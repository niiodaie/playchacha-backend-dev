const express = require('express');
const { body } = require('express-validator');
const { userService } = require('../services');
const { validate } = require('../middleware');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post(
  '/register',
  validate([
    body('username')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters'),
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('first_name')
      .optional()
      .isLength({ max: 100 })
      .withMessage('First name cannot exceed 100 characters'),
    body('last_name')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Last name cannot exceed 100 characters'),
    body('date_of_birth')
      .isDate()
      .withMessage('Please provide a valid date of birth'),
    body('country')
      .notEmpty()
      .withMessage('Country is required')
  ]),
  async (req, res, next) => {
    try {
      const result = await userService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/auth/login
 * @desc Login user and return token
 * @access Public
 */
router.post(
  '/login',
  validate([
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ]),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const result = await userService.login(email, password);
      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/auth/forgot-password
 * @desc Initiate password reset
 * @access Public
 */
router.post(
  '/forgot-password',
  validate([
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
  ]),
  async (req, res, next) => {
    try {
      // In a real application, this would send a password reset email
      // For now, we'll just return a success message
      res.json({
        success: true,
        message: 'Password reset instructions sent to your email'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/auth/reset-password
 * @desc Complete password reset
 * @access Public
 */
router.post(
  '/reset-password',
  validate([
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
  ]),
  async (req, res, next) => {
    try {
      // In a real application, this would verify the token and update the password
      // For now, we'll just return a success message
      res.json({
        success: true,
        message: 'Password reset successful'
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

