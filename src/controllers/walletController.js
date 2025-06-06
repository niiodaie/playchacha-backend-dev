/**
 * Wallet Controller
 * 
 * Handles wallet-related API endpoints.
 */

const walletService = require('../services/walletService');
const logger = require('../config/logger');

/**
 * Get user's wallet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getWallet = async (req, res) => {
  try {
    const userId = req.user.id;
    const wallet = await walletService.getWallet(userId);
    
    res.status(200).json({
      success: true,
      data: {
        id: wallet.id,
        balance: wallet.balance,
        currency: wallet.currency,
        status: wallet.status
      }
    });
  } catch (error) {
    logger.error(`Error in getWallet controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet',
      message: error.message
    });
  }
};

/**
 * Get transaction history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit, offset, type, status } = req.query;
    
    // Get user's wallet
    const wallet = await walletService.getWallet(userId);
    
    // Get transaction history
    const transactions = await walletService.getTransactionHistory(wallet.id, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      type,
      status
    });
    
    res.status(200).json({
      success: true,
      data: {
        count: transactions.count,
        transactions: transactions.rows.map(tx => ({
          id: tx.id,
          amount: tx.amount,
          type: tx.type,
          status: tx.status,
          description: tx.description,
          created_at: tx.created_at
        }))
      }
    });
  } catch (error) {
    logger.error(`Error in getTransactions controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get transactions',
      message: error.message
    });
  }
};

/**
 * Process a deposit
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const deposit = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, payment_method_id, currency = 'USD' } = req.body;
    
    // Validate input
    if (!amount || !payment_method_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Amount and payment method ID are required'
      });
    }
    
    // Process deposit
    const result = await walletService.processDeposit(
      userId,
      parseFloat(amount),
      payment_method_id,
      currency
    );
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Error in deposit controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to process deposit',
      message: error.message
    });
  }
};

/**
 * Process a withdrawal
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const withdraw = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, withdrawal_method, withdrawal_details, currency = 'USD' } = req.body;
    
    // Validate input
    if (!amount || !withdrawal_method) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Amount and withdrawal method are required'
      });
    }
    
    // Process withdrawal
    const result = await walletService.processWithdrawal(
      userId,
      parseFloat(amount),
      withdrawal_method,
      withdrawal_details,
      currency
    );
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Error in withdraw controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to process withdrawal',
      message: error.message
    });
  }
};

module.exports = {
  getWallet,
  getTransactions,
  deposit,
  withdraw
};

