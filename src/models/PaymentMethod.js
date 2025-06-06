const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

/**
 * PaymentMethod Model
 * 
 * Represents a user's payment method (credit card, bank account, etc.).
 */
const PaymentMethod = sequelize.define('PaymentMethod', {
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
  type: {
    type: DataTypes.ENUM('credit_card', 'debit_card', 'bank_account', 'paypal', 'crypto'),
    allowNull: false
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Payment provider (e.g., stripe, paypal)'
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Encrypted payment method token'
  },
  last_four: {
    type: DataTypes.STRING(4),
    allowNull: true,
    comment: 'Last four digits of card or account'
  },
  expiry_month: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 12
    }
  },
  expiry_year: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  card_brand: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Card brand (e.g., visa, mastercard)'
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'removed'),
    allowNull: false,
    defaultValue: 'active'
  },
  billing_details: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Billing address and other details'
  }
}, {
  tableName: 'payment_methods',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define associations
PaymentMethod.associate = (models) => {
  PaymentMethod.belongsTo(models.User, { foreignKey: 'user_id' });
};

module.exports = PaymentMethod;

