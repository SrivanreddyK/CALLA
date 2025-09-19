const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment of Simple Web3 Subscription Gateway...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy SimpleSubscriptionManager contract
  console.log("\n1. Deploying SimpleSubscriptionManager contract...");
  const SimpleSubscriptionManager = await ethers.getContractFactory("SimpleSubscriptionManager");
  const subscriptionManager = await SimpleSubscriptionManager.deploy();
  await subscriptionManager.waitForDeployment();
  console.log("SimpleSubscriptionManager deployed to:", await subscriptionManager.getAddress());

  // Add mock token to supported tokens
  console.log("\n2. Adding mock token to supported tokens...");
  const USDC_ADDRESS = "0x0000000000000000000000000000000000000001"; // Mock token for testing
  await subscriptionManager.addSupportedToken(USDC_ADDRESS);
  console.log("Added mock USDC token to supported tokens");

  // Create sample subscription plans
  console.log("\n3. Creating sample subscription plans...");
  
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

  // Deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", await ethers.provider.getNetwork().then(n => n.name));
  console.log("Deployer:", deployer.address);
  console.log("SimpleSubscriptionManager:", await subscriptionManager.getAddress());
  console.log("=".repeat(60));

  // Save deployment addresses to file
  const deploymentInfo = {
    network: await ethers.provider.getNetwork().then(n => n.name),
    chainId: Number(await ethers.provider.getNetwork().then(n => n.chainId)),
    deployer: deployer.address,
    contracts: {
      SimpleSubscriptionManager: await subscriptionManager.getAddress()
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
