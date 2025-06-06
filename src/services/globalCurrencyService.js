const axios = require('axios');
const { logger } = require('./logger');

class GlobalCurrencyService {
  constructor() {
    this.exchangeRateApiKey = process.env.EXCHANGE_RATE_API_KEY;
    this.fixerApiKey = process.env.FIXER_API_KEY;
    this.coinGeckoApiKey = process.env.COINGECKO_API_KEY;
    
    this.cache = new Map();
    this.fiatCacheTimeout = 5 * 60 * 1000; // 5 minutes for fiat
    this.cryptoCacheTimeout = 1 * 60 * 1000; // 1 minute for crypto
    
    this.supportedFiatCurrencies = [
      'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NZD',
      'MXN', 'SGD', 'HKD', 'NOK', 'TRY', 'ZAR', 'BRL', 'INR', 'KRW', 'PLN',
      'DKK', 'CZK', 'HUF', 'ILS', 'CLP', 'PHP', 'AED', 'SAR', 'THB', 'MYR'
    ];
    
    this.supportedCryptoCurrencies = [
      'BTC', 'ETH', 'USDC', 'USDT', 'BNB', 'ADA', 'DOT', 'LINK'
    ];

    this.baseCurrency = 'USD';
  }

  /**
   * Get exchange rate between two currencies
   * @param {string} from - Source currency code
   * @param {string} to - Target currency code
   * @returns {number} Exchange rate
   */
  async getExchangeRate(from, to) {
    if (from === to) return 1;

    try {
      const cacheKey = `rate_${from}_${to}`;
      const cached = this.cache.get(cacheKey);
      
      const isCrypto = this.isCryptoCurrency(from) || this.isCryptoCurrency(to);
      const cacheTimeout = isCrypto ? this.cryptoCacheTimeout : this.fiatCacheTimeout;
      
      if (cached && Date.now() - cached.timestamp < cacheTimeout) {
        return cached.rate;
      }

      let rate;
      if (isCrypto) {
        rate = await this.getCryptoExchangeRate(from, to);
      } else {
        rate = await this.getFiatExchangeRate(from, to);
      }

      // Cache the rate
      this.cache.set(cacheKey, {
        rate,
        timestamp: Date.now()
      });

      return rate;
    } catch (error) {
      logger.error('Failed to get exchange rate', { from, to, error: error.message });
      throw new Error(`Unable to get exchange rate from ${from} to ${to}`);
    }
  }

