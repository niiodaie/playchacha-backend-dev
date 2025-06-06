/**
 * Unit tests for User model
 */

const bcrypt = require('bcrypt');
const { models, connect, clearDatabase, closeDatabase } = require('../../helpers/db-helper');
const { User } = models;

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

describe('User Model', () => {
  it('should create a user successfully', async () => {
    // Arrange
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      first_name: 'Test',
      last_name: 'User',
      role: 'user'
    };
    
    // Act
    const user = await User.create(userData);
    
    // Assert
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.username).toBe(userData.username);
    expect(user.email).toBe(userData.email);
    expect(user.first_name).toBe(userData.first_name);
    expect(user.last_name).toBe(userData.last_name);
    expect(user.role).toBe(userData.role);
    // Password should be hashed
    expect(user.password).not.toBe(userData.password);
    // Verify the password was hashed correctly
    const passwordMatch = await bcrypt.compare(userData.password, user.password);
    expect(passwordMatch).toBe(true);
  });
  
  it('should not create a user with duplicate email', async () => {
    // Arrange
    const userData = {
      username: 'testuser1',
      email: 'duplicate@example.com',
      password: 'Password123!',
      first_name: 'Test',
      last_name: 'User',
      role: 'user'
    };
    
    const duplicateData = {
      username: 'testuser2',
      email: 'duplicate@example.com', // Same email
      password: 'Password456!',
      first_name: 'Another',
      last_name: 'User',
      role: 'user'
    };
    
    // Act & Assert
    await User.create(userData);
    
    // Attempt to create user with duplicate email should fail
    await expect(User.create(duplicateData)).rejects.toThrow();
  });
  
  it('should not create a user with duplicate username', async () => {
    // Arrange
    const userData = {
      username: 'sameusername',
      email: 'user1@example.com',
      password: 'Password123!',
      first_name: 'Test',
      last_name: 'User',
      role: 'user'
    };
    
    const duplicateData = {
      username: 'sameusername', // Same username
      email: 'user2@example.com',
      password: 'Password456!',
      first_name: 'Another',
      last_name: 'User',
      role: 'user'
    };
    
    // Act & Assert
    await User.create(userData);
    
    // Attempt to create user with duplicate username should fail
    await expect(User.create(duplicateData)).rejects.toThrow();
  });
  
  it('should not create a user with invalid email', async () => {
    // Arrange
    const userData = {
      username: 'testuser',
      email: 'invalid-email', // Invalid email format
      password: 'Password123!',
      first_name: 'Test',
      last_name: 'User',
      role: 'user'
    };
    
    // Act & Assert
    // This should fail validation
    await expect(User.create(userData)).rejects.toThrow();
  });
  
  it('should hash the password before saving', async () => {
    // Arrange
    const plainPassword = 'Password123!';
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: plainPassword,
      first_name: 'Test',
      last_name: 'User',
      role: 'user'
    };
    
    // Act
    const user = await User.create(userData);
    
    // Assert
    expect(user.password).not.toBe(plainPassword);
    // Verify it's a bcrypt hash
    expect(user.password).toMatch(/^\$2[aby]\$\d+\$/);
    // Verify we can compare the password correctly
    const passwordMatch = await bcrypt.compare(plainPassword, user.password);
    expect(passwordMatch).toBe(true);
  });
  
  it('should create a user with default role if not specified', async () => {
    // Arrange
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      first_name: 'Test',
      last_name: 'User'
      // No role specified
    };
    
    // Act
    const user = await User.create(userData);
    
    // Assert
    expect(user.role).toBe('user'); // Default role should be 'user'
  });
  
  it('should update user information correctly', async () => {
    // Arrange
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      first_name: 'Test',
      last_name: 'User',
      role: 'user'
    };
    
    // Act
    const user = await User.create(userData);
    
    // Update user
    user.first_name = 'Updated';
    user.last_name = 'Name';
    await user.save();
    
    // Reload user from database
    const updatedUser = await User.findByPk(user.id);
    
    // Assert
    expect(updatedUser.first_name).toBe('Updated');
    expect(updatedUser.last_name).toBe('Name');
  });
  
  it('should not allow changing role to an invalid value', async () => {
    // Arrange
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      first_name: 'Test',
      last_name: 'User',
      role: 'user'
    };
    
    // Act
    const user = await User.create(userData);
    
    // Try to update to invalid role
    user.role = 'invalid_role';
    
    // Assert
    // This should fail validation
    await expect(user.save()).rejects.toThrow();
  });
});

