/**
 * Test script for sports data API integration
 * 
 * This script tests the connection to The Odds API and fetches sample data.
 * Run with: node src/utils/testSportsApi.js
 */

require('dotenv').config();
const axios = require('axios');

// API configuration
const API_KEY = process.env.ODDS_API_KEY;
const API_BASE_URL = 'https://api.the-odds-api.com/v4';

/**
 * Test the sports API connection
 */
const testSportsApi = async () => {
  try {
    console.log('Testing connection to The Odds API...');
    
    // Test 1: Fetch sports
    console.log('\n--- Test 1: Fetching sports ---');
    const sportsResponse = await axios.get(`${API_BASE_URL}/sports`, {
      params: { apiKey: API_KEY }
    });
    
    console.log(`Status: ${sportsResponse.status}`);
    console.log(`Found ${sportsResponse.data.length} sports`);
    console.log('Sample sports:');
    sportsResponse.data.slice(0, 3).forEach(sport => {
      console.log(`- ${sport.title} (${sport.key})`);
    });
    
    // Get a sample sport key for further tests
    const sampleSport = sportsResponse.data.find(s => s.active) || sportsResponse.data[0];
    const sportKey = sampleSport.key;
    
    // Test 2: Fetch odds for a sport
    console.log(`\n--- Test 2: Fetching odds for ${sampleSport.title} ---`);
    const oddsResponse = await axios.get(`${API_BASE_URL}/sports/${sportKey}/odds`, {
      params: {
        apiKey: API_KEY,
        regions: 'us',
        markets: 'h2h',
        oddsFormat: 'american'
      }
    });
    
    console.log(`Status: ${oddsResponse.status}`);
    console.log(`Found ${oddsResponse.data.length} events with odds`);
    
    if (oddsResponse.data.length > 0) {
      const sampleEvent = oddsResponse.data[0];
      console.log('Sample event:');
      console.log(`- ${sampleEvent.home_team} vs ${sampleEvent.away_team}`);
      console.log(`- Commence time: ${new Date(sampleEvent.commence_time).toLocaleString()}`);
      console.log(`- Bookmakers: ${sampleEvent.bookmakers.length}`);
      
      if (sampleEvent.bookmakers.length > 0) {
        const sampleBookmaker = sampleEvent.bookmakers[0];
        console.log(`- Sample bookmaker: ${sampleBookmaker.title}`);
        console.log(`- Last update: ${new Date(sampleBookmaker.last_update).toLocaleString()}`);
        
        if (sampleBookmaker.markets.length > 0) {
          const sampleMarket = sampleBookmaker.markets[0];
          console.log(`- Market: ${sampleMarket.key}`);
          console.log('- Outcomes:');
          sampleMarket.outcomes.forEach(outcome => {
            console.log(`  * ${outcome.name}: ${outcome.price}`);
          });
        }
      }
    }
    
    // Test 3: Check API usage
    console.log('\n--- Test 3: Checking API usage ---');
    const remainingRequests = sportsResponse.headers['x-requests-remaining'];
    const usedRequests = sportsResponse.headers['x-requests-used'];
    
    console.log(`Remaining requests: ${remainingRequests}`);
    console.log(`Used requests: ${usedRequests}`);
    
    console.log('\nAPI integration test completed successfully!');
  } catch (error) {
    console.error('Error testing sports API:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from API');
      console.error(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
    }
    
    console.error('\nAPI integration test failed!');
  }
};

// Run the test
testSportsApi();

