const geoip = require('geoip-lite');
const axios = require('axios');
const { logger } = require('./logger');

class LocationDetectionService {
  constructor() {
    this.ipStackApiKey = process.env.IPSTACK_API_KEY;
    this.maxMindApiKey = process.env.MAXMIND_API_KEY;
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Detect user location from request
   * @param {Object} req - Express request object
   * @returns {Object} Location information
   */
  async detectLocation(req) {
    try {
      const ip = this.getClientIP(req);
      
      // Check cache first
      const cacheKey = `location_${ip}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Try multiple detection methods
      let location = await this.detectFromIP(ip);
      
      // Enhance with browser geolocation if available
      if (req.headers['x-user-location']) {
        const browserLocation = JSON.parse(req.headers['x-user-location']);
        location = this.enhanceWithBrowserLocation(location, browserLocation);
      }

      // Add regulatory information
      location = await this.addRegulatoryInfo(location);

      // Cache the result
      this.cache.set(cacheKey, {
        data: location,
        timestamp: Date.now()
      });

      return location;
    } catch (error) {
      logger.error('Location detection failed', { error: error.message });
      return this.getDefaultLocation();
    }
  }

  /**
   * Get client IP address from request
   * @param {Object} req - Express request object
   * @returns {string} IP address
   */
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.ip ||
           '127.0.0.1';
  }

  /**
   * Detect location from IP address using multiple providers
   * @param {string} ip - IP address
   * @returns {Object} Location information
   */
  async detectFromIP(ip) {
    // Skip local IPs
    if (this.isLocalIP(ip)) {
      return this.getDefaultLocation();
    }

    // Try GeoIP-Lite first (free, local database)
    let location = this.detectWithGeoIPLite(ip);
    
    // Enhance with external services if available
    if (this.ipStackApiKey) {
      try {
        const ipStackData = await this.detectWithIPStack(ip);
        location = this.mergeLocationData(location, ipStackData);
      } catch (error) {
        logger.warn('IPStack detection failed', { error: error.message });
      }
    }

    return location;
  }

  /**
   * Detect location using GeoIP-Lite
   * @param {string} ip - IP address
   * @returns {Object} Location information
   */
  detectWithGeoIPLite(ip) {
    const geo = geoip.lookup(ip);
    
    if (!geo) {
      return this.getDefaultLocation();
    }

    return {
      ip,
      country: geo.country,
      countryName: this.getCountryName(geo.country),
      region: geo.region,
      city: geo.city,
      latitude: geo.ll[0],
      longitude: geo.ll[1],
      timezone: geo.timezone,
      accuracy: 'country',
      provider: 'geoip-lite'
    };
  }

  /**
   * Detect location using IPStack API
   * @param {string} ip - IP address
   * @returns {Object} Location information
   */
  async detectWithIPStack(ip) {
    const response = await axios.get(`http://api.ipstack.com/${ip}`, {
      params: {
        access_key: this.ipStackApiKey,
        format: 'json'
      },
      timeout: 5000
    });

    const data = response.data;
    
    if (data.error) {
      throw new Error(`IPStack error: ${data.error.info}`);
    }

    return {
      ip,
      country: data.country_code,
      countryName: data.country_name,
      region: data.region_name,
      city: data.city,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.time_zone?.id,
      accuracy: 'city',
      provider: 'ipstack',
      isp: data.connection?.isp,
      vpn: data.security?.is_proxy || data.security?.is_crawler
    };
  }

  /**
   * Enhance location with browser geolocation
   * @param {Object} ipLocation - Location from IP detection
   * @param {Object} browserLocation - Location from browser
   * @returns {Object} Enhanced location
   */
  enhanceWithBrowserLocation(ipLocation, browserLocation) {
    // Use browser location for more accurate coordinates
    if (browserLocation.latitude && browserLocation.longitude) {
      return {
        ...ipLocation,
        latitude: browserLocation.latitude,
        longitude: browserLocation.longitude,
        accuracy: 'gps',
        browserEnhanced: true
      };
    }

    return ipLocation;
  }

  /**
   * Add regulatory information for the location
   * @param {Object} location - Location information
   * @returns {Object} Location with regulatory info
   */
  async addRegulatoryInfo(location) {
    const regulatory = this.getRegulatoryInfo(location.country);
    
    return {
      ...location,
      regulatory: {
        bettingAllowed: regulatory.bettingAllowed,
        minimumAge: regulatory.minimumAge,
        restrictions: regulatory.restrictions,
        currency: regulatory.currency,
        language: regulatory.language,
        timezone: regulatory.timezone
      }
    };
  }

