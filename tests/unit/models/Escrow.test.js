/**
 * Unit tests for Escrow model
 */

const { models, connect, clearDatabase, closeDatabase } = require('../../helpers/db-helper');
const { User, Sport, League, Event, Bet, BetMatch, Escrow } = models;

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

describe('Escrow Model', () => {
  let creator, taker, sport, league, event, bet, betMatch;
  
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
  
  it('should create an escrow successfully', async () => {
    // Arrange
    const escrowData = {
      bet_match_id: betMatch.id,
      amount: 200.00, // Both sides of the bet
      status: 'active',
      platform_fee: 6.00 // 3% of 200
    };
    
    // Act
    const escrow = await Escrow.create(escrowData);
    
    // Assert
    expect(escrow).toBeDefined();
    expect(escrow.id).toBeDefined();
    expect(escrow.bet_match_id).toBe(betMatch.id);
    expect(parseFloat(escrow.amount)).toBe(escrowData.amount);
    expect(escrow.status).toBe(escrowData.status);
    expect(parseFloat(escrow.platform_fee)).toBe(escrowData.platform_fee);
    expect(escrow.winner_id).toBeNull();
    expect(escrow.released_at).toBeNull();
    expect(escrow.resolved_by).toBeNull();
    expect(escrow.resolution_notes).toBeNull();
    expect(escrow.dispute_reason).toBeNull();
  });
  
  it('should not create an escrow without a bet_match_id', async () => {
    // Arrange
    const escrowData = {
      amount: 200.00,
      status: 'active',
      platform_fee: 6.00
      // No bet_match_id
    };
    
    // Act & Assert
    await expect(Escrow.create(escrowData)).rejects.toThrow();
  });
  
  it('should not create an escrow without an amount', async () => {
    // Arrange
    const escrowData = {
      bet_match_id: betMatch.id,
      status: 'active',
      platform_fee: 6.00
      // No amount
    };
    
    // Act & Assert
    await expect(Escrow.create(escrowData)).rejects.toThrow();
  });
  
  it('should not create an escrow with invalid status', async () => {
    // Arrange
    const escrowData = {
      bet_match_id: betMatch.id,
      amount: 200.00,
      status: 'invalid_status', // Invalid status
      platform_fee: 6.00
    };
    
    // Act & Assert
    await expect(Escrow.create(escrowData)).rejects.toThrow();
  });
  
  it('should not create an escrow with negative amount', async () => {
    // Arrange
    const escrowData = {
      bet_match_id: betMatch.id,
      amount: -200.00, // Negative amount
      status: 'active',
      platform_fee: 6.00
    };
    
    // Act & Assert
    await expect(Escrow.create(escrowData)).rejects.toThrow();
  });
  
  it('should not create an escrow with negative platform fee', async () => {
    // Arrange
    const escrowData = {
      bet_match_id: betMatch.id,
      amount: 200.00,
      status: 'active',
      platform_fee: -6.00 // Negative platform fee
    };
    
    // Act & Assert
    await expect(Escrow.create(escrowData)).rejects.toThrow();
  });
  
  it('should update escrow status correctly', async () => {
    // Arrange
    const escrow = await Escrow.create({
      bet_match_id: betMatch.id,
      amount: 200.00,
      status: 'active',
      platform_fee: 6.00
    });
    
    // Act
    escrow.status = 'completed';
    escrow.winner_id = creator.id;
    escrow.released_at = new Date();
    await escrow.save();
    
    // Reload escrow from database
    const updatedEscrow = await Escrow.findByPk(escrow.id);
    
    // Assert
    expect(updatedEscrow.status).toBe('completed');
    expect(updatedEscrow.winner_id).toBe(creator.id);
    expect(updatedEscrow.released_at).toBeDefined();
  });
  
  it('should create a disputed escrow correctly', async () => {
    // Arrange
    const escrowData = {
      bet_match_id: betMatch.id,
      amount: 200.00,
      status: 'disputed',
      platform_fee: 6.00,
      dispute_reason: 'Incorrect result recorded'
    };
    
    // Act
    const escrow = await Escrow.create(escrowData);
    
    // Assert
    expect(escrow).toBeDefined();
    expect(escrow.status).toBe('disputed');
    expect(escrow.dispute_reason).toBe(escrowData.dispute_reason);
  });
  
  it('should resolve a disputed escrow correctly', async () => {
    // Arrange
    const admin = await User.create({
      username: 'admin',
      email: 'admin@example.com',
      password: 'Password123!',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin'
    });
    
    const escrow = await Escrow.create({
      bet_match_id: betMatch.id,
      amount: 200.00,
      status: 'disputed',
      platform_fee: 6.00,
      dispute_reason: 'Incorrect result recorded'
    });
    
    // Act
    escrow.status = 'completed';
    escrow.winner_id = creator.id;
    escrow.resolved_by = admin.id;
    escrow.resolution_notes = 'Verified the correct result';
    escrow.released_at = new Date();
    await escrow.save();
    
    // Reload escrow from database
    const resolvedEscrow = await Escrow.findByPk(escrow.id);
    
    // Assert
    expect(resolvedEscrow.status).toBe('completed');
    expect(resolvedEscrow.winner_id).toBe(creator.id);
    expect(resolvedEscrow.resolved_by).toBe(admin.id);
    expect(resolvedEscrow.resolution_notes).toBe('Verified the correct result');
    expect(resolvedEscrow.released_at).toBeDefined();
  });
  
  it('should associate escrow with bet match correctly', async () => {
    // Arrange
    const escrow = await Escrow.create({
      bet_match_id: betMatch.id,
      amount: 200.00,
      status: 'active',
      platform_fee: 6.00
    });
    
    // Act
    const escrowWithBetMatch = await Escrow.findByPk(escrow.id, {
      include: [{ model: BetMatch, as: 'betMatch' }]
    });
    
    // Assert
    expect(escrowWithBetMatch.betMatch).toBeDefined();
    expect(escrowWithBetMatch.betMatch.id).toBe(betMatch.id);
    expect(escrowWithBetMatch.betMatch.bet_id).toBe(bet.id);
    expect(escrowWithBetMatch.betMatch.taker_id).toBe(taker.id);
  });
});

