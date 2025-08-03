const axios = require('axios');
const { cacheGet, cacheSet } = require('../config/redis');
const { translateCityNames } = require('./translation');
const { getCountryByCode } = require('./countries');

const getCitiesFromAPI = async (countryCode) => {
  try {
    const cacheKey = `cities_raw:${countryCode.toLowerCase()}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return cached;
    }

    const apiUrl = `https://api.countrystatecity.in/v1/countries/${countryCode.toUpperCase()}/cities`;
    const response = await axios.get(apiUrl, {
      headers: {
        'X-CSCAPI-KEY': process.env.COUNTRY_STATE_CITY_API_KEY || 'demo-key'
      }
    });

    const cities = response.data.map(city => ({
      id: city.id,
      name: city.name,
      stateCode: city.state_code,
      stateName: city.state_name,
      countryCode: city.country_code,
      latitude: city.latitude,
      longitude: city.longitude
    }));

    await cacheSet(cacheKey, cities, 0); // No expiration - persist forever
    return cities;
  } catch (error) {
    console.error(`Error fetching cities for ${countryCode}:`, error.message);
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

    let cities = await getCitiesFromAPI(countryCode);

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      cities = cities.filter(city => 
        city.name.toLowerCase().includes(lowerQuery) ||
        (city.stateName && city.stateName.toLowerCase().includes(lowerQuery))
      );
    }

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

module.exports = {
  getCitiesFromAPI,
  getCitiesWithTranslation,
  searchCities,
  getAllCitiesForCountry
};