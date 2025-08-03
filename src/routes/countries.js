const express = require('express');
const router = express.Router();
const {
  getAllCountries,
  searchCountries,
  getCountryByCode,
  getSupportedLanguages
} = require('../services/countries');

router.get('/languages', (req, res) => {
  try {
    const languages = getSupportedLanguages();
    res.json({
      success: true,
      count: languages.length,
      languages: languages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported languages',
      message: error.message
    });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q, query, lang, languages, flag } = req.query;
    
    const searchQuery = q || query;
    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        message: 'Please provide a search query using ?q= or ?query= parameter'
      });
    }

    let languageList = [];
    if (languages) {
      languageList = languages.split(',').map(l => l.trim());
    } else if (lang) {
      languageList = [lang.trim()];
    } else {
      languageList = ['en'];
    }

    const includeFlagDataUrl = flag === 'true' || flag === '1';

    const results = await searchCountries(searchQuery, languageList, includeFlagDataUrl);

    res.json({
      success: true,
      query: searchQuery,
      languages: languageList,
      count: results.length,
      countries: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

router.get('/all', async (req, res) => {
  try {
    const { lang, languages, flag, limit } = req.query;

    let languageList = [];
    if (languages) {
      languageList = languages.split(',').map(l => l.trim());
    } else if (lang) {
      languageList = [lang.trim()];
    } else {
      languageList = ['en'];
    }

    const includeFlagDataUrl = flag === 'true' || flag === '1';

    let results = await getAllCountries(languageList, includeFlagDataUrl);

    if (limit) {
      const limitNum = parseInt(limit);
      if (!isNaN(limitNum) && limitNum > 0) {
        results = results.slice(0, limitNum);
      }
    }

    res.json({
      success: true,
      languages: languageList,
      count: results.length,
      countries: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve countries',
      message: error.message
    });
  }
});

router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { lang, languages, flag } = req.query;

    let languageList = [];
    if (languages) {
      languageList = languages.split(',').map(l => l.trim());
    } else if (lang) {
      languageList = [lang.trim()];
    } else {
      languageList = ['en'];
    }

    const includeFlagDataUrl = flag === 'true' || flag === '1';

    const country = await getCountryByCode(code, languageList, includeFlagDataUrl);

    if (!country) {
      return res.status(404).json({
        success: false,
        error: 'Country not found',
        message: `No country found with code: ${code}`
      });
    }

    res.json({
      success: true,
      languages: languageList,
      country: country
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve country',
      message: error.message
    });
  }
});

module.exports = router;