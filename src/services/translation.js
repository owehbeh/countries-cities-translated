const axios = require('axios');
const { cacheGet, cacheSet } = require('../config/redis');

const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';

const initializeTranslation = () => {
  if (!process.env.GOOGLE_CLOUD_API_KEY) {
    console.warn('Google Cloud Translation API key not configured. Translation features will be limited.');
    return false;
  }

  console.log('Google Cloud Translation REST API initialized');
  return true;
};

const translateText = async (text, targetLanguage, sourceLanguage = 'en') => {
  if (!process.env.GOOGLE_CLOUD_API_KEY) {
    throw new Error('Google Cloud Translation API key not configured');
  }

  const normalizedSource = !sourceLanguage || sourceLanguage === 'auto' ? 'auto' : sourceLanguage;
  const cacheKey = `translation:${normalizedSource}:${targetLanguage}:${text}`;
  
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return cached;
    }

    const requestBody = {
      q: text,
      target: targetLanguage,
      format: 'text'
    };

    if (normalizedSource !== 'auto') {
      requestBody.source = normalizedSource;
    }

    const response = await axios.post(GOOGLE_TRANSLATE_API_URL, requestBody, {
      params: {
        key: process.env.GOOGLE_CLOUD_API_KEY
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const translation = response.data.data.translations[0].translatedText;
    await cacheSet(cacheKey, translation, 0); // No expiration - persist forever
    return translation;
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error(`Failed to translate text: ${error.message}`);
  }
};

const translateCityNames = async (cities, targetLanguage, sourceLanguage = 'en') => {
  if (!process.env.GOOGLE_CLOUD_API_KEY) {
    throw new Error('Google Cloud Translation API key not configured');
  }

  const cacheKey = `cities_translation:${sourceLanguage}:${targetLanguage}:${JSON.stringify(cities.map(c => c.name))}`;
  
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return cached;
    }

    const textsToTranslate = cities.map(city => city.name);
    
    if (textsToTranslate.length === 0) {
      return cities;
    }

    const response = await axios.post(GOOGLE_TRANSLATE_API_URL, {
      q: textsToTranslate,
      source: sourceLanguage,
      target: targetLanguage,
      format: 'text'
    }, {
      params: {
        key: process.env.GOOGLE_CLOUD_API_KEY
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const translations = response.data.data.translations.map(t => t.translatedText);

    const translatedCities = cities.map((city, index) => ({
      ...city,
      name: translations[index] || city.name,
      originalName: city.name
    }));

    await cacheSet(cacheKey, translatedCities, 0); // No expiration - persist forever
    return translatedCities;
  } catch (error) {
    console.error('Cities translation error:', error);
    return cities.map(city => ({
      ...city,
      originalName: city.name,
      translationError: true
    }));
  }
};

const getSupportedLanguages = async () => {
  const defaultLanguages = [
    'ar', 'bg', 'br', 'cs', 'da', 'de', 'el', 'en', 'eo', 'es', 'et', 'eu',
    'fa', 'fi', 'fr', 'hr', 'hu', 'hy', 'it', 'ja', 'ko', 'lt', 'nl', 'no',
    'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'th', 'tr', 'uk', 'zh', 'zh-tw'
  ];

  if (!process.env.GOOGLE_CLOUD_API_KEY) {
    return defaultLanguages;
  }

  try {
    const cacheKey = 'supported_languages';
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await axios.get('https://translation.googleapis.com/language/translate/v2/languages', {
      params: {
        key: process.env.GOOGLE_CLOUD_API_KEY,
        model: 'base'
      }
    });

    const supportedCodes = response.data.data.languages.map(lang => lang.language);
    
    await cacheSet(cacheKey, supportedCodes, 0); // No expiration - persist forever
    return supportedCodes;
  } catch (error) {
    console.error('Error getting supported languages:', error);
    return defaultLanguages;
  }
};

module.exports = {
  initializeTranslation,
  translateText,
  translateCityNames,
  getSupportedLanguages
};
