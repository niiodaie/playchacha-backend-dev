// Regional sports data for different markets
export const regionalSportsData = {
  // North America
  'us': {
    timezone: 'America/New_York',
    currency: 'USD',
    sports: ['NFL', 'NBA', 'MLB', 'NHL', 'MLS'],
    events: [
      { sport: 'NFL', home: 'Chiefs', away: 'Bills', homeScore: 21, awayScore: 17 },
      { sport: 'NBA', home: 'Lakers', away: 'Warriors', homeScore: 89, awayScore: 92 },
      { sport: 'MLB', home: 'Yankees', away: 'Red Sox', homeScore: 5, awayScore: 3 }
    ]
  },
  
  // Europe
  'eu': {
    timezone: 'Europe/London',
    currency: 'EUR',
    sports: ['Premier League', 'Champions League', 'Bundesliga', 'Serie A'],
    events: [
      { sport: 'Premier League', home: 'Manchester City', away: 'Liverpool', homeScore: 2, awayScore: 1 },
      { sport: 'Champions League', home: 'Real Madrid', away: 'Barcelona', homeScore: 3, awayScore: 2 },
      { sport: 'Bundesliga', home: 'Bayern Munich', away: 'Dortmund', homeScore: 1, awayScore: 0 }
    ]
  },
  
  // Asia-Pacific
  'ap': {
    timezone: 'Asia/Singapore',
    currency: 'SGD',
    sports: ['Cricket', 'J-League', 'K-League', 'A-League'],
    events: [
      { sport: 'Cricket', home: 'India', away: 'Australia', homeScore: 285, awayScore: 240 },
      { sport: 'J-League', home: 'Tokyo FC', away: 'Yokohama', homeScore: 2, awayScore: 1 },
      { sport: 'A-League', home: 'Sydney FC', away: 'Melbourne City', homeScore: 1, awayScore: 1 }
    ]
  },
  
  // Latin America
  'latam': {
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    sports: ['Brazilian Serie A', 'Liga MX', 'Copa Libertadores', 'Argentine Primera'],
    events: [
      { sport: 'Brazilian Serie A', home: 'Flamengo', away: 'Palmeiras', homeScore: 2, awayScore: 1 },
      { sport: 'Liga MX', home: 'Club América', away: 'Chivas', homeScore: 3, awayScore: 0 },
      { sport: 'Copa Libertadores', home: 'Boca Juniors', away: 'River Plate', homeScore: 1, awayScore: 2 }
    ]
  },
  
  // Africa
  'africa': {
    timezone: 'Africa/Johannesburg',
    currency: 'ZAR',
    sports: ['Premier League', 'AFCON', 'PSL', 'Cricket'],
    events: [
      { sport: 'PSL', home: 'Kaizer Chiefs', away: 'Orlando Pirates', homeScore: 1, awayScore: 0 },
      { sport: 'Cricket', home: 'Proteas', away: 'England', homeScore: 320, awayScore: 285 },
      { sport: 'AFCON', home: 'Nigeria', away: 'Ghana', homeScore: 2, awayScore: 1 }
    ]
  }
};

// Currency configurations for different regions
export const regionalCurrencies = {
  // North America
  'USD': { symbol: '$', name: 'US Dollar', regions: ['us', 'ca'] },
  'CAD': { symbol: 'C$', name: 'Canadian Dollar', regions: ['ca'] },
  'MXN': { symbol: '$', name: 'Mexican Peso', regions: ['mx'] },
  
  // Europe
  'EUR': { symbol: '€', name: 'Euro', regions: ['eu'] },
  'GBP': { symbol: '£', name: 'British Pound', regions: ['gb'] },
  'CHF': { symbol: 'Fr', name: 'Swiss Franc', regions: ['ch'] },
  
  // Asia-Pacific
  'JPY': { symbol: '¥', name: 'Japanese Yen', regions: ['jp'] },
  'KRW': { symbol: '₩', name: 'Korean Won', regions: ['kr'] },
  'AUD': { symbol: 'A$', name: 'Australian Dollar', regions: ['au'] },
  'SGD': { symbol: 'S$', name: 'Singapore Dollar', regions: ['sg'] },
  
  // Latin America
  'BRL': { symbol: 'R$', name: 'Brazilian Real', regions: ['br'] },
  'ARS': { symbol: '$', name: 'Argentine Peso', regions: ['ar'] },
  'COP': { symbol: '$', name: 'Colombian Peso', regions: ['co'] },
  'PEN': { symbol: 'S/', name: 'Peruvian Sol', regions: ['pe'] },
  'CLP': { symbol: '$', name: 'Chilean Peso', regions: ['cl'] },
  
  // Africa
  'ZAR': { symbol: 'R', name: 'South African Rand', regions: ['za'] },
  'NGN': { symbol: '₦', name: 'Nigerian Naira', regions: ['ng'] },
  'KES': { symbol: 'KSh', name: 'Kenyan Shilling', regions: ['ke'] },
  'GHS': { symbol: '₵', name: 'Ghanaian Cedi', regions: ['gh'] },
  'EGP': { symbol: '£', name: 'Egyptian Pound', regions: ['eg'] }
};

