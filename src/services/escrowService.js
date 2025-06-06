/**
 * Escrow Service
 * 
 * This service handles escrow operations for bets.
 */

const { Escrow, BetMatch, Bet, User, Wallet, Transaction, Payout, sequelize } = require('../models');
const { PLATFORM_FEE_PERCENT } = require('../config/stripe');
const walletService = require('./walletService');
const logger = require('../config/logger');

/**
 * Create an escrow for a bet match
 * @param {string} betMatchId - Bet match ID
 * @returns {Promise<Object>} Created escrow
 */
const createEscrow = async (betMatchId) => {
  const t = await sequelize.transaction();
  
  try {
    // Get bet match details
    const betMatch = await BetMatch.findByPk(betMatchId, {
      include: [
        { 
          model: Bet, 
          as: 'bet',
          include: [{ model: User, as: 'creator' }]
        },
        { model: User, as: 'taker' }
      ],
      transaction: t
    });
    
    if (!betMatch) {
      throw new Error('Bet match not found');
    }
    
    // Check if escrow already exists
    const existingEscrow = await Escrow.findOne({
      where: { bet_match_id: betMatchId },
      transaction: t
    });
    
    if (existingEscrow) {
      throw new Error('Escrow already exists for this bet match');
    }
    
    // Get total amount from bet
    const amount = parseFloat(betMatch.bet.amount) * 2; // Both sides of the bet
    
    // Calculate platform fee
    const platformFee = amount * PLATFORM_FEE_PERCENT;
    
    // Create escrow record
    const escrow = await Escrow.create({
      bet_match_id: betMatchId,
      amount,
      status: 'active',
      platform_fee: platformFee
    }, { transaction: t });
    
    // Get wallets for both users
    const creatorWallet = await walletService.getWallet(betMatch.bet.creator_id);
    const takerWallet = await walletService.getWallet(betMatch.taker_id);
    
    // Check if both users have sufficient balance
    if (parseFloat(creatorWallet.balance) < parseFloat(betMatch.bet.amount)) {
      throw new Error('Creator has insufficient funds');
    }
    
    if (parseFloat(takerWallet.balance) < parseFloat(betMatch.bet.amount)) {
      throw new Error('Taker has insufficient funds');
    }
    
    // Create transactions for both users
    const creatorTransaction = await Transaction.create({
      wallet_id: creatorWallet.id,
      amount: -betMatch.bet.amount, // Negative amount for deduction
      type: 'bet',
      status: 'completed',
      reference_id: escrow.id,
      description: 'Funds placed in escrow for bet',
      metadata: {
        escrow_id: escrow.id,
        bet_match_id: betMatchId,
        bet_id: betMatch.bet.id,
        role: 'creator'
      }
    }, { transaction: t });
    
    const takerTransaction = await Transaction.create({
      wallet_id: takerWallet.id,
      amount: -betMatch.bet.amount, // Negative amount for deduction
      type: 'bet',
      status: 'completed',
      reference_id: escrow.id,
      description: 'Funds placed in escrow for bet',
      metadata: {
        escrow_id: escrow.id,
        bet_match_id: betMatchId,
        bet_id: betMatch.bet.id,
        role: 'taker'
      }
    }, { transaction: t });
    
    // Update wallet balances
    await walletService.updateBalance(creatorWallet.id, -betMatch.bet.amount, t);
    await walletService.updateBalance(takerWallet.id, -betMatch.bet.amount, t);
    
    // Update bet match status
    await betMatch.update({
      status: 'active',
      escrow_created_at: new Date()
    }, { transaction: t });
    
    await t.commit();
    
    logger.info(`Escrow created for bet match ${betMatchId}`, {
      escrow_id: escrow.id,
      amount,
      platform_fee: platformFee
    });
    
    return {
      escrow_id: escrow.id,
      amount,
      platform_fee: platformFee,
      status: 'active',
      creator_transaction_id: creatorTransaction.id,
      taker_transaction_id: takerTransaction.id
    };
  } catch (error) {
    await t.rollback();
    logger.error(`Error creating escrow: ${error.message}`, { betMatchId });
    throw error;
  }
};

/**
 * Get escrow details
 * @param {string} escrowId - Escrow ID
 * @returns {Promise<Object>} Escrow details
 */
