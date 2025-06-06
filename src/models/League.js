const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const League = sequelize.define('League', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sport_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sports',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  api_league_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  underscored: true,
  tableName: 'leagues',
  indexes: [
    {
      fields: ['sport_id']
    },
    {
      fields: ['api_league_key']
    }
  ]
});

module.exports = League;

