const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment of Web3 Subscription Gateway...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy EntryPoint contract (ERC4337)
  console.log("\n1. Deploying EntryPoint contract...");
  const EntryPoint = await ethers.getContractFactory("EntryPoint");
  const entryPoint = await EntryPoint.deploy();
  await entryPoint.waitForDeployment();
  console.log("EntryPoint deployed to:", await entryPoint.getAddress());

  // Deploy IntentManager contract
  console.log("\n2. Deploying IntentManager contract...");
  const IntentManager = await ethers.getContractFactory("IntentManager");
  const intentManager = await IntentManager.deploy();
  await intentManager.waitForDeployment();
  console.log("IntentManager deployed to:", await intentManager.getAddress());

  // Deploy SubscriptionManager contract
  console.log("\n3. Deploying SubscriptionManager contract...");
  const SubscriptionManager = await ethers.getContractFactory("SubscriptionManager");
  const subscriptionManager = await SubscriptionManager.deploy();
  await subscriptionManager.waitForDeployment();
  console.log("SubscriptionManager deployed to:", await subscriptionManager.getAddress());

  // Deploy GasOptimizer contract
  console.log("\n4. Deploying GasOptimizer contract...");
  const GasOptimizer = await ethers.getContractFactory("GasOptimizer");
  const gasOptimizer = await GasOptimizer.deploy();
  await gasOptimizer.waitForDeployment();
  console.log("GasOptimizer deployed to:", await gasOptimizer.getAddress());

  // Deploy SubscriptionSolver contract
  console.log("\n5. Deploying SubscriptionSolver contract...");
  const SubscriptionSolver = await ethers.getContractFactory("SubscriptionSolver");
  const subscriptionSolver = await SubscriptionSolver.deploy(
    await subscriptionManager.getAddress(),
    await gasOptimizer.getAddress()
  );
  await subscriptionSolver.waitForDeployment();
  console.log("SubscriptionSolver deployed to:", await subscriptionSolver.getAddress());

  // Deploy SubscriptionSmartWallet factory
  console.log("\n6. Deploying SubscriptionSmartWalletFactory contract...");
  const SubscriptionSmartWalletFactory = await ethers.getContractFactory("SubscriptionSmartWalletFactory");
  const smartWalletFactory = await SubscriptionSmartWalletFactory.deploy(
    await entryPoint.getAddress(),
    await subscriptionManager.getAddress(),
    await gasOptimizer.getAddress()
  );
  await smartWalletFactory.waitForDeployment();
  console.log("SubscriptionSmartWalletFactory deployed to:", await smartWalletFactory.getAddress());

  // Set up contract relationships
  console.log("\n7. Setting up contract relationships...");
  
  // Update SubscriptionManager to use GasOptimizer
  await subscriptionManager.updateGasOptimizer(await gasOptimizer.getAddress());
  console.log("Updated SubscriptionManager with GasOptimizer");

  // Update GasOptimizer to use SubscriptionManager
  await gasOptimizer.updateSubscriptionManager(await subscriptionManager.getAddress());
  console.log("Updated GasOptimizer with SubscriptionManager");

  // Create sample subscription plans
  console.log("\n8. Creating sample subscription plans...");
  
  // USDC on Polygon (testnet: 0x2058A9D7613eEE744279e3856Ef0eAda5FCbaA7e)
  const USDC_ADDRESS = "0x2058A9D7613eEE744279e3856Ef0eAda5FCbaA7e"; // Mumbai testnet USDC
  
  // Basic plan: $10/month
  await subscriptionManager.createPlan(
    "Basic Plan",
    USDC_ADDRESS,
    ethers.parseUnits("10", 6), // 10 USDC (6 decimals)
    30 * 24 * 60 * 60, // 30 days in seconds
    1000 // Max 1000 subscribers
  );
  console.log("Created Basic Plan ($10/month)");

  // Premium plan: $25/month
  await subscriptionManager.createPlan(
    "Premium Plan",
    USDC_ADDRESS,
    ethers.parseUnits("25", 6), // 25 USDC (6 decimals)
    30 * 24 * 60 * 60, // 30 days in seconds
    500 // Max 500 subscribers
  );
  console.log("Created Premium Plan ($25/month)");

  // Pro plan: $50/month
  await subscriptionManager.createPlan(
    "Pro Plan",
    USDC_ADDRESS,
    ethers.parseUnits("50", 6), // 50 USDC (6 decimals)
    30 * 24 * 60 * 60, // 30 days in seconds
    200 // Max 200 subscribers
  );
  console.log("Created Pro Plan ($50/month)");

  // Configure GasOptimizer
  console.log("\n9. Configuring GasOptimizer...");
  await gasOptimizer.updateConfig({
    maxGasPrice: ethers.parseUnits("50", "gwei"),
    optimalGasPrice: ethers.parseUnits("20", "gwei"),
    executionBuffer: 3600, // 1 hour
    autoExecution: true,
    maxExecutionDelay: 7200 // 2 hours
  });
  console.log("Configured GasOptimizer");

  // Configure SubscriptionSolver
  console.log("\n10. Configuring SubscriptionSolver...");
  await subscriptionSolver.updateConfig({
    maxGasPrice: ethers.parseUnits("50", "gwei"),
    optimalGasPrice: ethers.parseUnits("20", "gwei"),
    executionBuffer: 3600, // 1 hour
    autoExecution: true,
    maxExecutionDelay: 7200 // 2 hours
  });
  console.log("Configured SubscriptionSolver");

  // Deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", await ethers.provider.getNetwork().then(n => n.name));
  console.log("Deployer:", deployer.address);
  console.log("EntryPoint:", await entryPoint.getAddress());
  console.log("IntentManager:", await intentManager.getAddress());
  console.log("SubscriptionManager:", await subscriptionManager.getAddress());
  console.log("GasOptimizer:", await gasOptimizer.getAddress());
  console.log("SubscriptionSolver:", await subscriptionSolver.getAddress());
  console.log("SubscriptionSmartWalletFactory:", await smartWalletFactory.getAddress());
  console.log("=".repeat(60));

  // Save deployment addresses to file
  const deploymentInfo = {
    network: await ethers.provider.getNetwork().then(n => n.name),
    chainId: await ethers.provider.getNetwork().then(n => n.chainId),
    deployer: deployer.address,
    contracts: {
      EntryPoint: await entryPoint.getAddress(),
      IntentManager: await intentManager.getAddress(),
      SubscriptionManager: await subscriptionManager.getAddress(),
      GasOptimizer: await gasOptimizer.getAddress(),
      SubscriptionSolver: await subscriptionSolver.getAddress(),
      SubscriptionSmartWalletFactory: await smartWalletFactory.getAddress()
    },
    tokens: {
      USDC: USDC_ADDRESS
    },
    timestamp: new Date().toISOString()
  };

  const fs = require('fs');
  fs.writeFileSync(
    `deployments/${await ethers.provider.getNetwork().then(n => n.name)}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment completed successfully!");
  console.log("Contract addresses saved to deployments/ directory");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
