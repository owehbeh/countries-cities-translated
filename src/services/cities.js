const fs = require('fs');
const path = require('path');
const { cacheGet, cacheSet, cacheDelete } = require('../config/redis');
const { translateCityNames } = require('./translation');
const { getCountryByCode } = require('./countries');

let subdivisionsData = null;

const loadSubdivisions = () => {
  if (!subdivisionsData) {
    const subdivisionsPath = path.join(__dirname, '../../assets/subdivisions/subdivisions.json');
    subdivisionsData = JSON.parse(fs.readFileSync(subdivisionsPath, 'utf8'));
  }
  return subdivisionsData;
};

const getCitiesFromLocalData = async (countryCode) => {
  try {
    const cacheKey = `cities_raw:${countryCode.toLowerCase()}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return cached;
    }

    const subdivisions = loadSubdivisions();
    const countrySubdivisions = subdivisions.filter(
      sub => sub.country === countryCode.toUpperCase()
    );

    const cities = countrySubdivisions.map((subdivision, index) => ({
      id: index + 1,
      name: subdivision.name,
      stateCode: subdivision.code.split('-')[1],
      stateName: subdivision.name,
      countryCode: subdivision.country,
      latitude: null,
      longitude: null,
      type: subdivision.type
    }));

    // Cache empty results for shorter time (1 hour) vs full results (forever)
    const expiration = cities.length === 0 ? 3600 : 0;
    await cacheSet(cacheKey, cities, expiration);
    return cities;
  } catch (error) {
    console.error(`Error loading cities for ${countryCode}:`, error.message);
    throw error;
  }
};


const getCitiesWithTranslation = async (countryCode, languageCode = 'en', searchQuery = null) => {
  try {
    const country = await getCountryByCode(countryCode, ['en']);
    if (!country) {
      throw new Error(`Country not found: ${countryCode}`);
    }

    const cacheKey = `cities_translated:${countryCode.toLowerCase()}:${languageCode}:${searchQuery || 'all'}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return {
        ...cached,
        fromCache: true
      };
    }

    let cities = await getCitiesFromLocalData(countryCode);
    let translatedCities = cities;

    if (languageCode !== 'en' && cities.length > 0) {
      try {
        translatedCities = await translateCityNames(cities, languageCode, 'en');
      } catch (error) {
        console.error('Translation failed, returning original names:', error.message);
        translatedCities = cities.map(city => ({
          ...city,
          originalName: city.name,
          translationError: true
        }));
      }
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      translatedCities = translatedCities.filter(city => {
        // Search in original English name
        const matchesOriginal = (city.originalName || city.name).toLowerCase().includes(lowerQuery);
        
        // Search in translated name (if different from original)
        const matchesTranslated = languageCode !== 'en' && 
          city.name.toLowerCase().includes(lowerQuery);
        
        // Search in state/subdivision name
        const matchesState = city.stateName && city.stateName.toLowerCase().includes(lowerQuery);
        
        return matchesOriginal || matchesTranslated || matchesState;
      });
    }

    const result = {
      country: country,
      countryCode: countryCode.toUpperCase(),
      language: languageCode,
      searchQuery: searchQuery,
      count: translatedCities.length,
      cities: translatedCities,
      fromCache: false
    };

    await cacheSet(cacheKey, result, 0); // No expiration - persist forever
    return result;
  } catch (error) {
    console.error('Error in getCitiesWithTranslation:', error);
    throw error;
  }
};

const searchCities = async (countryCode, languageCode = 'en', searchQuery) => {
  if (!searchQuery || searchQuery.trim() === '') {
    throw new Error('Search query is required');
  }

  return await getCitiesWithTranslation(countryCode, languageCode, searchQuery.trim());
};

const getAllCitiesForCountry = async (countryCode, languageCode = 'en') => {
  return await getCitiesWithTranslation(countryCode, languageCode, null);
};

const clearCityCache = async (countryCode) => {
  try {
    const rawCacheKey = `cities_raw:${countryCode.toLowerCase()}`;
    await cacheDelete(rawCacheKey);
    
    // Clear all translated cache entries for this country (approximate - clears common languages)
    const languages = ['en', 'ar', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ja'];
    const clearPromises = languages.map(lang => 
      cacheDelete(`cities_translated:${countryCode.toLowerCase()}:${lang}:all`)
    );
    await Promise.all(clearPromises);
    
    return true;
  } catch (error) {
    console.error(`Error clearing cache for ${countryCode}:`, error);
    return false;
  }
};

module.exports = {
  getCitiesFromLocalData,
  getCitiesWithTranslation,
  searchCities,
  getAllCitiesForCountry,
  clearCityCache
};