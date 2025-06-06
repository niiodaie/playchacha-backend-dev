const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const Escrow = require('./Escrow');
const Transaction = require('./Transaction');

/**
 * Payout Model
 * 
 * Represents a payout to a user from an escrow.
 */
const Payout = sequelize.define('Payout', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  escrow_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Escrows',
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
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  transaction_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Transactions',
      key: 'id'
    }
  },
  payout_method: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Method used for payout (e.g., wallet, bank_transfer)'
  },
  external_reference: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'External reference ID for the payout'
  },
  failure_reason: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Reason for failure if status is failed'
  }
}, {
  tableName: 'payouts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define associations
Payout.associate = (models) => {
  Payout.belongsTo(models.User, { foreignKey: 'user_id' });
  Payout.belongsTo(models.Escrow, { foreignKey: 'escrow_id' });
  Payout.belongsTo(models.Transaction, { foreignKey: 'transaction_id' });
};

module.exports = Payout;

