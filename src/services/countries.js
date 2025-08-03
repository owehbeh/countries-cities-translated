const fs = require('fs');
const path = require('path');
const axios = require('axios');

let countriesData = null;

const loadCountriesData = () => {
  if (countriesData) {
    return countriesData;
  }

  try {
    const dataPath = path.join(__dirname, '../../assets/countries/_combined/countries.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    countriesData = JSON.parse(rawData);
    console.log(`Loaded ${countriesData.length} countries`);
    return countriesData;
  } catch (error) {
    console.error('Error loading countries data:', error);
    throw new Error('Failed to load countries data');
  }
};

const getSupportedLanguages = () => {
  return [
    'ar', 'bg', 'br', 'cs', 'da', 'de', 'el', 'en', 'eo', 'es', 'et', 'eu',
    'fa', 'fi', 'fr', 'hr', 'hu', 'hy', 'it', 'ja', 'ko', 'lt', 'nl', 'no',
    'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'th', 'tr', 'uk', 'zh', 'zh-tw'
  ];
};

const getCountryFlagDataUrl = async (countryCode) => {
  try {
    const flagUrl = `https://flagcdn.com/w320/${countryCode.toLowerCase()}.png`;
    const response = await axios.get(flagUrl, { responseType: 'arraybuffer' });
    const base64 = Buffer.from(response.data).toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error(`Error fetching flag for ${countryCode}:`, error.message);
    return null;
  }
};

const formatCountryResponse = async (country, languages = ['en'], includeFlagDataUrl = false) => {
  const response = {
    id: country.id,
    alpha2: country.alpha2,
    alpha3: country.alpha3,
    names: {}
  };

  languages.forEach(lang => {
    if (country[lang]) {
      response.names[lang] = country[lang];
    }
  });

  if (includeFlagDataUrl) {
    response.flag = await getCountryFlagDataUrl(country.alpha2);
  }

  return response;
};

const getAllCountries = async (languages = ['en'], includeFlagDataUrl = false) => {
  const countries = loadCountriesData();
  const supportedLangs = getSupportedLanguages();
  
  const validLanguages = languages.filter(lang => supportedLangs.includes(lang));
  if (validLanguages.length === 0) {
    validLanguages.push('en');
  }

  const promises = countries.map(country => 
    formatCountryResponse(country, validLanguages, includeFlagDataUrl)
  );

  return await Promise.all(promises);
};

const searchCountries = async (query, languages = ['en'], includeFlagDataUrl = false) => {
  const countries = loadCountriesData();
  const supportedLangs = getSupportedLanguages();
  
  const validLanguages = languages.filter(lang => supportedLangs.includes(lang));
  if (validLanguages.length === 0) {
    validLanguages.push('en');
  }

  const lowerQuery = query.toLowerCase();
  
  const filteredCountries = countries.filter(country => {
    return validLanguages.some(lang => {
      const name = country[lang];
      return name && name.toLowerCase().includes(lowerQuery);
    }) || 
    country.alpha2.toLowerCase().includes(lowerQuery) ||
    country.alpha3.toLowerCase().includes(lowerQuery);
  });

  const promises = filteredCountries.map(country => 
    formatCountryResponse(country, validLanguages, includeFlagDataUrl)
  );

  return await Promise.all(promises);
};

const getCountryByCode = async (code, languages = ['en'], includeFlagDataUrl = false) => {
  const countries = loadCountriesData();
  const supportedLangs = getSupportedLanguages();
  
  const validLanguages = languages.filter(lang => supportedLangs.includes(lang));
  if (validLanguages.length === 0) {
    validLanguages.push('en');
  }

  const upperCode = code.toUpperCase();
  const country = countries.find(c => 
    c.alpha2.toUpperCase() === upperCode || 
    c.alpha3.toUpperCase() === upperCode ||
    c.id.toString() === code
  );

  if (!country) {
    return null;
  }

  return await formatCountryResponse(country, validLanguages, includeFlagDataUrl);
};

module.exports = {
  loadCountriesData,
  getSupportedLanguages,
  getAllCountries,
  searchCountries,
  getCountryByCode,
  getCountryFlagDataUrl
};