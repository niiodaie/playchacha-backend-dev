const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  league_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'leagues',
      key: 'id'
    }
  },
  home_team: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  away_team: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'scheduled',
    validate: {
      isIn: [['scheduled', 'live', 'completed', 'cancelled']]
    }
  },
  home_score: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  away_score: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  api_event_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  event_data: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  timestamps: true,
  underscored: true,
  tableName: 'events',
  indexes: [
    {
      fields: ['league_id']
    },
    {
      fields: ['api_event_id']
    },
    {
      fields: ['start_time']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = Event;

