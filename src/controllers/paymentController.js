/**
 * Payment Controller
 * 
 * Handles payment-related API endpoints.
 */

const paymentService = require('../services/paymentService');
const { stripe } = require('../config/stripe');
const logger = require('../config/logger');

/**
 * Get payment methods
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getPaymentMethods = async (req, res) => {
  try {
    const userId = req.user.id;
    const paymentMethods = await paymentService.getPaymentMethods(userId);
    
    res.status(200).json({
      success: true,
      data: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        last_four: pm.last_four,
        card_brand: pm.card_brand,
        expiry_month: pm.expiry_month,
        expiry_year: pm.expiry_year,
        is_default: pm.is_default,
        created_at: pm.created_at
      }))
    });
  } catch (error) {
    logger.error(`Error in getPaymentMethods controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment methods',
      message: error.message
    });
  }
};

/**
 * Create a payment method
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const createPaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const { payment_method_id } = req.body;
    
    // Validate input
    if (!payment_method_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Payment method ID is required'
      });
    }
    
    // Create payment method
    const paymentMethod = await paymentService.createPaymentMethod(userId, payment_method_id);
    
    res.status(201).json({
      success: true,
      data: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        last_four: paymentMethod.last_four,
        card_brand: paymentMethod.card_brand,
        expiry_month: paymentMethod.expiry_month,
        expiry_year: paymentMethod.expiry_year,
        is_default: paymentMethod.is_default,
        created_at: paymentMethod.created_at
      }
    });
  } catch (error) {
    logger.error(`Error in createPaymentMethod controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment method',
      message: error.message
    });
  }
};

/**
 * Set default payment method
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const setDefaultPaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Set default payment method
    await paymentService.setDefaultPaymentMethod(id, userId);
    
    res.status(200).json({
      success: true,
      message: 'Payment method set as default'
    });
  } catch (error) {
    logger.error(`Error in setDefaultPaymentMethod controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to set default payment method',
      message: error.message
    });
  }
};

/**
 * Remove a payment method
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const removePaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Remove payment method
    await paymentService.removePaymentMethod(id, userId);
    
    res.status(200).json({
      success: true,
      message: 'Payment method removed'
    });
  } catch (error) {
    logger.error(`Error in removePaymentMethod controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to remove payment method',
      message: error.message
    });
  }
};

/**
 * Create a setup intent for adding a payment method
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const createSetupIntent = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user
    const { User } = require('../models');
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Create setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: user.stripe_customer_id,
      metadata: {
        user_id: userId
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        client_secret: setupIntent.client_secret
      }
    });
  } catch (error) {
    logger.error(`Error in createSetupIntent controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to create setup intent',
      message: error.message
    });
  }
};

/**
 * Create a Connect account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const createConnectAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountDetails = req.body;
    
    // Create Connect account
    const result = await paymentService.createConnectAccount(userId, accountDetails);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Error in createConnectAccount controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to create Connect account',
      message: error.message
    });
  }
};

/**
 * Get Connect account status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getConnectAccountStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get Connect account status
    const status = await paymentService.getConnectAccountStatus(userId);
    
    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error(`Error in getConnectAccountStatus controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get Connect account status',
      message: error.message
    });
  }
};

/**
 * Create a new account link for Connect onboarding
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const createAccountLink = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Create account link
    const result = await paymentService.createAccountLink(userId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Error in createAccountLink controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to create account link',
      message: error.message
    });
  }
};

/**
 * Handle Stripe webhook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  try {
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    
    // Process webhook event
    await paymentService.handleWebhookEvent(event);
    
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`Webhook error: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

module.exports = {
  getPaymentMethods,
  createPaymentMethod,
  setDefaultPaymentMethod,
  removePaymentMethod,
  createSetupIntent,
  createConnectAccount,
  getConnectAccountStatus,
  createAccountLink,
  handleWebhook
};

