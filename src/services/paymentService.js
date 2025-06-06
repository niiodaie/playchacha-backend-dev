/**
 * Payment Service
 * 
 * This service handles payment methods and Stripe integration.
 */

const { PaymentMethod, User, sequelize } = require('../models');
const { stripe, safeStripeCall } = require('../config/stripe');
const logger = require('../config/logger');

/**
 * Create a payment method for a user
 * @param {string} userId - User ID
 * @param {string} paymentMethodId - Stripe payment method ID
 * @returns {Promise<Object>} Created payment method
 */
const createPaymentMethod = async (userId, paymentMethodId) => {
  try {
    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Get Stripe customer ID
    let stripeCustomerId = user.stripe_customer_id;
    
    if (!stripeCustomerId) {
      // Create Stripe customer if not exists
      const customer = await safeStripeCall(stripe.customers.create, {
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        metadata: {
          user_id: userId
        }
      });
      
      stripeCustomerId = customer.id;
      
      // Update user with Stripe customer ID
      await user.update({ stripe_customer_id: stripeCustomerId });
    }
    
    // Attach payment method to customer
    await safeStripeCall(stripe.paymentMethods.attach, paymentMethodId, {
      customer: stripeCustomerId
    });
    
    // Get payment method details from Stripe
    const paymentMethod = await safeStripeCall(stripe.paymentMethods.retrieve, paymentMethodId);
    
    // Determine payment method type and details
    let type, lastFour, expiryMonth, expiryYear, cardBrand;
    
    if (paymentMethod.type === 'card') {
      type = paymentMethod.card.funding === 'credit' ? 'credit_card' : 'debit_card';
      lastFour = paymentMethod.card.last4;
      expiryMonth = paymentMethod.card.exp_month;
      expiryYear = paymentMethod.card.exp_year;
      cardBrand = paymentMethod.card.brand;
    } else if (paymentMethod.type === 'bank_account') {
      type = 'bank_account';
      lastFour = paymentMethod.bank_account?.last4;
    } else {
      type = paymentMethod.type;
    }
    
    // Check if this is the first payment method for the user
    const existingMethods = await PaymentMethod.count({
      where: { user_id: userId }
    });
    
    const isDefault = existingMethods === 0;
    
    // Create payment method record
    const paymentMethodRecord = await PaymentMethod.create({
      user_id: userId,
      type,
      provider: 'stripe',
      token: paymentMethodId,
      last_four: lastFour,
      expiry_month: expiryMonth,
      expiry_year: expiryYear,
      card_brand: cardBrand,
      is_default: isDefault,
      status: 'active',
      billing_details: paymentMethod.billing_details
    });
    
    logger.info(`Payment method created for user ${userId}`, {
      payment_method_id: paymentMethodRecord.id,
      type
    });
    
    return paymentMethodRecord;
  } catch (error) {
    logger.error(`Error creating payment method: ${error.message}`, { userId, paymentMethodId });
    throw error;
  }
};

/**
 * Get payment methods for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Payment methods
 */
const getPaymentMethods = async (userId) => {
  try {
    const paymentMethods = await PaymentMethod.findAll({
      where: {
        user_id: userId,
        status: 'active'
      },
      order: [
        ['is_default', 'DESC'],
        ['created_at', 'DESC']
      ]
    });
    
    return paymentMethods;
  } catch (error) {
    logger.error(`Error getting payment methods: ${error.message}`, { userId });
    throw error;
  }
};

/**
 * Set a payment method as default
 * @param {string} paymentMethodId - Payment method ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated payment method
 */
const setDefaultPaymentMethod = async (paymentMethodId, userId) => {
  const t = await sequelize.transaction();
  
  try {
    // Check if payment method exists and belongs to user
    const paymentMethod = await PaymentMethod.findOne({
      where: {
        id: paymentMethodId,
        user_id: userId,
        status: 'active'
      },
      transaction: t
    });
    
    if (!paymentMethod) {
      throw new Error('Payment method not found or does not belong to user');
    }
    
    // Reset default flag for all user's payment methods
    await PaymentMethod.update(
      { is_default: false },
      {
        where: {
          user_id: userId,
          status: 'active'
        },
        transaction: t
      }
    );
    
    // Set this payment method as default
    paymentMethod.is_default = true;
    await paymentMethod.save({ transaction: t });
    
    await t.commit();
    
    logger.info(`Payment method ${paymentMethodId} set as default for user ${userId}`);
    
    return paymentMethod;
  } catch (error) {
    await t.rollback();
    logger.error(`Error setting default payment method: ${error.message}`, { paymentMethodId, userId });
    throw error;
  }
};

