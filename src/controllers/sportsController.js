/**
 * Sports Controller
 * 
 * This controller handles all sports-related API endpoints.
 */

const { Sport, League, Event } = require('../models');
const sportsDataService = require('../services/sportsDataService');
const logger = require('../config/logger');

/**
 * Get all sports
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getAllSports = async (req, res) => {
  try {
    const sports = await Sport.findAll({
      where: { active: true },
      attributes: ['id', 'key', 'name', 'group', 'description'],
      order: [['name', 'ASC']]
    });
    
    return res.status(200).json({
      success: true,
      count: sports.length,
      data: sports
    });
  } catch (error) {
    logger.error(`Error in getAllSports: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

/**
 * Get events for a specific sport
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getSportEvents = async (req, res) => {
  try {
    const { sportId } = req.params;
    
    // Validate sport exists
    const sport = await Sport.findByPk(sportId);
    if (!sport) {
      return res.status(404).json({
        success: false,
        error: 'Sport not found'
      });
    }
    
    // Get events for the sport
    const events = await Event.findAll({
      where: { 
        sport_id: sportId,
        commence_time: {
          [require('sequelize').Op.gte]: new Date() // Only future events
        }
      },
      attributes: [
        'id', 'external_id', 'home_team', 'away_team', 
        'commence_time', 'status', 'home_score', 'away_score'
      ],
      order: [['commence_time', 'ASC']]
    });
    
    return res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    logger.error(`Error in getSportEvents: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

/**
 * Get a specific event by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getEventById = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Get event with odds data
    const event = await Event.findByPk(eventId, {
      include: [
        {
          model: Sport,
          attributes: ['id', 'key', 'name', 'group']
        }
      ]
    });
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    // Get latest odds for this event
    // This would be implemented based on how we store odds data
    
    return res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    logger.error(`Error in getEventById: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

/**
 * Force refresh sports data from API
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const refreshSportsData = async (req, res) => {
  try {
    // Only allow admins to refresh data
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to perform this action'
      });
    }
    
    // Start the refresh process
    await sportsDataService.syncSportsData();
    
    return res.status(200).json({
      success: true,
      message: 'Sports data refresh initiated'
    });
  } catch (error) {
    logger.error(`Error in refreshSportsData: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

/**
 * Force refresh events data for a specific sport
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const refreshEventsData = async (req, res) => {
  try {
    // Only allow admins to refresh data
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to perform this action'
      });
    }
    
    const { sportKey } = req.params;
    
    // Validate sport exists
    const sport = await Sport.findOne({ where: { key: sportKey } });
    if (!sport) {
      return res.status(404).json({
        success: false,
        error: 'Sport not found'
      });
    }
    
    // Start the refresh process
    await sportsDataService.syncEventsData(sportKey);
    
    return res.status(200).json({
      success: true,
      message: `Events data refresh initiated for ${sport.name}`
    });
  } catch (error) {
    logger.error(`Error in refreshEventsData: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

module.exports = {
  getAllSports,
  getSportEvents,
  getEventById,
  refreshSportsData,
  refreshEventsData
};

