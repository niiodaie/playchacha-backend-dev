const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');
const { logger } = require('./logger');

class InternationalizationService {
  constructor() {
    this.supportedLanguages = [
      'en-US', 'en-GB', 'es-ES', 'es-MX', 'fr-FR', 'de-DE', 'pt-BR', 'pt-PT',
      'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR', 'ar-SA', 'ru-RU', 'it-IT', 'nl-NL',
      'sv-SE', 'pl-PL', 'tr-TR', 'hi-IN', 'th-TH', 'vi-VN', 'id-ID', 'ms-MY',
      'he-IL', 'da-DK', 'no-NO', 'fi-FI', 'cs-CZ', 'hu-HU'
    ];
    
    this.defaultLanguage = 'en-US';
    this.fallbackLanguage = 'en-US';
    
    this.rtlLanguages = ['ar-SA', 'he-IL'];
    
    this.initialized = false;
  }

  /**
   * Initialize i18next
   * @returns {Promise} Initialization promise
   */
  async initialize() {
    try {
      await i18next
        .use(Backend)
        .use(middleware.LanguageDetector)
        .init({
          lng: this.defaultLanguage,
          fallbackLng: this.fallbackLanguage,
          supportedLngs: this.supportedLanguages,
          
          backend: {
            loadPath: path.join(__dirname, '../translations/{{lng}}/{{ns}}.json'),
            addPath: path.join(__dirname, '../translations/{{lng}}/{{ns}}.missing.json')
          },
          
          detection: {
            order: ['header', 'querystring', 'cookie', 'session'],
            lookupHeader: 'accept-language',
            lookupQuerystring: 'lng',
            lookupCookie: 'i18next',
            lookupSession: 'lng',
            caches: ['cookie', 'session']
          },
          
          interpolation: {
            escapeValue: false
          },
          
          saveMissing: process.env.NODE_ENV === 'development',
          saveMissingTo: 'current',
          
          ns: ['common', 'betting', 'auth', 'wallet', 'sports', 'errors'],
          defaultNS: 'common',
          
          debug: process.env.NODE_ENV === 'development'
        });

      this.initialized = true;
      logger.info('Internationalization service initialized');
    } catch (error) {
      logger.error('Failed to initialize i18next', { error: error.message });
      throw error;
    }
  }

  /**
   * Get Express middleware for i18next
   * @returns {Function} Express middleware
   */
  getMiddleware() {
    if (!this.initialized) {
      throw new Error('Internationalization service not initialized');
    }
    
    return middleware.handle(i18next, {
      removeLngFromUrl: false
    });
  }

  /**
   * Translate text
   * @param {string} key - Translation key
   * @param {string} language - Target language
   * @param {Object} options - Translation options
   * @returns {string} Translated text
   */
  translate(key, language = this.defaultLanguage, options = {}) {
    try {
      return i18next.getFixedT(language)(key, options);
    } catch (error) {
      logger.warn('Translation failed', { key, language, error: error.message });
      return key; // Return key as fallback
    }
  }

  /**
   * Detect language from request
   * @param {Object} req - Express request object
   * @returns {string} Detected language
   */
  detectLanguage(req) {
    // Check explicit language parameter
    if (req.query.lng && this.isLanguageSupported(req.query.lng)) {
      return req.query.lng;
    }

    // Check session
    if (req.session?.lng && this.isLanguageSupported(req.session.lng)) {
      return req.session.lng;
    }

    // Check user preferences
    if (req.user?.preferences?.language && this.isLanguageSupported(req.user.preferences.language)) {
      return req.user.preferences.language;
    }

    // Check Accept-Language header
    const acceptLanguage = req.headers['accept-language'];
    if (acceptLanguage) {
      const languages = this.parseAcceptLanguage(acceptLanguage);
      for (const lang of languages) {
        if (this.isLanguageSupported(lang)) {
          return lang;
        }
        
        // Try language without region
        const baseLang = lang.split('-')[0];
        const matchedLang = this.supportedLanguages.find(l => l.startsWith(baseLang));
        if (matchedLang) {
          return matchedLang;
        }
      }
    }

    return this.defaultLanguage;
  }

  /**
   * Parse Accept-Language header
   * @param {string} acceptLanguage - Accept-Language header value
   * @returns {Array} Array of language codes sorted by preference
   */
  parseAcceptLanguage(acceptLanguage) {
    return acceptLanguage
      .split(',')
      .map(lang => {
        const parts = lang.trim().split(';');
        const code = parts[0];
        const quality = parts[1] ? parseFloat(parts[1].split('=')[1]) : 1;
        return { code, quality };
      })
      .sort((a, b) => b.quality - a.quality)
      .map(lang => lang.code);
  }

