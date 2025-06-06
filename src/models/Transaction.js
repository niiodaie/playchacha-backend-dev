const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Wallet = require('./Wallet');

/**
 * Transaction Model
 * 
 * Represents a financial transaction in the system.
 */
const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  wallet_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Wallets',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      notNull: true,
      notEmpty: true
    }
  },
  type: {
    type: DataTypes.ENUM('deposit', 'withdrawal', 'bet', 'win', 'fee', 'refund'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  reference_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'External reference ID (e.g., Stripe payment ID)'
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional data related to the transaction'
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define associations
Transaction.associate = (models) => {
  Transaction.belongsTo(models.Wallet, { foreignKey: 'wallet_id' });
};

module.exports = Transaction;

