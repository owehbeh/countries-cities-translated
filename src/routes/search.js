const express = require('express');
const router = express.Router();

const { searchCountries } = require('../services/countries');
const { searchCities } = require('../services/cities');

const parseLimit = (limitValue) => {
  if (!limitValue) {
    return null;
  }

  const parsed = parseInt(limitValue, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const getLanguageList = (lang, languages) => {
  if (languages) {
    return languages
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (lang) {
    return [lang.trim()];
  }

  return ['en'];
};

router.get('/', async (req, res) => {
  try {
    const {
      q,
      query,
      type = 'country',
      lang,
      languages,
      limit,
      flag,
      country,
      countryCode
    } = req.query;

    const searchQuery = (q || query || '').trim();
    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        message: 'Please provide a search query using ?q= or ?query= parameter'
      });
    }

    const normalizedType = type.toLowerCase();
    const limitValue = parseLimit(limit);

    if (normalizedType === 'country') {
      const languageList = getLanguageList(lang, languages);
      const includeFlagDataUrl = flag === 'true' || flag === '1';

      let countries = await searchCountries(searchQuery, languageList, includeFlagDataUrl);
      if (limitValue) {
        countries = countries.slice(0, limitValue);
      }

      return res.json({
        success: true,
        type: 'country',
        query: searchQuery,
        languages: languageList,
        count: countries.length,
        countries
      });
    }

    if (normalizedType === 'city') {
      const countryParam = countryCode || country || null;
      const languageCode = lang ? lang.trim() : 'en';
      const searchResult = await searchCities(countryParam, languageCode, searchQuery);

      let cities = searchResult.cities || [];
      if (limitValue) {
        cities = cities.slice(0, limitValue);
      }

      const responsePayload = {
        success: true,
        type: 'city',
        scope: searchResult.isGlobalSearch ? 'global' : 'country',
        query: searchQuery,
        language: searchResult.language,
        resolvedQuery: searchResult.resolvedSearchQuery || searchResult.searchQuery,
        alternateQuery: searchResult.alternateSearchQuery || null,
        fromCache: !!searchResult.fromCache,
        count: cities.length,
        cities
      };

      if (searchResult.isGlobalSearch) {
        responsePayload.countries = searchResult.countries || [];
      } else {
        responsePayload.country = searchResult.country;
        responsePayload.countryCode = searchResult.countryCode;
      }

      return res.json(responsePayload);
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid type parameter',
      message: "Supported values for 'type' are 'country' and 'city'"
    });
  } catch (error) {
    console.error('Unified search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

module.exports = router;
