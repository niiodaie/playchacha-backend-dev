require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION || '24h',
  saltRounds: 10, // For bcrypt password hashing
  platformFee: parseFloat(process.env.PLATFORM_FEE) || 0.03 // 3% platform fee
};

