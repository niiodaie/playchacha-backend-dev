/**
 * Sports Data Initialization Script
 * 
 * This script initializes the sports data synchronization process.
 * It fetches initial data from the sports API and sets up scheduled updates.
 */

const logger = require('../config/logger');
const sportsDataService = require('../services/sportsDataService');

/**
 * Initialize sports data
 * @returns {Promise<void>}
 */
const initSportsData = async () => {
  try {
    logger.info('Starting sports data initialization...');
    
    // Sync sports data
    await sportsDataService.syncSportsData();
    
    // Get all active sports
    const sports = await require('../models').Sport.findAll({ where: { active: true } });
    
    // Sync events and odds for each sport
    for (const sport of sports) {
      await sportsDataService.syncEventsData(sport.key);
    }
    
    // Schedule regular updates
    // Update every 15 minutes (900000 ms)
    sportsDataService.scheduleDataSync(900000);
    
    logger.info('Sports data initialization completed successfully');
  } catch (error) {
    logger.error(`Error initializing sports data: ${error.message}`);
    throw error;
  }
};

module.exports = initSportsData;

