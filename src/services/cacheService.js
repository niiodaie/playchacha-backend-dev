const Redis = require('ioredis');
const { logger } = require('./logger');

class CacheService {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.defaultTTL = 3600; // 1 hour default TTL
    
    this.cacheKeys = {
      USER_PROFILE: 'user:profile:',
      USER_BALANCE: 'user:balance:',
      SPORTS_DATA: 'sports:data:',
      EVENTS_LIST: 'events:list:',
      EVENT_DETAILS: 'event:details:',
      ODDS_DATA: 'odds:data:',
      EXCHANGE_RATES: 'exchange:rates:',
      TRANSLATIONS: 'translations:',
      LOCATION_DATA: 'location:',
      BET_HISTORY: 'bet:history:',
      LEADERBOARD: 'leaderboard:',
      STATISTICS: 'stats:'
    };
    
    this.cacheTTL = {
      USER_PROFILE: 1800, // 30 minutes
      USER_BALANCE: 300, // 5 minutes
      SPORTS_DATA: 86400, // 24 hours
      EVENTS_LIST: 300, // 5 minutes
      EVENT_DETAILS: 600, // 10 minutes
      ODDS_DATA: 60, // 1 minute
      EXCHANGE_RATES: 300, // 5 minutes
      TRANSLATIONS: 86400, // 24 hours
      LOCATION_DATA: 86400, // 24 hours
      BET_HISTORY: 600, // 10 minutes
      LEADERBOARD: 300, // 5 minutes
      STATISTICS: 1800 // 30 minutes
    };
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000
      };

      // Use cluster if configured
      if (process.env.REDIS_CLUSTER_NODES) {
        const nodes = process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
          const [host, port] = node.trim().split(':');
          return { host, port: parseInt(port) };
        });
        
        this.redis = new Redis.Cluster(nodes, {
          redisOptions: redisConfig,
          enableOfflineQueue: false
        });
      } else {
        this.redis = new Redis(redisConfig);
      }

      // Event listeners
      this.redis.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis connected successfully');
      });

      this.redis.on('error', (error) => {
        this.isConnected = false;
        logger.error('Redis connection error', { error: error.message });
      });

      this.redis.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      this.redis.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });

      // Test connection
      await this.redis.ping();
      logger.info('Cache service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize cache service', { error: error.message });
      // Don't throw error - allow app to run without cache
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {any} Cached value or null
   */
  async get(key) {
    if (!this.isConnected) return null;

    try {
      const value = await this.redis.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      logger.warn('Cache get failed', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {boolean} Success status
   */
  async set(key, value, ttl = this.defaultTTL) {
    if (!this.isConnected) return false;

    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      logger.warn('Cache set failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {boolean} Success status
   */
  async del(key) {
    if (!this.isConnected) return false;

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.warn('Cache delete failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   * @param {string} pattern - Key pattern
   * @returns {number} Number of deleted keys
   */
  async delPattern(pattern) {
    if (!this.isConnected) return 0;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        return keys.length;
      }
      return 0;
    } catch (error) {
      logger.warn('Cache pattern delete failed', { pattern, error: error.message });
      return 0;
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {boolean} Existence status
   */
  async exists(key) {
    if (!this.isConnected) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.warn('Cache exists check failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Set expiration for key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @returns {boolean} Success status
   */
  async expire(key, ttl) {
    if (!this.isConnected) return false;

    try {
      await this.redis.expire(key, ttl);
      return true;
    } catch (error) {
      logger.warn('Cache expire failed', { key, ttl, error: error.message });
      return false;
    }
  }

  /**
   * Increment numeric value
   * @param {string} key - Cache key
   * @param {number} increment - Increment value
   * @returns {number} New value
   */
  async incr(key, increment = 1) {
    if (!this.isConnected) return 0;

    try {
      if (increment === 1) {
        return await this.redis.incr(key);
      } else {
        return await this.redis.incrby(key, increment);
      }
    } catch (error) {
      logger.warn('Cache increment failed', { key, increment, error: error.message });
      return 0;
    }
  }

  /**
   * Cache user profile
   * @param {string} userId - User ID
   * @param {Object} profile - User profile data
   */
  async cacheUserProfile(userId, profile) {
    const key = this.cacheKeys.USER_PROFILE + userId;
    await this.set(key, profile, this.cacheTTL.USER_PROFILE);
  }

  /**
   * Get cached user profile
   * @param {string} userId - User ID
   * @returns {Object} User profile or null
   */
  async getUserProfile(userId) {
    const key = this.cacheKeys.USER_PROFILE + userId;
    return await this.get(key);
  }

  /**
   * Cache user balance
   * @param {string} userId - User ID
   * @param {Object} balance - Balance data
   */
  async cacheUserBalance(userId, balance) {
    const key = this.cacheKeys.USER_BALANCE + userId;
    await this.set(key, balance, this.cacheTTL.USER_BALANCE);
  }

  /**
   * Get cached user balance
   * @param {string} userId - User ID
   * @returns {Object} Balance data or null
   */
  async getUserBalance(userId) {
    const key = this.cacheKeys.USER_BALANCE + userId;
    return await this.get(key);
  }

  /**
   * Invalidate user cache
   * @param {string} userId - User ID
   */
  async invalidateUserCache(userId) {
    await this.del(this.cacheKeys.USER_PROFILE + userId);
    await this.del(this.cacheKeys.USER_BALANCE + userId);
    await this.delPattern(this.cacheKeys.BET_HISTORY + userId + ':*');
  }

  /**
   * Cache sports data
   * @param {string} sport - Sport identifier
   * @param {Object} data - Sports data
   */
  async cacheSportsData(sport, data) {
    const key = this.cacheKeys.SPORTS_DATA + sport;
    await this.set(key, data, this.cacheTTL.SPORTS_DATA);
  }

  /**
   * Get cached sports data
   * @param {string} sport - Sport identifier
   * @returns {Object} Sports data or null
   */
  async getSportsData(sport) {
    const key = this.cacheKeys.SPORTS_DATA + sport;
    return await this.get(key);
  }

  /**
   * Cache events list
   * @param {string} sport - Sport identifier
   * @param {Object} events - Events data
   */
  async cacheEventsList(sport, events) {
    const key = this.cacheKeys.EVENTS_LIST + sport;
    await this.set(key, events, this.cacheTTL.EVENTS_LIST);
  }

  /**
   * Get cached events list
   * @param {string} sport - Sport identifier
   * @returns {Object} Events data or null
   */
  async getEventsList(sport) {
    const key = this.cacheKeys.EVENTS_LIST + sport;
    return await this.get(key);
  }

  /**
   * Cache event details
   * @param {string} eventId - Event ID
   * @param {Object} details - Event details
   */
  async cacheEventDetails(eventId, details) {
    const key = this.cacheKeys.EVENT_DETAILS + eventId;
    await this.set(key, details, this.cacheTTL.EVENT_DETAILS);
  }

  /**
   * Get cached event details
   * @param {string} eventId - Event ID
   * @returns {Object} Event details or null
   */
  async getEventDetails(eventId) {
    const key = this.cacheKeys.EVENT_DETAILS + eventId;
    return await this.get(key);
  }

  /**
   * Cache exchange rates
   * @param {string} from - Source currency
   * @param {string} to - Target currency
   * @param {number} rate - Exchange rate
   */
  async cacheExchangeRate(from, to, rate) {
    const key = this.cacheKeys.EXCHANGE_RATES + `${from}_${to}`;
    await this.set(key, rate, this.cacheTTL.EXCHANGE_RATES);
  }

  /**
   * Get cached exchange rate
   * @param {string} from - Source currency
   * @param {string} to - Target currency
   * @returns {number} Exchange rate or null
   */
  async getExchangeRate(from, to) {
    const key = this.cacheKeys.EXCHANGE_RATES + `${from}_${to}`;
    return await this.get(key);
  }

  /**
   * Cache translation
   * @param {string} language - Language code
   * @param {string} namespace - Translation namespace
   * @param {Object} translations - Translation data
   */
  async cacheTranslations(language, namespace, translations) {
    const key = this.cacheKeys.TRANSLATIONS + `${language}_${namespace}`;
    await this.set(key, translations, this.cacheTTL.TRANSLATIONS);
  }

  /**
   * Get cached translations
   * @param {string} language - Language code
   * @param {string} namespace - Translation namespace
   * @returns {Object} Translation data or null
   */
  async getTranslations(language, namespace) {
    const key = this.cacheKeys.TRANSLATIONS + `${language}_${namespace}`;
    return await this.get(key);
  }

  /**
   * Cache location data
   * @param {string} ip - IP address
   * @param {Object} location - Location data
   */
  async cacheLocationData(ip, location) {
    const key = this.cacheKeys.LOCATION_DATA + ip;
    await this.set(key, location, this.cacheTTL.LOCATION_DATA);
  }

  /**
   * Get cached location data
   * @param {string} ip - IP address
   * @returns {Object} Location data or null
   */
  async getLocationData(ip) {
    const key = this.cacheKeys.LOCATION_DATA + ip;
    return await this.get(key);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  async getStats() {
    if (!this.isConnected) {
      return { connected: false };
    }

    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        connected: true,
        memory: info,
        keyspace: keyspace,
        isCluster: this.redis instanceof Redis.Cluster
      };
    } catch (error) {
      logger.warn('Failed to get cache stats', { error: error.message });
      return { connected: false, error: error.message };
    }
  }

  /**
   * Clear all cache
   * @returns {boolean} Success status
   */
  async clearAll() {
    if (!this.isConnected) return false;

    try {
      await this.redis.flushdb();
      logger.info('Cache cleared successfully');
      return true;
    } catch (error) {
      logger.error('Failed to clear cache', { error: error.message });
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Cache service closed');
    }
  }
}

module.exports = new CacheService();

