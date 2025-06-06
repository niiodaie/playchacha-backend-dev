const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define which transports the logger must use
const transports = [
  // Console transport for all logs
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(
        ({ timestamp, level, message, ...meta }) => 
          `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`
      )
    )
  }),
  
  // File transport for error logs
  new winston.transports.File({ 
    filename: path.join(__dirname, '../../logs/error.log'), 
    level: 'error' 
  }),
  
  // File transport for all logs
  new winston.transports.File({ 
    filename: path.join(__dirname, '../../logs/combined.log') 
  })
];

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false
});

module.exports = logger;

