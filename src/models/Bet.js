const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Bet = sequelize.define('Bet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  creator_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  event_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'events',
      key: 'id'
    }
  },
  bet_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['moneyline', 'spread', 'over_under', 'prop']]
    }
  },
  bet_details: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  odds: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: true
    }
  },
  stake_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      isDecimal: true,
      min: 1
    }
  },
  potential_payout: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'open',
    validate: {
      isIn: [['open', 'matched', 'settled', 'cancelled', 'refunded']]
    }
  },
  expiry_time: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  underscored: true,
  tableName: 'bets',
  indexes: [
    {
      fields: ['creator_id']
    },
    {
      fields: ['event_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['bet_type']
    }
  ]
});

module.exports = Bet;

