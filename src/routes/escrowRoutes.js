/**
 * Escrow Routes
 * 
 * This file defines the API routes for escrow operations.
 */

const express = require('express');
const router = express.Router();
const escrowController = require('../controllers/escrowController');
const { auth } = require('../middleware');
const { validate } = require('../middleware');
const { body } = require('express-validator');

// Middleware to ensure user is authenticated
router.use(auth.authenticate);

// Create an escrow for a bet match
router.post(
  '/',
  [
    body('bet_match_id').notEmpty().withMessage('Bet match ID is required'),
    validate
  ],
  escrowController.createEscrow
);

// Get escrow details
router.get('/:id', escrowController.getEscrow);

// Get escrows for a user
router.get('/', escrowController.getUserEscrows);

// Release escrow funds to winner
router.post(
  '/:id/release',
  [
    body('winner_id').notEmpty().withMessage('Winner ID is required'),
    validate
  ],
  escrowController.releaseEscrow
);

// Create a dispute for an escrow
router.post(
  '/:id/dispute',
  [
    body('reason').notEmpty().withMessage('Dispute reason is required'),
    validate
  ],
  escrowController.createDispute
);

// Admin routes
router.use(auth.isAdmin);

// Resolve a disputed escrow (admin only)
router.post(
  '/:id/resolve',
  [
    body('notes').notEmpty().withMessage('Resolution notes are required'),
    validate
  ],
  escrowController.resolveDispute
);

// Get all disputed escrows (admin only)
router.get('/admin/disputed', escrowController.getDisputedEscrows);

module.exports = router;

