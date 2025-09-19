const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment of Web3 Subscription Gateway Backend...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy IntentManager contract
  console.log("\n1. Deploying IntentManager contract...");
  const IntentManager = await ethers.getContractFactory("IntentManager");
  const intentManager = await IntentManager.deploy();
  await intentManager.waitForDeployment();
  console.log("IntentManager deployed to:", await intentManager.getAddress());

  // Deploy SubscriptionManager contract
  console.log("\n2. Deploying SubscriptionManager contract...");
  const SubscriptionManager = await ethers.getContractFactory("SubscriptionManager");
  const subscriptionManager = await SubscriptionManager.deploy();
  await subscriptionManager.waitForDeployment();
  console.log("SubscriptionManager deployed to:", await subscriptionManager.getAddress());

  // Deploy GasOptimizer contract
  console.log("\n3. Deploying GasOptimizer contract...");
  const GasOptimizer = await ethers.getContractFactory("GasOptimizer");
  const gasOptimizer = await GasOptimizer.deploy();
  await gasOptimizer.waitForDeployment();
  console.log("GasOptimizer deployed to:", await gasOptimizer.getAddress());

  // Deploy SubscriptionSolver contract
  console.log("\n4. Deploying SubscriptionSolver contract...");
  const SubscriptionSolver = await ethers.getContractFactory("SubscriptionSolver");
  const subscriptionSolver = await SubscriptionSolver.deploy(
    await subscriptionManager.getAddress(),
    await gasOptimizer.getAddress()
  );
  await subscriptionSolver.waitForDeployment();
  console.log("SubscriptionSolver deployed to:", await subscriptionSolver.getAddress());

  // Add mock token to supported tokens
  console.log("\n5. Adding mock token to supported tokens...");
  const USDC_ADDRESS = "0x0000000000000000000000000000000000000001";
  await subscriptionManager.addSupportedToken(USDC_ADDRESS);
  console.log("Added mock USDC token to supported tokens");

  // Create sample subscription plans
  console.log("\n6. Creating sample subscription plans...");
  
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

  console.log("\n7. Backend deployment completed!");

  // Deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("BACKEND DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", await ethers.provider.getNetwork().then(n => n.name));
  console.log("Deployer:", deployer.address);
  console.log("IntentManager:", await intentManager.getAddress());
  console.log("SubscriptionManager:", await subscriptionManager.getAddress());
  console.log("GasOptimizer:", await gasOptimizer.getAddress());
  console.log("SubscriptionSolver:", await subscriptionSolver.getAddress());
  console.log("=".repeat(60));

  // Save deployment addresses to file
  const deploymentInfo = {
    network: await ethers.provider.getNetwork().then(n => n.name),
    chainId: Number(await ethers.provider.getNetwork().then(n => n.chainId)),
    deployer: deployer.address,
    contracts: {
      IntentManager: await intentManager.getAddress(),
      SubscriptionManager: await subscriptionManager.getAddress(),
      GasOptimizer: await gasOptimizer.getAddress(),
      SubscriptionSolver: await subscriptionSolver.getAddress()
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

  console.log("\n🎉 Backend deployment completed successfully!");
  console.log("Contract addresses saved to deployments/ directory");
  console.log("\n📋 Backend Features Implemented:");
  console.log("✅ Subscription Management - Create/manage subscription plans");
  console.log("✅ Intent Management - Off-chain intent signing for user commitment");
  console.log("✅ Gas Optimization - Monitor and optimize gas fees");
  console.log("✅ Solver System - Execute transactions at optimal times");
  console.log("✅ Payment Processing - Handle recurring payments");
  console.log("✅ API Access Control - Grant access based on payments");
  console.log("✅ Revenue Tracking - Track earnings per token");
  console.log("✅ Gas Sponsorship - Sponsor gas fees for first-time users");
  console.log("\n🚀 Next Steps:");
  console.log("1. Deploy to Polygon Amoy: npx hardhat run scripts/deploy-backend.js --network polygon-amoy");
  console.log("2. Deploy to Polygon Mainnet: npx hardhat run scripts/deploy-backend.js --network polygon-mainnet");
  console.log("3. Start gas monitoring service: node services/gas-monitor.js");
  console.log("4. Start intent verification service: node services/intent-verifier.js");
  console.log("5. Start API server: node api/subscription-api.js");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
