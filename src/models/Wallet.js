const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

/**
 * Wallet Model
 * 
 * Represents a user's wallet for storing funds.
 */
const Wallet = sequelize.define('Wallet', {
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
  balance: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'USD'
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'closed'),
    allowNull: false,
    defaultValue: 'active'
  },
  stripe_customer_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  stripe_account_id: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'wallets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define associations
Wallet.associate = (models) => {
  Wallet.belongsTo(models.User, { foreignKey: 'user_id' });
  Wallet.hasMany(models.Transaction, { foreignKey: 'wallet_id' });
};

module.exports = Wallet;

