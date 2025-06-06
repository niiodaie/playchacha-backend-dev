/**
 * Unit tests for Escrow Service
 */

const { models, connect, clearDatabase, closeDatabase } = require('../../helpers/db-helper');
const { User, Wallet, Transaction, Sport, League, Event, Bet, BetMatch, Escrow, Payout } = models;

// Mock the wallet service
jest.mock('../../../src/services/walletService', () => ({
  getWallet: jest.fn(),
  updateBalance: jest.fn()
}));

// Import the mocked wallet service
const walletService = require('../../../src/services/walletService');

// Import the escrow service after mocking dependencies
const escrowService = require('../../../src/services/escrowService');

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

describe('Escrow Service', () => {
  let creator, taker, creatorWallet, takerWallet, sport, league, event, bet, betMatch;
  
  beforeEach(async () => {
    // Create test users
    creator = await User.create({
      username: 'creator',
      email: 'creator@example.com',
      password: 'Password123!',
      first_name: 'Bet',
      last_name: 'Creator',
      role: 'user'
    });
    
    taker = await User.create({
      username: 'taker',
      email: 'taker@example.com',
      password: 'Password123!',
      first_name: 'Bet',
      last_name: 'Taker',
      role: 'user'
    });
    
    // Create wallets
    creatorWallet = await Wallet.create({
      user_id: creator.id,
      balance: 200.00,
      currency: 'USD',
      status: 'active'
    });
    
    takerWallet = await Wallet.create({
      user_id: taker.id,
      balance: 200.00,
      currency: 'USD',
      status: 'active'
    });
    
    // Mock wallet service methods
    walletService.getWallet.mockImplementation(async (userId) => {
      if (userId === creator.id) return creatorWallet;
      if (userId === taker.id) return takerWallet;
      throw new Error('Wallet not found');
    });
    
    walletService.updateBalance.mockImplementation(async (walletId, amount) => {
      if (walletId === creatorWallet.id) {
        creatorWallet.balance = parseFloat(creatorWallet.balance) + amount;
        return creatorWallet;
      }
      if (walletId === takerWallet.id) {
        takerWallet.balance = parseFloat(takerWallet.balance) + amount;
        return takerWallet;
      }
      throw new Error('Wallet not found');
    });
    
    // Create test sport, league, and event
    sport = await Sport.create({
      name: 'Football',
      slug: 'football',
      active: true
    });
    
    league = await League.create({
      sport_id: sport.id,
      name: 'Premier League',
      slug: 'premier-league',
      country: 'England',
      active: true
    });
    
    event = await Event.create({
      league_id: league.id,
      name: 'Manchester United vs Liverpool',
      start_time: new Date(Date.now() + 86400000), // Tomorrow
      status: 'scheduled',
      home_team: 'Manchester United',
      away_team: 'Liverpool',
      external_id: 'ext_123456'
    });
    
    // Create test bet
    bet = await Bet.create({
      creator_id: creator.id,
      event_id: event.id,
      amount: 100.00,
      odds: 1.95,
      stake: 'home_team',
      status: 'open',
      description: 'Manchester United to win'
    });
    
    // Create test bet match
    betMatch = await BetMatch.create({
      bet_id: bet.id,
      taker_id: taker.id,
      status: 'matched',
      matched_at: new Date()
    });
  });
  
  describe('createEscrow', () => {
    it('should create escrow successfully', async () => {
      // Act
      const result = await escrowService.createEscrow(betMatch.id);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.escrow_id).toBeDefined();
      expect(parseFloat(result.amount)).toBe(200.00); // Both sides of the bet
      expect(parseFloat(result.platform_fee)).toBe(6.00); // 3% of 200
      expect(result.status).toBe('active');
      
      // Verify escrow created in database
      const escrow = await Escrow.findByPk(result.escrow_id);
      expect(escrow).toBeDefined();
      expect(escrow.bet_match_id).toBe(betMatch.id);
      expect(parseFloat(escrow.amount)).toBe(200.00);
      expect(parseFloat(escrow.platform_fee)).toBe(6.00);
      expect(escrow.status).toBe('active');
      
      // Verify wallet service called correctly
      expect(walletService.getWallet).toHaveBeenCalledWith(creator.id);
      expect(walletService.getWallet).toHaveBeenCalledWith(taker.id);
      expect(walletService.updateBalance).toHaveBeenCalledWith(creatorWallet.id, -100.00, expect.anything());
      expect(walletService.updateBalance).toHaveBeenCalledWith(takerWallet.id, -100.00, expect.anything());
      
      // Verify transactions created
      const transactions = await Transaction.findAll({
        where: { reference_id: escrow.id }
      });
      expect(transactions.length).toBe(2);
      
      // Verify bet match status updated
      const updatedBetMatch = await BetMatch.findByPk(betMatch.id);
      expect(updatedBetMatch.status).toBe('active');
      expect(updatedBetMatch.escrow_created_at).toBeDefined();
    });
    
    it('should throw error if bet match not found', async () => {
      // Act & Assert
      await expect(escrowService.createEscrow(999999)).rejects.toThrow('Bet match not found');
    });
    
    it('should throw error if escrow already exists', async () => {
      // Arrange
      await Escrow.create({
        bet_match_id: betMatch.id,
        amount: 200.00,
        status: 'active',
        platform_fee: 6.00
      });
      
      // Act & Assert
      await expect(escrowService.createEscrow(betMatch.id)).rejects.toThrow('Escrow already exists for this bet match');
    });
    
    it('should throw error if creator has insufficient funds', async () => {
      // Arrange
      creatorWallet.balance = 50.00; // Less than bet amount
      await creatorWallet.save();
      
      // Act & Assert
      await expect(escrowService.createEscrow(betMatch.id)).rejects.toThrow('Creator has insufficient funds');
    });
    
    it('should throw error if taker has insufficient funds', async () => {
      // Arrange
      takerWallet.balance = 50.00; // Less than bet amount
      await takerWallet.save();
      
      // Act & Assert
      await expect(escrowService.createEscrow(betMatch.id)).rejects.toThrow('Taker has insufficient funds');
    });
  });
  
  describe('getEscrow', () => {
    let escrow;
    
    beforeEach(async () => {
      escrow = await Escrow.create({
        bet_match_id: betMatch.id,
        amount: 200.00,
        status: 'active',
        platform_fee: 6.00
      });
    });
    
    it('should get escrow details successfully', async () => {
      // Act
      const result = await escrowService.getEscrow(escrow.id);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(escrow.id);
      expect(parseFloat(result.amount)).toBe(200.00);
      expect(parseFloat(result.platform_fee)).toBe(6.00);
      expect(result.status).toBe('active');
      expect(result.betMatch).toBeDefined();
      expect(result.betMatch.id).toBe(betMatch.id);
      expect(result.betMatch.bet).toBeDefined();
      expect(result.betMatch.bet.creator).toBeDefined();
      expect(result.betMatch.taker).toBeDefined();
    });
    
    it('should throw error if escrow not found', async () => {
      // Act & Assert
      await expect(escrowService.getEscrow(999999)).rejects.toThrow('Escrow not found');
    });
  });
  
  describe('releaseEscrow', () => {
    let escrow;
    
    beforeEach(async () => {
      escrow = await Escrow.create({
        bet_match_id: betMatch.id,
        amount: 200.00,
        status: 'active',
        platform_fee: 6.00
      });
    });
    
    it('should release escrow to winner successfully', async () => {
      // Act
      const result = await escrowService.releaseEscrow(escrow.id, creator.id);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.payout_id).toBeDefined();
      expect(parseFloat(result.amount)).toBe(194.00); // 200 - 6 (platform fee)
      expect(result.status).toBe('completed');
      
      // Verify escrow updated in database
      const updatedEscrow = await Escrow.findByPk(escrow.id);
      expect(updatedEscrow.status).toBe('completed');
      expect(updatedEscrow.winner_id).toBe(creator.id);
      expect(updatedEscrow.released_at).toBeDefined();
      
      // Verify bet match updated
      const updatedBetMatch = await BetMatch.findByPk(betMatch.id);
      expect(updatedBetMatch.status).toBe('settled');
      expect(updatedBetMatch.winner_id).toBe(creator.id);
      expect(updatedBetMatch.settled_at).toBeDefined();
      
      // Verify payout created
      const payout = await Payout.findByPk(result.payout_id);
      expect(payout).toBeDefined();
      expect(payout.user_id).toBe(creator.id);
      expect(payout.escrow_id).toBe(escrow.id);
      expect(parseFloat(payout.amount)).toBe(194.00);
      expect(payout.status).toBe('completed');
      
      // Verify wallet service called correctly
      expect(walletService.getWallet).toHaveBeenCalledWith(creator.id);
      expect(walletService.updateBalance).toHaveBeenCalledWith(creatorWallet.id, 194.00, expect.anything());
    });
    
    it('should throw error if escrow not found', async () => {
      // Act & Assert
      await expect(escrowService.releaseEscrow(999999, creator.id)).rejects.toThrow('Escrow not found');
    });
    
    it('should throw error if escrow is not active', async () => {
      // Arrange
      escrow.status = 'completed';
      await escrow.save();
      
      // Act & Assert
      await expect(escrowService.releaseEscrow(escrow.id, creator.id)).rejects.toThrow('Escrow is not active');
    });
    
    it('should throw error if winner is not part of the bet', async () => {
      // Arrange
      const otherUser = await User.create({
        username: 'other',
        email: 'other@example.com',
        password: 'Password123!',
        first_name: 'Other',
        last_name: 'User',
        role: 'user'
      });
      
      // Act & Assert
      await expect(escrowService.releaseEscrow(escrow.id, otherUser.id)).rejects.toThrow('Winner is not part of this bet');
    });
  });
  
  describe('createDispute', () => {
    let escrow;
    
    beforeEach(async () => {
      escrow = await Escrow.create({
        bet_match_id: betMatch.id,
        amount: 200.00,
        status: 'active',
        platform_fee: 6.00
      });
    });
    
    it('should create dispute successfully', async () => {
      // Arrange
      const reason = 'Incorrect result recorded';
      
      // Act
      const result = await escrowService.createDispute(escrow.id, creator.id, reason);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(escrow.id);
      expect(result.status).toBe('disputed');
      expect(result.dispute_reason).toBe(reason);
      
      // Verify bet match updated
      const updatedBetMatch = await BetMatch.findByPk(betMatch.id);
      expect(updatedBetMatch.status).toBe('disputed');
    });
    
    it('should throw error if escrow not found', async () => {
      // Act & Assert
      await expect(escrowService.createDispute(999999, creator.id, 'reason')).rejects.toThrow('Escrow not found');
    });
    
    it('should throw error if escrow is not active', async () => {
      // Arrange
      escrow.status = 'completed';
      await escrow.save();
      
      // Act & Assert
      await expect(escrowService.createDispute(escrow.id, creator.id, 'reason')).rejects.toThrow('Escrow is not active');
    });
    
    it('should throw error if user is not part of the bet', async () => {
      // Arrange
      const otherUser = await User.create({
        username: 'other',
        email: 'other@example.com',
        password: 'Password123!',
        first_name: 'Other',
        last_name: 'User',
        role: 'user'
      });
      
      // Act & Assert
      await expect(escrowService.createDispute(escrow.id, otherUser.id, 'reason')).rejects.toThrow('User is not part of this bet');
    });
  });
  
  describe('resolveDispute', () => {
    let escrow, admin;
    
    beforeEach(async () => {
      admin = await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: 'Password123!',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      });
      
      escrow = await Escrow.create({
        bet_match_id: betMatch.id,
        amount: 200.00,
        status: 'disputed',
        platform_fee: 6.00,
        dispute_reason: 'Incorrect result recorded'
      });
      
      // Update bet match status
      await betMatch.update({ status: 'disputed' });
    });
    
    it('should resolve dispute with winner successfully', async () => {
      // Arrange
      const notes = 'Verified the correct result';
      
      // Act
      const result = await escrowService.resolveDispute(escrow.id, creator.id, admin.id, notes);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.resolution).toBe('winner_declared');
      expect(result.winner_id).toBe(creator.id);
      expect(result.payout_id).toBeDefined();
      expect(parseFloat(result.amount)).toBe(194.00); // 200 - 6 (platform fee)
      
      // Verify escrow updated in database
      const updatedEscrow = await Escrow.findByPk(escrow.id);
      expect(updatedEscrow.status).toBe('completed');
      expect(updatedEscrow.winner_id).toBe(creator.id);
      expect(updatedEscrow.resolved_by).toBe(admin.id);
      expect(updatedEscrow.resolution_notes).toBe(notes);
      expect(updatedEscrow.released_at).toBeDefined();
      
      // Verify bet match updated
      const updatedBetMatch = await BetMatch.findByPk(betMatch.id);
      expect(updatedBetMatch.status).toBe('settled');
      expect(updatedBetMatch.winner_id).toBe(creator.id);
      expect(updatedBetMatch.settled_at).toBeDefined();
      
      // Verify wallet service called correctly
      expect(walletService.getWallet).toHaveBeenCalledWith(creator.id);
      expect(walletService.updateBalance).toHaveBeenCalledWith(creatorWallet.id, 194.00, expect.anything());
    });
    
    it('should resolve dispute with refund successfully', async () => {
      // Arrange
      const notes = 'Unable to determine winner, refunding both parties';
      
      // Act
      const result = await escrowService.resolveDispute(escrow.id, null, admin.id, notes);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.resolution).toBe('refunded');
      expect(result.creator_transaction_id).toBeDefined();
      expect(result.taker_transaction_id).toBeDefined();
      expect(parseFloat(result.amount)).toBe(100.00); // Half of total amount
      
      // Verify escrow updated in database
      const updatedEscrow = await Escrow.findByPk(escrow.id);
      expect(updatedEscrow.status).toBe('refunded');
      expect(updatedEscrow.resolved_by).toBe(admin.id);
      expect(updatedEscrow.resolution_notes).toBe(notes);
      expect(updatedEscrow.released_at).toBeDefined();
      
      // Verify bet match updated
      const updatedBetMatch = await BetMatch.findByPk(betMatch.id);
      expect(updatedBetMatch.status).toBe('cancelled');
      expect(updatedBetMatch.cancelled_at).toBeDefined();
      
      // Verify wallet service called correctly
      expect(walletService.getWallet).toHaveBeenCalledWith(creator.id);
      expect(walletService.getWallet).toHaveBeenCalledWith(taker.id);
      expect(walletService.updateBalance).toHaveBeenCalledWith(creatorWallet.id, 100.00, expect.anything());
      expect(walletService.updateBalance).toHaveBeenCalledWith(takerWallet.id, 100.00, expect.anything());
    });
    
    it('should throw error if escrow not found', async () => {
      // Act & Assert
      await expect(escrowService.resolveDispute(999999, creator.id, admin.id, 'notes')).rejects.toThrow('Escrow not found');
    });
    
    it('should throw error if escrow is not disputed', async () => {
      // Arrange
      escrow.status = 'active';
      await escrow.save();
      
      // Act & Assert
      await expect(escrowService.resolveDispute(escrow.id, creator.id, admin.id, 'notes')).rejects.toThrow('Escrow is not disputed');
    });
  });
});

