require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize, User, Wallet, Sport, League, Event } = require('../models');
const { auth } = require('../config');
const logger = require('../config/logger');

/**
 * Seed the database with initial data
 */
const seedDatabase = async () => {
  try {
    logger.info('Starting database seeding...');
    
    // Sync database models
    await sequelize.sync({ force: true });
    logger.info('Database synchronized');
    
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', auth.saltRounds);
    const admin = await User.create({
      username: 'admin',
      email: 'admin@example.com',
      password_hash: adminPassword,
      first_name: 'Admin',
      last_name: 'User',
      date_of_birth: '1990-01-01',
      country: 'US',
      kyc_verified: true,
      kyc_verification_date: new Date(),
      account_status: 'active'
    });
    
    // Create admin wallet
    await Wallet.create({
      user_id: admin.id,
      balance: 10000,
      currency: 'USD'
    });
    
    logger.info('Admin user created');
    
    // Create test user
    const userPassword = await bcrypt.hash('test123', auth.saltRounds);
    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password_hash: userPassword,
      first_name: 'Test',
      last_name: 'User',
      date_of_birth: '1995-05-15',
      country: 'US',
      kyc_verified: true,
      kyc_verification_date: new Date(),
      account_status: 'active'
    });
    
    // Create test user wallet
    await Wallet.create({
      user_id: user.id,
      balance: 1000,
      currency: 'USD'
    });
    
    logger.info('Test user created');
    
    // Create sports
    const sports = [
      {
        name: 'Soccer',
        api_sport_key: 'soccer',
        active: true
      },
      {
        name: 'Basketball',
        api_sport_key: 'basketball',
        active: true
      },
      {
        name: 'American Football',
        api_sport_key: 'americanfootball',
        active: true
      },
      {
        name: 'Baseball',
        api_sport_key: 'baseball',
        active: true
      },
      {
        name: 'Hockey',
        api_sport_key: 'hockey',
        active: true
      }
    ];
    
    const createdSports = await Sport.bulkCreate(sports);
    logger.info('Sports created');
    
    // Create leagues
    const leagues = [
      {
        sport_id: createdSports[0].id, // Soccer
        name: 'English Premier League',
        api_league_key: 'soccer_epl',
        country: 'England',
        active: true
      },
      {
        sport_id: createdSports[0].id, // Soccer
        name: 'UEFA Champions League',
        api_league_key: 'soccer_uefa_champs_league',
        country: 'Europe',
        active: true
      },
      {
        sport_id: createdSports[1].id, // Basketball
        name: 'NBA',
        api_league_key: 'basketball_nba',
        country: 'USA',
        active: true
      },
      {
        sport_id: createdSports[2].id, // American Football
        name: 'NFL',
        api_league_key: 'americanfootball_nfl',
        country: 'USA',
        active: true
      },
      {
        sport_id: createdSports[3].id, // Baseball
        name: 'MLB',
        api_league_key: 'baseball_mlb',
        country: 'USA',
        active: true
      }
    ];
    
    const createdLeagues = await League.bulkCreate(leagues);
    logger.info('Leagues created');
    
    // Create events
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfterTomorrow = new Date(now);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    
    const events = [
      {
        league_id: createdLeagues[0].id, // EPL
        home_team: 'Manchester United',
        away_team: 'Liverpool',
        start_time: tomorrow,
        status: 'scheduled',
        api_event_id: 'soccer_epl_man_united_liverpool_2025_06_07',
        event_data: {
          venue: 'Old Trafford',
          bookmakers: [
            {
              key: 'betfair',
              markets: [
                {
                  key: 'h2h',
                  outcomes: [
                    { name: 'Manchester United', price: 2.5 },
                    { name: 'Liverpool', price: 2.1 },
                    { name: 'Draw', price: 3.4 }
                  ]
                }
              ]
            }
          ]
        }
      },
      {
        league_id: createdLeagues[2].id, // NBA
        home_team: 'Los Angeles Lakers',
        away_team: 'Boston Celtics',
        start_time: dayAfterTomorrow,
        status: 'scheduled',
        api_event_id: 'basketball_nba_lakers_celtics_2025_06_08',
        event_data: {
          venue: 'Staples Center',
          bookmakers: [
            {
              key: 'betfair',
              markets: [
                {
                  key: 'h2h',
                  outcomes: [
                    { name: 'Los Angeles Lakers', price: 1.9 },
                    { name: 'Boston Celtics', price: 2.2 }
                  ]
                }
              ]
            }
          ]
        }
      },
      {
        league_id: createdLeagues[3].id, // NFL
        home_team: 'Kansas City Chiefs',
        away_team: 'San Francisco 49ers',
        start_time: dayAfterTomorrow,
        status: 'scheduled',
        api_event_id: 'americanfootball_nfl_chiefs_49ers_2025_06_08',
        event_data: {
          venue: 'Arrowhead Stadium',
          bookmakers: [
            {
              key: 'betfair',
              markets: [
                {
                  key: 'h2h',
                  outcomes: [
                    { name: 'Kansas City Chiefs', price: 1.8 },
                    { name: 'San Francisco 49ers', price: 2.3 }
                  ]
                }
              ]
            }
          ]
        }
      }
    ];
    
    await Event.bulkCreate(events);
    logger.info('Events created');
    
    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await sequelize.close();
  }
};

// Run seeder if executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;

