const express = require('express');
const router = express.Router();
const {
  searchCities,
  getAllCitiesForCountry,
  clearCityCache
} = require('../services/cities');

router.get('/search', async (req, res) => {
  try {
    const { country, countryCode, lang, language, q, query } = req.query;
    
    const searchQuery = q || query;
    const countryParam = country || countryCode;
    const languageParam = lang || language || 'en';

    if (!countryParam) {
      return res.status(400).json({
        success: false,
        error: 'Country code is required',
        message: 'Please provide a country code using ?country= or ?countryCode= parameter'
      });
    }

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        message: 'Please provide a search query using ?q= or ?query= parameter'
      });
    }

    const result = await searchCities(countryParam, languageParam, searchQuery);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.message.includes('Country not found')) {
      return res.status(404).json({
        success: false,
        error: 'Country not found',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

router.get('/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { lang, language, q, query } = req.query;
    
    const languageParam = lang || language || 'en';
    const searchQuery = q || query;

    let result;
    if (searchQuery) {
      result = await searchCities(countryCode, languageParam, searchQuery);
    } else {
      result = await getAllCitiesForCountry(countryCode, languageParam);
    }

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.message.includes('Country not found')) {
      return res.status(404).json({
        success: false,
        error: 'Country not found',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cities',
      message: error.message
    });
  }
});

router.get('/', async (req, res) => {
  res.status(400).json({
    success: false,
    error: 'Country code is required',
    message: 'Please specify a country code in the URL path (e.g., /api/cities/US) or use the search endpoint with country parameter',
    examples: {
      getAllCitiesForCountry: '/api/cities/LB?lang=ar',
      searchCitiesInCountry: '/api/cities/LB?q=beirut&lang=ar',
      searchWithQueryParams: '/api/cities/search?country=LB&q=beirut&lang=ar'
    }
  });
});

router.delete('/:countryCode/cache', async (req, res) => {
  try {
    const { countryCode } = req.params;
    
    const success = await clearCityCache(countryCode);
    
    if (success) {
      res.json({
        success: true,
        message: `Cache cleared for country ${countryCode.toUpperCase()}`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache',
        message: `Could not clear cache for country ${countryCode.toUpperCase()}`
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Cache clearing failed',
      message: error.message
    });
  }
});

module.exports = router;