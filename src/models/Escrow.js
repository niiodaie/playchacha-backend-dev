const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const BetMatch = require('./BetMatch');
const User = require('./User');

/**
 * Escrow Model
 * 
 * Represents funds held in escrow for a bet match.
 */
const Escrow = sequelize.define('Escrow', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  bet_match_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'BetMatches',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'disputed', 'refunded', 'cancelled'),
    allowNull: false,
    defaultValue: 'active'
  },
  winner_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'ID of the winning user'
  },
  platform_fee: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Platform fee amount (3% of total pot)'
  },
  released_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the funds were released from escrow'
  },
  dispute_reason: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Reason for dispute if status is disputed'
  },
  resolution_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notes on dispute resolution'
  },
  resolved_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'Admin who resolved the dispute'
  }
}, {
  tableName: 'escrows',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define associations
Escrow.associate = (models) => {
  Escrow.belongsTo(models.BetMatch, { foreignKey: 'bet_match_id' });
  Escrow.belongsTo(models.User, { as: 'winner', foreignKey: 'winner_id' });
  Escrow.belongsTo(models.User, { as: 'resolver', foreignKey: 'resolved_by' });
  Escrow.hasMany(models.Payout, { foreignKey: 'escrow_id' });
};

module.exports = Escrow;

