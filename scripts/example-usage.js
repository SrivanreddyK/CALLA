const { ethers } = require("hardhat");

async function main() {
  console.log("=== Web3 Subscription Gateway Usage Example ===\n");
  
  // Get signers
  const [owner, user1, user2] = await ethers.getSigners();
  
  // Contract address (update this with your deployed address)
  const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  
  // Get contract instance
  const subscriptionManager = await ethers.getContractAt("SimpleSubscriptionManager", CONTRACT_ADDRESS);
  
  console.log("📋 Contract Info:");
  console.log(`Contract Address: ${CONTRACT_ADDRESS}`);
  console.log(`Owner: ${owner.address}`);
  console.log(`User 1: ${user1.address}`);
  console.log(`User 2: ${user2.address}\n`);
  
  // 1. Check available subscription plans
  console.log("📊 Available Subscription Plans:");
  for (let i = 0; i < 3; i++) {
    const plan = await subscriptionManager.getPlan(i);
    console.log(`Plan ${i}: ${plan.name}`);
    console.log(`  Price: ${ethers.formatUnits(plan.price, 6)} USDC`);
    console.log(`  Interval: ${plan.interval / (24 * 60 * 60)} days`);
    console.log(`  Active: ${plan.active}`);
    console.log(`  Subscribers: ${plan.currentSubscribers}/${plan.maxSubscribers}\n`);
  }
  
  // 2. Start subscription for user1
  console.log("🚀 Starting Basic Plan subscription for User 1...");
  await subscriptionManager.startSubscription(user1.address, 0); // Basic Plan
  console.log("✅ Subscription started!\n");
  
  // 3. Check user's subscription status
  console.log("👤 User 1 Subscription Status:");
  const userSub = await subscriptionManager.getUserSubscription(user1.address);
  console.log(`Plan ID: ${userSub.planId}`);
  console.log(`Active: ${userSub.active}`);
  console.log(`API Access: ${userSub.apiAccess}`);
  console.log(`Next Payment: ${new Date(Number(userSub.nextPayment) * 1000).toLocaleString()}\n`);
  
  // 4. Check API access (should be false before payment)
  console.log("🔐 API Access Check:");
  const hasAccess = await subscriptionManager.hasApiAccess(user1.address);
  console.log(`User 1 has API access: ${hasAccess}\n`);
  
  // 5. Process payment (simulate user making payment)
  console.log("💳 Processing payment for User 1...");
  await subscriptionManager.processPayment(user1.address, ethers.parseUnits("10", 6)); // 10 USDC
  console.log("✅ Payment processed!\n");
  
  // 6. Check API access again (should be true after payment)
  console.log("🔐 API Access Check After Payment:");
  const hasAccessAfter = await subscriptionManager.hasApiAccess(user1.address);
  console.log(`User 1 has API access: ${hasAccessAfter}\n`);
  
  // 7. Check updated subscription status
  console.log("👤 Updated User 1 Subscription Status:");
  const updatedUserSub = await subscriptionManager.getUserSubscription(user1.address);
  console.log(`Plan ID: ${updatedUserSub.planId}`);
  console.log(`Active: ${updatedUserSub.active}`);
  console.log(`API Access: ${updatedUserSub.apiAccess}`);
  console.log(`Last Payment: ${new Date(Number(updatedUserSub.lastPayment) * 1000).toLocaleString()}`);
  console.log(`Next Payment: ${new Date(Number(updatedUserSub.nextPayment) * 1000).toLocaleString()}\n`);
  
  // 8. Start subscription for user2
  console.log("🚀 Starting Premium Plan subscription for User 2...");
  await subscriptionManager.startSubscription(user2.address, 1); // Premium Plan
  console.log("✅ Subscription started!\n");
  
  // 9. Check revenue tracking
  console.log("💰 Revenue Tracking:");
  const mockTokenAddress = "0x0000000000000000000000000000000000000001";
  const revenue = await subscriptionManager.getTokenRevenue(mockTokenAddress);
  console.log(`Total USDC Revenue: ${ethers.formatUnits(revenue, 6)} USDC\n`);
  
  // 10. Cancel user2's subscription
  console.log("❌ Cancelling User 2's subscription...");
  await subscriptionManager.cancelSubscription(user2.address);
  console.log("✅ Subscription cancelled!\n");
  
  // 11. Final status check
  console.log("📊 Final Status Summary:");
  console.log(`User 1 - Active: ${(await subscriptionManager.getUserSubscription(user1.address)).active}, API Access: ${await subscriptionManager.hasApiAccess(user1.address)}`);
  console.log(`User 2 - Active: ${(await subscriptionManager.getUserSubscription(user2.address)).active}, API Access: ${await subscriptionManager.hasApiAccess(user2.address)}`);
  
  console.log("\n🎉 Example completed successfully!");
  console.log("\n📝 Next Steps:");
  console.log("1. Deploy to Polygon Mumbai: npx hardhat run scripts/deploy-simple.js --network polygon-mumbai");
  console.log("2. Update CONTRACT_ADDRESS in this script with your deployed address");
  console.log("3. Use real USDC token address for production");
  console.log("4. Integrate with your frontend/API");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Example failed:", error);
    process.exit(1);
  });
