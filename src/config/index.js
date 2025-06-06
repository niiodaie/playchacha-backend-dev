const sequelize = require('./database');
const logger = require('./logger');
const auth = require('./auth');

module.exports = {
  sequelize,
  logger,
  auth,
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  oddsApiKey: process.env.ODDS_API_KEY
};

