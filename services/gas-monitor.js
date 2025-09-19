const { ethers } = require("ethers");
const fs = require("fs");

/**
 * Gas Monitoring Service
 * Monitors gas prices and triggers optimization when conditions are met
 */
class GasMonitor {
  constructor(config) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.gasOptimizerAddress = config.gasOptimizerAddress;
    this.subscriptionSolverAddress = config.subscriptionSolverAddress;
    this.privateKey = config.privateKey;
    this.wallet = new ethers.Wallet(this.privateKey, this.provider);
    
    this.gasOptimizer = new ethers.Contract(
      this.gasOptimizerAddress,
      this.getGasOptimizerABI(),
      this.wallet
    );
    
    this.subscriptionSolver = new ethers.Contract(
      this.subscriptionSolverAddress,
      this.getSubscriptionSolverABI(),
      this.wallet
    );
    
    this.isRunning = false;
    this.monitoringInterval = config.monitoringInterval || 30000; // 30 seconds
    this.gasPriceHistory = [];
    this.maxHistorySize = 100;
  }
  
  /**
   * Start gas monitoring
   */
  async start() {
    console.log("🔍 Starting gas monitoring service...");
    this.isRunning = true;
    
    // Initial gas price check
    await this.checkGasPrices();
    
    // Set up monitoring interval
    this.monitoringTimer = setInterval(async () => {
      if (this.isRunning) {
        await this.checkGasPrices();
      }
    }, this.monitoringInterval);
    
    console.log("✅ Gas monitoring service started");
  }
  
  /**
   * Stop gas monitoring
   */
  stop() {
    console.log("🛑 Stopping gas monitoring service...");
    this.isRunning = false;
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    console.log("✅ Gas monitoring service stopped");
  }
  
  /**
   * Check current gas prices and trigger optimization if needed
   */
  async checkGasPrices() {
    try {
      const currentGasPrice = await this.provider.getGasPrice();
      const blockNumber = await this.provider.getBlockNumber();
      
      // Record gas price snapshot
      this.recordGasPriceSnapshot(currentGasPrice, blockNumber);
      
      // Check if conditions are optimal for execution
      const isOptimal = await this.isOptimalGasConditions(currentGasPrice);
      
      if (isOptimal) {
        console.log(`🎯 Optimal gas conditions detected: ${ethers.formatUnits(currentGasPrice, "gwei")} gwei`);
        await this.executeOptimizations();
      } else {
        console.log(`⏳ Waiting for better gas conditions: ${ethers.formatUnits(currentGasPrice, "gwei")} gwei`);
      }
      
      // Log gas price trend
      const trend = this.getGasPriceTrend();
      console.log(`📊 Gas price trend: ${trend}`);
      
    } catch (error) {
      console.error("❌ Error checking gas prices:", error.message);
    }
  }
  
  /**
   * Record gas price snapshot
   */
  recordGasPriceSnapshot(gasPrice, blockNumber) {
    const snapshot = {
      gasPrice: gasPrice.toString(),
      blockNumber,
      timestamp: Date.now(),
      gwei: ethers.formatUnits(gasPrice, "gwei")
    };
    
    this.gasPriceHistory.push(snapshot);
    
    // Maintain history size
    if (this.gasPriceHistory.length > this.maxHistorySize) {
      this.gasPriceHistory.shift();
    }
    
    // Save to file for persistence
    this.saveGasPriceHistory();
  }
  
  /**
   * Check if gas conditions are optimal
   */
  async isOptimalGasConditions(currentGasPrice) {
    try {
      // Get optimal gas price from contract
      const optimalGasPrice = await this.gasOptimizer.getOptimalGasPrice();
      
      // Check if current price is below optimal
      return currentGasPrice <= optimalGasPrice;
    } catch (error) {
      console.error("❌ Error checking optimal gas conditions:", error.message);
      return false;
    }
  }
  
  /**
   * Execute optimizations when conditions are met
   */
  async executeOptimizations() {
    try {
      console.log("🚀 Executing gas optimizations...");
      
      // Execute pending transactions in solver
      const tx = await this.subscriptionSolver.executePendingTransactions();
      await tx.wait();
      
      console.log("✅ Gas optimizations executed successfully");
      
    } catch (error) {
      console.error("❌ Error executing optimizations:", error.message);
    }
  }
  
  /**
   * Get gas price trend
   */
  getGasPriceTrend() {
    if (this.gasPriceHistory.length < 2) {
      return "insufficient_data";
    }
    
    const recent = BigInt(this.gasPriceHistory[this.gasPriceHistory.length - 1].gasPrice);
    const previous = BigInt(this.gasPriceHistory[this.gasPriceHistory.length - 2].gasPrice);
    
    const changePercent = Number((recent - previous) * 100n / previous);
    
    if (changePercent > 10) {
      return "increasing";
    } else if (changePercent < -10) {
      return "decreasing";
    } else {
      return "stable";
    }
  }
  
  /**
   * Save gas price history to file
   */
  saveGasPriceHistory() {
    try {
      const data = {
        timestamp: Date.now(),
        history: this.gasPriceHistory
      };
      
      fs.writeFileSync("gas-price-history.json", JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("❌ Error saving gas price history:", error.message);
    }
  }
  
  /**
   * Load gas price history from file
   */
  loadGasPriceHistory() {
    try {
      if (fs.existsSync("gas-price-history.json")) {
        const data = JSON.parse(fs.readFileSync("gas-price-history.json", "utf8"));
        this.gasPriceHistory = data.history || [];
        console.log(`📈 Loaded ${this.gasPriceHistory.length} gas price snapshots`);
      }
    } catch (error) {
      console.error("❌ Error loading gas price history:", error.message);
    }
  }
  
  /**
   * Get gas optimizer ABI
   */
  getGasOptimizerABI() {
    return [
      "function getOptimalGasPrice() external view returns (uint256)",
      "function getGasPriceTrend() external view returns (string)",
      "function executeOptimization(address user) external",
      "function getOptimizationSession(address user) external view returns (tuple(address user, address wallet, uint256 planId, uint256 startTime, uint256 targetExecutionTime, bool active, tuple(uint256 maxGasPrice, uint256 targetGasPrice, uint256 gasPriceThreshold, uint256 maxWaitTime, bool autoRenewal) params))",
      "function getRecentGasPriceHistory(uint256 count) external view returns (tuple(uint256 gasPrice, uint256 timestamp, uint256 blockNumber)[])"
    ];
  }
  
  /**
   * Get subscription solver ABI
   */
  getSubscriptionSolverABI() {
    return [
      "function executePendingTransactions() external",
      "function getPendingTransactionsCount() external view returns (uint256)",
      "function getPendingTransaction(uint256 index) external view returns (tuple(address user, address wallet, uint256 planId, uint256 targetExecutionTime, uint256 maxGasPrice, bool executed, uint256 executionTime, uint256 actualGasPrice))",
      "function queueTransaction(address user, address wallet, uint256 planId) external",
      "function getSolverStats() external view returns (tuple(uint256 totalExecutions, uint256 totalGasSaved, uint256 averageGasPrice, uint256 successRate, uint256 lastExecutionTime))"
    ];
  }
  
  /**
   * Get current gas price statistics
   */
  getGasPriceStats() {
    if (this.gasPriceHistory.length === 0) {
      return {
        current: "0",
        average: "0",
        min: "0",
        max: "0",
        trend: "insufficient_data"
      };
    }
    
    const prices = this.gasPriceHistory.map(s => BigInt(s.gasPrice));
    const current = prices[prices.length - 1];
    const sum = prices.reduce((a, b) => a + b, 0n);
    const average = sum / BigInt(prices.length);
    const min = prices.reduce((a, b) => a < b ? a : b);
    const max = prices.reduce((a, b) => a > b ? a : b);
    
    return {
      current: ethers.formatUnits(current, "gwei"),
      average: ethers.formatUnits(average, "gwei"),
      min: ethers.formatUnits(min, "gwei"),
      max: ethers.formatUnits(max, "gwei"),
      trend: this.getGasPriceTrend()
    };
  }
}

module.exports = GasMonitor;

// Example usage
if (require.main === module) {
  const config = {
    rpcUrl: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
    gasOptimizerAddress: process.env.GAS_OPTIMIZER_ADDRESS,
    subscriptionSolverAddress: process.env.SUBSCRIPTION_SOLVER_ADDRESS,
    privateKey: process.env.PRIVATE_KEY,
    monitoringInterval: 30000 // 30 seconds
  };
  
  const monitor = new GasMonitor(config);
  
  // Load existing history
  monitor.loadGasPriceHistory();
  
  // Start monitoring
  monitor.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gas monitor...');
    monitor.stop();
    process.exit(0);
  });
}
