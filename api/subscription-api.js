const express = require("express");
const { ethers } = require("ethers");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

/**
 * Subscription API Server
 * REST API endpoints for Web3 subscription gateway
 */
class SubscriptionAPI {
  constructor(config) {
    this.app = express();
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    
    // Initialize contracts
    this.initializeContracts();
    
    // Setup middleware
    this.setupMiddleware();
    
    // Setup routes
    this.setupRoutes();
  }
  
  /**
   * Initialize contract instances
   */
  initializeContracts() {
    this.subscriptionManager = new ethers.Contract(
      this.config.subscriptionManagerAddress,
      this.getSubscriptionManagerABI(),
      this.wallet
    );
    
    this.smartWalletFactory = new ethers.Contract(
      this.config.smartWalletFactoryAddress,
      this.getSmartWalletFactoryABI(),
      this.wallet
    );
    
    this.intentManager = new ethers.Contract(
      this.config.intentManagerAddress,
      this.getIntentManagerABI(),
      this.wallet
    );
    
    this.gasOptimizer = new ethers.Contract(
      this.config.gasOptimizerAddress,
      this.getGasOptimizerABI(),
      this.wallet
    );
  }
  
  /**
   * Setup middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });
    this.app.use(limiter);
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }
  
  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check
    this.app.get("/health", (req, res) => {
      res.json({ status: "healthy", timestamp: new Date().toISOString() });
    });
    
    // Subscription plans
    this.app.get("/api/plans", this.getPlans.bind(this));
    this.app.get("/api/plans/:id", this.getPlan.bind(this));
    
    // User subscriptions
    this.app.get("/api/users/:address/subscription", this.getUserSubscription.bind(this));
    this.app.post("/api/users/:address/subscription", this.createSubscription.bind(this));
    this.app.delete("/api/users/:address/subscription", this.cancelSubscription.bind(this));
    
    // Smart wallet management
    this.app.get("/api/users/:address/wallet", this.getUserWallet.bind(this));
    this.app.post("/api/users/:address/wallet", this.createWallet.bind(this));
    
    // Intent management
    this.app.get("/api/users/:address/intent", this.getUserIntent.bind(this));
    this.app.post("/api/users/:address/intent", this.createIntent.bind(this));
    this.app.post("/api/users/:address/intent/verify", this.verifyIntent.bind(this));
    this.app.delete("/api/users/:address/intent", this.revokeIntent.bind(this));
    
    // Payment processing
    this.app.post("/api/users/:address/payment", this.processPayment.bind(this));
    
    // API access control
    this.app.get("/api/users/:address/access", this.checkApiAccess.bind(this));
    
    // Gas optimization
    this.app.get("/api/gas/status", this.getGasStatus.bind(this));
    this.app.post("/api/gas/optimize/:address", this.startGasOptimization.bind(this));
    
    // Revenue tracking
    this.app.get("/api/revenue", this.getRevenue.bind(this));
    this.app.get("/api/revenue/:token", this.getTokenRevenue.bind(this));
    
    // Admin endpoints
    this.app.post("/api/admin/plans", this.createPlan.bind(this));
    this.app.put("/api/admin/plans/:id/pause", this.pausePlan.bind(this));
    this.app.put("/api/admin/plans/:id/resume", this.resumePlan.bind(this));
    this.app.post("/api/admin/sponsor-gas/:address", this.sponsorGas.bind(this));
    
    // Error handling
    this.app.use(this.errorHandler.bind(this));
  }
  
  /**
   * Get all subscription plans
   */
  async getPlans(req, res) {
    try {
      const planCount = await this.subscriptionManager.planCount();
      const plans = [];
      
      for (let i = 0; i < planCount; i++) {
        const plan = await this.subscriptionManager.getPlan(i);
        plans.push({
          id: i,
          name: plan.name,
          token: plan.token,
          price: ethers.formatUnits(plan.price, 6),
          interval: plan.interval,
          active: plan.active,
          maxSubscribers: plan.maxSubscribers,
          currentSubscribers: plan.currentSubscribers
        });
      }
      
      res.json({ success: true, plans });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  /**
   * Get specific subscription plan
   */
  async getPlan(req, res) {
    try {
      const planId = parseInt(req.params.id);
      const plan = await this.subscriptionManager.getPlan(planId);
      
      res.json({
        success: true,
        plan: {
          id: planId,
          name: plan.name,
          token: plan.token,
          price: ethers.formatUnits(plan.price, 6),
          interval: plan.interval,
          active: plan.active,
          maxSubscribers: plan.maxSubscribers,
          currentSubscribers: plan.currentSubscribers
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  /**
   * Get user subscription
   */
  async getUserSubscription(req, res) {
    try {
      const userAddress = req.params.address;
      const subscription = await this.subscriptionManager.getUserSubscription(userAddress);
      
      res.json({
        success: true,
        subscription: {
          planId: subscription.planId,
          wallet: subscription.wallet,
          startTime: subscription.startTime,
          lastPayment: subscription.lastPayment,
          nextPayment: subscription.nextPayment,
          active: subscription.active,
          apiAccess: subscription.apiAccess
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  /**
   * Create user subscription
   */
  async createSubscription(req, res) {
    try {
      const userAddress = req.params.address;
      const { planId, wallet, intentHash } = req.body;
      
      // Validate input
      if (!planId && planId !== 0) {
        return res.status(400).json({ success: false, error: "Plan ID is required" });
      }
      
      // Create subscription
      const tx = await this.subscriptionManager.startSubscription(
        userAddress,
        planId,
        wallet,
        intentHash
      );
      
      await tx.wait();
      
      res.json({
        success: true,
        transactionHash: tx.hash,
        message: "Subscription created successfully"
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  /**
   * Cancel user subscription
   */
  async cancelSubscription(req, res) {
    try {
      const userAddress = req.params.address;
      
      const tx = await this.subscriptionManager.cancelSubscription(userAddress);
      await tx.wait();
      
      res.json({
        success: true,
        transactionHash: tx.hash,
        message: "Subscription cancelled successfully"
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  /**
   * Get user's smart wallet
   */
  async getUserWallet(req, res) {
    try {
      const userAddress = req.params.address;
      const hasWallet = await this.smartWalletFactory.hasWallet(userAddress);
      
      if (!hasWallet) {
        return res.json({
          success: true,
          wallet: null,
          message: "No wallet found for user"
        });
      }
      
      const walletAddress = await this.smartWalletFactory.getUserWallet(userAddress);
      
      res.json({
        success: true,
        wallet: walletAddress
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  /**
   * Create smart wallet for user
   */
  async createWallet(req, res) {
    try {
      const userAddress = req.params.address;
      const { salt } = req.body;
      
      const tx = await this.smartWalletFactory.createWallet(userAddress, salt || Date.now());
      await tx.wait();
      
      const walletAddress = await this.smartWalletFactory.getUserWallet(userAddress);
      
      res.json({
        success: true,
        transactionHash: tx.hash,
        wallet: walletAddress,
        message: "Wallet created successfully"
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  /**
   * Check API access for user
   */
  async checkApiAccess(req, res) {
    try {
      const userAddress = req.params.address;
      const hasAccess = await this.subscriptionManager.hasApiAccess(userAddress);
      
      res.json({
        success: true,
        hasAccess,
        message: hasAccess ? "User has API access" : "User does not have API access"
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  /**
   * Process payment for user
   */
  async processPayment(req, res) {
    try {
      const userAddress = req.params.address;
      const { amount } = req.body;
      
      const tx = await this.subscriptionManager.processPayment(userAddress, amount);
      await tx.wait();
      
      res.json({
        success: true,
        transactionHash: tx.hash,
        message: "Payment processed successfully"
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  /**
   * Get gas optimization status
   */
  async getGasStatus(req, res) {
    try {
      const optimalGasPrice = await this.gasOptimizer.getOptimalGasPrice();
      const trend = await this.gasOptimizer.getGasPriceTrend();
      
      res.json({
        success: true,
        gasStatus: {
          optimalGasPrice: ethers.formatUnits(optimalGasPrice, "gwei"),
          trend,
          currentGasPrice: ethers.formatUnits(await this.provider.getGasPrice(), "gwei")
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  /**
   * Get revenue statistics
   */
  async getRevenue(req, res) {
    try {
      const usdcAddress = "0x0000000000000000000000000000000000000001"; // Mock USDC
      const revenue = await this.subscriptionManager.getTokenRevenue(usdcAddress);
      
      res.json({
        success: true,
        revenue: {
          usdc: ethers.formatUnits(revenue, 6),
          total: ethers.formatUnits(revenue, 6)
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  /**
   * Error handler
   */
  errorHandler(err, req, res, next) {
    console.error("API Error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: err.message
    });
  }
  
  /**
   * Start the API server
   */
  start(port = 3001) {
    this.app.listen(port, () => {
      console.log(`🚀 Subscription API server running on port ${port}`);
      console.log(`📋 Health check: http://localhost:${port}/health`);
      console.log(`📊 API docs: http://localhost:${port}/api/plans`);
    });
  }
  
  // Contract ABIs (simplified)
  getSubscriptionManagerABI() {
    return [
      "function planCount() external view returns (uint256)",
      "function getPlan(uint256) external view returns (tuple(string name, address token, uint256 price, uint256 interval, bool active, uint256 maxSubscribers, uint256 currentSubscribers))",
      "function getUserSubscription(address) external view returns (tuple(uint256 planId, address wallet, uint256 startTime, uint256 lastPayment, uint256 nextPayment, bool active, bool apiAccess, bytes32 intentHash))",
      "function startSubscription(address, uint256, address, bytes32) external",
      "function cancelSubscription(address) external",
      "function hasApiAccess(address) external view returns (bool)",
      "function processPayment(address, uint256) external",
      "function getTokenRevenue(address) external view returns (uint256)",
      "function createPlan(string, address, uint256, uint256, uint256) external",
      "function pausePlan(uint256) external",
      "function resumePlan(uint256) external",
      "function sponsorGasFees(address, uint256) external"
    ];
  }
  
  getSmartWalletFactoryABI() {
    return [
      "function hasWallet(address) external view returns (bool)",
      "function getUserWallet(address) external view returns (address)",
      "function createWallet(address, uint256) external"
    ];
  }
  
  getIntentManagerABI() {
    return [
      "function getIntent(address) external view returns (tuple(address user, address wallet, uint256 planId, uint256 amount, uint256 interval, uint256 startTime, uint256 endTime, bytes32 intentHash, bool verified, bool revoked, uint256 createdAt))",
      "function isIntentValid(address) external view returns (bool)",
      "function createIntent(address, address, uint256, uint256, uint256, bytes32) external",
      "function verifyIntent(address, bytes) external",
      "function revokeIntent(address, string) external"
    ];
  }
  
  getGasOptimizerABI() {
    return [
      "function getOptimalGasPrice() external view returns (uint256)",
      "function getGasPriceTrend() external view returns (string)",
      "function startOptimization(address, address, uint256, tuple(uint256 maxGasPrice, uint256 targetGasPrice, uint256 gasPriceThreshold, uint256 maxWaitTime, bool autoRenewal)) external"
    ];
  }
}

module.exports = SubscriptionAPI;

// Example usage
if (require.main === module) {
  const config = {
    rpcUrl: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
    subscriptionManagerAddress: process.env.SUBSCRIPTION_MANAGER_ADDRESS,
    smartWalletFactoryAddress: process.env.SMART_WALLET_FACTORY_ADDRESS,
    intentManagerAddress: process.env.INTENT_MANAGER_ADDRESS,
    gasOptimizerAddress: process.env.GAS_OPTIMIZER_ADDRESS,
    privateKey: process.env.PRIVATE_KEY
  };
  
  const api = new SubscriptionAPI(config);
  api.start(3001);
}
