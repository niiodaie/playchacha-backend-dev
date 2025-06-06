const express = require('express');
const { body } = require('express-validator');
const { userService } = require('../services');
const { auth, validate } = require('../middleware');

const router = express.Router();

/**
 * @route GET /api/users/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', auth.authenticate, async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.id);
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/users/me
 * @desc Update user profile
 * @access Private
 */
router.put(
  '/me',
  auth.authenticate,
  validate([
    body('first_name')
      .optional()
      .isLength({ max: 100 })
      .withMessage('First name cannot exceed 100 characters'),
    body('last_name')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Last name cannot exceed 100 characters'),
    body('phone_number')
      .optional()
      .isLength({ max: 20 })
      .withMessage('Phone number cannot exceed 20 characters'),
    body('state')
      .optional()
      .isLength({ max: 100 })
      .withMessage('State cannot exceed 100 characters')
  ]),
  async (req, res, next) => {
    try {
      const updatedProfile = await userService.updateProfile(req.user.id, req.body);
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PUT /api/users/password
 * @desc Change user password
 * @access Private
 */
router.put(
  '/password',
  auth.authenticate,
  validate([
    body('current_password')
      .notEmpty()
      .withMessage('Current password is required'),
    body('new_password')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
  ]),
  async (req, res, next) => {
    try {
      const { current_password, new_password } = req.body;
      await userService.changePassword(req.user.id, current_password, new_password);
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/users/kyc
 * @desc Submit KYC verification
 * @access Private
 */
router.post(
  '/kyc',
  auth.authenticate,
  validate([
    body('document_type')
      .notEmpty()
      .withMessage('Document type is required'),
    body('document_number')
      .notEmpty()
      .withMessage('Document number is required')
  ]),
  async (req, res, next) => {
    try {
      const result = await userService.submitKyc(req.user.id, req.body);
      res.json({
        success: true,
        message: 'KYC verification submitted',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/users/kyc/status
 * @desc Check KYC verification status
 * @access Private
 */
router.get('/kyc/status', auth.authenticate, async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.id);
    res.json({
      success: true,
      data: {
        kyc_verified: profile.kyc_verified,
        kyc_verification_date: profile.kyc_verification_date
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