/**
 * Remove a payment method
 * @param {string} paymentMethodId - Payment method ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
const removePaymentMethod = async (paymentMethodId, userId) => {
  try {
    // Check if payment method exists and belongs to user
    const paymentMethod = await PaymentMethod.findOne({
      where: {
        id: paymentMethodId,
        user_id: userId,
        status: 'active'
      }
    });
    
    if (!paymentMethod) {
      throw new Error('Payment method not found or does not belong to user');
    }
    
    // Check if this is the default payment method
    if (paymentMethod.is_default) {
      // Find another payment method to set as default
      const anotherPaymentMethod = await PaymentMethod.findOne({
        where: {
          user_id: userId,
          status: 'active',
          id: { [sequelize.Op.ne]: paymentMethodId }
        }
      });
      
      if (anotherPaymentMethod) {
        await setDefaultPaymentMethod(anotherPaymentMethod.id, userId);
      }
    }
    
    // Detach payment method from Stripe customer
    await safeStripeCall(stripe.paymentMethods.detach, paymentMethod.token);
    
    // Mark payment method as removed
    await paymentMethod.update({ status: 'removed' });
    
    logger.info(`Payment method ${paymentMethodId} removed for user ${userId}`);
    
    return true;
  } catch (error) {
    logger.error(`Error removing payment method: ${error.message}`, { paymentMethodId, userId });
    throw error;
  }
};

/**
 * Create a Stripe Connect account for a user
 * @param {string} userId - User ID
 * @param {Object} accountDetails - Account details
 * @returns {Promise<Object>} Account creation result
 */
const createConnectAccount = async (userId, accountDetails) => {
  try {
    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check if user already has a Connect account
    if (user.stripe_account_id) {
      // Return the existing account
      const account = await safeStripeCall(stripe.accounts.retrieve, user.stripe_account_id);
      
      return {
        account_id: account.id,
        account_link: null,
        status: account.details_submitted ? 'complete' : 'pending'
      };
    }
    
    // Create a Connect account
    const account = await safeStripeCall(stripe.accounts.create, {
      type: 'express',
      country: process.env.STRIPE_ACCOUNT_COUNTRY || 'US',
      email: user.email,
      business_type: 'individual',
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true }
      },
      metadata: {
        user_id: userId
      }
    });
    
    // Update user with Connect account ID
    await user.update({ stripe_account_id: account.id });
    
    // Create an account link for onboarding
    const accountLink = await safeStripeCall(stripe.accountLinks.create, {
      account: account.id,
      refresh_url: `${process.env.PLATFORM_URL}/account/connect/refresh`,
      return_url: `${process.env.PLATFORM_URL}/account/connect/complete`,
      type: 'account_onboarding'
    });
    
    logger.info(`Connect account created for user ${userId}`, {
      account_id: account.id
    });
    
    return {
      account_id: account.id,
      account_link: accountLink.url,
      status: 'pending'
    };
  } catch (error) {
    logger.error(`Error creating Connect account: ${error.message}`, { userId });
    throw error;
  }
};

/**
 * Get Connect account status for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Account status
 */
const getConnectAccountStatus = async (userId) => {
  try {
    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check if user has a Connect account
    if (!user.stripe_account_id) {
      return {
        has_account: false,
        status: 'not_created',
        details_submitted: false,
        charges_enabled: false,
        payouts_enabled: false
      };
    }
    
    // Get account details from Stripe
    const account = await safeStripeCall(stripe.accounts.retrieve, user.stripe_account_id);
    
    return {
      has_account: true,
      status: account.details_submitted ? 'complete' : 'pending',
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements: account.requirements
    };
  } catch (error) {
    logger.error(`Error getting Connect account status: ${error.message}`, { userId });
    throw error;
  }
};

/**
 * Create a new account link for Connect onboarding
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Account link
 */
const createAccountLink = async (userId) => {
  try {
    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check if user has a Connect account
    if (!user.stripe_account_id) {
      throw new Error('User does not have a Connect account');
    }
    
    // Create an account link for onboarding
    const accountLink = await safeStripeCall(stripe.accountLinks.create, {
      account: user.stripe_account_id,
      refresh_url: `${process.env.PLATFORM_URL}/account/connect/refresh`,
      return_url: `${process.env.PLATFORM_URL}/account/connect/complete`,
      type: 'account_onboarding'
    });
    
    logger.info(`Account link created for user ${userId}`);
    
    return {
      account_link: accountLink.url
    };
  } catch (error) {
    logger.error(`Error creating account link: ${error.message}`, { userId });
    throw error;
  }
};

