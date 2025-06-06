/**
 * Database helper for tests
 * 
 * This file provides helper functions for setting up and tearing down the test database.
 */

const sequelize = require('../../src/config/database.test');
const User = require('../../src/models/User');
const Wallet = require('../../src/models/Wallet');
const Transaction = require('../../src/models/Transaction');
const PaymentMethod = require('../../src/models/PaymentMethod');
const Sport = require('../../src/models/Sport');
const League = require('../../src/models/League');
const Event = require('../../src/models/Event');
const Bet = require('../../src/models/Bet');
const BetMatch = require('../../src/models/BetMatch');
const Escrow = require('../../src/models/Escrow');
const Payout = require('../../src/models/Payout');

// Define model associations for testing
const setupAssociations = () => {
  // User associations
  User.hasOne(Wallet, { foreignKey: 'user_id', as: 'wallet' });
  User.hasMany(PaymentMethod, { foreignKey: 'user_id', as: 'paymentMethods' });
  User.hasMany(Bet, { foreignKey: 'creator_id', as: 'bets' });
  User.hasMany(BetMatch, { foreignKey: 'taker_id', as: 'takenBets' });
  
  // Wallet associations
  Wallet.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Wallet.hasMany(Transaction, { foreignKey: 'wallet_id', as: 'transactions' });
  
  // Transaction associations
  Transaction.belongsTo(Wallet, { foreignKey: 'wallet_id', as: 'wallet' });
  
  // PaymentMethod associations
  PaymentMethod.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  
  // Sport associations
  Sport.hasMany(League, { foreignKey: 'sport_id', as: 'leagues' });
  
  // League associations
  League.belongsTo(Sport, { foreignKey: 'sport_id', as: 'sport' });
  League.hasMany(Event, { foreignKey: 'league_id', as: 'events' });
  
  // Event associations
  Event.belongsTo(League, { foreignKey: 'league_id', as: 'league' });
  Event.hasMany(Bet, { foreignKey: 'event_id', as: 'bets' });
  
  // Bet associations
  Bet.belongsTo(User, { foreignKey: 'creator_id', as: 'creator' });
  Bet.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
  Bet.hasMany(BetMatch, { foreignKey: 'bet_id', as: 'matches' });
  
  // BetMatch associations
  BetMatch.belongsTo(Bet, { foreignKey: 'bet_id', as: 'bet' });
  BetMatch.belongsTo(User, { foreignKey: 'taker_id', as: 'taker' });
  BetMatch.hasOne(Escrow, { foreignKey: 'bet_match_id', as: 'escrow' });
  
  // Escrow associations
  Escrow.belongsTo(BetMatch, { foreignKey: 'bet_match_id', as: 'betMatch' });
  Escrow.belongsTo(User, { foreignKey: 'winner_id', as: 'winner' });
  Escrow.belongsTo(User, { foreignKey: 'resolved_by', as: 'resolver' });
  Escrow.hasMany(Payout, { foreignKey: 'escrow_id', as: 'payouts' });
  
  // Payout associations
  Payout.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Payout.belongsTo(Escrow, { foreignKey: 'escrow_id', as: 'escrow' });
  Payout.belongsTo(Transaction, { foreignKey: 'transaction_id', as: 'transaction' });
};

/**
 * Connect to the test database and sync models
 */
const connect = async () => {
  try {
    // Setup associations
    setupAssociations();
    
    // Sync all models with the database
    await sequelize.sync({ force: true });
    
    console.log('Test database connected and synced');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
};

/**
 * Close the database connection
 */
const closeDatabase = async () => {
  try {
    await sequelize.close();
    console.log('Test database connection closed');
  } catch (error) {
    console.error('Failed to close test database connection:', error);
    throw error;
  }
};

/**
 * Clear all data from the database
 */
const clearDatabase = async () => {
  try {
    await sequelize.sync({ force: true });
    console.log('Test database cleared');
  } catch (error) {
    console.error('Failed to clear test database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  connect,
  closeDatabase,
  clearDatabase,
  models: {
    User,
    Wallet,
    Transaction,
    PaymentMethod,
    Sport,
    League,
    Event,
    Bet,
    BetMatch,
    Escrow,
    Payout
  }
};

