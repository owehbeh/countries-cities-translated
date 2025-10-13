# Countries & Cities Translation API

A multilingual REST API for countries and cities with Google Cloud Translation support.

## 🌍 Why This Project Exists

In today's globalized world, applications need to serve users in their native languages. However, maintaining a comprehensive database of countries and cities translated into dozens of languages presents a significant challenge:

**The Challenge:** Traditional approaches require either:
- Pre-translating and storing all geographical data in all supported languages (expensive storage and maintenance)
- Using third-party APIs for every request (costly and dependent on external services)
- Limiting language support (poor user experience)

**The Solution:** This API provides an intelligent, cost-effective approach by combining:
- **Local data storage** for countries and subdivisions in English
- **On-demand translation** using Google Cloud Translation API
- **Persistent Redis caching** to translate each term only once
- **Self-hosted deployment** for complete control and privacy

**The Result:** You get worldwide geographical data in 37+ languages without breaking the bank. Each city name is translated only once and cached permanently, making subsequent requests lightning-fast and cost-free.

## 🏗️ How It Works

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │    │   Express API    │    │  Local JSON     │
│                 │───▶│                  │───▶│  Countries &    │
│ ?lang=ar        │    │  Authentication  │    │  Cities Data    │
│ ?q=beirut       │    │  Rate Limiting   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        │
                       ┌──────────────────┐              │
                       │   Redis Cache    │              │
                       │                  │              │
                       │ Check if "beirut"│              │
                       │ exists in Arabic │              │
                       └──────────────────┘              │
                                │                        │
                         Cache Hit? ────────────────────▶│
                                │                        │
                                ▼ (Cache Miss)           │
                       ┌──────────────────┐              │
                       │ Google Cloud     │              │
                       │ Translation API  │              │
                       │                  │              │
                       │ Translate        │              │
                       │ "beirut" → "بيروت"│              │
                       └──────────────────┘              │
                                │                        │
                                ▼                        │
                       ┌──────────────────┐              │
                       │ Store in Redis   │              │
                       │ (Permanent)      │              │
                       │                  │              │
                       │ Key: beirut_ar   │              │
                       │ Value: بيروت      │              │
                       └──────────────────┘              │
                                │                        │
                                ▼                        │
                       ┌──────────────────┐              │
                       │ Return Response  │◀─────────────┘
                       │                  │
                       │ {                │
                       │   "name": "بيروت", │
                       │   "country": "LB" │
                       │ }                │
                       └──────────────────┘
```

### Key Benefits:
- **Cost Optimization**: Each translation happens only once, then cached forever
- **Performance**: Subsequent requests served from Redis cache (sub-millisecond response)
- **Scalability**: Self-hosted solution with no external API dependencies after initial translation
- **Reliability**: Data persists through restarts with Redis AOF + RDB persistence
- **Flexibility**: Support for 37+ languages with easy extensibility

## 🚀 Quick Start

```bash
# 1. Clone and setup
git clone <your-repo>
cd countries-cities-translated

# 2. Set environment variables
cp .env.example .env
# Edit .env with your Google Cloud API key

# 3. Run with Docker
docker-compose up -d

# 4. Access API
curl http://localhost:3000
```

## 📋 Environment Variables

**Required:**
```env
GOOGLE_CLOUD_API_KEY=your-google-cloud-api-key
```

**Optional:**
```env
ALLOWED_API_KEYS=key1,key2,key3
ALLOWED_IPS=192.168.1.100,10.0.0.5
REDIS_PASSWORD=your-redis-password
```

## 🌐 API Endpoints

### Countries
- `GET /api/countries/all?lang=en&flag=true` - All countries
- `GET /api/countries/search?q=United&lang=en` - Search countries
- `GET /api/countries/US?lang=ar&flag=true` - Get country by code

### Cities/Subdivisions
- `GET /api/cities/LB?lang=ar` - All subdivisions for Lebanon in Arabic
- `GET /api/cities/LB?q=beirut&lang=ar` - Search subdivisions
- `GET /api/cities/QA?lang=ar` - Qatar municipalities in Arabic
- `DELETE /api/cities/QA/cache` - Clear cache for Qatar
- `DELETE /api/cities/cache/all` - Clear all cities cache

### Supported Languages
37 languages supported: `ar`, `bg`, `br`, `cs`, `da`, `de`, `el`, `en`, `eo`, `es`, `et`, `eu`, `fa`, `fi`, `fr`, `hr`, `hu`, `hy`, `it`, `ja`, `ko`, `lt`, `nl`, `no`, `pl`, `pt`, `ro`, `ru`, `sk`, `sl`, `sr`, `sv`, `th`, `tr`, `uk`, `zh`, `zh-tw`

## 🐳 Docker Deployment

### Local Development
```bash
docker-compose up -d
# API: http://localhost:3000
# Redis: localhost:6379
```

### Production (Coolify/Any Platform)
```bash
# Set environment variables in your platform
docker-compose up -d
# Platform will handle routing
```

## 📊 Example Response

```json
{
  "success": true,
  "languages": ["ar"],
  "count": 1,
  "countries": [
    {
      "id": 422,
      "alpha2": "lb",
      "alpha3": "lbn",
      "names": {
        "ar": "لبنان"
      },
      "flag": "data:image/png;base64,iVBORw0..."
    }
  ]
}
```

## 💾 Data & Caching

- **Local subdivision data**: Uses built-in JSON files for cities/subdivisions
- **Redis caching**: All translations cached permanently
- **Data survives restarts**: Redis configured with AOF + RDB persistence
- **Cost optimization**: Google Cloud Translation called only once per translation

## 🔒 Security

- **Open by default**: No restrictions if no env vars set
- **API key auth**: Set `ALLOWED_API_KEYS` to restrict access
- **IP restrictions**: Set `ALLOWED_IPS` to limit by IP address

## 📈 Architecture

- **Express.js** - REST API framework
- **Local JSON data** - Built-in countries and subdivisions database
- **Redis** - Translation caching layer
- **Google Cloud Translation** - Real-time translation
- **Docker Compose** - Container orchestration

## 🛠️ Development

```bash
npm install
npm run dev
```

## 📄 License

MIT License
