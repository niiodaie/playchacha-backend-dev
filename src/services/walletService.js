/**
 * Wallet Service
 * 
 * This service handles all wallet-related operations.
 */

const { Wallet, Transaction, User, sequelize } = require('../models');
const { stripe, safeStripeCall, PLATFORM_FEE_PERCENT } = require('../config/stripe');
const logger = require('../config/logger');

/**
 * Create a wallet for a user
 * @param {string} userId - User ID
 * @param {string} currency - Currency code (default: USD)
 * @returns {Promise<Object>} Created wallet
 */
const createWallet = async (userId, currency = 'USD') => {
  try {
    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check if wallet already exists for this user and currency
    const existingWallet = await Wallet.findOne({
      where: {
        user_id: userId,
        currency
      }
    });
    
    if (existingWallet) {
      return existingWallet;
    }
    
    // Create Stripe customer if not exists
    let stripeCustomerId = user.stripe_customer_id;
    
    if (!stripeCustomerId) {
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
    
    // Create wallet
    const wallet = await Wallet.create({
      user_id: userId,
      balance: 0,
      currency,
      status: 'active',
      stripe_customer_id: stripeCustomerId
    });
    
    logger.info(`Wallet created for user ${userId}`, { wallet_id: wallet.id });
    
    return wallet;
  } catch (error) {
    logger.error(`Error creating wallet: ${error.message}`, { userId });
    throw error;
  }
};

/**
 * Get a user's wallet
 * @param {string} userId - User ID
 * @param {string} currency - Currency code (default: USD)
 * @returns {Promise<Object>} Wallet
 */
const getWallet = async (userId, currency = 'USD') => {
  try {
    const wallet = await Wallet.findOne({
      where: {
        user_id: userId,
        currency
      }
    });
    
    if (!wallet) {
      // Create wallet if it doesn't exist
      return await createWallet(userId, currency);
    }
    
    return wallet;
  } catch (error) {
    logger.error(`Error getting wallet: ${error.message}`, { userId });
    throw error;
  }
};

/**
 * Update wallet balance
 * @param {string} walletId - Wallet ID
 * @param {number} amount - Amount to add (positive) or subtract (negative)
 * @param {Object} transaction - Sequelize transaction
 * @returns {Promise<Object>} Updated wallet
 */
const updateBalance = async (walletId, amount, transaction) => {
  try {
    const wallet = await Wallet.findByPk(walletId, { transaction });
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    if (wallet.status !== 'active') {
      throw new Error('Wallet is not active');
    }
    
    // Check if balance would go negative
    if (parseFloat(wallet.balance) + parseFloat(amount) < 0) {
      throw new Error('Insufficient funds');
    }
    
    // Update balance
    wallet.balance = parseFloat(wallet.balance) + parseFloat(amount);
    await wallet.save({ transaction });
    
    logger.info(`Wallet ${walletId} balance updated: ${amount}`, {
      new_balance: wallet.balance
    });
    
    return wallet;
  } catch (error) {
    logger.error(`Error updating wallet balance: ${error.message}`, { walletId, amount });
    throw error;
  }
};

/**
 * Process a deposit
 * @param {string} userId - User ID
 * @param {number} amount - Amount to deposit
 * @param {string} paymentMethodId - Stripe payment method ID
 * @param {string} currency - Currency code (default: USD)
 * @returns {Promise<Object>} Transaction details
 */
const processDeposit = async (userId, amount, paymentMethodId, currency = 'USD') => {
  const t = await sequelize.transaction();
  
  try {
    // Validate amount
    const minAmount = parseFloat(process.env.MIN_DEPOSIT_AMOUNT);
    const maxAmount = parseFloat(process.env.MAX_DEPOSIT_AMOUNT);
    
    if (amount < minAmount) {
      throw new Error(`Minimum deposit amount is ${minAmount} ${currency}`);
    }
    
    if (amount > maxAmount) {
      throw new Error(`Maximum deposit amount is ${maxAmount} ${currency}`);
    }
    
    // Get or create wallet
    const wallet = await getWallet(userId, currency);
    
    // Create payment intent with Stripe
    const paymentIntent = await safeStripeCall(stripe.paymentIntents.create, {
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: wallet.stripe_customer_id,
      payment_method: paymentMethodId,
      confirm: true,
      metadata: {
        wallet_id: wallet.id,
        user_id: userId,
        type: 'deposit'
      }
    });
    
    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment failed: ${paymentIntent.status}`);
    }
    
    // Create transaction record
    const transaction = await Transaction.create({
      wallet_id: wallet.id,
      amount,
      type: 'deposit',
      status: 'completed',
      reference_id: paymentIntent.id,
      description: 'Deposit to wallet',
      metadata: {
        payment_intent_id: paymentIntent.id,
        payment_method_id: paymentMethodId
      }
    }, { transaction: t });
    
    // Update wallet balance
    await updateBalance(wallet.id, amount, t);
    
    await t.commit();
    
    logger.info(`Deposit processed for user ${userId}`, {
      amount,
      transaction_id: transaction.id
    });
    
    return {
      transaction_id: transaction.id,
      amount,
      status: 'completed',
      payment_intent_id: paymentIntent.id
    };
  } catch (error) {
    await t.rollback();
    logger.error(`Error processing deposit: ${error.message}`, { userId, amount });
    throw error;
  }
};

/**
 * Process a withdrawal
 * @param {string} userId - User ID
 * @param {number} amount - Amount to withdraw
 * @param {string} withdrawalMethod - Withdrawal method (e.g., 'bank_account')
 * @param {Object} withdrawalDetails - Details for the withdrawal method
 * @param {string} currency - Currency code (default: USD)
 * @returns {Promise<Object>} Transaction details
 */
const processWithdrawal = async (userId, amount, withdrawalMethod, withdrawalDetails, currency = 'USD') => {
  const t = await sequelize.transaction();
  
  try {
    // Validate amount
    const minAmount = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT);
    const maxAmount = parseFloat(process.env.MAX_WITHDRAWAL_AMOUNT);
    const dailyLimit = parseFloat(process.env.DAILY_WITHDRAWAL_LIMIT);
    
    if (amount < minAmount) {
      throw new Error(`Minimum withdrawal amount is ${minAmount} ${currency}`);
    }
    
    if (amount > maxAmount) {
      throw new Error(`Maximum withdrawal amount is ${maxAmount} ${currency}`);
    }
    
    // Get wallet
    const wallet = await getWallet(userId, currency);
    
    // Check if user has sufficient balance
    if (parseFloat(wallet.balance) < amount) {
      throw new Error('Insufficient funds');
    }
    
    // Check daily withdrawal limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailyWithdrawals = await Transaction.sum('amount', {
      where: {
        wallet_id: wallet.id,
        type: 'withdrawal',
        status: ['pending', 'completed'],
        created_at: {
          [sequelize.Op.gte]: today
        }
      }
    });
    
    if (parseFloat(dailyWithdrawals) + parseFloat(amount) > dailyLimit) {
      throw new Error(`Daily withdrawal limit of ${dailyLimit} ${currency} exceeded`);
    }
    
    // Create transaction record
    const transaction = await Transaction.create({
      wallet_id: wallet.id,
      amount: -amount, // Negative amount for withdrawal
      type: 'withdrawal',
      status: 'pending',
      description: 'Withdrawal from wallet',
      metadata: {
        withdrawal_method: withdrawalMethod,
        withdrawal_details: withdrawalDetails
      }
    }, { transaction: t });
    
    // Update wallet balance
    await updateBalance(wallet.id, -amount, t);
    
    // Process withdrawal with Stripe (implementation depends on withdrawal method)
    // For now, we'll just mark it as pending and assume it will be processed manually
    // In a production system, you would integrate with Stripe Connect payouts or similar
    
    await t.commit();
    
    logger.info(`Withdrawal initiated for user ${userId}`, {
      amount,
      transaction_id: transaction.id
    });
    
    return {
      transaction_id: transaction.id,
      amount,
      status: 'pending',
      estimated_completion: '1-3 business days'
    };
  } catch (error) {
    await t.rollback();
    logger.error(`Error processing withdrawal: ${error.message}`, { userId, amount });
    throw error;
  }
};

/**
 * Get transaction history for a wallet
 * @param {string} walletId - Wallet ID
 * @param {Object} options - Query options (limit, offset, type, status)
 * @returns {Promise<Array>} Transactions
 */
const getTransactionHistory = async (walletId, options = {}) => {
  try {
    const { limit = 20, offset = 0, type, status } = options;
    
    const whereClause = { wallet_id: walletId };
    
    if (type) {
      whereClause.type = type;
    }
    
    if (status) {
      whereClause.status = status;
    }
    
    const transactions = await Transaction.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });
    
    return transactions;
  } catch (error) {
    logger.error(`Error getting transaction history: ${error.message}`, { walletId });
    throw error;
  }
};

/**
 * Create an escrow for a bet match
 * @param {string} betMatchId - Bet match ID
 * @param {number} amount - Total amount to escrow
 * @param {Object} transaction - Sequelize transaction
 * @returns {Promise<Object>} Created escrow
 */
const createEscrow = async (betMatchId, amount, transaction) => {
  try {
    const { Escrow, BetMatch } = require('../models');
    
    // Get bet match details
    const betMatch = await BetMatch.findByPk(betMatchId, {
      include: [
        { model: require('../models').Bet, as: 'bet', include: [{ model: User, as: 'creator' }] }
      ],
      transaction
    });
    
    if (!betMatch) {
      throw new Error('Bet match not found');
    }
    
    // Calculate platform fee
    const platformFee = parseFloat(amount) * PLATFORM_FEE_PERCENT;
    
    // Create escrow record
    const escrow = await Escrow.create({
      bet_match_id: betMatchId,
      amount,
      status: 'active',
      platform_fee: platformFee
    }, { transaction });
    
    logger.info(`Escrow created for bet match ${betMatchId}`, {
      escrow_id: escrow.id,
      amount,
      platform_fee: platformFee
    });
    
    return escrow;
  } catch (error) {
    logger.error(`Error creating escrow: ${error.message}`, { betMatchId, amount });
    throw error;
  }
};

/**
 * Release escrow funds to winner
 * @param {string} escrowId - Escrow ID
 * @param {string} winnerId - Winner user ID
 * @returns {Promise<Object>} Payout details
 */
const releaseEscrow = async (escrowId, winnerId) => {
  const t = await sequelize.transaction();
  
  try {
    const { Escrow, Payout, BetMatch } = require('../models');
    
    // Get escrow details
    const escrow = await Escrow.findByPk(escrowId, {
      include: [
        { model: BetMatch, as: 'betMatch', include: [{ model: require('../models').Bet, as: 'bet' }] }
      ],
      transaction: t
    });
    
    if (!escrow) {
      throw new Error('Escrow not found');
    }
    
    if (escrow.status !== 'active') {
      throw new Error(`Escrow is not active, current status: ${escrow.status}`);
    }
    
    // Calculate winnings (total amount minus platform fee)
    const winnings = parseFloat(escrow.amount) - parseFloat(escrow.platform_fee);
    
    // Get winner's wallet
    const wallet = await getWallet(winnerId);
    
    // Create transaction for winnings
    const transaction = await Transaction.create({
      wallet_id: wallet.id,
      amount: winnings,
      type: 'win',
      status: 'completed',
      reference_id: escrow.id,
      description: 'Bet winnings',
      metadata: {
        escrow_id: escrow.id,
        bet_match_id: escrow.bet_match_id
      }
    }, { transaction: t });
    
    // Update wallet balance
    await updateBalance(wallet.id, winnings, t);
    
    // Create payout record
    const payout = await Payout.create({
      user_id: winnerId,
      escrow_id: escrow.id,
      amount: winnings,
      status: 'completed',
      transaction_id: transaction.id,
      payout_method: 'wallet'
    }, { transaction: t });
    
    // Update escrow status
    await escrow.update({
      status: 'completed',
      winner_id: winnerId,
      released_at: new Date()
    }, { transaction: t });
    
    await t.commit();
    
    logger.info(`Escrow released to winner ${winnerId}`, {
      escrow_id: escrow.id,
      amount: winnings,
      payout_id: payout.id
    });
    
    return {
      payout_id: payout.id,
      amount: winnings,
      status: 'completed',
      escrow_id: escrow.id
    };
  } catch (error) {
    await t.rollback();
    logger.error(`Error releasing escrow: ${error.message}`, { escrowId, winnerId });
    throw error;
  }
};

/**
 * Handle a dispute for an escrow
 * @param {string} escrowId - Escrow ID
 * @param {string} userId - User ID creating the dispute
 * @param {string} reason - Reason for dispute
 * @returns {Promise<Object>} Updated escrow
 */
const disputeEscrow = async (escrowId, userId, reason) => {
  try {
    const { Escrow, BetMatch } = require('../models');
    
    // Get escrow details
    const escrow = await Escrow.findByPk(escrowId, {
      include: [
        { 
          model: BetMatch, 
          as: 'betMatch', 
          include: [
            { model: require('../models').Bet, as: 'bet', include: [{ model: User, as: 'creator' }] },
            { model: User, as: 'taker' }
          ] 
        }
      ]
    });
    
    if (!escrow) {
      throw new Error('Escrow not found');
    }
    
    if (escrow.status !== 'active') {
      throw new Error(`Escrow is not active, current status: ${escrow.status}`);
    }
    
    // Verify user is part of the bet
    const creatorId = escrow.betMatch.bet.creator_id;
    const takerId = escrow.betMatch.taker_id;
    
    if (userId !== creatorId && userId !== takerId) {
      throw new Error('User is not part of this bet');
    }
    
    // Update escrow status
    await escrow.update({
      status: 'disputed',
      dispute_reason: reason
    });
    
    logger.info(`Escrow disputed by user ${userId}`, {
      escrow_id: escrow.id,
      reason
    });
    
    return escrow;
  } catch (error) {
    logger.error(`Error disputing escrow: ${error.message}`, { escrowId, userId });
    throw error;
  }
};

/**
 * Resolve a disputed escrow
 * @param {string} escrowId - Escrow ID
 * @param {string} winnerId - Winner user ID (or null for refund)
 * @param {string} adminId - Admin user ID resolving the dispute
 * @param {string} notes - Resolution notes
 * @returns {Promise<Object>} Resolution details
 */
const resolveDispute = async (escrowId, winnerId, adminId, notes) => {
  const t = await sequelize.transaction();
  
  try {
    const { Escrow, BetMatch } = require('../models');
    
    // Get escrow details
    const escrow = await Escrow.findByPk(escrowId, {
      include: [
        { 
          model: BetMatch, 
          as: 'betMatch', 
          include: [
            { model: require('../models').Bet, as: 'bet', include: [{ model: User, as: 'creator' }] },
            { model: User, as: 'taker' }
          ] 
        }
      ],
      transaction: t
    });
    
    if (!escrow) {
      throw new Error('Escrow not found');
    }
    
    if (escrow.status !== 'disputed') {
      throw new Error(`Escrow is not disputed, current status: ${escrow.status}`);
    }
    
    // Update escrow with resolution details
    await escrow.update({
      resolved_by: adminId,
      resolution_notes: notes
    }, { transaction: t });
    
    let result;
    
    if (winnerId) {
      // Release to winner
      result = await releaseEscrow(escrowId, winnerId);
    } else {
      // Refund both parties
      // Implementation for refund logic would go here
      // This would involve returning funds to both the creator and taker
      
      // For now, we'll just mark it as refunded
      await escrow.update({
        status: 'refunded',
        released_at: new Date()
      }, { transaction: t });
      
      result = {
        status: 'refunded',
        escrow_id: escrow.id
      };
    }
    
    await t.commit();
    
    logger.info(`Dispute resolved for escrow ${escrowId}`, {
      winner_id: winnerId,
      admin_id: adminId,
      resolution: winnerId ? 'winner_declared' : 'refunded'
    });
    
    return result;
  } catch (error) {
    await t.rollback();
    logger.error(`Error resolving dispute: ${error.message}`, { escrowId, winnerId, adminId });
    throw error;
  }
};

module.exports = {
  createWallet,
  getWallet,
  updateBalance,
  processDeposit,
  processWithdrawal,
  getTransactionHistory,
  createEscrow,
  releaseEscrow,
  disputeEscrow,
  resolveDispute
};

