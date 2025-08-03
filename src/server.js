const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectRedis } = require('./config/redis');
const { initializeTranslation } = require('./services/translation');
const countriesRoutes = require('./routes/countries');
const citiesRoutes = require('./routes/cities');
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(limiter);

app.use(authMiddleware);

app.get('/', (req, res) => {
  res.json({
    message: 'Countries & Cities Translation API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      countries: '/api/countries',
      cities: '/api/cities'
    },
    supportedLanguages: [
      'ar', 'bg', 'br', 'cs', 'da', 'de', 'el', 'en', 'eo', 'es', 'et', 'eu',
      'fa', 'fi', 'fr', 'hr', 'hu', 'hy', 'it', 'ja', 'ko', 'lt', 'nl', 'no',
      'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'th', 'tr', 'uk', 'zh', 'zh-tw'
    ]
  });
});

app.use('/api/countries', countriesRoutes);
app.use('/api/cities', citiesRoutes);

app.use(errorHandler);

const startServer = async () => {
  let retries = 5;
  while (retries > 0) {
    try {
      await connectRedis();
      console.log('Redis connected successfully');
      
      initializeTranslation();
      
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`API Documentation: http://localhost:${PORT}`);
      });
      return;
    } catch (error) {
      retries--;
      console.error(`Failed to connect to Redis. Retries left: ${retries}`, error.message);
      if (retries === 0) {
        console.error('Failed to start server after multiple attempts');
        process.exit(1);
      }
      console.log('Retrying in 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

startServer();

module.exports = app;