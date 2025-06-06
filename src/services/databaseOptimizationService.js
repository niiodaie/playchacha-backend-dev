const { Sequelize } = require('sequelize');
const { logger, performanceLogger } = require('./logger');

class DatabaseOptimizationService {
  constructor() {
    this.sequelize = null;
    this.queryCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize database optimization
   * @param {Sequelize} sequelize - Sequelize instance
   */
  initialize(sequelize) {
    this.sequelize = sequelize;
    this.setupQueryLogging();
    this.setupConnectionPoolOptimization();
    this.setupQueryOptimization();
  }

  /**
   * Setup query logging for performance monitoring
   */
  setupQueryLogging() {
    this.sequelize.addHook('beforeQuery', (options) => {
      options.startTime = Date.now();
    });

    this.sequelize.addHook('afterQuery', (options, query) => {
      const duration = Date.now() - options.startTime;
      
      // Log slow queries
      if (duration > 1000) { // Queries taking more than 1 second
        logger.warn('Slow query detected', {
          sql: query.sql?.substring(0, 200),
          duration: `${duration}ms`,
          type: query.type
        });
      }

      // Log to performance logger
      performanceLogger.databaseQuery(
        query.sql?.substring(0, 100) || 'Unknown query',
        duration,
        query.rowCount
      );
    });
  }

  /**
   * Setup connection pool optimization
   */
  setupConnectionPoolOptimization() {
    // Monitor connection pool
    setInterval(() => {
      const pool = this.sequelize.connectionManager.pool;
      if (pool) {
        const stats = {
          size: pool.size,
          available: pool.available,
          using: pool.using,
          waiting: pool.waiting
        };

        // Log if pool is under stress
        if (stats.waiting > 5 || stats.available === 0) {
          logger.warn('Database connection pool under stress', stats);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Setup query optimization
   */
  setupQueryOptimization() {
    // Add query result caching for read-only queries
    this.sequelize.addHook('beforeFind', (options) => {
      if (options.cache && options.cache.ttl) {
        const cacheKey = this.generateCacheKey(options);
        const cached = this.getFromQueryCache(cacheKey);
        
        if (cached) {
          options.cached = true;
          return cached;
        }
        
        options.cacheKey = cacheKey;
      }
    });

    this.sequelize.addHook('afterFind', (result, options) => {
      if (options.cacheKey && !options.cached) {
        this.setQueryCache(options.cacheKey, result, options.cache.ttl);
      }
    });
  }

  /**
   * Generate cache key for query
   * @param {Object} options - Query options
   * @returns {string} Cache key
   */
  generateCacheKey(options) {
    const key = JSON.stringify({
      model: options.model?.name,
      where: options.where,
      include: options.include,
      order: options.order,
      limit: options.limit,
      offset: options.offset
    });
    
    return require('crypto').createHash('md5').update(key).digest('hex');
  }

  /**
   * Get from query cache
   * @param {string} key - Cache key
   * @returns {any} Cached result or null
   */
  getFromQueryCache(key) {
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    if (cached) {
      this.queryCache.delete(key);
    }
    
    return null;
  }

  /**
   * Set query cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  setQueryCache(key, data, ttl = this.cacheTimeout) {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Clean up old cache entries
    if (this.queryCache.size > 1000) {
      this.cleanupQueryCache();
    }
  }

  /**
   * Cleanup old query cache entries
   */
  cleanupQueryCache() {
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Create database indexes for performance
   */
  async createOptimizedIndexes() {
    try {
      const queries = [
        // User indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_status ON users(status);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at);',
        
        // Bet indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_user_id ON bets(user_id);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_event_id ON bets(event_id);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_status ON bets(status);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_created_at ON bets(created_at);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_amount ON bets(amount);',
        
        // Event indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_sport_id ON events(sport_id);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_league_id ON events(league_id);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_start_time ON events(start_time);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_status ON events(status);',
        
        // Transaction indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_type ON transactions(type);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_status ON transactions(status);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);',
        
        // Wallet indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_currency ON wallets(currency);',
        
        // Escrow indexes
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_escrows_bet_id ON escrows(bet_id);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_escrows_status ON escrows(status);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_escrows_created_at ON escrows(created_at);',
        
        // Composite indexes for common queries
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_user_status ON bets(user_id, status);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_sport_start_time ON events(sport_id, start_time);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);'
      ];

      for (const query of queries) {
        try {
          await this.sequelize.query(query);
          logger.info('Index created successfully', { query: query.substring(0, 100) });
        } catch (error) {
          // Index might already exist, log as warning
          logger.warn('Index creation failed (might already exist)', { 
            query: query.substring(0, 100),
            error: error.message 
          });
        }
      }

      logger.info('Database indexes optimization completed');
    } catch (error) {
      logger.error('Failed to create optimized indexes', { error: error.message });
    }
  }

  /**
   * Analyze query performance
   * @param {string} sql - SQL query
   * @returns {Object} Query analysis
   */
  async analyzeQuery(sql) {
    try {
      const explainResult = await this.sequelize.query(`EXPLAIN ANALYZE ${sql}`, {
        type: Sequelize.QueryTypes.SELECT
      });

      return {
        query: sql,
        executionPlan: explainResult,
        analysis: this.parseExecutionPlan(explainResult)
      };
    } catch (error) {
      logger.error('Query analysis failed', { sql, error: error.message });
      return null;
    }
  }

  /**
   * Parse execution plan for insights
   * @param {Array} plan - Execution plan
   * @returns {Object} Parsed analysis
   */
  parseExecutionPlan(plan) {
    const analysis = {
      totalCost: 0,
      slowOperations: [],
      recommendations: []
    };

    plan.forEach(row => {
      const planText = row['QUERY PLAN'] || '';
      
      // Extract cost information
      const costMatch = planText.match(/cost=(\d+\.\d+)\.\.(\d+\.\d+)/);
      if (costMatch) {
        analysis.totalCost = Math.max(analysis.totalCost, parseFloat(costMatch[2]));
      }

      // Identify slow operations
      if (planText.includes('Seq Scan')) {
        analysis.slowOperations.push('Sequential scan detected');
        analysis.recommendations.push('Consider adding an index');
      }

      if (planText.includes('Sort') && planText.includes('external')) {
        analysis.slowOperations.push('External sort detected');
        analysis.recommendations.push('Consider increasing work_mem or optimizing query');
      }

      if (planText.includes('Nested Loop') && analysis.totalCost > 1000) {
        analysis.slowOperations.push('Expensive nested loop');
        analysis.recommendations.push('Consider using hash join or merge join');
      }
    });

    return analysis;
  }

  /**
   * Get database statistics
   * @returns {Object} Database statistics
   */
  async getDatabaseStats() {
    try {
      const stats = {};

      // Table sizes
      const tableSizes = await this.sequelize.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
      `, { type: Sequelize.QueryTypes.SELECT });

      stats.tableSizes = tableSizes;

      // Index usage
      const indexUsage = await this.sequelize.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC;
      `, { type: Sequelize.QueryTypes.SELECT });

      stats.indexUsage = indexUsage;

      // Connection stats
      const connections = await this.sequelize.query(`
        SELECT 
          state,
          count(*) as count
        FROM pg_stat_activity 
        WHERE datname = current_database()
        GROUP BY state;
      `, { type: Sequelize.QueryTypes.SELECT });

      stats.connections = connections;

      // Slow queries
      const slowQueries = await this.sequelize.query(`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        WHERE mean_time > 100
        ORDER BY mean_time DESC 
        LIMIT 10;
      `, { type: Sequelize.QueryTypes.SELECT });

      stats.slowQueries = slowQueries;

      return stats;
    } catch (error) {
      logger.error('Failed to get database stats', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Optimize database configuration
   */
  async optimizeConfiguration() {
    try {
      const optimizations = [
        // Enable query statistics
        "SELECT pg_stat_statements_reset();",
        
        // Set optimal work memory for sorting
        "SET work_mem = '256MB';",
        
        // Set shared buffers for caching
        "SET shared_buffers = '256MB';",
        
        // Enable parallel query execution
        "SET max_parallel_workers_per_gather = 4;",
        
        // Optimize checkpoint settings
        "SET checkpoint_completion_target = 0.9;",
        
        // Set effective cache size
        "SET effective_cache_size = '1GB';"
      ];

      for (const optimization of optimizations) {
        try {
          await this.sequelize.query(optimization);
        } catch (error) {
          logger.warn('Configuration optimization failed', { 
            optimization,
            error: error.message 
          });
        }
      }

      logger.info('Database configuration optimized');
    } catch (error) {
      logger.error('Failed to optimize database configuration', { error: error.message });
    }
  }

  /**
   * Run database maintenance
   */
  async runMaintenance() {
    try {
      logger.info('Starting database maintenance');

      // Analyze tables for query planner
      await this.sequelize.query('ANALYZE;');
      
      // Vacuum tables to reclaim space
      await this.sequelize.query('VACUUM;');
      
      // Reindex for performance
      await this.sequelize.query('REINDEX DATABASE ' + this.sequelize.config.database + ';');

      logger.info('Database maintenance completed');
    } catch (error) {
      logger.error('Database maintenance failed', { error: error.message });
    }
  }

  /**
   * Clear query cache
   */
  clearQueryCache() {
    this.queryCache.clear();
    logger.info('Query cache cleared');
  }

  /**
   * Get query cache statistics
   * @returns {Object} Cache statistics
   */
  getQueryCacheStats() {
    return {
      size: this.queryCache.size,
      timeout: this.cacheTimeout
    };
  }
}

module.exports = new DatabaseOptimizationService();

