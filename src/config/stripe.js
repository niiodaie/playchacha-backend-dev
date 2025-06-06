/**
 * Stripe Configuration
 * 
 * This file configures the Stripe API client for payment processing.
 */

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('./logger');

// Configure Stripe API version
stripe.setApiVersion('2025-05-01');

// Log Stripe API errors
const handleStripeError = (error) => {
  const { type, message, code, decline_code, param } = error;
  
  logger.error(`Stripe Error: ${type} - ${message}`, {
    code,
    decline_code,
    param
  });
  
  return error;
};

// Wrapper for Stripe API calls with error handling
const safeStripeCall = async (stripeMethod, ...args) => {
  try {
    return await stripeMethod(...args);
  } catch (error) {
    throw handleStripeError(error);
  }
};

// Export configured Stripe client and helper functions
module.exports = {
  stripe,
  handleStripeError,
  safeStripeCall,
  
  // Constants
  PLATFORM_FEE_PERCENT: parseFloat(process.env.PLATFORM_FEE) || 0.03, // 3% by default
  
  // Stripe Connect account types
  ACCOUNT_TYPES: {
    STANDARD: 'standard',
    EXPRESS: 'express',
    CUSTOM: 'custom'
  },
  
  // Webhook signing secret
  WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
};

