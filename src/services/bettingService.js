const { Bet, BetMatch, Escrow, Event, User, Wallet, Transaction } = require('../models');
const { sequelize } = require('../config');
const { auth } = require('../config');
const logger = require('../config/logger');

/**
 * Betting service for handling bet creation, matching, and settlement
 */
class BettingService {
  /**
   * Create a new bet
   * @param {string} userId - User ID
   * @param {Object} betData - Bet data
   * @returns {Object} Created bet
   */
  async createBet(userId, betData) {
    const transaction = await sequelize.transaction();
    
    try {
      // Get user's wallet
      const wallet = await Wallet.findOne({
        where: {
          user_id: userId
        },
        transaction
      });
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      // Check if user has sufficient balance
      if (wallet.balance < betData.stake_amount) {
        throw new Error('Insufficient balance');
      }
      
      // Get event
      const event = await Event.findByPk(betData.event_id, { transaction });
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Check if event has started
      if (new Date(event.start_time) <= new Date()) {
        throw new Error('Cannot place bet on event that has already started');
      }
      
      // Calculate potential payout based on odds
      const potentialPayout = betData.stake_amount * betData.odds;
      
      // Create bet
      const bet = await Bet.create({
        creator_id: userId,
        event_id: betData.event_id,
        bet_type: betData.bet_type,
        bet_details: betData.bet_details,
        odds: betData.odds,
        stake_amount: betData.stake_amount,
        potential_payout: potentialPayout,
        status: 'open',
        expiry_time: betData.expiry_time || new Date(event.start_time)
      }, { transaction });
      
      // Create transaction record for bet placement
      await Transaction.create({
        user_id: userId,
        wallet_id: wallet.id,
        amount: -betData.stake_amount,
        transaction_type: 'bet_place',
        status: 'completed',
        reference_id: bet.id
      }, { transaction });
      
      // Update wallet balance
      await wallet.decrement('balance', { by: betData.stake_amount, transaction });
      
      await transaction.commit();
      
      return bet;
    } catch (error) {
      await transaction.rollback();
      logger.error('Error creating bet:', error);
      throw error;
    }
  }
  
  /**
   * Take (match) an existing bet
   * @param {string} userId - User ID
   * @param {string} betId - Bet ID
   * @returns {Object} Bet match data
   */
  async takeBet(userId, betId) {
    const transaction = await sequelize.transaction();
    
    try {
      // Get bet
      const bet = await Bet.findByPk(betId, {
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username']
          },
          {
            model: Event,
            as: 'event'
          }
        ],
        transaction
      });
      
      if (!bet) {
        throw new Error('Bet not found');
      }
      
      // Check if bet is open
      if (bet.status !== 'open') {
        throw new Error('Bet is not open for matching');
      }
      
      // Check if event has started
      if (new Date(bet.event.start_time) <= new Date()) {
        throw new Error('Cannot take bet on event that has already started');
      }
      
      // Check if user is not the creator
      if (bet.creator_id === userId) {
        throw new Error('Cannot take your own bet');
      }
      
      // Get user's wallet
      const wallet = await Wallet.findOne({
        where: {
          user_id: userId
        },
        transaction
      });
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      // Calculate required stake amount
      const requiredStake = bet.potential_payout - bet.stake_amount;
      
      // Check if user has sufficient balance
      if (wallet.balance < requiredStake) {
        throw new Error('Insufficient balance');
      }
      
      // Calculate platform fee (3% of total pot)
      const totalPot = bet.stake_amount + requiredStake;
      const platformFee = totalPot * auth.platformFee;
      
      // Create escrow
      const escrow = await Escrow.create({
        creator_amount: bet.stake_amount,
        taker_amount: requiredStake,
        platform_fee: platformFee,
        status: 'held'
      }, { transaction });
      
      // Create bet match
      const betMatch = await BetMatch.create({
        bet_id: bet.id,
        taker_id: userId,
        stake_amount: requiredStake,
        potential_payout: bet.stake_amount + requiredStake - platformFee,
        status: 'active',
        platform_fee: platformFee,
        escrow_id: escrow.id
      }, { transaction });
      
      // Update escrow with bet match ID
      await escrow.update({
        bet_match_id: betMatch.id
      }, { transaction });
      
      // Update bet status
      await bet.update({
        status: 'matched'
      }, { transaction });
      
      // Create transaction record for bet placement
      await Transaction.create({
        user_id: userId,
        wallet_id: wallet.id,
        amount: -requiredStake,
        transaction_type: 'bet_place',
        status: 'completed',
        reference_id: betMatch.id
      }, { transaction });
      
      // Update wallet balance
      await wallet.decrement('balance', { by: requiredStake, transaction });
      
