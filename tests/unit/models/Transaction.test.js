/**
 * Unit tests for Transaction model
 */

const { models, connect, clearDatabase, closeDatabase } = require('../../helpers/db-helper');
const { User, Wallet, Transaction } = models;

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

describe('Transaction Model', () => {
  let testUser, testWallet;
  
  beforeEach(async () => {
    // Create a test user and wallet for transaction tests
    testUser = await User.create({
      username: 'transactionuser',
      email: 'transaction@example.com',
      password: 'Password123!',
      first_name: 'Transaction',
      last_name: 'User',
      role: 'user'
    });
    
    testWallet = await Wallet.create({
      user_id: testUser.id,
      balance: 100.00,
      currency: 'USD',
      status: 'active'
    });
  });
  
  it('should create a transaction successfully', async () => {
    // Arrange
    const transactionData = {
      wallet_id: testWallet.id,
      amount: 50.00,
      type: 'deposit',
      status: 'completed',
      reference_id: 'payment_123',
      description: 'Test deposit',
      metadata: { source: 'credit_card', payment_id: 'pi_123456' }
    };
    
    // Act
    const transaction = await Transaction.create(transactionData);
    
    // Assert
    expect(transaction).toBeDefined();
    expect(transaction.id).toBeDefined();
    expect(transaction.wallet_id).toBe(testWallet.id);
    expect(parseFloat(transaction.amount)).toBe(transactionData.amount);
    expect(transaction.type).toBe(transactionData.type);
    expect(transaction.status).toBe(transactionData.status);
    expect(transaction.reference_id).toBe(transactionData.reference_id);
    expect(transaction.description).toBe(transactionData.description);
    expect(transaction.metadata).toEqual(transactionData.metadata);
  });
  
  it('should not create a transaction without a wallet_id', async () => {
    // Arrange
    const transactionData = {
      amount: 50.00,
      type: 'deposit',
      status: 'completed',
      description: 'Test deposit'
      // No wallet_id
    };
    
    // Act & Assert
    await expect(Transaction.create(transactionData)).rejects.toThrow();
  });
  
  it('should not create a transaction without an amount', async () => {
    // Arrange
    const transactionData = {
      wallet_id: testWallet.id,
      type: 'deposit',
      status: 'completed',
      description: 'Test deposit'
      // No amount
    };
    
    // Act & Assert
    await expect(Transaction.create(transactionData)).rejects.toThrow();
  });
  
  it('should not create a transaction with invalid type', async () => {
    // Arrange
    const transactionData = {
      wallet_id: testWallet.id,
      amount: 50.00,
      type: 'invalid_type', // Invalid type
      status: 'completed',
      description: 'Test deposit'
    };
    
    // Act & Assert
    await expect(Transaction.create(transactionData)).rejects.toThrow();
  });
  
  it('should not create a transaction with invalid status', async () => {
    // Arrange
    const transactionData = {
      wallet_id: testWallet.id,
      amount: 50.00,
      type: 'deposit',
      status: 'invalid_status', // Invalid status
      description: 'Test deposit'
    };
    
    // Act & Assert
    await expect(Transaction.create(transactionData)).rejects.toThrow();
  });
  
  it('should create a transaction with zero amount', async () => {
    // Arrange
    const transactionData = {
      wallet_id: testWallet.id,
      amount: 0.00, // Zero amount (e.g., for a fee waiver)
      type: 'fee',
      status: 'completed',
      description: 'Fee waiver'
    };
    
    // Act
    const transaction = await Transaction.create(transactionData);
    
    // Assert
    expect(transaction).toBeDefined();
    expect(parseFloat(transaction.amount)).toBe(0.00);
  });
  
  it('should create a transaction with negative amount for withdrawals', async () => {
    // Arrange
    const transactionData = {
      wallet_id: testWallet.id,
      amount: -25.00, // Negative amount for withdrawal
      type: 'withdrawal',
      status: 'completed',
      description: 'Test withdrawal'
    };
    
    // Act
    const transaction = await Transaction.create(transactionData);
    
    // Assert
    expect(transaction).toBeDefined();
    expect(parseFloat(transaction.amount)).toBe(-25.00);
  });
  
  it('should associate transaction with wallet correctly', async () => {
    // Arrange
    const transaction = await Transaction.create({
      wallet_id: testWallet.id,
      amount: 50.00,
      type: 'deposit',
      status: 'completed',
      description: 'Test deposit'
    });
    
    // Act
    const transactionWithWallet = await Transaction.findByPk(transaction.id, {
      include: [{ model: Wallet, as: 'wallet' }]
    });
    
    // Assert
    expect(transactionWithWallet.wallet).toBeDefined();
    expect(transactionWithWallet.wallet.id).toBe(testWallet.id);
    expect(parseFloat(transactionWithWallet.wallet.balance)).toBe(100.00);
  });
  
  it('should store and retrieve JSON metadata correctly', async () => {
    // Arrange
    const metadata = {
      payment_method: 'credit_card',
      card_brand: 'visa',
      last_four: '4242',
      customer_id: 'cus_123456',
      receipt_url: 'https://example.com/receipt'
    };
    
    const transactionData = {
      wallet_id: testWallet.id,
      amount: 75.50,
      type: 'deposit',
      status: 'completed',
      description: 'Test deposit with metadata',
      metadata
    };
    
    // Act
    const transaction = await Transaction.create(transactionData);
    
    // Reload transaction from database
    const savedTransaction = await Transaction.findByPk(transaction.id);
    
    // Assert
    expect(savedTransaction.metadata).toEqual(metadata);
    expect(savedTransaction.metadata.payment_method).toBe('credit_card');
    expect(savedTransaction.metadata.last_four).toBe('4242');
  });
});

