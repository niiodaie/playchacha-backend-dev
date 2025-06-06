const jwt = require('jsonwebtoken');
const { auth } = require('../config');
const { User } = require('../models');
const logger = require('../config/logger');

/**
 * Middleware to authenticate JWT tokens
 */
exports.authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, auth.jwtSecret);
    
    // Find user
    const user = await User.findByPk(decoded.id);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token. User not found.' 
      });
    }
    
    if (user.account_status !== 'active') {
      return res.status(403).json({ 
        success: false, 
        message: `Account is ${user.account_status}. Please contact support.` 
      });
    }
    
    // Add user to request object
    req.user = user;
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired. Please login again.' 
      });
    }
    
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

/**
 * Middleware to check if user is an admin
 */
exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Admin privileges required.' 
    });
  }
  
  next();
};

/**
 * Middleware to check if user is verified (KYC)
 */
exports.isVerified = (req, res, next) => {
  if (!req.user || !req.user.kyc_verified) {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. KYC verification required.' 
    });
  }
  
  next();
};

