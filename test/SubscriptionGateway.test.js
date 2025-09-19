const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Web3 Subscription Gateway", function () {
  let owner, user1, user2;
  let entryPoint, intentManager, subscriptionManager, gasOptimizer, subscriptionSolver, smartWalletFactory;
  let usdcToken;
  
  const USDC_ADDRESS = "0x2058A9D7613eEE744279e3856Ef0eAda5FCbaA7e"; // Mumbai testnet USDC
  
  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy EntryPoint
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();
    
    // Deploy IntentManager
    const IntentManager = await ethers.getContractFactory("IntentManager");
    intentManager = await IntentManager.deploy();
    await intentManager.waitForDeployment();
    
    // Deploy SubscriptionManager
    const SubscriptionManager = await ethers.getContractFactory("SubscriptionManager");
    subscriptionManager = await SubscriptionManager.deploy();
    await subscriptionManager.waitForDeployment();
    
    // Deploy GasOptimizer
    const GasOptimizer = await ethers.getContractFactory("GasOptimizer");
    gasOptimizer = await GasOptimizer.deploy();
    await gasOptimizer.waitForDeployment();
    
    // Deploy SubscriptionSolver
    const SubscriptionSolver = await ethers.getContractFactory("SubscriptionSolver");
    subscriptionSolver = await SubscriptionSolver.deploy(
      await subscriptionManager.getAddress(),
      await gasOptimizer.getAddress()
    );
    await subscriptionSolver.waitForDeployment();
    
    // Deploy SmartWalletFactory
    const SubscriptionSmartWalletFactory = await ethers.getContractFactory("SubscriptionSmartWalletFactory");
    smartWalletFactory = await SubscriptionSmartWalletFactory.deploy(
      await entryPoint.getAddress(),
      await subscriptionManager.getAddress(),
      await gasOptimizer.getAddress()
    );
    await smartWalletFactory.waitForDeployment();
    
    // Create a mock USDC token for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdcToken = await MockERC20.deploy("USD Coin", "USDC", 6);
    await usdcToken.waitForDeployment();
    
    // Add USDC to supported tokens
    await subscriptionManager.addSupportedToken(await usdcToken.getAddress());
    
    // Create subscription plans
    await subscriptionManager.createPlan(
      "Basic Plan",
      await usdcToken.getAddress(),
      ethers.parseUnits("10", 6), // 10 USDC
      30 * 24 * 60 * 60, // 30 days
      1000
    );
  });
  
  describe("Subscription Plans", function () {
    it("Should create subscription plans", async function () {
      const plan = await subscriptionManager.getPlan(0);
      expect(plan.name).to.equal("Basic Plan");
      expect(plan.price).to.equal(ethers.parseUnits("10", 6));
      expect(plan.interval).to.equal(30 * 24 * 60 * 60);
    });
    
    it("Should allow only owner to create plans", async function () {
      await expect(
        subscriptionManager.connect(user1).createPlan(
          "Test Plan",
          await usdcToken.getAddress(),
          ethers.parseUnits("5", 6),
          7 * 24 * 60 * 60,
          100
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  
  describe("Smart Wallet Creation", function () {
    it("Should create smart wallet for user", async function () {
      const salt = 12345;
      const wallet = await smartWalletFactory.createWallet(user1.address, salt);
      
      expect(await smartWalletFactory.hasWallet(user1.address)).to.be.true;
      expect(await smartWalletFactory.getUserWallet(user1.address)).to.equal(wallet);
    });
    
    it("Should not allow creating duplicate wallets", async function () {
      const salt = 12345;
      await smartWalletFactory.createWallet(user1.address, salt);
      
      await expect(
        smartWalletFactory.createWallet(user1.address, salt + 1)
      ).to.be.revertedWith("Wallet already exists");
    });
  });
  
  describe("Intent Management", function () {
    it("Should create intent for user", async function () {
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("test intent"));
      
      await intentManager.createIntent(
        user1.address,
        await smartWalletFactory.getUserWallet(user1.address),
        0, // planId
        ethers.parseUnits("10", 6),
        30 * 24 * 60 * 60,
        intentHash
      );
      
      const intent = await intentManager.getIntent(user1.address);
      expect(intent.user).to.equal(user1.address);
      expect(intent.intentHash).to.equal(intentHash);
    });
    
    it("Should verify intent with signature", async function () {
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("test intent"));
      
      await intentManager.createIntent(
        user1.address,
        await smartWalletFactory.getUserWallet(user1.address),
        0,
        ethers.parseUnits("10", 6),
        30 * 24 * 60 * 60,
        intentHash
      );
      
      // Create signature
      const messageHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [intentHash, user1.address, await smartWalletFactory.getUserWallet(user1.address), 0, ethers.parseUnits("10", 6), 30 * 24 * 60 * 60, await intentManager.getIntent(user1.address).then(i => i.startTime), await intentManager.getIntent(user1.address).then(i => i.endTime)]
      ));
      
      const signature = await user1.signMessage(ethers.getBytes(messageHash));
      
      await intentManager.verifyIntent(user1.address, signature);
      
      expect(await intentManager.isIntentValid(user1.address)).to.be.true;
    });
  });
  
  describe("Subscription Management", function () {
    beforeEach(async function () {
      // Create wallet for user1
      await smartWalletFactory.createWallet(user1.address, 12345);
      
      // Create intent
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("test intent"));
      await intentManager.createIntent(
        user1.address,
        await smartWalletFactory.getUserWallet(user1.address),
        0,
        ethers.parseUnits("10", 6),
        30 * 24 * 60 * 60,
        intentHash
      );
    });
    
    it("Should start subscription for user", async function () {
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("test intent"));
      
      await subscriptionManager.startSubscription(
        user1.address,
        0, // planId
        await smartWalletFactory.getUserWallet(user1.address),
        intentHash
      );
      
      const userSub = await subscriptionManager.getUserSubscription(user1.address);
      expect(userSub.active).to.be.true;
      expect(userSub.planId).to.equal(0);
    });
    
    it("Should grant API access after first payment", async function () {
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("test intent"));
      
      await subscriptionManager.startSubscription(
        user1.address,
        0,
        await smartWalletFactory.getUserWallet(user1.address),
        intentHash
      );
      
      // Simulate payment
      await subscriptionManager.processPayment(
        user1.address,
        ethers.parseUnits("10", 6)
      );
      
      expect(await subscriptionManager.hasApiAccess(user1.address)).to.be.true;
    });
  });
  
  describe("Gas Optimization", function () {
    it("Should start gas optimization for user", async function () {
      const params = {
        maxGasPrice: ethers.parseUnits("50", "gwei"),
        targetGasPrice: ethers.parseUnits("20", "gwei"),
        executionBuffer: 3600,
        autoExecution: true,
        maxExecutionDelay: 7200
      };
      
      await gasOptimizer.startOptimization(
        user1.address,
        await smartWalletFactory.getUserWallet(user1.address),
        0,
        params
      );
      
      const session = await gasOptimizer.getOptimizationSession(user1.address);
      expect(session.active).to.be.true;
      expect(session.user).to.equal(user1.address);
    });
    
    it("Should record gas price snapshots", async function () {
      const currentGasPrice = await gasOptimizer.getCurrentGasPrice();
      expect(currentGasPrice).to.be.gt(0);
    });
  });
  
  describe("Solver Functionality", function () {
    it("Should queue transaction for execution", async function () {
      // Create wallet and start subscription first
      await smartWalletFactory.createWallet(user1.address, 12345);
      
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("test intent"));
      await intentManager.createIntent(
        user1.address,
        await smartWalletFactory.getUserWallet(user1.address),
        0,
        ethers.parseUnits("10", 6),
        30 * 24 * 60 * 60,
        intentHash
      );
      
      await subscriptionManager.startSubscription(
        user1.address,
        0,
        await smartWalletFactory.getUserWallet(user1.address),
        intentHash
      );
      
      await subscriptionSolver.queueTransaction(
        user1.address,
        await smartWalletFactory.getUserWallet(user1.address),
        0
      );
      
      expect(await subscriptionSolver.getPendingTransactionsCount()).to.be.gt(0);
    });
  });
});

// Mock ERC20 contract for testing
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = 1000000 * 10**_decimals;
        balanceOf[msg.sender] = totalSupply;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        
        emit Transfer(from, to, amount);
        return true;
    }
}
