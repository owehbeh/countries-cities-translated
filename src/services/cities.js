const fs = require('fs');
const path = require('path');
const { cacheGet, cacheSet, cacheDelete } = require('../config/redis');
const { translateCityNames, translateText } = require('./translation');
const { getCountryByCode } = require('./countries');

let subdivisionsData = null;
let allCitiesData = null;

const normalizeForSearch = (value) => {
  if (!value) {
    return '';
  }

  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`´ˊˋ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
};

const levenshteinDistance = (a, b) => {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }

  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }

  return matrix[a.length][b.length];
};

const matchesSearchTerm = (value, rawLowerQuery, normalizedQuery) => {
  if (!value) {
    return false;
  }

  const lowerValue = value.toString().toLowerCase();
  if (rawLowerQuery && lowerValue.includes(rawLowerQuery)) {
    return true;
  }

  const normalizedValue = normalizeForSearch(value);
  if (!normalizedValue) {
    return false;
  }

  if (normalizedQuery && normalizedValue.includes(normalizedQuery)) {
    return true;
  }

  if (!normalizedQuery || normalizedQuery.length < 4) {
    return false;
  }

  const tokens = normalizedValue.split(' ').filter(Boolean);
  const firstLetter = normalizedQuery[0];
  const maxAllowedDistance = (length) => {
    if (length <= 3) {
      return 0;
    }
    return Math.max(2, Math.ceil(Math.max(length, normalizedQuery.length) * 0.4));
  };

  return tokens.some(token => {
    if (!token) {
      return false;
    }

    if (token[0] !== firstLetter) {
      return false;
    }

    const distance = levenshteinDistance(token, normalizedQuery);
    return distance <= maxAllowedDistance(token.length);
  });
};

const filterCitiesByQuery = (citiesList, query, languageCode) => {
  if (!query) {
    return citiesList;
  }

  const rawLowerQuery = query.toLowerCase();
  const normalizedQuery = normalizeForSearch(query);

  return citiesList.filter(city => {
    const originalName = city.originalName || city.name;
    const matchesOriginal = matchesSearchTerm(originalName, rawLowerQuery, normalizedQuery);
    const matchesTranslated = matchesSearchTerm(city.name, rawLowerQuery, normalizedQuery);
    const matchesState = city.stateName && matchesSearchTerm(city.stateName, rawLowerQuery, normalizedQuery);
    const matchesStateCode = city.stateCode && matchesSearchTerm(city.stateCode, rawLowerQuery, normalizedQuery);

    if (languageCode === 'en') {
      return matchesOriginal || matchesState || matchesStateCode;
    }

    return matchesOriginal || matchesTranslated || matchesState || matchesStateCode;
  });
};

const searchCitiesGlobal = async (languageCode = 'en', searchQuery) => {
  const trimmedQuery = searchQuery.trim();
  const normalizedCacheKeyPart = normalizeForSearch(trimmedQuery) || trimmedQuery.toLowerCase();
  const cacheKey = `cities_translated:global:${languageCode}:${normalizedCacheKeyPart || 'empty'}`;

  const cached = await cacheGet(cacheKey);
  if (cached) {
    return {
      ...cached,
      fromCache: true
    };
  }

  const allCities = getAllCitiesFromLocalData();
  const searchMetadata = {
    originalQuery: trimmedQuery,
    resolvedQuery: trimmedQuery,
    alternateQuery: null
  };

  let filteredCities = filterCitiesByQuery(allCities, trimmedQuery, languageCode);

  if (
    filteredCities.length === 0 &&
    process.env.GOOGLE_CLOUD_API_KEY &&
    trimmedQuery.length > 0
  ) {
    try {
      const translatedQuery = await translateText(trimmedQuery, 'en', 'auto');
      if (translatedQuery && translatedQuery.toLowerCase() !== trimmedQuery.toLowerCase()) {
        const fallbackCities = filterCitiesByQuery(allCities, translatedQuery, 'en');
        if (fallbackCities.length > 0) {
          filteredCities = fallbackCities;
          searchMetadata.resolvedQuery = translatedQuery;
          searchMetadata.alternateQuery = translatedQuery;
        }
      }
    } catch (error) {
      console.error('Global city search translation failed:', error.message);
    }
  }

  let translatedCities = filteredCities;
  if (translatedCities.length > 0 && languageCode !== 'en') {
    try {
      translatedCities = await translateCityNames(translatedCities, languageCode, 'en');
    } catch (error) {
      console.error('Global city name translation failed:', error.message);
      translatedCities = filteredCities.map(city => ({
        ...city,
        originalName: city.name,
        translationError: true
      }));
    }
  }

  const uniqueCountryCodes = Array.from(
    new Set(translatedCities.map(city => city.countryCode).filter(Boolean))
  );

  const result = {
    language: languageCode,
    searchQuery: trimmedQuery,
    resolvedSearchQuery: searchMetadata.resolvedQuery,
    alternateSearchQuery: searchMetadata.alternateQuery,
    count: translatedCities.length,
    cities: translatedCities,
    countries: uniqueCountryCodes,
    isGlobalSearch: true,
    fromCache: false
  };

  await cacheSet(cacheKey, result, 0);
  return result;
};

const loadSubdivisions = () => {
  if (!subdivisionsData) {
    const subdivisionsPath = path.join(__dirname, '../../assets/subdivisions/subdivisions.json');
    subdivisionsData = JSON.parse(fs.readFileSync(subdivisionsPath, 'utf8'));
  }
  return subdivisionsData;
};

const extractStateCode = (code) => {
  if (!code) {
    return null;
  }
  const parts = code.split('-');
  return parts.length > 1 ? parts.slice(1).join('-') : code;
};

const mapSubdivisionToCity = (subdivision, index) => ({
  id: index + 1,
  name: subdivision.name,
  stateCode: extractStateCode(subdivision.code),
  stateName: subdivision.name,
  countryCode: subdivision.country,
  latitude: null,
  longitude: null,
  type: subdivision.type,
  parent: subdivision.parent || null
});

const getAllCitiesFromLocalData = () => {
  if (!allCitiesData) {
    const subdivisions = loadSubdivisions();
    allCitiesData = subdivisions.map((subdivision, index) => mapSubdivisionToCity(subdivision, index));
  }
  return allCitiesData;
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

    const cities = countrySubdivisions.map((subdivision, index) =>
      mapSubdivisionToCity(subdivision, index)
    );

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

    let searchMetadata = {
      originalQuery: searchQuery || null,
      resolvedQuery: searchQuery || null,
      alternateQuery: null
    };

    if (searchQuery) {
      let filteredCities = filterCitiesByQuery(translatedCities, searchQuery, languageCode);

      if (
        filteredCities.length === 0 &&
        process.env.GOOGLE_CLOUD_API_KEY &&
        searchQuery.trim().length > 0
      ) {
        try {
          const translatedQuery = await translateText(searchQuery, 'en', 'auto');
          if (translatedQuery && translatedQuery.toLowerCase() !== searchQuery.toLowerCase()) {
            const fallbackCities = filterCitiesByQuery(translatedCities, translatedQuery, 'en');
            if (fallbackCities.length > 0) {
              filteredCities = fallbackCities;
              searchMetadata.resolvedQuery = translatedQuery;
              searchMetadata.alternateQuery = translatedQuery;
            }
          }
        } catch (error) {
          console.error('Search query translation failed:', error.message);
        }
      }

      translatedCities = filteredCities;
    }

    const result = {
      country: country,
      countryCode: countryCode.toUpperCase(),
      language: languageCode,
      searchQuery: searchQuery,
      resolvedSearchQuery: searchMetadata.resolvedQuery,
      alternateSearchQuery: searchMetadata.alternateQuery,
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

  const trimmedQuery = searchQuery.trim();

  if (!countryCode) {
    return await searchCitiesGlobal(languageCode, trimmedQuery);
  }

  return await getCitiesWithTranslation(countryCode, languageCode, trimmedQuery);
};

const getAllCitiesForCountry = async (countryCode, languageCode = 'en') => {
  return await getCitiesWithTranslation(countryCode, languageCode, null);
};

const clearCityCache = async (countryCode) => {
  try {
    const rawCacheKey = `cities_raw:${countryCode.toLowerCase()}`;
    await cacheDelete(rawCacheKey);
    allCitiesData = null;
    subdivisionsData = null;
    
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

const clearAllCitiesCache = async () => {
  try {
    const { getRedisClient } = require('../config/redis');
    const client = getRedisClient();
    
    // Get all cache keys matching cities patterns
    const rawKeys = await client.keys('cities_raw:*');
    const translatedKeys = await client.keys('cities_translated:*');
    
    const allKeys = [...rawKeys, ...translatedKeys];
    
    if (allKeys.length > 0) {
      await client.del(allKeys);
      console.log(`Cleared ${allKeys.length} cities cache entries`);
    }
    allCitiesData = null;
    subdivisionsData = null;
    
    return {
      success: true,
      clearedKeys: allKeys.length,
      message: `Cleared ${allKeys.length} cities cache entries`
    };
  } catch (error) {
    console.error('Error clearing all cities cache:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  getCitiesFromLocalData,
  getCitiesWithTranslation,
  searchCities,
  searchCitiesGlobal,
  getAllCitiesForCountry,
  clearCityCache,
  clearAllCitiesCache
};
