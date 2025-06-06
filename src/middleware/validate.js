const { validationResult } = require('express-validator');

/**
 * Middleware to validate request data using express-validator
 * @param {Array} validations - Array of express-validator validation rules
 * @returns {Function} Express middleware function
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Execute all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Check for validation errors
    const errors = validationResult(req);
    
    if (errors.isEmpty()) {
      return next();
    }
    
    // Format validation errors
    const formattedErrors = errors.array().map(error => ({
      field: error.param,
      message: error.msg
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: formattedErrors
    });
  };
};

module.exports = validate;

