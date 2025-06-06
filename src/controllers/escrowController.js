/**
 * Escrow Controller
 * 
 * Handles escrow-related API endpoints.
 */

const escrowService = require('../services/escrowService');
const logger = require('../config/logger');

/**
 * Create an escrow for a bet match
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const createEscrow = async (req, res) => {
  try {
    const { bet_match_id } = req.body;
    
    // Validate input
    if (!bet_match_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Bet match ID is required'
      });
    }
    
    // Create escrow
    const result = await escrowService.createEscrow(bet_match_id);
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Error in createEscrow controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to create escrow',
      message: error.message
    });
  }
};

/**
 * Get escrow details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getEscrow = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get escrow
    const escrow = await escrowService.getEscrow(id);
    
    res.status(200).json({
      success: true,
      data: escrow
    });
  } catch (error) {
    logger.error(`Error in getEscrow controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get escrow',
      message: error.message
    });
  }
};

/**
 * Get escrows for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getUserEscrows = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit, offset, status } = req.query;
    
    // Get user escrows
    const escrows = await escrowService.getUserEscrows(userId, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      status
    });
    
    res.status(200).json({
      success: true,
      data: escrows
    });
  } catch (error) {
    logger.error(`Error in getUserEscrows controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get user escrows',
      message: error.message
    });
  }
};

/**
 * Release escrow funds to winner
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const releaseEscrow = async (req, res) => {
  try {
    const { id } = req.params;
    const { winner_id } = req.body;
    
    // Validate input
    if (!winner_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Winner ID is required'
      });
    }
    
    // Release escrow
    const result = await escrowService.releaseEscrow(id, winner_id);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Error in releaseEscrow controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to release escrow',
      message: error.message
    });
  }
};

/**
 * Create a dispute for an escrow
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const createDispute = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;
    
    // Validate input
    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Dispute reason is required'
      });
    }
    
    // Create dispute
    const escrow = await escrowService.createDispute(id, userId, reason);
    
    res.status(200).json({
      success: true,
      data: {
        id: escrow.id,
        status: escrow.status,
        dispute_reason: escrow.dispute_reason
      }
    });
  } catch (error) {
    logger.error(`Error in createDispute controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to create dispute',
      message: error.message
    });
  }
};

/**
 * Resolve a disputed escrow (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const resolveDispute = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const { winner_id, notes } = req.body;
    
    // Validate input
    if (!notes) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Resolution notes are required'
      });
    }
    
    // Resolve dispute
    const result = await escrowService.resolveDispute(id, winner_id, adminId, notes);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Error in resolveDispute controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve dispute',
      message: error.message
    });
  }
};

/**
 * Get all disputed escrows (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getDisputedEscrows = async (req, res) => {
  try {
    const { limit, offset } = req.query;
    
    // Get disputed escrows
    const escrows = await escrowService.getDisputedEscrows({
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0
    });
    
    res.status(200).json({
      success: true,
      data: {
        count: escrows.count,
        escrows: escrows.rows
      }
    });
  } catch (error) {
    logger.error(`Error in getDisputedEscrows controller: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get disputed escrows',
      message: error.message
    });
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

