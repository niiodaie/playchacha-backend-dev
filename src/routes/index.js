const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const walletRoutes = require('./walletRoutes');
const paymentRoutes = require('./paymentRoutes');
const escrowRoutes = require('./escrowRoutes');
const sportsRoutes = require('./sportsRoutes');
const bettingRoutes = require('./bettingRoutes');

const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date()
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/wallet', walletRoutes);
router.use('/payments', paymentRoutes);
router.use('/escrow', escrowRoutes);
router.use('/sports', sportsRoutes);
router.use('/bets', bettingRoutes);

module.exports = router;

