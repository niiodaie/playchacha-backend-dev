/**
 * Health check script for Docker container
 * 
 * This script checks if the API server is running and responding to requests.
 */

const http = require('http');

const options = {
  host: 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/health',
  timeout: 2000
};

const request = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  
  // If the status code is 200, the server is healthy
  if (res.statusCode === 200) {
    process.exit(0); // Success
  } else {
    process.exit(1); // Failure
  }
});

request.on('error', (err) => {
  console.error('Health check failed:', err);
  process.exit(1); // Failure
});

// End the request
request.end();

