const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Sport = sequelize.define('Sport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  api_sport_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  underscored: true,
  tableName: 'sports',
  indexes: [
    {
      fields: ['api_sport_key']
    }
  ]
});

module.exports = Sport;

