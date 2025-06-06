const winston = require('winston');
const path = require('path');

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(logColors);

// Create log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create production log format (JSON for log aggregation)
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports
const transports = [];

// Console transport for development
if (process.env.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      format: logFormat
    })
  );
} else {
  // Console transport for production (JSON format)
  transports.push(
    new winston.transports.Console({
      format: productionFormat
    })
  );
}

// File transports for all environments
transports.push(
  // Error log file
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
    format: productionFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
    format: productionFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),
  
  // HTTP requests log
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/http.log'),
    level: 'http',
    format: productionFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 3
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
  levels: logLevels,
  format: productionFormat,
  transports,
  exitOnError: false
});

// Create specialized loggers for different components
const createComponentLogger = (component) => {
  return {
    error: (message, meta = {}) => logger.error(message, { component, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { component, ...meta }),
    info: (message, meta = {}) => logger.info(message, { component, ...meta }),
    http: (message, meta = {}) => logger.http(message, { component, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { component, ...meta })
  };
};

// Specialized loggers
const loggers = {
  auth: createComponentLogger('AUTH'),
  betting: createComponentLogger('BETTING'),
  wallet: createComponentLogger('WALLET'),
  payment: createComponentLogger('PAYMENT'),
  escrow: createComponentLogger('ESCROW'),
  sports: createComponentLogger('SPORTS'),
  admin: createComponentLogger('ADMIN'),
  security: createComponentLogger('SECURITY'),
  database: createComponentLogger('DATABASE'),
  api: createComponentLogger('API')
};

// Security event logger
const securityLogger = {
  loginAttempt: (userId, ip, success, reason = null) => {
    loggers.security.info('Login attempt', {
      userId,
      ip,
      success,
      reason,
      event: 'LOGIN_ATTEMPT'
    });
  },
  
  suspiciousActivity: (userId, ip, activity, details = {}) => {
    loggers.security.warn('Suspicious activity detected', {
      userId,
      ip,
      activity,
      details,
      event: 'SUSPICIOUS_ACTIVITY'
    });
  },
  
  rateLimitExceeded: (ip, endpoint, limit) => {
    loggers.security.warn('Rate limit exceeded', {
      ip,
      endpoint,
      limit,
      event: 'RATE_LIMIT_EXCEEDED'
    });
  },
  
  unauthorizedAccess: (userId, ip, resource, action) => {
    loggers.security.error('Unauthorized access attempt', {
      userId,
      ip,
      resource,
      action,
      event: 'UNAUTHORIZED_ACCESS'
    });
  },
  
  dataExport: (userId, ip, dataType, recordCount) => {
    loggers.security.info('Data export performed', {
      userId,
      ip,
      dataType,
      recordCount,
      event: 'DATA_EXPORT'
    });
  }
};

// Business event logger
const businessLogger = {
  betPlaced: (userId, betId, amount, sport, event) => {
    loggers.betting.info('Bet placed', {
      userId,
      betId,
      amount,
      sport,
      event,
      businessEvent: 'BET_PLACED'
    });
  },
  
  betMatched: (betId, matchedBetId, amount) => {
    loggers.betting.info('Bet matched', {
      betId,
      matchedBetId,
      amount,
      businessEvent: 'BET_MATCHED'
    });
  },
  
  betSettled: (betId, winnerId, amount, platformFee) => {
    loggers.betting.info('Bet settled', {
      betId,
      winnerId,
      amount,
      platformFee,
      businessEvent: 'BET_SETTLED'
    });
  },
  
  deposit: (userId, amount, currency, method, transactionId) => {
    loggers.wallet.info('Deposit processed', {
      userId,
      amount,
      currency,
      method,
      transactionId,
      businessEvent: 'DEPOSIT'
    });
  },
  
  withdrawal: (userId, amount, currency, method, transactionId) => {
    loggers.wallet.info('Withdrawal processed', {
      userId,
      amount,
      currency,
      method,
      transactionId,
      businessEvent: 'WITHDRAWAL'
    });
  },
  
  escrowCreated: (escrowId, betId, amount, participants) => {
    loggers.escrow.info('Escrow created', {
      escrowId,
      betId,
      amount,
      participants,
      businessEvent: 'ESCROW_CREATED'
    });
  },
  
  escrowReleased: (escrowId, winnerId, amount, platformFee) => {
    loggers.escrow.info('Escrow released', {
      escrowId,
      winnerId,
      amount,
      platformFee,
      businessEvent: 'ESCROW_RELEASED'
    });
  }
};

// Performance logger
const performanceLogger = {
  apiResponse: (endpoint, method, duration, statusCode, userId = null) => {
    loggers.api.http('API response', {
      endpoint,
      method,
      duration,
      statusCode,
      userId,
      performanceEvent: 'API_RESPONSE'
    });
  },
  
  databaseQuery: (query, duration, recordCount = null) => {
    loggers.database.debug('Database query', {
      query: query.substring(0, 100), // Truncate long queries
      duration,
      recordCount,
      performanceEvent: 'DB_QUERY'
    });
  },
  
  externalApiCall: (service, endpoint, duration, statusCode) => {
    loggers.api.info('External API call', {
      service,
      endpoint,
      duration,
      statusCode,
      performanceEvent: 'EXTERNAL_API_CALL'
    });
  }
};

// Error logger with context
const errorLogger = {
  applicationError: (error, context = {}) => {
    logger.error('Application error', {
      message: error.message,
      stack: error.stack,
      context,
      errorType: 'APPLICATION_ERROR'
    });
  },
  
  validationError: (errors, context = {}) => {
    logger.warn('Validation error', {
      errors,
      context,
      errorType: 'VALIDATION_ERROR'
    });
  },
  
  externalServiceError: (service, error, context = {}) => {
    logger.error('External service error', {
      service,
      message: error.message,
      context,
      errorType: 'EXTERNAL_SERVICE_ERROR'
    });
  },
  
  databaseError: (error, query = null, context = {}) => {
    logger.error('Database error', {
      message: error.message,
      query: query ? query.substring(0, 100) : null,
      context,
      errorType: 'DATABASE_ERROR'
    });
  }
};

// Middleware for request logging
const requestLoggingMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    performanceLogger.apiResponse(
      req.originalUrl,
      req.method,
      duration,
      res.statusCode,
      req.user ? req.user.id : null
    );
  });
  
  next();
};

module.exports = {
  logger,
  loggers,
  securityLogger,
  businessLogger,
  performanceLogger,
  errorLogger,
  requestLoggingMiddleware
};

