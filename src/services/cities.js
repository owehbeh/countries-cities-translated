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
    
    return getDemoOrMockCities(countryCode);
  }
};

const getDemoOrMockCities = (countryCode) => {
  const mockCities = {
    'LB': [
      { id: 1, name: 'Beirut', stateCode: 'BA', stateName: 'Beirut', countryCode: 'LB', latitude: '33.8938', longitude: '35.5018' },
      { id: 2, name: 'Tripoli', stateCode: 'AS', stateName: 'North', countryCode: 'LB', latitude: '34.4332', longitude: '35.8498' },
      { id: 3, name: 'Sidon', stateCode: 'JA', stateName: 'South', countryCode: 'LB', latitude: '33.5633', longitude: '35.3695' },
      { id: 4, name: 'Tyre', stateCode: 'JA', stateName: 'South', countryCode: 'LB', latitude: '33.2704', longitude: '35.2038' },
      { id: 5, name: 'Jounieh', stateCode: 'JL', stateName: 'Mount Lebanon', countryCode: 'LB', latitude: '33.9811', longitude: '35.6173' }
    ],
    'US': [
      { id: 1, name: 'New York', stateCode: 'NY', stateName: 'New York', countryCode: 'US', latitude: '40.7128', longitude: '-74.0060' },
      { id: 2, name: 'Los Angeles', stateCode: 'CA', stateName: 'California', countryCode: 'US', latitude: '34.0522', longitude: '-118.2437' },
      { id: 3, name: 'Chicago', stateCode: 'IL', stateName: 'Illinois', countryCode: 'US', latitude: '41.8781', longitude: '-87.6298' }
    ],
    'FR': [
      { id: 1, name: 'Paris', stateCode: 'IDF', stateName: 'Île-de-France', countryCode: 'FR', latitude: '48.8566', longitude: '2.3522' },
      { id: 2, name: 'Marseille', stateCode: 'PAC', stateName: 'Provence-Alpes-Côte dAzur', countryCode: 'FR', latitude: '43.2965', longitude: '5.3698' },
      { id: 3, name: 'Lyon', stateCode: 'ARA', stateName: 'Auvergne-Rhône-Alpes', countryCode: 'FR', latitude: '45.7640', longitude: '4.8357' }
    ]
  };

  return mockCities[countryCode.toUpperCase()] || [];
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
  getAllCitiesForCountry,
  getDemoOrMockCities
};