# Countries & Cities Translation API

A multilingual API for countries and cities with Google Cloud Translation support, built for easy deployment with Docker Compose. Perfect for Coolify deployment.

## Features

- 🌍 **37 supported languages** for countries
- 🏙️ **Real-time city translation** using Google Cloud Translation
- 🚀 **Redis caching** for optimized performance
- 🔒 **API key and IP-based authentication**
- 🏁 **Country flag images** as data URLs
- 🐳 **Docker Compose** ready for easy deployment
- 📊 **RESTful API** with comprehensive endpoints

## Supported Languages

The API supports **37 languages** based on the countries dataset:

`ar`, `bg`, `br`, `cs`, `da`, `de`, `el`, `en`, `eo`, `es`, `et`, `eu`, `fa`, `fi`, `fr`, `hr`, `hu`, `hy`, `it`, `ja`, `ko`, `lt`, `nl`, `no`, `pl`, `pt`, `ro`, `ru`, `sk`, `sl`, `sr`, `sv`, `th`, `tr`, `uk`, `zh`, `zh-tw`

## Quick Start

### 1. Clone and Setup

```bash
git clone <your-repo>
cd countries-cities-translated
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file with your configuration:

```env
# Required for Google Cloud Translation
GOOGLE_CLOUD_API_KEY=your-google-cloud-api-key

# Optional: For enhanced city data
COUNTRY_STATE_CITY_API_KEY=your-api-key

# Optional: Security
ALLOWED_API_KEYS=your-api-key-1,your-api-key-2
ALLOWED_IPS=192.168.1.100,10.0.0.5
```

### 3. Get Google Cloud Translation API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the **Cloud Translation API**
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > API Key**
6. Copy the API key to your `.env` file

### 4. Deploy with Docker Compose

```bash
# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop services
docker-compose down
```

## API Endpoints

### Base URL
`http://localhost:3000`

### Countries API

#### Get All Countries
```http
GET /api/countries/all?lang=en&flag=true
```

**Parameters:**
- `lang` or `languages`: Language code(s) (comma-separated)
- `flag`: Include flag data URL (`true`/`false`)
- `limit`: Limit number of results

**Example Response:**
```json
{
  "success": true,
  "languages": ["en"],
  "count": 195,
  "countries": [
    {
      "id": 4,
      "alpha2": "af",
      "alpha3": "afg",
      "names": {
        "en": "Afghanistan"
      },
      "flag": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    }
  ]
}
```

**Without Flag Data URL (`flag=false` or omitted):**
```json
{
  "success": true,
  "languages": ["en"],
  "count": 195,
  "countries": [
    {
      "id": 4,
      "alpha2": "af",
      "alpha3": "afg", 
      "names": {
        "en": "Afghanistan"
      }
    }
  ]
}
```

#### Search Countries
```http
GET /api/countries/search?q=United&lang=en,fr&flag=true
```

#### Get Country by Code
```http
GET /api/countries/US?lang=en,es&flag=true
```

#### Get Supported Languages
```http
GET /api/countries/languages
```

### Cities API

#### Get All Cities for Country
```http
GET /api/cities/LB?lang=ar
```

**Parameters:**
- `lang` or `language`: Target language for translation
- `q` or `query`: Search query (optional)

**Example Response:**
```json
{
  "success": true,
  "country": {
    "id": 422,
    "alpha2": "lb",
    "alpha3": "lbn",
    "names": {
      "en": "Lebanon"
    }
  },
  "countryCode": "LB",
  "language": "ar",
  "count": 5,
  "cities": [
    {
      "id": 1,
      "name": "بيروت",
      "originalName": "Beirut",
      "stateCode": "BA",
      "stateName": "Beirut",
      "countryCode": "LB",
      "latitude": "33.8938",
      "longitude": "35.5018"
    }
  ],
  "fromCache": false
}
```

#### Search Cities
```http
GET /api/cities/search?country=LB&q=beirut&lang=ar
```

Or:

```http
GET /api/cities/LB?q=beirut&lang=ar
```

## Authentication

### Open Access (Default)
By default, if you **don't set** `ALLOWED_API_KEYS` or `ALLOWED_IPS` environment variables, the API allows **unrestricted access** from any IP address.

### API Key Authentication (Optional)
Set `ALLOWED_API_KEYS` in your environment to restrict access by API key:

```http
GET /api/countries/all
X-API-Key: your-api-key
```

Or as query parameter:
```http
GET /api/countries/all?api_key=your-api-key
```

### IP-based Authentication (Optional)
Set `ALLOWED_IPS` in your environment to restrict access by IP address:

```env
ALLOWED_IPS=192.168.1.100,10.0.0.5,203.0.113.0
```

### Combined Authentication
You can use both API keys and IP restrictions. Users need either a valid API key **OR** an allowed IP address to access the API.

## Deployment on Coolify

1. **Create New Project** in Coolify
2. **Set Source** to your Git repository
3. **Environment Variables:**
   ```
   GOOGLE_CLOUD_API_KEY=your-google-cloud-api-key
   ALLOWED_API_KEYS=your-api-keys
   ALLOWED_IPS=your-allowed-ips
   ```
4. **Deploy** - Coolify will automatically use the `docker-compose.yml`

**No JSON files needed!** Just set the environment variables and deploy.

## Development

### Local Development
```bash
npm install
npm run dev
```

### Testing
```bash
npm test
```

### Docker Development
```bash
# Development with hot reload
docker-compose -f docker-compose.dev.yml up
```

## Architecture

- **Express.js** - Web framework
- **Redis** - Caching layer for translations and cities data
- **Google Cloud Translation** - Real-time translation service
- **Docker Compose** - Container orchestration
- **Country State City API** - Enhanced city data (optional)

## Caching Strategy

- **Countries**: Loaded once from JSON file (in memory)
- **Cities Raw Data**: Cached permanently (never expires)
- **Translated Cities**: Cached permanently (never expires)
- **Translations**: Cached permanently (never expires)
- **Supported Languages**: Cached permanently (never expires)

**Cost Optimization:** All translations are cached permanently to minimize Google Cloud Translation API costs. City names and country names don't change, so there's no need to re-translate them.

## Data Persistence

Redis is configured with **dual persistence** for maximum data safety:

- **RDB Snapshots**: Automatic saves every 15 minutes (if changes), 5 minutes (if 10+ changes), 1 minute (if 10,000+ changes)
- **AOF (Append Only File)**: Real-time append-only logging with `fsync` every second
- **Auto-rewrite**: AOF file compaction when it grows 100% larger than 64MB

Data survives container restarts and system reboots automatically.

## Error Handling

The API provides comprehensive error responses:

```json
{
  "success": false,
  "error": "Country not found",
  "message": "No country found with code: XX"
}
```

## Rate Limiting

- **Default**: 1000 requests per 15 minutes per IP
- **Configurable** via environment variables

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the API documentation at `http://localhost:3000`
- Review logs: `docker-compose logs -f api`
- Ensure Google Cloud API key is properly configured