/**
 * Payment Routes
 * 
 * This file defines the API routes for payment operations.
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { auth } = require('../middleware');
const { validate } = require('../middleware');
const { body } = require('express-validator');

// Middleware to ensure user is authenticated (except webhook)
router.use('/webhook', express.raw({ type: 'application/json' }));
router.post('/webhook', paymentController.handleWebhook);

// All other routes require authentication
router.use(auth.authenticate);

// Get payment methods
router.get('/methods', paymentController.getPaymentMethods);

// Create a payment method
router.post(
  '/methods',
  [
    body('payment_method_id').notEmpty().withMessage('Payment method ID is required'),
    validate
  ],
  paymentController.createPaymentMethod
);

// Set default payment method
router.put('/methods/:id/default', paymentController.setDefaultPaymentMethod);

// Remove a payment method
router.delete('/methods/:id', paymentController.removePaymentMethod);

// Create a setup intent for adding a payment method
router.post('/setup-intent', paymentController.createSetupIntent);

// Connect account routes
router.post(
  '/connect',
  paymentController.createConnectAccount
);

router.get('/connect/status', paymentController.getConnectAccountStatus);

router.post('/connect/account-link', paymentController.createAccountLink);

module.exports = router;

