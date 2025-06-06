/**
 * Unit tests for Wallet Service
 */

const { models, connect, clearDatabase, closeDatabase, sequelize } = require('../../helpers/db-helper');
const { User, Wallet, Transaction } = models;

// Mock the wallet service to avoid external dependencies
jest.mock('../../../src/config/stripe', () => ({
  stripe: {
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ id: 'pi_mock_123', client_secret: 'secret_mock_123' }),
      confirm: jest.fn().mockResolvedValue({ id: 'pi_mock_123', status: 'succeeded' })
    }
  }
}));

// Import the service after mocking dependencies
const walletService = require('../../../src/services/walletService');

// Setup and teardown
beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Wallet Service', () => {
  let testUser;
  
  beforeEach(async () => {
    // Create a test user for wallet tests
    testUser = await User.create({
      username: 'walletuser',
      email: 'wallet@example.com',
      password: 'Password123!',
      first_name: 'Wallet',
      last_name: 'User',
      role: 'user'
    });
  });
  
  describe('getWallet', () => {
    it('should get existing wallet for user', async () => {
      // Arrange
      const wallet = await Wallet.create({
        user_id: testUser.id,
        balance: 100.00,
        currency: 'USD',
        status: 'active'
      });
      
      // Act
      const result = await walletService.getWallet(testUser.id);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(wallet.id);
      expect(parseFloat(result.balance)).toBe(100.00);
      expect(result.user_id).toBe(testUser.id);
    });
    
    it('should create new wallet if user does not have one', async () => {
      // Act
      const result = await walletService.getWallet(testUser.id);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.user_id).toBe(testUser.id);
      expect(parseFloat(result.balance)).toBe(0.00);
      expect(result.currency).toBe('USD');
      expect(result.status).toBe('active');
    });
    
    it('should throw error if user does not exist', async () => {
      // Act & Assert
      await expect(walletService.getWallet(999999)).rejects.toThrow();
    });
  });
  
  describe('updateBalance', () => {
    let wallet;
    
    beforeEach(async () => {
      wallet = await Wallet.create({
        user_id: testUser.id,
        balance: 100.00,
        currency: 'USD',
        status: 'active'
      });
    });
    
    it('should increase wallet balance correctly', async () => {
      // Act
      const result = await walletService.updateBalance(wallet.id, 50.00);
      
      // Assert
      expect(result).toBeDefined();
      expect(parseFloat(result.balance)).toBe(150.00);
      
      // Verify in database
      const updatedWallet = await Wallet.findByPk(wallet.id);
      expect(parseFloat(updatedWallet.balance)).toBe(150.00);
    });
    
    it('should decrease wallet balance correctly', async () => {
      // Act
      const result = await walletService.updateBalance(wallet.id, -30.00);
      
      // Assert
      expect(result).toBeDefined();
      expect(parseFloat(result.balance)).toBe(70.00);
      
      // Verify in database
      const updatedWallet = await Wallet.findByPk(wallet.id);
      expect(parseFloat(updatedWallet.balance)).toBe(70.00);
    });
    
    it('should throw error if resulting balance would be negative', async () => {
      // Act & Assert
      await expect(walletService.updateBalance(wallet.id, -150.00)).rejects.toThrow('Insufficient funds');
    });
    
    it('should throw error if wallet does not exist', async () => {
      // Act & Assert
      await expect(walletService.updateBalance(999999, 50.00)).rejects.toThrow('Wallet not found');
    });
    
    it('should use transaction if provided', async () => {
      // Arrange
      const t = await sequelize.transaction();
      
      // Act
      const result = await walletService.updateBalance(wallet.id, 50.00, t);
      await t.commit();
      
      // Assert
      expect(result).toBeDefined();
      expect(parseFloat(result.balance)).toBe(150.00);
      
      // Verify in database
      const updatedWallet = await Wallet.findByPk(wallet.id);
      expect(parseFloat(updatedWallet.balance)).toBe(150.00);
    });
  });
  
  describe('getTransactionHistory', () => {
    let wallet;
    
    beforeEach(async () => {
      wallet = await Wallet.create({
        user_id: testUser.id,
        balance: 100.00,
        currency: 'USD',
        status: 'active'
      });
      
      // Create some test transactions
      await Transaction.create({
        wallet_id: wallet.id,
        amount: 100.00,
        type: 'deposit',
        status: 'completed',
        description: 'Initial deposit'
      });
      
      await Transaction.create({
        wallet_id: wallet.id,
        amount: -30.00,
        type: 'withdrawal',
        status: 'completed',
        description: 'Test withdrawal'
      });
      
      await Transaction.create({
        wallet_id: wallet.id,
        amount: 50.00,
        type: 'deposit',
        status: 'completed',
        description: 'Another deposit'
      });
      
      await Transaction.create({
        wallet_id: wallet.id,
        amount: -20.00,
        type: 'bet',
        status: 'completed',
        description: 'Bet placement'
      });
    });
    
    it('should get all transactions for wallet', async () => {
      // Act
      const result = await walletService.getTransactionHistory(wallet.id);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.count).toBe(4);
      expect(result.rows.length).toBe(4);
    });
    
    it('should filter transactions by type', async () => {
      // Act
      const result = await walletService.getTransactionHistory(wallet.id, { type: 'deposit' });
      
      // Assert
      expect(result).toBeDefined();
      expect(result.count).toBe(2);
      expect(result.rows.length).toBe(2);
      expect(result.rows[0].type).toBe('deposit');
      expect(result.rows[1].type).toBe('deposit');
    });
    
    it('should limit and offset transactions correctly', async () => {
      // Act
      const result = await walletService.getTransactionHistory(wallet.id, { limit: 2, offset: 1 });
      
      // Assert
      expect(result).toBeDefined();
      expect(result.count).toBe(4); // Total count should still be 4
      expect(result.rows.length).toBe(2); // But only 2 returned
    });
    
    it('should throw error if wallet does not exist', async () => {
      // Act & Assert
      await expect(walletService.getTransactionHistory(999999)).rejects.toThrow('Wallet not found');
    });
  });
  
  describe('processDeposit', () => {
    let wallet;
    
    beforeEach(async () => {
      wallet = await Wallet.create({
        user_id: testUser.id,
        balance: 100.00,
        currency: 'USD',
        status: 'active'
      });
    });
    
    it('should process deposit successfully', async () => {
      // Arrange
      const amount = 50.00;
      const paymentMethodId = 'pm_mock_123';
      
      // Act
      const result = await walletService.processDeposit(testUser.id, amount, paymentMethodId);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.transaction_id).toBeDefined();
      
      // Verify wallet balance updated
      const updatedWallet = await Wallet.findByPk(wallet.id);
      expect(parseFloat(updatedWallet.balance)).toBe(150.00);
      
      // Verify transaction created
      const transaction = await Transaction.findByPk(result.transaction_id);
      expect(transaction).toBeDefined();
      expect(parseFloat(transaction.amount)).toBe(amount);
      expect(transaction.type).toBe('deposit');
      expect(transaction.status).toBe('completed');
    });
    
    it('should throw error if user does not exist', async () => {
      // Act & Assert
      await expect(walletService.processDeposit(999999, 50.00, 'pm_mock_123')).rejects.toThrow();
    });
    
    it('should throw error if amount is not positive', async () => {
      // Act & Assert
      await expect(walletService.processDeposit(testUser.id, 0, 'pm_mock_123')).rejects.toThrow('Amount must be positive');
      await expect(walletService.processDeposit(testUser.id, -50.00, 'pm_mock_123')).rejects.toThrow('Amount must be positive');
    });
  });
  
  describe('processWithdrawal', () => {
    let wallet;
    
    beforeEach(async () => {
      wallet = await Wallet.create({
        user_id: testUser.id,
        balance: 100.00,
        currency: 'USD',
        status: 'active'
      });
    });
    
    it('should process withdrawal successfully', async () => {
      // Arrange
      const amount = 50.00;
      const withdrawalMethod = 'bank_transfer';
      const withdrawalDetails = { account_number: '1234567890', routing_number: '987654321' };
      
      // Act
      const result = await walletService.processWithdrawal(testUser.id, amount, withdrawalMethod, withdrawalDetails);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.transaction_id).toBeDefined();
      
      // Verify wallet balance updated
      const updatedWallet = await Wallet.findByPk(wallet.id);
      expect(parseFloat(updatedWallet.balance)).toBe(50.00);
      
      // Verify transaction created
      const transaction = await Transaction.findByPk(result.transaction_id);
      expect(transaction).toBeDefined();
      expect(parseFloat(transaction.amount)).toBe(-amount); // Negative for withdrawal
      expect(transaction.type).toBe('withdrawal');
      expect(transaction.status).toBe('pending'); // Withdrawals start as pending
      expect(transaction.metadata).toEqual(expect.objectContaining({
        withdrawal_method: withdrawalMethod,
        withdrawal_details: withdrawalDetails
      }));
    });
    
    it('should throw error if insufficient funds', async () => {
      // Act & Assert
      await expect(walletService.processWithdrawal(testUser.id, 150.00, 'bank_transfer', {})).rejects.toThrow('Insufficient funds');
    });
    
    it('should throw error if amount is not positive', async () => {
      // Act & Assert
      await expect(walletService.processWithdrawal(testUser.id, 0, 'bank_transfer', {})).rejects.toThrow('Amount must be positive');
      await expect(walletService.processWithdrawal(testUser.id, -50.00, 'bank_transfer', {})).rejects.toThrow('Amount must be positive');
    });
    
    it('should throw error if user does not exist', async () => {
      // Act & Assert
      await expect(walletService.processWithdrawal(999999, 50.00, 'bank_transfer', {})).rejects.toThrow();
    });
  });
});

