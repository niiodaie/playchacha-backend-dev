const jwt = require('jsonwebtoken');
const { User, Wallet } = require('../models');
const { auth } = require('../config');
const logger = require('../config/logger');
const { sequelize } = require('../config');

/**
 * User service for handling user-related business logic
 */
class UserService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Object} Created user and token
   */
  async register(userData) {
    const transaction = await sequelize.transaction();
    
    try {
      // Check if user with email or username already exists
      const existingUser = await User.findOne({
        where: {
          [sequelize.Op.or]: [
            { email: userData.email },
            { username: userData.username }
          ]
        }
      });
      
      if (existingUser) {
        throw new Error('User with this email or username already exists');
      }
      
      // Create user
      const user = await User.create({
        username: userData.username,
        email: userData.email,
        password_hash: userData.password,
        first_name: userData.first_name,
        last_name: userData.last_name,
        date_of_birth: userData.date_of_birth,
        phone_number: userData.phone_number,
        country: userData.country,
        state: userData.state
      }, { transaction });
      
      // Create wallet for user
      await Wallet.create({
        user_id: user.id,
        balance: 0,
        currency: 'USD'
      }, { transaction });
      
      // Generate JWT token
      const token = this.generateToken(user);
      
      await transaction.commit();
      
      // Return user data (excluding password) and token
      const { password_hash, ...userWithoutPassword } = user.get({ plain: true });
      
      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in user registration:', error);
      throw error;
    }
  }
  
  /**
   * Login a user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Object} User data and token
   */
  async login(email, password) {
    try {
      // Find user by email
      const user = await User.findOne({ where: { email } });
      
      if (!user) {
        throw new Error('Invalid email or password');
      }
      
      // Check password
      const isPasswordValid = await user.validPassword(password);
      
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }
      
      if (user.account_status !== 'active') {
        throw new Error(`Account is ${user.account_status}. Please contact support.`);
      }
      
      // Update last login
      await user.update({ last_login: new Date() });
      
      // Generate JWT token
      const token = this.generateToken(user);
      
      // Return user data (excluding password) and token
      const { password_hash, ...userWithoutPassword } = user.get({ plain: true });
      
      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      logger.error('Error in user login:', error);
      throw error;
    }
  }
  
  /**
   * Get user profile by ID
   * @param {string} userId - User ID
   * @returns {Object} User profile data
   */
  async getProfile(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password_hash'] },
        include: [
          {
            model: Wallet,
            as: 'wallets'
          }
        ]
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      logger.error('Error getting user profile:', error);
      throw error;
    }
  }
  
  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated user data
   */
  async updateProfile(userId, updateData) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Prevent updating sensitive fields
      delete updateData.email;
      delete updateData.password_hash;
      delete updateData.kyc_verified;
      delete updateData.kyc_verification_date;
      delete updateData.account_status;
      
      // Update user
      await user.update(updateData);
      
      // Return updated user (excluding password)
      const { password_hash, ...userWithoutPassword } = user.get({ plain: true });
      
      return userWithoutPassword;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  }
  
  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {boolean} Success status
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Verify current password
      const isPasswordValid = await user.validPassword(currentPassword);
      
      if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
      }
      
      // Update password
      await user.update({ password_hash: newPassword });
      
      return true;
    } catch (error) {
      logger.error('Error changing password:', error);
      throw error;
    }
  }
  
  /**
   * Submit KYC verification
   * @param {string} userId - User ID
   * @param {Object} kycData - KYC verification data
   * @returns {Object} KYC submission status
   */
  async submitKyc(userId, kycData) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // In a real application, this would involve:
      // 1. Storing KYC documents
      // 2. Sending data to a KYC provider
      // 3. Handling verification workflow
      
      // For now, we'll simulate a pending status
      // In production, this would be updated by a webhook or admin
      
      return {
        status: 'pending',
        message: 'KYC verification submitted successfully. It will be reviewed within 24-48 hours.'
      };
    } catch (error) {
      logger.error('Error submitting KYC:', error);
      throw error;
    }
  }
  
  /**
   * Generate JWT token for user
   * @param {Object} user - User object
   * @returns {string} JWT token
   */
  generateToken(user) {
    return jwt.sign(
      { 
        id: user.id,
        email: user.email,
        username: user.username
      },
      auth.jwtSecret,
      { expiresIn: auth.jwtExpiration }
    );
  }
}

module.exports = new UserService();

