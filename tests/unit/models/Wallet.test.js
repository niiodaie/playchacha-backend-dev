/**
 * Unit tests for Wallet model
 */

const { models, connect, clearDatabase, closeDatabase } = require('../../helpers/db-helper');
const { User, Wallet } = models;

// Setup and teardown
beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Wallet Model', () => {
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
  
  it('should create a wallet successfully', async () => {
    // Arrange
    const walletData = {
      user_id: testUser.id,
      balance: 100.00,
      currency: 'USD',
      status: 'active'
    };
    
    // Act
    const wallet = await Wallet.create(walletData);
    
    // Assert
    expect(wallet).toBeDefined();
    expect(wallet.id).toBeDefined();
    expect(wallet.user_id).toBe(testUser.id);
    expect(parseFloat(wallet.balance)).toBe(walletData.balance);
    expect(wallet.currency).toBe(walletData.currency);
    expect(wallet.status).toBe(walletData.status);
  });
  
  it('should create a wallet with default values', async () => {
    // Arrange
    const walletData = {
      user_id: testUser.id
      // No balance, currency, or status specified
    };
    
    // Act
    const wallet = await Wallet.create(walletData);
    
    // Assert
    expect(wallet).toBeDefined();
    expect(wallet.id).toBeDefined();
    expect(wallet.user_id).toBe(testUser.id);
    expect(parseFloat(wallet.balance)).toBe(0.00); // Default balance
    expect(wallet.currency).toBe('USD'); // Default currency
    expect(wallet.status).toBe('active'); // Default status
  });
  
  it('should not create a wallet without a user_id', async () => {
    // Arrange
    const walletData = {
      balance: 100.00,
      currency: 'USD',
      status: 'active'
      // No user_id
    };
    
    // Act & Assert
    await expect(Wallet.create(walletData)).rejects.toThrow();
  });
  
  it('should not create a wallet with negative balance', async () => {
    // Arrange
    const walletData = {
      user_id: testUser.id,
      balance: -50.00, // Negative balance
      currency: 'USD',
      status: 'active'
    };
    
    // Act & Assert
    await expect(Wallet.create(walletData)).rejects.toThrow();
  });
  
  it('should not create a wallet with invalid currency', async () => {
    // Arrange
    const walletData = {
      user_id: testUser.id,
      balance: 100.00,
      currency: 'INVALID', // Invalid currency code (should be 3 letters)
      status: 'active'
    };
    
    // Act & Assert
    await expect(Wallet.create(walletData)).rejects.toThrow();
  });
  
  it('should not create a wallet with invalid status', async () => {
    // Arrange
    const walletData = {
      user_id: testUser.id,
      balance: 100.00,
      currency: 'USD',
      status: 'invalid_status' // Invalid status
    };
    
    // Act & Assert
    await expect(Wallet.create(walletData)).rejects.toThrow();
  });
  
  it('should update wallet balance correctly', async () => {
    // Arrange
    const wallet = await Wallet.create({
      user_id: testUser.id,
      balance: 100.00,
      currency: 'USD',
      status: 'active'
    });
    
    // Act
    wallet.balance = 150.00;
    await wallet.save();
    
    // Reload wallet from database
    const updatedWallet = await Wallet.findByPk(wallet.id);
    
    // Assert
    expect(parseFloat(updatedWallet.balance)).toBe(150.00);
  });
  
  it('should not allow updating balance to a negative value', async () => {
    // Arrange
    const wallet = await Wallet.create({
      user_id: testUser.id,
      balance: 100.00,
      currency: 'USD',
      status: 'active'
    });
    
    // Act
    wallet.balance = -50.00; // Negative balance
    
    // Assert
    await expect(wallet.save()).rejects.toThrow();
  });
  
  it('should associate wallet with user correctly', async () => {
    // Arrange
    const wallet = await Wallet.create({
      user_id: testUser.id,
      balance: 100.00,
      currency: 'USD',
      status: 'active'
    });
    
    // Act
    const walletWithUser = await Wallet.findByPk(wallet.id, {
      include: [{ model: User, as: 'user' }]
    });
    
    // Assert
    expect(walletWithUser.user).toBeDefined();
    expect(walletWithUser.user.id).toBe(testUser.id);
    expect(walletWithUser.user.username).toBe(testUser.username);
  });
});