const getEscrow = async (escrowId) => {
  try {
    const escrow = await Escrow.findByPk(escrowId, {
      include: [
        {
          model: BetMatch,
          as: 'betMatch',
          include: [
            { 
              model: Bet, 
              as: 'bet',
              include: [{ model: User, as: 'creator' }]
            },
            { model: User, as: 'taker' }
          ]
        },
        { model: User, as: 'winner' },
        { model: User, as: 'resolver' }
      ]
    });
    
    if (!escrow) {
      throw new Error('Escrow not found');
    }
    
    return escrow;
  } catch (error) {
    logger.error(`Error getting escrow: ${error.message}`, { escrowId });
    throw error;
  }
};

/**
 * Get escrows for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options (limit, offset, status)
 * @returns {Promise<Array>} Escrows
 */
const getUserEscrows = async (userId, options = {}) => {
  try {
    const { limit = 20, offset = 0, status } = options;
    
    // Find bet matches where user is either creator or taker
    const betMatches = await BetMatch.findAll({
      include: [
        {
          model: Bet,
          as: 'bet',
          where: { creator_id: userId },
          required: false
        },
        {
          model: Escrow,
          as: 'escrow',
          required: true,
          ...(status ? { where: { status } } : {})
        }
      ],
      where: {
        [sequelize.Op.or]: [
          { '$bet.creator_id$': userId },
          { taker_id: userId }
        ]
      },
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });
    
    // Extract escrows from bet matches
    const escrows = betMatches.map(match => match.escrow);
    
    return escrows;
  } catch (error) {
    logger.error(`Error getting user escrows: ${error.message}`, { userId });
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
    // Get escrow details
    const escrow = await Escrow.findByPk(escrowId, {
      include: [
        {
          model: BetMatch,
          as: 'betMatch',
          include: [
            { model: Bet, as: 'bet' },
            { model: User, as: 'taker' }
          ]
        }
      ],
      transaction: t
    });
    
    if (!escrow) {
      throw new Error('Escrow not found');
    }
    
    if (escrow.status !== 'active') {
      throw new Error(`Escrow is not active, current status: ${escrow.status}`);
    }
    
    // Verify winner is part of the bet
    const creatorId = escrow.betMatch.bet.creator_id;
    const takerId = escrow.betMatch.taker_id;
    
    if (winnerId !== creatorId && winnerId !== takerId) {
      throw new Error('Winner is not part of this bet');
    }
    
    // Calculate winnings (total amount minus platform fee)
    const winnings = parseFloat(escrow.amount) - parseFloat(escrow.platform_fee);
    
    // Get winner's wallet
    const wallet = await walletService.getWallet(winnerId);
    
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
    await walletService.updateBalance(wallet.id, winnings, t);
    
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
    
    // Update bet match status
    await escrow.betMatch.update({
      status: 'settled',
      winner_id: winnerId,
      settled_at: new Date()
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
 * Create a dispute for an escrow
 * @param {string} escrowId - Escrow ID
 * @param {string} userId - User ID creating the dispute
 * @param {string} reason - Reason for dispute
 * @returns {Promise<Object>} Updated escrow
 */
const createDispute = async (escrowId, userId, reason) => {
  try {
    // Get escrow details
    const escrow = await Escrow.findByPk(escrowId, {
      include: [
        {
          model: BetMatch,
          as: 'betMatch',
          include: [
            { model: Bet, as: 'bet' },
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
    
    // Update bet match status
    await escrow.betMatch.update({
      status: 'disputed'
    });
    
    logger.info(`Escrow disputed by user ${userId}`, {
      escrow_id: escrow.id,
      reason
    });
    
    return escrow;
  } catch (error) {
    logger.error(`Error creating dispute: ${error.message}`, { escrowId, userId });
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
    // Get escrow details
    const escrow = await Escrow.findByPk(escrowId, {
      include: [
        {
          model: BetMatch,
          as: 'betMatch',
          include: [
            { model: Bet, as: 'bet' },
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
      await escrow.update({
        status: 'completed',
        winner_id: winnerId,
        released_at: new Date()
      }, { transaction: t });
      
      // Calculate winnings (total amount minus platform fee)
      const winnings = parseFloat(escrow.amount) - parseFloat(escrow.platform_fee);
      
      // Get winner's wallet
      const wallet = await walletService.getWallet(winnerId);
      
      // Create transaction for winnings
      const transaction = await Transaction.create({
        wallet_id: wallet.id,
        amount: winnings,
        type: 'win',
        status: 'completed',
        reference_id: escrow.id,
        description: 'Bet winnings (dispute resolved)',
        metadata: {
          escrow_id: escrow.id,
          bet_match_id: escrow.bet_match_id,
          dispute_resolved_by: adminId
        }
      }, { transaction: t });
      
      // Update wallet balance
      await walletService.updateBalance(wallet.id, winnings, t);
      
      // Create payout record
      const payout = await Payout.create({
        user_id: winnerId,
        escrow_id: escrow.id,
        amount: winnings,
        status: 'completed',
        transaction_id: transaction.id,
        payout_method: 'wallet'
      }, { transaction: t });
      
      // Update bet match status
      await escrow.betMatch.update({
        status: 'settled',
        winner_id: winnerId,
        settled_at: new Date()
      }, { transaction: t });
      
      result = {
        resolution: 'winner_declared',
        winner_id: winnerId,
        payout_id: payout.id,
        amount: winnings
      };
    } else {
      // Refund both parties
      const creatorId = escrow.betMatch.bet.creator_id;
      const takerId = escrow.betMatch.taker_id;
      const betAmount = parseFloat(escrow.amount) / 2; // Split the total amount
      
      // Get wallets
      const creatorWallet = await walletService.getWallet(creatorId);
      const takerWallet = await walletService.getWallet(takerId);
      
      // Create refund transactions
      const creatorTransaction = await Transaction.create({
        wallet_id: creatorWallet.id,
        amount: betAmount,
        type: 'refund',
        status: 'completed',
        reference_id: escrow.id,
        description: 'Bet refund (dispute resolved)',
        metadata: {
          escrow_id: escrow.id,
          bet_match_id: escrow.bet_match_id,
          dispute_resolved_by: adminId,
          role: 'creator'
        }
      }, { transaction: t });
      
      const takerTransaction = await Transaction.create({
        wallet_id: takerWallet.id,
        amount: betAmount,
        type: 'refund',
        status: 'completed',
        reference_id: escrow.id,
        description: 'Bet refund (dispute resolved)',
        metadata: {
          escrow_id: escrow.id,
          bet_match_id: escrow.bet_match_id,
          dispute_resolved_by: adminId,
          role: 'taker'
        }
      }, { transaction: t });
      
      // Update wallet balances
      await walletService.updateBalance(creatorWallet.id, betAmount, t);
      await walletService.updateBalance(takerWallet.id, betAmount, t);
      
      // Update escrow status
      await escrow.update({
        status: 'refunded',
        released_at: new Date()
      }, { transaction: t });
      
      // Update bet match status
      await escrow.betMatch.update({
        status: 'cancelled',
        cancelled_at: new Date()
      }, { transaction: t });
      
      result = {
        resolution: 'refunded',
        creator_transaction_id: creatorTransaction.id,
        taker_transaction_id: takerTransaction.id,
        amount: betAmount
      };
    }
    
    await t.commit();
    
    logger.info(`Dispute resolved for escrow ${escrowId}`, {
      resolution: winnerId ? 'winner_declared' : 'refunded',
      admin_id: adminId
    });
    
    return result;
  } catch (error) {
    await t.rollback();
    logger.error(`Error resolving dispute: ${error.message}`, { escrowId, winnerId, adminId });
    throw error;
  }
};

/**
 * Get all disputed escrows
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Array>} Disputed escrows
 */
const getDisputedEscrows = async (options = {}) => {
  try {
    const { limit = 20, offset = 0 } = options;
    
    const escrows = await Escrow.findAndCountAll({
      where: { status: 'disputed' },
      include: [
        {
          model: BetMatch,
          as: 'betMatch',
          include: [
            { 
              model: Bet, 
              as: 'bet',
              include: [{ model: User, as: 'creator' }]
            },
            { model: User, as: 'taker' }
          ]
        }
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });
    
    return escrows;
  } catch (error) {
    logger.error(`Error getting disputed escrows: ${error.message}`);
    throw error;
  }
};

module.exports = {
  createEscrow,
  getEscrow,
  getUserEscrows,
  releaseEscrow,
  createDispute,
  resolveDispute,
  getDisputedEscrows
};

