const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Different rate limits for different endpoints
const rateLimiters = {
  // General API rate limit
  general: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // limit each IP to 100 requests per windowMs
    'Too many requests from this IP, please try again later.'
  ),

  // Authentication endpoints (stricter)
  auth: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // limit each IP to 5 requests per windowMs
    'Too many authentication attempts, please try again later.'
  ),

  // Betting endpoints (moderate)
  betting: createRateLimiter(
    1 * 60 * 1000, // 1 minute
    10, // limit each IP to 10 bets per minute
    'Too many betting requests, please slow down.'
  ),

  // Wallet endpoints (strict)
  wallet: createRateLimiter(
    5 * 60 * 1000, // 5 minutes
    3, // limit each IP to 3 wallet operations per 5 minutes
    'Too many wallet operations, please wait before trying again.'
  ),

  // Password reset (very strict)
  passwordReset: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    3, // limit each IP to 3 password reset attempts per hour
    'Too many password reset attempts, please try again later.'
  )
};

// Security middleware configuration
const securityMiddleware = {
  // Helmet for security headers
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        frameSrc: ["'self'", "https://js.stripe.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }),

  // CORS configuration
  cors: cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        'https://playchacha.net',
        'https://www.playchacha.net',
        'https://app.playchacha.net',
        'https://admin.playchacha.net',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173' // Vite dev server
      ];
      
      if (process.env.NODE_ENV === 'development') {
        allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
      }
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }),

  // Compression
  compression: compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }),

  // Data sanitization
  mongoSanitize: mongoSanitize(),
  xss: xss(),
  hpp: hpp({
    whitelist: ['sort', 'fields', 'page', 'limit', 'status', 'sport', 'league']
  })
};

// IP whitelist for admin operations
const adminIPWhitelist = process.env.ADMIN_IP_WHITELIST 
  ? process.env.ADMIN_IP_WHITELIST.split(',').map(ip => ip.trim())
  : [];

const checkAdminIP = (req, res, next) => {
  if (adminIPWhitelist.length === 0) {
    return next(); // No IP restriction in development
  }

  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  
  if (!adminIPWhitelist.includes(clientIP)) {
    return res.status(403).json({
      error: 'Access denied from this IP address'
    });
  }
  
  next();
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };
    
    if (req.user) {
      logData.userId = req.user.id;
    }
    
    // Log to console in development, to proper logging service in production
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(logData, null, 2));
    } else {
      // In production, send to logging service (e.g., Winston, CloudWatch)
      console.log(JSON.stringify(logData));
    }
  });
  
  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// Input validation middleware
const validateInput = (req, res, next) => {
  // Check for common injection patterns
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi
  ];
  
  const checkValue = (value) => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };
  
  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    return res.status(400).json({
      error: 'Invalid input detected'
    });
  }
  
  next();
};

module.exports = {
  rateLimiters,
  securityMiddleware,
  checkAdminIP,
  requestLogger,
  securityHeaders,
  validateInput
};

