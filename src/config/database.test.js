/**
 * Test database configuration
 * 
 * This file contains the configuration for the test database.
 */

const { Sequelize } = require('sequelize');

// Use in-memory SQLite for tests
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false, // Disable logging for tests
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

module.exports = sequelize;