  /**
   * Get regulatory information for a country
   * @param {string} countryCode - ISO country code
   * @returns {Object} Regulatory information
   */
  getRegulatoryInfo(countryCode) {
    const regulations = {
      // Allowed countries
      'GB': { bettingAllowed: true, minimumAge: 18, currency: 'GBP', language: 'en-GB', timezone: 'Europe/London' },
      'DE': { bettingAllowed: true, minimumAge: 18, currency: 'EUR', language: 'de-DE', timezone: 'Europe/Berlin' },
      'FR': { bettingAllowed: true, minimumAge: 18, currency: 'EUR', language: 'fr-FR', timezone: 'Europe/Paris' },
      'ES': { bettingAllowed: true, minimumAge: 18, currency: 'EUR', language: 'es-ES', timezone: 'Europe/Madrid' },
      'IT': { bettingAllowed: true, minimumAge: 18, currency: 'EUR', language: 'it-IT', timezone: 'Europe/Rome' },
      'CA': { bettingAllowed: true, minimumAge: 19, currency: 'CAD', language: 'en-CA', timezone: 'America/Toronto' },
      'AU': { bettingAllowed: true, minimumAge: 18, currency: 'AUD', language: 'en-AU', timezone: 'Australia/Sydney' },
      'BR': { bettingAllowed: true, minimumAge: 18, currency: 'BRL', language: 'pt-BR', timezone: 'America/Sao_Paulo' },
      'MX': { bettingAllowed: true, minimumAge: 18, currency: 'MXN', language: 'es-MX', timezone: 'America/Mexico_City' },
      'JP': { bettingAllowed: true, minimumAge: 20, currency: 'JPY', language: 'ja-JP', timezone: 'Asia/Tokyo' },
      'KR': { bettingAllowed: true, minimumAge: 19, currency: 'KRW', language: 'ko-KR', timezone: 'Asia/Seoul' },
      'SG': { bettingAllowed: true, minimumAge: 21, currency: 'SGD', language: 'en-SG', timezone: 'Asia/Singapore' },
      'HK': { bettingAllowed: true, minimumAge: 18, currency: 'HKD', language: 'zh-HK', timezone: 'Asia/Hong_Kong' },
      'NZ': { bettingAllowed: true, minimumAge: 18, currency: 'NZD', language: 'en-NZ', timezone: 'Pacific/Auckland' },
      'ZA': { bettingAllowed: true, minimumAge: 18, currency: 'ZAR', language: 'en-ZA', timezone: 'Africa/Johannesburg' },
      
      // Restricted countries
      'US': { 
        bettingAllowed: false, 
        minimumAge: 21, 
        currency: 'USD', 
        language: 'en-US', 
        timezone: 'America/New_York',
        restrictions: ['State-by-state regulations', 'Federal restrictions apply']
      },
      'CN': { 
        bettingAllowed: false, 
        minimumAge: 18, 
        currency: 'CNY', 
        language: 'zh-CN', 
        timezone: 'Asia/Shanghai',
        restrictions: ['Gambling prohibited by law']
      },
      'IN': { 
        bettingAllowed: false, 
        minimumAge: 18, 
        currency: 'INR', 
        language: 'hi-IN', 
        timezone: 'Asia/Kolkata',
        restrictions: ['Limited to skill-based games only']
      }
    };

    return regulations[countryCode] || {
      bettingAllowed: false,
      minimumAge: 18,
      currency: 'USD',
      language: 'en-US',
      timezone: 'UTC',
      restrictions: ['Country not supported']
    };
  }

  /**
   * Check if IP is local/private
   * @param {string} ip - IP address
   * @returns {boolean} True if local IP
   */
  isLocalIP(ip) {
    const localPatterns = [
      /^127\./,
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^::1$/,
      /^localhost$/
    ];

    return localPatterns.some(pattern => pattern.test(ip));
  }

  /**
   * Get country name from country code
   * @param {string} countryCode - ISO country code
   * @returns {string} Country name
   */
  getCountryName(countryCode) {
    const countries = {
      'US': 'United States',
      'GB': 'United Kingdom',
      'DE': 'Germany',
      'FR': 'France',
      'ES': 'Spain',
      'IT': 'Italy',
      'CA': 'Canada',
      'AU': 'Australia',
      'BR': 'Brazil',
      'MX': 'Mexico',
      'JP': 'Japan',
      'KR': 'South Korea',
      'CN': 'China',
      'IN': 'India',
      'SG': 'Singapore',
      'HK': 'Hong Kong',
      'NZ': 'New Zealand',
      'ZA': 'South Africa'
    };

    return countries[countryCode] || countryCode;
  }

  /**
   * Get default location for fallback
   * @returns {Object} Default location
   */
  getDefaultLocation() {
    return {
      ip: 'unknown',
      country: 'US',
      countryName: 'United States',
      region: 'Unknown',
      city: 'Unknown',
      latitude: 0,
      longitude: 0,
      timezone: 'UTC',
      accuracy: 'unknown',
      provider: 'default',
      regulatory: {
        bettingAllowed: false,
        minimumAge: 18,
        restrictions: ['Location detection failed'],
        currency: 'USD',
        language: 'en-US',
        timezone: 'UTC'
      }
    };
  }

  /**
   * Merge location data from multiple sources
   * @param {Object} primary - Primary location data
   * @param {Object} secondary - Secondary location data
   * @returns {Object} Merged location data
   */
  mergeLocationData(primary, secondary) {
    return {
      ...primary,
      ...secondary,
      // Keep the most accurate data
      accuracy: secondary.accuracy || primary.accuracy,
      // Combine provider information
      provider: `${primary.provider}, ${secondary.provider}`
    };
  }

  /**
   * Validate location data
   * @param {Object} location - Location data to validate
   * @returns {boolean} True if valid
   */
  validateLocation(location) {
    return location &&
           location.country &&
           location.country.length === 2 &&
           typeof location.latitude === 'number' &&
           typeof location.longitude === 'number';
  }

  /**
   * Clear location cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new LocationDetectionService();