  /**
   * Check if language is supported
   * @param {string} language - Language code
   * @returns {boolean} True if supported
   */
  isLanguageSupported(language) {
    return this.supportedLanguages.includes(language);
  }

  /**
   * Check if language is RTL
   * @param {string} language - Language code
   * @returns {boolean} True if RTL
   */
  isRTL(language) {
    return this.rtlLanguages.includes(language);
  }

  /**
   * Get language information
   * @param {string} language - Language code
   * @returns {Object} Language information
   */
  getLanguageInfo(language) {
    const languageNames = {
      'en-US': { name: 'English (US)', nativeName: 'English (US)' },
      'en-GB': { name: 'English (UK)', nativeName: 'English (UK)' },
      'es-ES': { name: 'Spanish (Spain)', nativeName: 'Español (España)' },
      'es-MX': { name: 'Spanish (Mexico)', nativeName: 'Español (México)' },
      'fr-FR': { name: 'French', nativeName: 'Français' },
      'de-DE': { name: 'German', nativeName: 'Deutsch' },
      'pt-BR': { name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
      'pt-PT': { name: 'Portuguese (Portugal)', nativeName: 'Português (Portugal)' },
      'zh-CN': { name: 'Chinese (Simplified)', nativeName: '简体中文' },
      'zh-TW': { name: 'Chinese (Traditional)', nativeName: '繁體中文' },
      'ja-JP': { name: 'Japanese', nativeName: '日本語' },
      'ko-KR': { name: 'Korean', nativeName: '한국어' },
      'ar-SA': { name: 'Arabic', nativeName: 'العربية' },
      'ru-RU': { name: 'Russian', nativeName: 'Русский' },
      'it-IT': { name: 'Italian', nativeName: 'Italiano' },
      'nl-NL': { name: 'Dutch', nativeName: 'Nederlands' },
      'sv-SE': { name: 'Swedish', nativeName: 'Svenska' },
      'pl-PL': { name: 'Polish', nativeName: 'Polski' },
      'tr-TR': { name: 'Turkish', nativeName: 'Türkçe' },
      'hi-IN': { name: 'Hindi', nativeName: 'हिन्दी' },
      'th-TH': { name: 'Thai', nativeName: 'ไทย' },
      'vi-VN': { name: 'Vietnamese', nativeName: 'Tiếng Việt' },
      'id-ID': { name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
      'ms-MY': { name: 'Malay', nativeName: 'Bahasa Melayu' },
      'he-IL': { name: 'Hebrew', nativeName: 'עברית' },
      'da-DK': { name: 'Danish', nativeName: 'Dansk' },
      'no-NO': { name: 'Norwegian', nativeName: 'Norsk' },
      'fi-FI': { name: 'Finnish', nativeName: 'Suomi' },
      'cs-CZ': { name: 'Czech', nativeName: 'Čeština' },
      'hu-HU': { name: 'Hungarian', nativeName: 'Magyar' }
    };

    const info = languageNames[language] || { name: language, nativeName: language };
    
    return {
      code: language,
      name: info.name,
      nativeName: info.nativeName,
      rtl: this.isRTL(language),
      supported: this.isLanguageSupported(language)
    };
  }

  /**
   * Get all supported languages with their information
   * @returns {Array} Array of language information objects
   */
  getAllLanguages() {
    return this.supportedLanguages.map(lang => this.getLanguageInfo(lang));
  }

  /**
   * Get languages for a specific region
   * @param {string} countryCode - ISO country code
   * @returns {Array} Array of language codes for the region
   */
  getLanguagesForRegion(countryCode) {
    const regionLanguages = {
      'US': ['en-US', 'es-MX'],
      'GB': ['en-GB'],
      'CA': ['en-US', 'fr-FR'],
      'AU': ['en-GB'],
      'NZ': ['en-GB'],
      'ZA': ['en-GB'],
      'DE': ['de-DE'],
      'AT': ['de-DE'],
      'CH': ['de-DE', 'fr-FR', 'it-IT'],
      'FR': ['fr-FR'],
      'BE': ['fr-FR', 'nl-NL'],
      'LU': ['fr-FR', 'de-DE'],
      'ES': ['es-ES'],
      'MX': ['es-MX'],
      'AR': ['es-ES'],
      'CL': ['es-ES'],
      'CO': ['es-ES'],
      'PE': ['es-ES'],
      'BR': ['pt-BR'],
      'PT': ['pt-PT'],
      'IT': ['it-IT'],
      'NL': ['nl-NL'],
      'SE': ['sv-SE'],
      'NO': ['no-NO'],
      'DK': ['da-DK'],
      'FI': ['fi-FI'],
      'PL': ['pl-PL'],
      'CZ': ['cs-CZ'],
      'HU': ['hu-HU'],
      'TR': ['tr-TR'],
      'RU': ['ru-RU'],
      'CN': ['zh-CN'],
      'TW': ['zh-TW'],
      'HK': ['zh-TW', 'en-GB'],
      'JP': ['ja-JP'],
      'KR': ['ko-KR'],
      'IN': ['hi-IN', 'en-GB'],
      'TH': ['th-TH'],
      'VN': ['vi-VN'],
      'ID': ['id-ID'],
      'MY': ['ms-MY', 'en-GB'],
      'SG': ['en-GB', 'zh-CN', 'ms-MY'],
      'SA': ['ar-SA'],
      'AE': ['ar-SA', 'en-GB'],
      'IL': ['he-IL', 'en-GB']
    };

    return regionLanguages[countryCode] || [this.defaultLanguage];
  }

  /**
   * Format number according to locale
   * @param {number} number - Number to format
   * @param {string} language - Language code
   * @param {Object} options - Formatting options
   * @returns {string} Formatted number
   */
  formatNumber(number, language = this.defaultLanguage, options = {}) {
    try {
      const locale = language.replace('-', '_');
      return new Intl.NumberFormat(locale, options).format(number);
    } catch (error) {
      logger.warn('Number formatting failed', { number, language, error: error.message });
      return number.toString();
    }
  }

  /**
   * Format currency according to locale
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code
   * @param {string} language - Language code
   * @returns {string} Formatted currency
   */
  formatCurrency(amount, currency, language = this.defaultLanguage) {
    try {
      const locale = language.replace('-', '_');
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
      }).format(amount);
    } catch (error) {
      logger.warn('Currency formatting failed', { amount, currency, language, error: error.message });
      return `${amount} ${currency}`;
    }
  }

