const { logger, errorLogger } = require('../utils/logger');

// Global error handler middleware
const globalErrorHandler = (err, req, res, next) => {
  // Log the error
  errorLogger.applicationError(err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user.id : null,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Set default error values
  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // Sequelize errors
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map(e => e.message).join(', ');
    error = { message, statusCode: 400 };
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    const message = 'Invalid reference to related resource';
    error = { message, statusCode: 400 };
  }

  // Payment processing errors
  if (err.type === 'StripeCardError') {
    const message = 'Payment failed: ' + err.message;
    error = { message, statusCode: 400 };
  }

  if (err.type === 'StripeInvalidRequestError') {
    const message = 'Invalid payment request';
    error = { message, statusCode: 400 };
  }

  // Rate limiting errors
  if (err.status === 429) {
    const message = 'Too many requests, please try again later';
    error = { message, statusCode: 429 };
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = { message, statusCode: 400 };
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown'
  });
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  logger.warn(message, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  res.status(404).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  });
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error handler
const validationErrorHandler = (errors) => {
  const formattedErrors = errors.array().map(error => ({
    field: error.param,
    message: error.msg,
    value: error.value
  }));

  return new AppError(`Validation failed: ${formattedErrors.map(e => e.message).join(', ')}`, 400);
};

// Business logic error handlers
const businessErrorHandlers = {
  insufficientFunds: (availableBalance, requiredAmount) => {
    return new AppError(
      `Insufficient funds. Available: ${availableBalance}, Required: ${requiredAmount}`,
      400
    );
  },

  betNotFound: (betId) => {
    return new AppError(`Bet with ID ${betId} not found`, 404);
  },

  betAlreadyMatched: (betId) => {
    return new AppError(`Bet ${betId} is already matched`, 400);
  },

  betExpired: (betId) => {
    return new AppError(`Bet ${betId} has expired`, 400);
  },

  eventNotFound: (eventId) => {
    return new AppError(`Event with ID ${eventId} not found`, 404);
  },

  eventAlreadyStarted: (eventId) => {
    return new AppError(`Event ${eventId} has already started`, 400);
  },

  userNotFound: (userId) => {
    return new AppError(`User with ID ${userId} not found`, 404);
  },

  userNotVerified: (userId) => {
    return new AppError(`User ${userId} is not verified`, 403);
  },

  userSuspended: (userId) => {
    return new AppError(`User ${userId} is suspended`, 403);
  },

  escrowNotFound: (escrowId) => {
    return new AppError(`Escrow with ID ${escrowId} not found`, 404);
  },

  escrowAlreadyReleased: (escrowId) => {
    return new AppError(`Escrow ${escrowId} has already been released`, 400);
  },

  paymentMethodNotFound: (paymentMethodId) => {
    return new AppError(`Payment method with ID ${paymentMethodId} not found`, 404);
  },

  transactionFailed: (reason) => {
    return new AppError(`Transaction failed: ${reason}`, 400);
  },

  withdrawalLimitExceeded: (limit, amount) => {
    return new AppError(`Withdrawal limit exceeded. Limit: ${limit}, Requested: ${amount}`, 400);
  },

  duplicateBet: () => {
    return new AppError('You have already placed a similar bet on this event', 400);
  },

  selfBetting: () => {
    return new AppError('You cannot bet against yourself', 400);
  },

  regionRestricted: (region) => {
    return new AppError(`Betting is not available in your region: ${region}`, 403);
  },

  ageRestricted: () => {
    return new AppError('You must be 18 or older to place bets', 403);
  },

  maintenanceMode: () => {
    return new AppError('Platform is currently under maintenance. Please try again later.', 503);
  }
};

// Error response formatter
const formatErrorResponse = (error, req) => {
  const response = {
    success: false,
    error: error.message,
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown'
  };

  // Add additional context in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
    response.details = {
      url: req.originalUrl,
      method: req.method,
      params: req.params,
      query: req.query,
      body: req.body
    };
  }

  return response;
};

// Graceful shutdown handler
const gracefulShutdown = (server) => {
  const shutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
      logger.info('HTTP server closed.');
      
      // Close database connections
      // Close Redis connections
      // Clean up other resources
      
      logger.info('Graceful shutdown completed.');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

// Unhandled promise rejection handler
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Promise Rejection', {
    error: err.message,
    stack: err.stack,
    promise: promise
  });
  
  // Close server & exit process
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Uncaught exception handler
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack
  });
  
  // Close server & exit process
  process.exit(1);
});

module.exports = {
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  validationErrorHandler,
  businessErrorHandlers,
  formatErrorResponse,
  gracefulShutdown
};

