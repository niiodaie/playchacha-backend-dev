const { logger, performanceLogger } = require('../utils/logger');
const { AppError } = require('./errorHandler');

// Health check endpoint
const healthCheck = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      checks: {}
    };

    // Database health check
    try {
      const { sequelize } = require('../models');
      await sequelize.authenticate();
      health.checks.database = { status: 'healthy', responseTime: Date.now() - startTime };
    } catch (error) {
      health.checks.database = { status: 'unhealthy', error: error.message };
      health.status = 'degraded';
    }

    // Redis health check (if using Redis)
    try {
      // Add Redis health check here if implemented
      health.checks.redis = { status: 'healthy' };
    } catch (error) {
      health.checks.redis = { status: 'unhealthy', error: error.message };
      health.status = 'degraded';
    }

    // External API health check
    try {
      // Check sports API availability
      const response = await fetch(process.env.ODDS_API_URL + '/sports', {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.ODDS_API_KEY
        }
      });
      
      if (response.ok) {
        health.checks.sportsApi = { status: 'healthy' };
      } else {
        health.checks.sportsApi = { status: 'unhealthy', statusCode: response.status };
        health.status = 'degraded';
      }
    } catch (error) {
      health.checks.sportsApi = { status: 'unhealthy', error: error.message };
      health.status = 'degraded';
    }

    // Memory usage check
    const memUsage = process.memoryUsage();
    health.checks.memory = {
      status: memUsage.heapUsed < 1024 * 1024 * 1024 ? 'healthy' : 'warning', // 1GB threshold
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    };

    // CPU usage check (simplified)
    const cpuUsage = process.cpuUsage();
    health.checks.cpu = {
      status: 'healthy',
      user: cpuUsage.user,
      system: cpuUsage.system
    };

    const responseTime = Date.now() - startTime;
    health.responseTime = `${responseTime}ms`;

    // Log health check
    performanceLogger.apiResponse('/health', 'GET', responseTime, 200);

    // Return appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
};

// Readiness check (for Kubernetes)
const readinessCheck = async (req, res) => {
  try {
    // Check if application is ready to serve traffic
    const { sequelize } = require('../models');
    await sequelize.authenticate();
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

// Liveness check (for Kubernetes)
const livenessCheck = (req, res) => {
  // Simple check to see if the process is alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

// Metrics endpoint
const metricsEndpoint = async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    };

    // Add application-specific metrics
    try {
      const { User, Bet, Transaction } = require('../models');
      
      metrics.application = {
        totalUsers: await User.count(),
        activeUsers: await User.count({ where: { status: 'active' } }),
        totalBets: await Bet.count(),
        activeBets: await Bet.count({ where: { status: 'active' } }),
        totalTransactions: await Transaction.count(),
        pendingTransactions: await Transaction.count({ where: { status: 'pending' } })
      };
    } catch (error) {
      metrics.application = { error: 'Could not fetch application metrics' };
    }

    res.json(metrics);
  } catch (error) {
    logger.error('Metrics endpoint failed', { error: error.message });
    res.status(500).json({
      error: 'Could not fetch metrics',
      timestamp: new Date().toISOString()
    });
  }
};

// Performance monitoring middleware
const performanceMonitoring = (req, res, next) => {
  const startTime = Date.now();
  const startUsage = process.cpuUsage();

  res.on('finish', () => {
    const endTime = Date.now();
    const endUsage = process.cpuUsage(startUsage);
    const duration = endTime - startTime;

    // Log slow requests
    if (duration > 1000) { // Log requests taking more than 1 second
      logger.warn('Slow request detected', {
        url: req.originalUrl,
        method: req.method,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }

    // Log performance metrics
    performanceLogger.apiResponse(
      req.originalUrl,
      req.method,
      duration,
      res.statusCode,
      req.user ? req.user.id : null
    );

    // Track CPU usage for the request
    if (endUsage.user > 100000 || endUsage.system > 100000) { // High CPU usage
      logger.warn('High CPU usage request', {
        url: req.originalUrl,
        method: req.method,
        cpuUser: endUsage.user,
        cpuSystem: endUsage.system,
        duration: `${duration}ms`
      });
    }
  });

  next();
};

// Request timeout middleware
const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.error('Request timeout', {
          url: req.originalUrl,
          method: req.method,
          timeout: timeoutMs,
          ip: req.ip
        });
        
        res.status(408).json({
          error: 'Request timeout',
          timeout: `${timeoutMs}ms`,
          timestamp: new Date().toISOString()
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

// Memory usage monitoring
const memoryMonitoring = () => {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    // Log memory usage if it's high
    if (heapUsedMB > 512) { // Log if using more than 512MB
      logger.warn('High memory usage detected', {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
      });
    }
    
    // Force garbage collection if memory usage is very high
    if (heapUsedMB > 1024 && global.gc) { // 1GB threshold
      logger.info('Forcing garbage collection due to high memory usage');
      global.gc();
    }
  }, 60000); // Check every minute
};

// Graceful shutdown monitoring
const shutdownMonitoring = (server) => {
  let isShuttingDown = false;

  const gracefulShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new requests
    server.close(() => {
      logger.info('HTTP server closed.');
      
      // Close database connections
      const { sequelize } = require('../models');
      sequelize.close().then(() => {
        logger.info('Database connections closed.');
        process.exit(0);
      }).catch((error) => {
        logger.error('Error closing database connections', { error: error.message });
        process.exit(1);
      });
    });

    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
      reason: reason,
      promise: promise
    });
    process.exit(1);
  });
};

module.exports = {
  healthCheck,
  readinessCheck,
  livenessCheck,
  metricsEndpoint,
  performanceMonitoring,
  requestTimeout,
  memoryMonitoring,
  shutdownMonitoring
};