  /**
   * Format date according to locale
   * @param {Date} date - Date to format
   * @param {string} language - Language code
   * @param {Object} options - Formatting options
   * @returns {string} Formatted date
   */
  formatDate(date, language = this.defaultLanguage, options = {}) {
    try {
      const locale = language.replace('-', '_');
      return new Intl.DateTimeFormat(locale, options).format(date);
    } catch (error) {
      logger.warn('Date formatting failed', { date, language, error: error.message });
      return date.toISOString();
    }
  }

  /**
   * Get relative time format
   * @param {Date} date - Date to format
   * @param {string} language - Language code
   * @returns {string} Relative time string
   */
  formatRelativeTime(date, language = this.defaultLanguage) {
    try {
      const locale = language.replace('-', '_');
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      
      const now = new Date();
      const diffInSeconds = Math.floor((date - now) / 1000);
      
      if (Math.abs(diffInSeconds) < 60) {
        return rtf.format(diffInSeconds, 'second');
      } else if (Math.abs(diffInSeconds) < 3600) {
        return rtf.format(Math.floor(diffInSeconds / 60), 'minute');
      } else if (Math.abs(diffInSeconds) < 86400) {
        return rtf.format(Math.floor(diffInSeconds / 3600), 'hour');
      } else {
        return rtf.format(Math.floor(diffInSeconds / 86400), 'day');
      }
    } catch (error) {
      logger.warn('Relative time formatting failed', { date, language, error: error.message });
      return date.toLocaleDateString();
    }
  }

  /**
   * Pluralize text based on count
   * @param {string} key - Translation key
   * @param {number} count - Count for pluralization
   * @param {string} language - Language code
   * @returns {string} Pluralized text
   */
  pluralize(key, count, language = this.defaultLanguage) {
    return this.translate(key, language, { count });
  }

  /**
   * Get text direction for language
   * @param {string} language - Language code
   * @returns {string} Text direction ('ltr' or 'rtl')
   */
  getTextDirection(language) {
    return this.isRTL(language) ? 'rtl' : 'ltr';
  }
}

module.exports = new InternationalizationService();