// Language configurations
export const regionalLanguages = {
  'en': { name: 'English', regions: ['us', 'gb', 'au', 'za', 'ng', 'ke'] },
  'es': { name: 'Español', regions: ['mx', 'ar', 'co', 'pe', 'cl'] },
  'pt': { name: 'Português', regions: ['br'] },
  'fr': { name: 'Français', regions: ['fr', 'ca'] },
  'de': { name: 'Deutsch', regions: ['de', 'at', 'ch'] },
  'ja': { name: '日本語', regions: ['jp'] },
  'ko': { name: '한국어', regions: ['kr'] },
  'zh': { name: '中文', regions: ['cn', 'tw', 'hk'] },
  'ar': { name: 'العربية', regions: ['eg', 'ma', 'ae'] },
  'sw': { name: 'Kiswahili', regions: ['ke', 'tz'] }
};

// Payment method configurations by region
export const regionalPaymentMethods = {
  // North America
  'us': ['stripe', 'paypal', 'apple_pay', 'google_pay'],
  'ca': ['stripe', 'paypal', 'interac'],
  'mx': ['conekta', 'openpay', 'spei'],
  
  // Europe
  'eu': ['stripe', 'paypal', 'sepa', 'ideal'],
  'gb': ['stripe', 'paypal', 'faster_payments'],
  
  // Asia-Pacific
  'jp': ['stripe', 'konbini', 'bank_transfer'],
  'kr': ['toss', 'kakaopay', 'bank_transfer'],
  'au': ['stripe', 'paypal', 'poli'],
  'sg': ['stripe', 'grabpay', 'bank_transfer'],
  
  // Latin America
  'br': ['pagseguro', 'mercadopago', 'pix'],
  'ar': ['mercadopago', 'todopago'],
  'co': ['payu', 'pse'],
  'pe': ['payu', 'culqi'],
  'cl': ['transbank', 'khipu'],
  
  // Africa
  'za': ['paygate', 'peach_payments', 'eft'],
  'ng': ['paystack', 'flutterwave', 'bank_transfer'],
  'ke': ['mpesa', 'safaricom', 'equity_bank'],
  'gh': ['paystack', 'mtn_mobile_money'],
  'eg': ['fawry', 'bank_transfer']
};

// Regulatory compliance by region
export const regionalCompliance = {
  'us': {
    legalStatus: 'regulated',
    licenseRequired: true,
    taxRate: 0.21,
    kycRequired: true,
    amlRequired: true,
    localBanking: true
  },
  'gb': {
    legalStatus: 'regulated',
    licenseRequired: true,
    taxRate: 0.15,
    kycRequired: true,
    amlRequired: true,
    localBanking: false
  },
  'br': {
    legalStatus: 'regulated',
    licenseRequired: true,
    taxRate: 0.12,
    kycRequired: true,
    amlRequired: true,
    localBanking: true
  },
  'za': {
    legalStatus: 'regulated',
    licenseRequired: true,
    taxRate: 0.06,
    kycRequired: true,
    amlRequired: true,
    localBanking: true
  },
  'ng': {
    legalStatus: 'regulated',
    licenseRequired: true,
    taxRate: 0.20,
    kycRequired: true,
    amlRequired: true,
    localBanking: false
  }
};

// Function to get regional configuration
export function getRegionalConfig(countryCode) {
  const region = getRegionFromCountry(countryCode);
  
  return {
    sports: regionalSportsData[region]?.sports || regionalSportsData['us'].sports,
    events: regionalSportsData[region]?.events || regionalSportsData['us'].events,
    timezone: regionalSportsData[region]?.timezone || 'UTC',
    currency: regionalSportsData[region]?.currency || 'USD',
    paymentMethods: regionalPaymentMethods[countryCode] || regionalPaymentMethods['us'],
    compliance: regionalCompliance[countryCode] || regionalCompliance['us']
  };
}

// Function to map country to region
function getRegionFromCountry(countryCode) {
  const regionMap = {
    'us': 'us', 'ca': 'us', 'mx': 'latam',
    'gb': 'eu', 'de': 'eu', 'fr': 'eu', 'es': 'eu', 'it': 'eu',
    'jp': 'ap', 'kr': 'ap', 'au': 'ap', 'sg': 'ap',
    'br': 'latam', 'ar': 'latam', 'co': 'latam', 'pe': 'latam', 'cl': 'latam',
    'za': 'africa', 'ng': 'africa', 'ke': 'africa', 'gh': 'africa', 'eg': 'africa'
  };
  
  return regionMap[countryCode] || 'us';
}