  /**
   * Convert amount between currencies
   * @param {number} amount - Amount to convert
   * @param {string} from - Source currency code
   * @param {string} to - Target currency code
   * @returns {Object} Conversion result
   */
  async convertCurrency(amount, from, to) {
    try {
      const rate = await this.getExchangeRate(from, to);
      const convertedAmount = amount * rate;
      
      return {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount: this.formatAmount(convertedAmount, to),
        convertedCurrency: to,
        exchangeRate: rate,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Currency conversion failed', { amount, from, to, error: error.message });
      throw error;
    }
  }

  /**
   * Get fiat currency exchange rate
   * @param {string} from - Source currency
   * @param {string} to - Target currency
   * @returns {number} Exchange rate
   */
  async getFiatExchangeRate(from, to) {
    // Try ExchangeRate-API first
    if (this.exchangeRateApiKey) {
      try {
        return await this.getExchangeRateFromAPI(from, to);
      } catch (error) {
        logger.warn('ExchangeRate-API failed, trying Fixer', { error: error.message });
      }
    }

    // Fallback to Fixer.io
    if (this.fixerApiKey) {
      try {
        return await this.getExchangeRateFromFixer(from, to);
      } catch (error) {
        logger.warn('Fixer.io failed', { error: error.message });
      }
    }

    // Fallback to free service (limited)
    return await this.getExchangeRateFromFree(from, to);
  }

  /**
   * Get exchange rate from ExchangeRate-API
   * @param {string} from - Source currency
   * @param {string} to - Target currency
   * @returns {number} Exchange rate
   */
  async getExchangeRateFromAPI(from, to) {
    const response = await axios.get(`https://v6.exchangerate-api.com/v6/${this.exchangeRateApiKey}/pair/${from}/${to}`, {
      timeout: 5000
    });

    if (response.data.result !== 'success') {
      throw new Error(`ExchangeRate-API error: ${response.data.error_type}`);
    }

    return response.data.conversion_rate;
  }

  /**
   * Get exchange rate from Fixer.io
   * @param {string} from - Source currency
   * @param {string} to - Target currency
   * @returns {number} Exchange rate
   */
  async getExchangeRateFromFixer(from, to) {
    const response = await axios.get('http://data.fixer.io/api/latest', {
      params: {
        access_key: this.fixerApiKey,
        base: from,
        symbols: to
      },
      timeout: 5000
    });

    if (!response.data.success) {
      throw new Error(`Fixer.io error: ${response.data.error.info}`);
    }

    return response.data.rates[to];
  }

  /**
   * Get exchange rate from free service
   * @param {string} from - Source currency
   * @param {string} to - Target currency
   * @returns {number} Exchange rate
   */
  async getExchangeRateFromFree(from, to) {
    const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from}`, {
      timeout: 5000
    });

    if (!response.data.rates[to]) {
      throw new Error(`Currency ${to} not found in free API`);
    }

    return response.data.rates[to];
  }

  /**
   * Get cryptocurrency exchange rate
   * @param {string} from - Source currency
   * @param {string} to - Target currency
   * @returns {number} Exchange rate
   */
  async getCryptoExchangeRate(from, to) {
    try {
      // Convert crypto symbols to CoinGecko IDs
      const fromId = this.getCoinGeckoId(from);
      const toId = this.getCoinGeckoId(to);

      let response;
      if (this.isCryptoCurrency(from) && this.isCryptoCurrency(to)) {
        // Crypto to crypto
        response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
          params: {
            ids: fromId,
            vs_currencies: toId
          },
          timeout: 5000
        });
        return response.data[fromId][toId];
      } else if (this.isCryptoCurrency(from)) {
        // Crypto to fiat
        response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
          params: {
            ids: fromId,
            vs_currencies: to.toLowerCase()
          },
          timeout: 5000
        });
        return response.data[fromId][to.toLowerCase()];
      } else {
        // Fiat to crypto
        response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
          params: {
            ids: toId,
            vs_currencies: from.toLowerCase()
          },
          timeout: 5000
        });
        return 1 / response.data[toId][from.toLowerCase()];
      }
    } catch (error) {
      logger.error('CoinGecko API failed', { error: error.message });
      throw new Error('Cryptocurrency exchange rate unavailable');
    }
  }

  /**
   * Get CoinGecko ID for cryptocurrency
   * @param {string} symbol - Cryptocurrency symbol
   * @returns {string} CoinGecko ID
   */
  getCoinGeckoId(symbol) {
    const mapping = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'BNB': 'binancecoin',
      'ADA': 'cardano',
      'DOT': 'polkadot',
      'LINK': 'chainlink'
    };

    return mapping[symbol] || symbol.toLowerCase();
  }

  /**
   * Check if currency is cryptocurrency
   * @param {string} currency - Currency code
   * @returns {boolean} True if cryptocurrency
   */
  isCryptoCurrency(currency) {
    return this.supportedCryptoCurrencies.includes(currency);
  }

  /**
   * Check if currency is supported
   * @param {string} currency - Currency code
   * @returns {boolean} True if supported
   */
  isSupportedCurrency(currency) {
    return this.supportedFiatCurrencies.includes(currency) || 
           this.supportedCryptoCurrencies.includes(currency);
  }

  /**
   * Format amount according to currency
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code
   * @returns {number} Formatted amount
   */
  formatAmount(amount, currency) {
    const cryptoDecimals = {
      'BTC': 8,
      'ETH': 6,
      'USDC': 2,
      'USDT': 2
    };

    const fiatDecimals = 2;

    const decimals = this.isCryptoCurrency(currency) 
      ? (cryptoDecimals[currency] || 8)
      : fiatDecimals;

    return Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  /**
   * Get currency symbol
   * @param {string} currency - Currency code
   * @returns {string} Currency symbol
   */
  getCurrencySymbol(currency) {
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$',
      'CHF': 'CHF',
      'CNY': '¥',
      'SEK': 'kr',
      'NZD': 'NZ$',
      'MXN': '$',
      'SGD': 'S$',
      'HKD': 'HK$',
      'NOK': 'kr',
      'TRY': '₺',
      'ZAR': 'R',
      'BRL': 'R$',
      'INR': '₹',
      'KRW': '₩',
      'PLN': 'zł',
      'BTC': '₿',
      'ETH': 'Ξ',
      'USDC': '$',
      'USDT': '$'
    };

    return symbols[currency] || currency;
  }

  /**
   * Get all supported currencies for a region
   * @param {string} countryCode - ISO country code
   * @returns {Object} Supported currencies
   */
  getSupportedCurrenciesForRegion(countryCode) {
    const regionCurrencies = {
      'US': ['USD', 'BTC', 'ETH', 'USDC'],
      'GB': ['GBP', 'EUR', 'USD', 'BTC', 'ETH'],
      'DE': ['EUR', 'USD', 'GBP', 'BTC', 'ETH'],
      'FR': ['EUR', 'USD', 'GBP', 'BTC', 'ETH'],
      'ES': ['EUR', 'USD', 'GBP', 'BTC', 'ETH'],
      'IT': ['EUR', 'USD', 'GBP', 'BTC', 'ETH'],
      'CA': ['CAD', 'USD', 'BTC', 'ETH'],
      'AU': ['AUD', 'USD', 'BTC', 'ETH'],
      'BR': ['BRL', 'USD', 'BTC', 'ETH'],
      'MX': ['MXN', 'USD', 'BTC', 'ETH'],
      'JP': ['JPY', 'USD', 'BTC', 'ETH'],
      'KR': ['KRW', 'USD', 'BTC', 'ETH'],
      'CN': ['CNY', 'USD'], // No crypto in China
      'IN': ['INR', 'USD', 'BTC', 'ETH'],
      'SG': ['SGD', 'USD', 'BTC', 'ETH'],
      'HK': ['HKD', 'USD', 'BTC', 'ETH']
    };

    return {
      primary: regionCurrencies[countryCode]?.[0] || 'USD',
      supported: regionCurrencies[countryCode] || ['USD', 'BTC', 'ETH'],
      fiat: this.supportedFiatCurrencies,
      crypto: this.supportedCryptoCurrencies
    };
  }

  /**
   * Get historical exchange rates
   * @param {string} from - Source currency
   * @param {string} to - Target currency
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {number} Historical exchange rate
   */
  async getHistoricalRate(from, to, date) {
    try {
      if (this.exchangeRateApiKey) {
        const response = await axios.get(`https://v6.exchangerate-api.com/v6/${this.exchangeRateApiKey}/history/${from}/${date}`, {
          timeout: 5000
        });

        if (response.data.result === 'success') {
          return response.data.conversion_rates[to];
        }
      }

      throw new Error('Historical rates not available');
    } catch (error) {
      logger.error('Failed to get historical rate', { from, to, date, error: error.message });
      throw error;
    }
  }

  /**
   * Clear currency cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      fiatTimeout: this.fiatCacheTimeout,
      cryptoTimeout: this.cryptoCacheTimeout
    };
  }
}

module.exports = new GlobalCurrencyService();

