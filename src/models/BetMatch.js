const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BetMatch = sequelize.define('BetMatch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  bet_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'bets',
      key: 'id'
    }
  },
  taker_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
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
    defaultValue: 'active',
    validate: {
      isIn: [['active', 'settled', 'cancelled', 'refunded']]
    }
  },
  platform_fee: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  escrow_id: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  timestamps: true,
  underscored: true,
  tableName: 'bet_matches',
  indexes: [
    {
      fields: ['bet_id']
    },
    {
      fields: ['taker_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['escrow_id']
    }
  ]
});

module.exports = BetMatch;

