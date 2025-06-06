const cluster = require('cluster');
const os = require('os');
const { logger } = require('./logger');

class ScalabilityService {
  constructor() {
    this.workers = new Map();
    this.maxWorkers = process.env.MAX_WORKERS || os.cpus().length;
    this.isClusterMode = process.env.CLUSTER_MODE === 'true';
    this.workerMemoryLimit = process.env.WORKER_MEMORY_LIMIT || 512; // MB
    this.restartThreshold = process.env.RESTART_THRESHOLD || 1000; // MB
  }

  /**
   * Initialize cluster if in cluster mode
   */
  initialize() {
    if (this.isClusterMode && cluster.isMaster) {
      this.setupMasterProcess();
    } else if (!cluster.isMaster) {
      this.setupWorkerProcess();
    }
  }

  /**
   * Setup master process for cluster management
   */
  setupMasterProcess() {
    logger.info(`Master process ${process.pid} starting with ${this.maxWorkers} workers`);

    // Fork workers
    for (let i = 0; i < this.maxWorkers; i++) {
      this.forkWorker();
    }

    // Handle worker events
    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
      this.workers.delete(worker.id);
      
      // Restart worker if it wasn't intentionally killed
      if (!worker.exitedAfterDisconnect) {
        logger.info('Restarting worker...');
        this.forkWorker();
      }
    });

    cluster.on('online', (worker) => {
      logger.info(`Worker ${worker.process.pid} is online`);
    });

    cluster.on('disconnect', (worker) => {
      logger.info(`Worker ${worker.process.pid} disconnected`);
    });

    // Monitor worker health
    this.startWorkerHealthMonitoring();

    // Handle graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Fork a new worker
   */
  forkWorker() {
    const worker = cluster.fork();
    this.workers.set(worker.id, {
      worker,
      startTime: Date.now(),
      requests: 0,
      memoryUsage: 0
    });

    // Monitor worker messages
    worker.on('message', (message) => {
      this.handleWorkerMessage(worker.id, message);
    });

    return worker;
  }

  /**
   * Setup worker process
   */
  setupWorkerProcess() {
    logger.info(`Worker ${process.pid} started`);

    // Monitor worker memory usage
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      // Send memory usage to master
      if (process.send) {
        process.send({
          type: 'memory_usage',
          pid: process.pid,
          memory: heapUsedMB
        });
      }

      // Self-restart if memory usage is too high
      if (heapUsedMB > this.restartThreshold) {
        logger.warn(`Worker ${process.pid} memory usage too high: ${heapUsedMB}MB`);
        this.gracefulWorkerShutdown();
      }
    }, 30000); // Check every 30 seconds

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      logger.info(`Worker ${process.pid} received SIGTERM`);
      this.gracefulWorkerShutdown();
    });

    process.on('SIGINT', () => {
      logger.info(`Worker ${process.pid} received SIGINT`);
      this.gracefulWorkerShutdown();
    });
  }

  /**
   * Handle messages from workers
   * @param {number} workerId - Worker ID
   * @param {Object} message - Message from worker
   */
  handleWorkerMessage(workerId, message) {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    switch (message.type) {
      case 'memory_usage':
        workerInfo.memoryUsage = message.memory;
        
        // Restart worker if memory usage is too high
        if (message.memory > this.restartThreshold) {
          logger.warn(`Restarting worker ${message.pid} due to high memory usage: ${message.memory}MB`);
          this.restartWorker(workerId);
        }
        break;

      case 'request_count':
        workerInfo.requests = message.count;
        break;

      case 'health_check':
        workerInfo.lastHealthCheck = Date.now();
        break;

      default:
        logger.debug('Unknown message from worker', { workerId, message });
    }
  }

  /**
   * Start worker health monitoring
   */
  startWorkerHealthMonitoring() {
    setInterval(() => {
      this.workers.forEach((workerInfo, workerId) => {
        const { worker, startTime, memoryUsage, requests } = workerInfo;
        const uptime = Date.now() - startTime;

        logger.debug('Worker health check', {
          workerId,
          pid: worker.process.pid,
          uptime: Math.round(uptime / 1000),
          memoryUsage,
          requests,
          status: worker.isDead() ? 'dead' : 'alive'
        });

        // Check if worker is responsive
        if (worker.isDead()) {
          logger.error(`Worker ${worker.process.pid} is dead`);
          this.workers.delete(workerId);
          this.forkWorker();
        }
      });
    }, 60000); // Check every minute
  }

  /**
   * Restart a specific worker
   * @param {number} workerId - Worker ID to restart
   */
  restartWorker(workerId) {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    const { worker } = workerInfo;
    
    // Gracefully disconnect worker
    worker.disconnect();
    
    // Force kill if it doesn't exit within 10 seconds
    setTimeout(() => {
      if (!worker.isDead()) {
        logger.warn(`Force killing worker ${worker.process.pid}`);
        worker.kill('SIGKILL');
      }
    }, 10000);

    // Remove from workers map
    this.workers.delete(workerId);
  }

  /**
   * Graceful worker shutdown
   */
  gracefulWorkerShutdown() {
    logger.info(`Worker ${process.pid} starting graceful shutdown`);
    
    // Stop accepting new connections
    if (global.server) {
      global.server.close(() => {
        logger.info(`Worker ${process.pid} server closed`);
        process.exit(0);
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error(`Worker ${process.pid} force exit`);
        process.exit(1);
      }, 30000);
    } else {
      process.exit(0);
    }
  }

  /**
   * Setup graceful shutdown for master process
   */
  setupGracefulShutdown() {
    const shutdown = (signal) => {
      logger.info(`Master received ${signal}, shutting down workers`);
      
      // Disconnect all workers
      this.workers.forEach((workerInfo) => {
        workerInfo.worker.disconnect();
      });

      // Wait for workers to exit
      let workersAlive = this.workers.size;
      const checkInterval = setInterval(() => {
        workersAlive = Array.from(this.workers.values())
          .filter(info => !info.worker.isDead()).length;

        if (workersAlive === 0) {
          clearInterval(checkInterval);
          logger.info('All workers shut down, exiting master');
          process.exit(0);
        }
      }, 1000);

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Force killing remaining workers');
        this.workers.forEach((workerInfo) => {
          if (!workerInfo.worker.isDead()) {
            workerInfo.worker.kill('SIGKILL');
          }
        });
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Get cluster statistics
   * @returns {Object} Cluster statistics
   */
  getClusterStats() {
    if (!this.isClusterMode || !cluster.isMaster) {
      return {
        clusterMode: false,
        workers: 1,
        master: cluster.isMaster
      };
    }

    const workers = Array.from(this.workers.values()).map(info => ({
      id: info.worker.id,
      pid: info.worker.process.pid,
      uptime: Date.now() - info.startTime,
      memoryUsage: info.memoryUsage,
      requests: info.requests,
      status: info.worker.isDead() ? 'dead' : 'alive'
    }));

    return {
      clusterMode: true,
      master: true,
      maxWorkers: this.maxWorkers,
      activeWorkers: workers.filter(w => w.status === 'alive').length,
      totalWorkers: workers.length,
      workers
    };
  }

  /**
   * Scale workers up or down
   * @param {number} targetWorkers - Target number of workers
   */
  scaleWorkers(targetWorkers) {
    if (!this.isClusterMode || !cluster.isMaster) {
      logger.warn('Cannot scale workers: not in cluster mode or not master');
      return;
    }

    const currentWorkers = this.workers.size;
    
    if (targetWorkers > currentWorkers) {
      // Scale up
      const workersToAdd = targetWorkers - currentWorkers;
      logger.info(`Scaling up: adding ${workersToAdd} workers`);
      
      for (let i = 0; i < workersToAdd; i++) {
        this.forkWorker();
      }
    } else if (targetWorkers < currentWorkers) {
      // Scale down
      const workersToRemove = currentWorkers - targetWorkers;
      logger.info(`Scaling down: removing ${workersToRemove} workers`);
      
      const workerIds = Array.from(this.workers.keys()).slice(0, workersToRemove);
      workerIds.forEach(workerId => {
        this.restartWorker(workerId);
      });
    }
  }

  /**
   * Auto-scale based on load
   * @param {Object} metrics - Load metrics
   */
  autoScale(metrics) {
    if (!this.isClusterMode || !cluster.isMaster) return;

    const { cpuUsage, memoryUsage, requestRate } = metrics;
    const currentWorkers = this.workers.size;
    let targetWorkers = currentWorkers;

    // Scale up conditions
    if (cpuUsage > 80 && currentWorkers < this.maxWorkers) {
      targetWorkers = Math.min(currentWorkers + 1, this.maxWorkers);
      logger.info(`Auto-scaling up due to high CPU usage: ${cpuUsage}%`);
    } else if (requestRate > 1000 && currentWorkers < this.maxWorkers) {
      targetWorkers = Math.min(currentWorkers + 1, this.maxWorkers);
      logger.info(`Auto-scaling up due to high request rate: ${requestRate}/min`);
    }

    // Scale down conditions
    else if (cpuUsage < 30 && currentWorkers > 1) {
      targetWorkers = Math.max(currentWorkers - 1, 1);
      logger.info(`Auto-scaling down due to low CPU usage: ${cpuUsage}%`);
    } else if (requestRate < 100 && currentWorkers > 1) {
      targetWorkers = Math.max(currentWorkers - 1, 1);
      logger.info(`Auto-scaling down due to low request rate: ${requestRate}/min`);
    }

    if (targetWorkers !== currentWorkers) {
      this.scaleWorkers(targetWorkers);
    }
  }

  /**
   * Get load balancing statistics
   * @returns {Object} Load balancing stats
   */
  getLoadBalancingStats() {
    const workers = Array.from(this.workers.values());
    const totalRequests = workers.reduce((sum, info) => sum + info.requests, 0);
    const avgMemoryUsage = workers.reduce((sum, info) => sum + info.memoryUsage, 0) / workers.length;

    return {
      totalWorkers: workers.length,
      totalRequests,
      avgMemoryUsage: Math.round(avgMemoryUsage),
      requestDistribution: workers.map(info => ({
        workerId: info.worker.id,
        requests: info.requests,
        percentage: totalRequests > 0 ? Math.round((info.requests / totalRequests) * 100) : 0
      }))
    };
  }
}

module.exports = new ScalabilityService();