/**
 * Handle Stripe webhook events
 * @param {Object} event - Stripe event object
 * @returns {Promise<Object>} Processing result
 */
const handleWebhookEvent = async (event) => {
  try {
    const { type, data } = event;
    
    logger.info(`Processing Stripe webhook event: ${type}`, {
      event_id: event.id
    });
    
    switch (type) {
      case 'payment_intent.succeeded':
        // Handle successful payment
        await handlePaymentIntentSucceeded(data.object);
        break;
        
      case 'payment_intent.payment_failed':
        // Handle failed payment
        await handlePaymentIntentFailed(data.object);
        break;
        
      case 'account.updated':
        // Handle Connect account updates
        await handleAccountUpdated(data.object);
        break;
        
      // Add more event handlers as needed
        
      default:
        logger.info(`Unhandled webhook event type: ${type}`);
    }
    
    return { success: true, event_type: type };
  } catch (error) {
    logger.error(`Error handling webhook event: ${error.message}`, {
      event_id: event.id,
      event_type: event.type
    });
    throw error;
  }
};

/**
 * Handle payment intent succeeded event
 * @param {Object} paymentIntent - Payment intent object
 * @returns {Promise<void>}
 */
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    const { metadata } = paymentIntent;
    
    if (!metadata || !metadata.type) {
      logger.warn('Payment intent has no metadata or type', {
        payment_intent_id: paymentIntent.id
      });
      return;
    }
    
    // Different handling based on payment type
    switch (metadata.type) {
      case 'deposit':
        // Deposit already handled in processDeposit
        logger.info(`Deposit payment confirmed: ${paymentIntent.id}`);
        break;
        
      // Add more payment types as needed
        
      default:
        logger.info(`Unhandled payment type: ${metadata.type}`);
    }
  } catch (error) {
    logger.error(`Error handling payment intent succeeded: ${error.message}`, {
      payment_intent_id: paymentIntent.id
    });
    throw error;
  }
};

/**
 * Handle payment intent failed event
 * @param {Object} paymentIntent - Payment intent object
 * @returns {Promise<void>}
 */
const handlePaymentIntentFailed = async (paymentIntent) => {
  try {
    const { metadata, last_payment_error } = paymentIntent;
    
    if (!metadata || !metadata.type) {
      logger.warn('Failed payment intent has no metadata or type', {
        payment_intent_id: paymentIntent.id
      });
      return;
    }
    
    // Different handling based on payment type
    switch (metadata.type) {
      case 'deposit':
        // Update transaction status if it exists
        if (metadata.wallet_id) {
          const { Transaction } = require('../models');
          
          await Transaction.update(
            {
              status: 'failed',
              metadata: {
                ...metadata,
                error: last_payment_error
              }
            },
            {
              where: {
                reference_id: paymentIntent.id
              }
            }
          );
          
          logger.info(`Deposit payment failed: ${paymentIntent.id}`, {
            error: last_payment_error?.message
          });
        }
        break;
        
      // Add more payment types as needed
        
      default:
        logger.info(`Unhandled failed payment type: ${metadata.type}`);
    }
  } catch (error) {
    logger.error(`Error handling payment intent failed: ${error.message}`, {
      payment_intent_id: paymentIntent.id
    });
    throw error;
  }
};

/**
 * Handle Connect account updated event
 * @param {Object} account - Account object
 * @returns {Promise<void>}
 */
const handleAccountUpdated = async (account) => {
  try {
    const { metadata } = account;
    
    if (!metadata || !metadata.user_id) {
      logger.warn('Account has no metadata or user_id', {
        account_id: account.id
      });
      return;
    }
    
    // Update user's wallet with Connect account status
    const user = await User.findOne({
      where: { id: metadata.user_id }
    });
    
    if (!user) {
      logger.warn(`User not found for Connect account: ${account.id}`);
      return;
    }
    
    // Update user's wallet if needed
    const wallet = await require('./walletService').getWallet(metadata.user_id);
    
    if (wallet) {
      await wallet.update({
        stripe_account_id: account.id
      });
    }
    
    logger.info(`Connect account updated for user ${metadata.user_id}`, {
      account_id: account.id,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled
    });
  } catch (error) {
    logger.error(`Error handling account updated: ${error.message}`, {
      account_id: account.id
    });
    throw error;
  }
};

module.exports = {
  createPaymentMethod,
  getPaymentMethods,
  setDefaultPaymentMethod,
  removePaymentMethod,
  createConnectAccount,
  getConnectAccountStatus,
  createAccountLink,
  handleWebhookEvent
};

