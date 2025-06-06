# Sports API Integration Documentation

This document provides information about the integration of sports data APIs into our peer-to-peer betting platform.

## Overview

Our platform integrates with [The Odds API](https://the-odds-api.com/) to fetch sports data, including:

- List of sports and leagues
- Upcoming events
- Odds from various bookmakers
- Event results and scores

This data is used to power our peer-to-peer betting platform, allowing users to create and accept bets on real sports events.

## API Provider

We use **The Odds API** as our primary data provider for the following reasons:

1. **Comprehensive Coverage**: Covers a wide range of sports and leagues globally
2. **Real-time Odds**: Provides odds from multiple bookmakers in real-time
3. **Scores and Results**: Offers event results and scores for bet settlement
4. **Reliable API**: Well-documented and reliable API with good uptime
5. **Reasonable Pricing**: Cost-effective for our usage patterns

## Integration Architecture

The integration follows these key principles:

1. **Data Synchronization**: Regular syncing of sports data to our database
2. **Caching**: Local storage of data to reduce API calls and ensure availability
3. **Scheduled Updates**: Automatic updates at regular intervals
4. **Error Handling**: Robust error handling and fallback mechanisms
5. **Monitoring**: Tracking of API usage and limits

## Data Flow

1. **Initial Load**: When the server starts, it fetches all available sports and stores them in the database
2. **Regular Updates**: Every 15 minutes, the system fetches updated odds and event data
3. **Event Results**: After events complete, results are fetched and stored for bet settlement
4. **API Endpoints**: Our backend exposes RESTful endpoints for the frontend to access the data

## API Endpoints

The following endpoints are available for accessing sports data:

### Public Endpoints

- `GET /api/sports` - Get all available sports
- `GET /api/sports/:sportId/events` - Get events for a specific sport
- `GET /api/events/:eventId` - Get details for a specific event

### Admin Endpoints

- `POST /api/refresh/sports` - Force refresh of sports data
- `POST /api/refresh/events/:sportKey` - Force refresh of events for a specific sport

## Database Schema

The sports data is stored in the following tables:

1. **Sports**: Stores information about sports
   - id (PK)
   - key (unique identifier from API)
   - name
   - group
   - description
   - active
   - has_outrights

2. **Events**: Stores information about sports events
   - id (PK)
   - external_id (ID from API)
   - sport_id (FK to Sports)
   - home_team
   - away_team
   - commence_time
   - status
   - home_score
   - away_score

3. **Bookmakers**: Stores information about bookmakers
   - id (PK)
   - key (unique identifier from API)
   - name
   - active

4. **Odds**: Stores odds information
   - id (PK)
   - event_id (FK to Events)
   - bookmaker_id (FK to Bookmakers)
   - market_key
   - outcome_name
   - price
   - last_update

## Configuration

The API integration is configured through environment variables:

```
# API Keys
ODDS_API_KEY=your_odds_api_key_here

# Sports Data Settings
INIT_SPORTS_DATA=true
SPORTS_DATA_SYNC_INTERVAL=900000 # 15 minutes in milliseconds
```

## Testing

A test script is available to verify the API integration:

```bash
node src/utils/testSportsApi.js
```

This script tests the connection to The Odds API and fetches sample data to ensure everything is working correctly.

## Error Handling

The integration includes robust error handling:

1. **API Failures**: If the API is unavailable, the system will use cached data
2. **Rate Limiting**: The system tracks API usage and adjusts sync frequency if needed
3. **Data Validation**: All incoming data is validated before being stored
4. **Logging**: Detailed logs are maintained for troubleshooting

## Future Improvements

Potential improvements to the API integration:

1. **Multiple Providers**: Add support for additional data providers for redundancy
2. **WebSocket Updates**: Implement real-time updates using WebSockets
3. **Advanced Caching**: Implement more sophisticated caching strategies
4. **Data Analytics**: Add analytics to track popular events and optimize API usage

## Maintenance

Regular maintenance tasks:

1. **Monitor API Usage**: Keep track of API usage to avoid hitting limits
2. **Update API Key**: Rotate API keys periodically for security
3. **Check for API Changes**: Stay updated on any changes to the API
4. **Optimize Sync Frequency**: Adjust sync frequency based on usage patterns

