/**
 * Sports Data Service
 * 
 * This service handles all interactions with external sports data APIs.
 * It provides methods to fetch sports, events, odds, and results.
 */

const axios = require('axios');
const logger = require('../config/logger');
const { Sport, League, Event } = require('../models');

// API configuration
const API_KEY = process.env.ODDS_API_KEY;
const API_BASE_URL = 'https://api.the-odds-api.com/v4';

/**
 * Fetch all available sports from the API
 * @returns {Promise<Array>} List of sports
 */
const fetchSports = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/sports`, {
      params: { apiKey: API_KEY }
    });
    
    logger.info(`Fetched ${response.data.length} sports from API`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching sports: ${error.message}`);
    throw error;
  }
};

/**
 * Fetch odds for a specific sport
 * @param {string} sportKey - The sport key
 * @param {string} regions - Comma-separated list of regions (us, uk, eu, au)
 * @param {string} markets - Comma-separated list of markets (h2h, spreads, totals)
 * @returns {Promise<Array>} List of events with odds
 */
const fetchOdds = async (sportKey, regions = 'us', markets = 'h2h') => {
  try {
    const response = await axios.get(`${API_BASE_URL}/sports/${sportKey}/odds`, {
      params: {
        apiKey: API_KEY,
        regions,
        markets,
        oddsFormat: 'american'
      }
    });
    
    logger.info(`Fetched odds for ${response.data.length} events in ${sportKey}`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching odds for ${sportKey}: ${error.message}`);
    throw error;
  }
};

/**
 * Fetch scores for a specific sport
 * @param {string} sportKey - The sport key
 * @param {number} daysFrom - Number of days in the past to include
 * @returns {Promise<Array>} List of events with scores
 */
const fetchScores = async (sportKey, daysFrom = 1) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/sports/${sportKey}/scores`, {
      params: {
        apiKey: API_KEY,
        daysFrom
      }
    });
    
    logger.info(`Fetched scores for ${response.data.length} events in ${sportKey}`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching scores for ${sportKey}: ${error.message}`);
    throw error;
  }
};

/**
 * Sync sports data from API to database
 * @returns {Promise<void>}
 */
const syncSportsData = async () => {
  try {
    const sports = await fetchSports();
    
    for (const sport of sports) {
      if (!sport.active) continue;
      
      // Create or update sport in database
      const [sportRecord] = await Sport.findOrCreate({
        where: { key: sport.key },
        defaults: {
          name: sport.title,
          group: sport.group,
          description: sport.description,
          active: sport.active,
          has_outrights: sport.has_outrights
        }
      });
      
      if (sportRecord) {
        logger.info(`Sport ${sport.title} synced to database`);
      }
    }
    
    logger.info('Sports data sync completed');
  } catch (error) {
    logger.error(`Error syncing sports data: ${error.message}`);
    throw error;
  }
};

/**
 * Sync events and odds data from API to database for a specific sport
 * @param {string} sportKey - The sport key
 * @returns {Promise<void>}
 */
const syncEventsData = async (sportKey) => {
  try {
    const events = await fetchOdds(sportKey);
    
    for (const event of events) {
      // Find the sport in the database
      const sport = await Sport.findOne({ where: { key: event.sport_key } });
      
      if (!sport) {
        logger.warn(`Sport ${event.sport_key} not found in database, skipping event`);
        continue;
      }
      
      // Create or update event in database
      const [eventRecord] = await Event.findOrCreate({
        where: { external_id: event.id },
        defaults: {
          sport_id: sport.id,
          home_team: event.home_team,
          away_team: event.away_team,
          commence_time: new Date(event.commence_time),
          status: 'upcoming'
        }
      });
      
      if (eventRecord) {
        // Process bookmakers and odds data
        await processOddsData(eventRecord, event.bookmakers);
        logger.info(`Event ${event.home_team} vs ${event.away_team} synced to database`);
      }
    }
    
    logger.info(`Events data sync completed for ${sportKey}`);
  } catch (error) {
    logger.error(`Error syncing events data for ${sportKey}: ${error.message}`);
    throw error;
  }
};

/**
 * Process odds data for an event
 * @param {Object} event - The event record from database
 * @param {Array} bookmakers - List of bookmakers with odds
 * @returns {Promise<void>}
 */
const processOddsData = async (event, bookmakers) => {
  try {
    // Implementation will depend on how we want to store odds data
    // For now, we'll just log the number of bookmakers
    logger.info(`Processed odds from ${bookmakers.length} bookmakers for event ID ${event.id}`);
  } catch (error) {
    logger.error(`Error processing odds data: ${error.message}`);
    throw error;
  }
};

/**
 * Update event results based on scores
 * @param {string} sportKey - The sport key
 * @returns {Promise<void>}
 */
const updateEventResults = async (sportKey) => {
  try {
    const scores = await fetchScores(sportKey);
    
    for (const score of scores) {
      // Find the event in the database
      const event = await Event.findOne({ where: { external_id: score.id } });
      
      if (!event) {
        logger.warn(`Event with ID ${score.id} not found in database, skipping result update`);
        continue;
      }
      
      // Update event with scores and status
      if (score.completed) {
        event.status = 'completed';
        event.home_score = score.scores?.[0]?.score || 0;
        event.away_score = score.scores?.[1]?.score || 0;
        await event.save();
        
        logger.info(`Updated results for event ID ${event.id}: ${event.home_team} ${event.home_score} - ${event.away_score} ${event.away_team}`);
      }
    }
    
    logger.info(`Event results update completed for ${sportKey}`);
  } catch (error) {
    logger.error(`Error updating event results for ${sportKey}: ${error.message}`);
    throw error;
  }
};

/**
 * Schedule regular data synchronization
 * @param {number} interval - Interval in milliseconds
 */
const scheduleDataSync = (interval = 3600000) => { // Default: 1 hour
  setInterval(async () => {
    try {
      await syncSportsData();
      
      // Get all active sports from database
      const sports = await Sport.findAll({ where: { active: true } });
      
      for (const sport of sports) {
        await syncEventsData(sport.key);
        await updateEventResults(sport.key);
      }
      
      logger.info('Scheduled data sync completed');
    } catch (error) {
      logger.error(`Error in scheduled data sync: ${error.message}`);
    }
  }, interval);
  
  logger.info(`Data sync scheduled to run every ${interval / 1000} seconds`);
};

module.exports = {
  fetchSports,
  fetchOdds,
  fetchScores,
  syncSportsData,
  syncEventsData,
  updateEventResults,
  scheduleDataSync
};

