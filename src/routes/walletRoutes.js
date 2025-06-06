/**
 * Wallet Routes
 * 
 * This file defines the API routes for wallet operations.
 */

const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { auth } = require('../middleware');
const { validate } = require('../middleware');
const { body } = require('express-validator');

// Middleware to ensure user is authenticated
router.use(auth.authenticate);

// Get user's wallet
router.get('/', walletController.getWallet);

// Get transaction history
router.get('/transactions', walletController.getTransactions);

// Process a deposit
router.post(
  '/deposit',
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    body('payment_method_id').notEmpty().withMessage('Payment method ID is required'),
    body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
    validate
  ],
  walletController.deposit
);

// Process a withdrawal
router.post(
  '/withdraw',
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    body('withdrawal_method').notEmpty().withMessage('Withdrawal method is required'),
    body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
    validate
  ],
  walletController.withdraw
);

module.exports = router;

