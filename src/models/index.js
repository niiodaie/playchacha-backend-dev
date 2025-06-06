const sequelize = require('../config/database');
const User = require('./User');
const Wallet = require('./Wallet');
const Transaction = require('./Transaction');
const PaymentMethod = require('./PaymentMethod');
const Sport = require('./Sport');
const League = require('./League');
const Event = require('./Event');
const Bet = require('./Bet');
const BetMatch = require('./BetMatch');
const Escrow = require('./Escrow');
const Payout = require('./Payout');

// Define relationships

// User - Wallet (one-to-many)
User.hasMany(Wallet, { foreignKey: 'user_id', as: 'wallets' });
Wallet.belongsTo(User, { foreignKey: 'user_id' });

// User - Transaction (one-to-many)
User.hasMany(Transaction, { foreignKey: 'user_id', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'user_id' });

// Wallet - Transaction (one-to-many)
Wallet.hasMany(Transaction, { foreignKey: 'wallet_id', as: 'transactions' });
Transaction.belongsTo(Wallet, { foreignKey: 'wallet_id' });

// User - PaymentMethod (one-to-many)
User.hasMany(PaymentMethod, { foreignKey: 'user_id', as: 'paymentMethods' });
PaymentMethod.belongsTo(User, { foreignKey: 'user_id' });

// Sport - League (one-to-many)
Sport.hasMany(League, { foreignKey: 'sport_id', as: 'leagues' });
League.belongsTo(Sport, { foreignKey: 'sport_id' });

// League - Event (one-to-many)
League.hasMany(Event, { foreignKey: 'league_id', as: 'events' });
Event.belongsTo(League, { foreignKey: 'league_id' });

// User - Bet (one-to-many) as creator
User.hasMany(Bet, { foreignKey: 'creator_id', as: 'createdBets' });
Bet.belongsTo(User, { foreignKey: 'creator_id', as: 'creator' });

// Event - Bet (one-to-many)
Event.hasMany(Bet, { foreignKey: 'event_id', as: 'bets' });
Bet.belongsTo(Event, { foreignKey: 'event_id' });

// Bet - BetMatch (one-to-many)
Bet.hasMany(BetMatch, { foreignKey: 'bet_id', as: 'matches' });
BetMatch.belongsTo(Bet, { foreignKey: 'bet_id' });

// User - BetMatch (one-to-many) as taker
User.hasMany(BetMatch, { foreignKey: 'taker_id', as: 'takenBets' });
BetMatch.belongsTo(User, { foreignKey: 'taker_id', as: 'taker' });

// BetMatch - Escrow (one-to-one)
BetMatch.hasOne(Escrow, { foreignKey: 'bet_match_id', as: 'escrow' });
Escrow.belongsTo(BetMatch, { foreignKey: 'bet_match_id' });

// User - Escrow (one-to-many) as winner
User.hasMany(Escrow, { foreignKey: 'winner_id', as: 'wonEscrows' });
Escrow.belongsTo(User, { foreignKey: 'winner_id', as: 'winner' });

// User - Escrow (one-to-many) as resolver
User.hasMany(Escrow, { foreignKey: 'resolved_by', as: 'resolvedEscrows' });
Escrow.belongsTo(User, { foreignKey: 'resolved_by', as: 'resolver' });

// Escrow - Payout (one-to-many)
Escrow.hasMany(Payout, { foreignKey: 'escrow_id', as: 'payouts' });
Payout.belongsTo(Escrow, { foreignKey: 'escrow_id' });

// User - Payout (one-to-many)
User.hasMany(Payout, { foreignKey: 'user_id', as: 'payouts' });
Payout.belongsTo(User, { foreignKey: 'user_id' });

// Transaction - Payout (one-to-one)
Transaction.hasOne(Payout, { foreignKey: 'transaction_id', as: 'payout' });
Payout.belongsTo(Transaction, { foreignKey: 'transaction_id' });

// Export models
module.exports = {
  sequelize,
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
};