      await transaction.commit();
      
      return {
        betMatch,
        escrow
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('Error taking bet:', error);
      throw error;
    }
  }
  
  /**
   * Cancel a bet
   * @param {string} userId - User ID
   * @param {string} betId - Bet ID
   * @returns {Object} Cancelled bet
   */
  async cancelBet(userId, betId) {
    const transaction = await sequelize.transaction();
    
    try {
      // Get bet
      const bet = await Bet.findByPk(betId, { transaction });
      
      if (!bet) {
        throw new Error('Bet not found');
      }
      
      // Check if user is the creator
      if (bet.creator_id !== userId) {
        throw new Error('Only the creator can cancel this bet');
      }
      
      // Check if bet is open
      if (bet.status !== 'open') {
        throw new Error('Only open bets can be cancelled');
      }
      
      // Get user's wallet
      const wallet = await Wallet.findOne({
        where: {
          user_id: userId
        },
        transaction
      });
      
      // Update bet status
      await bet.update({
        status: 'cancelled'
      }, { transaction });
      
      // Create transaction record for refund
      await Transaction.create({
        user_id: userId,
        wallet_id: wallet.id,
        amount: bet.stake_amount,
        transaction_type: 'bet_refund',
        status: 'completed',
        reference_id: bet.id
      }, { transaction });
      
      // Update wallet balance
      await wallet.increment('balance', { by: bet.stake_amount, transaction });
      
      await transaction.commit();
      
      return bet;
    } catch (error) {
      await transaction.rollback();
      logger.error('Error cancelling bet:', error);
      throw error;
    }
  }
  
  /**
   * Settle a bet based on event results
   * @param {string} betMatchId - Bet match ID
   * @param {Object} eventResult - Event result data
   * @returns {Object} Settlement result
   */
  async settleBet(betMatchId, eventResult) {
    const transaction = await sequelize.transaction();
    
    try {
      // Get bet match
      const betMatch = await BetMatch.findByPk(betMatchId, {
        include: [
          {
            model: Bet,
            as: 'bet',
            include: [
              {
                model: Event,
                as: 'event'
              },
              {
                model: User,
                as: 'creator'
              }
            ]
          },
          {
            model: User,
            as: 'taker'
          },
          {
            model: Escrow,
            as: 'escrow'
          }
        ],
        transaction
      });
      
      if (!betMatch) {
        throw new Error('Bet match not found');
      }
      
      // Check if bet match is active
      if (betMatch.status !== 'active') {
        throw new Error('Bet match is not active');
      }
      
      // Check if escrow is held
      if (betMatch.escrow.status !== 'held') {
        throw new Error('Escrow funds are not held');
      }
      
      // Determine winner based on bet type and event result
      const winnerId = this.determineWinner(betMatch.bet, eventResult);
      
      // Get winner's wallet
      const winnerWallet = await Wallet.findOne({
        where: {
          user_id: winnerId
        },
        transaction
      });
      
      if (!winnerWallet) {
        throw new Error('Winner wallet not found');
      }
      
      // Calculate winnings (total pot minus platform fee)
      const totalPot = betMatch.escrow.creator_amount + betMatch.escrow.taker_amount;
      const winnings = totalPot - betMatch.escrow.platform_fee;
      
      // Update escrow
      await betMatch.escrow.update({
        status: 'released',
        winner_id: winnerId,
        released_at: new Date()
      }, { transaction });
      
      // Update bet match
      await betMatch.update({
        status: 'settled'
      }, { transaction });
      
      // Create transaction record for winnings
      await Transaction.create({
        user_id: winnerId,
        wallet_id: winnerWallet.id,
        amount: winnings,
        transaction_type: 'bet_win',
        status: 'completed',
        reference_id: betMatch.id
      }, { transaction });
      
      // Create transaction record for platform fee
      await Transaction.create({
        user_id: winnerId,
        wallet_id: winnerWallet.id,
        amount: -betMatch.escrow.platform_fee,
        transaction_type: 'fee',
        status: 'completed',
        reference_id: betMatch.id
      }, { transaction });
      
      // Update winner's wallet balance
      await winnerWallet.increment('balance', { by: winnings, transaction });
      
      await transaction.commit();
      
      return {
        betMatch,
        winnerId,
        winnings
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('Error settling bet:', error);
      throw error;
    }
  }
  
  /**
   * Get available bets
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options
   * @returns {Array} List of bets
   */
  async getAvailableBets(filters = {}, options = {}) {
    try {
      const { limit = 20, offset = 0 } = options;
      const { eventId, sportId, betType } = filters;
      
      // Build query
      const query = {
        where: {
          status: 'open',
          expiry_time: {
            [sequelize.Op.gt]: new Date()
          }
        },
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username']
          },
          {
            model: Event,
            as: 'event',
            include: [
              {
                model: League,
                as: 'league'
              }
            ]
          }
        ],
        limit,
        offset,
        order: [['created_at', 'DESC']]
      };
      
      // Add event filter if provided
      if (eventId) {
        query.where.event_id = eventId;
      }
      
      // Add sport filter if provided
      if (sportId) {
        query.include[1].include[0].where = {
          sport_id: sportId
        };
      }
      
      // Add bet type filter if provided
      if (betType) {
        query.where.bet_type = betType;
      }
      
      // Get bets
      const bets = await Bet.findAndCountAll(query);
      
      return {
        total: bets.count,
        bets: bets.rows,
        limit,
        offset
      };
    } catch (error) {
      logger.error('Error getting available bets:', error);
      throw error;
    }
  }
  
  /**
   * Get user's bets
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} List of bets
   */
  async getUserBets(userId, options = {}) {
    try {
      const { limit = 20, offset = 0, status } = options;
      
      // Build query
      const query = {
        where: {
          creator_id: userId
        },
        include: [
          {
            model: Event,
            as: 'event'
          },
          {
            model: BetMatch,
            as: 'matches',
            include: [
              {
                model: User,
                as: 'taker',
                attributes: ['id', 'username']
              },
              {
                model: Escrow,
                as: 'escrow'
              }
            ]
          }
        ],
        limit,
        offset,
        order: [['created_at', 'DESC']]
      };
      
      // Add status filter if provided
      if (status) {
        query.where.status = status;
      }
      
      // Get bets
      const bets = await Bet.findAndCountAll(query);
      
      return {
        total: bets.count,
        bets: bets.rows,
        limit,
        offset
      };
    } catch (error) {
      logger.error('Error getting user bets:', error);
      throw error;
    }
  }
  
  /**
   * Get user's bet matches (bets taken)
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} List of bet matches
   */
  async getUserBetMatches(userId, options = {}) {
    try {
      const { limit = 20, offset = 0, status } = options;
      
      // Build query
      const query = {
        where: {
          taker_id: userId
        },
        include: [
          {
            model: Bet,
            as: 'bet',
            include: [
              {
                model: User,
                as: 'creator',
                attributes: ['id', 'username']
              },
              {
                model: Event,
                as: 'event'
              }
            ]
          },
          {
            model: Escrow,
            as: 'escrow'
          }
        ],
        limit,
        offset,
        order: [['created_at', 'DESC']]
      };
      
      // Add status filter if provided
      if (status) {
        query.where.status = status;
      }
      
      // Get bet matches
      const betMatches = await BetMatch.findAndCountAll(query);
      
      return {
        total: betMatches.count,
        betMatches: betMatches.rows,
        limit,
        offset
      };
    } catch (error) {
      logger.error('Error getting user bet matches:', error);
      throw error;
    }
  }
  
  /**
   * Determine winner based on bet type and event result
   * @param {Object} bet - Bet object
   * @param {Object} eventResult - Event result data
   * @returns {string} Winner user ID
   */
  determineWinner(bet, eventResult) {
    const { home_score, away_score } = eventResult;
    const { creator_id } = bet;
    const { bet_type, bet_details } = bet;
    
    // Get taker ID from first match (assuming only one match per bet)
    const taker_id = bet.matches[0].taker_id;
    
    switch (bet_type) {
      case 'moneyline':
        // Moneyline bet on which team wins
        if (bet_details.pick === 'home') {
          return home_score > away_score ? creator_id : taker_id;
        } else {
          return away_score > home_score ? creator_id : taker_id;
        }
        
      case 'spread':
        // Spread bet with handicap
        const spread = parseFloat(bet_details.spread);
        const adjustedHomeScore = home_score + spread;
        
        if (bet_details.pick === 'home') {
          return adjustedHomeScore > away_score ? creator_id : taker_id;
        } else {
          return adjustedHomeScore < away_score ? creator_id : taker_id;
        }
        
      case 'over_under':
        // Over/under bet on total score
        const total = parseFloat(bet_details.total);
        const actualTotal = home_score + away_score;
        
        if (bet_details.pick === 'over') {
          return actualTotal > total ? creator_id : taker_id;
        } else {
          return actualTotal < total ? creator_id : taker_id;
        }
        
      case 'prop':
        // Prop bets would require custom logic based on the specific prop
        // For now, we'll just return the creator as winner (placeholder)
        logger.warn('Prop bet settlement not fully implemented');
        return creator_id;
        
      default:
        logger.error('Unknown bet type:', bet_type);
        throw new Error('Unknown bet type');
    }
  }
}

module.exports = new BettingService();

