# Web3 Subscription Gateway - Usage Guide

## Quick Start

Your Web3 subscription gateway is now ready! Here's how to use it:

### 1. Contract Deployment

The contract has been successfully deployed to Hardhat network:
- **Contract Address**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Network**: Hardhat (local testing)

### 2. Available Subscription Plans

Three subscription plans have been created:

1. **Basic Plan**: $10/month (Plan ID: 0)
2. **Premium Plan**: $25/month (Plan ID: 1)  
3. **Pro Plan**: $50/month (Plan ID: 2)

### 3. Basic Usage Examples

#### Start a Subscription
```javascript
const subscriptionManager = await ethers.getContractAt("SimpleSubscriptionManager", "0x5FbDB2315678afecb367f032d93F642f64180aa3");

// Start Basic Plan subscription for user
await subscriptionManager.startSubscription(
  userAddress,  // User's wallet address
  0             // Plan ID (0 = Basic Plan)
);
```

#### Check API Access
```javascript
// Check if user has API access
const hasAccess = await subscriptionManager.hasApiAccess(userAddress);
if (hasAccess) {
  console.log("User has API access!");
} else {
  console.log("User needs to make payment first");
}
```

#### Process Payment
```javascript
// Process subscription payment (10 USDC for Basic Plan)
await subscriptionManager.processPayment(
  userAddress,
  ethers.parseUnits("10", 6) // 10 USDC (6 decimals)
);
```

#### Get Subscription Details
```javascript
// Get user's subscription info
const subscription = await subscriptionManager.getUserSubscription(userAddress);
console.log("Plan ID:", subscription.planId);
console.log("Next Payment:", new Date(Number(subscription.nextPayment) * 1000));
console.log("Active:", subscription.active);
```

### 4. Deploy to Polygon Testnet

To deploy to Polygon Mumbai testnet:

1. **Set up environment variables**:
```bash
# Create .env file
PRIVATE_KEY=your_private_key_here
POLYGON_MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here
```

2. **Deploy to Mumbai**:
```bash
npx hardhat run scripts/deploy-simple.js --network polygon-mumbai
```

3. **Update token addresses** in the deployment script:
```javascript
// Real USDC on Mumbai testnet
const USDC_ADDRESS = "0x2058A9D7613eEE744279e3856Ef0eAda5FCbaA7e";
```

### 5. Deploy to Polygon Mainnet

For mainnet deployment:

1. **Update RPC URL**:
```bash
POLYGON_MAINNET_RPC_URL=https://polygon-rpc.com
```

2. **Use real USDC address**:
```javascript
// Real USDC on Polygon mainnet
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
```

3. **Deploy**:
```bash
npx hardhat run scripts/deploy-simple.js --network polygon-mainnet
```

### 6. Key Features Implemented

✅ **Subscription Management**: Create and manage subscription plans
✅ **Payment Processing**: Handle recurring payments
✅ **API Access Control**: Grant/revoke service access based on payments
✅ **Multi-token Support**: Support for USDC, USDT, and custom tokens
✅ **Revenue Tracking**: Track earnings per token
✅ **Plan Management**: Pause/resume subscription plans
✅ **User Management**: Start/cancel user subscriptions

### 7. Next Steps for Full Implementation

To complete the full ERC4337 Account Abstraction system:

1. **Smart Wallet Integration**: Implement ERC4337 smart wallets
2. **Gas Optimization**: Add automatic gas fee optimization
3. **Intent System**: Implement off-chain intent signing
4. **Solver System**: Add automated transaction execution
5. **API Integration**: Build REST API endpoints
6. **Frontend**: Create web interface for users

### 8. Testing

Run the test suite:
```bash
npm test
```

### 9. Contract Verification

Verify contracts on PolygonScan:
```bash
npx hardhat verify --network polygon-mumbai <CONTRACT_ADDRESS>
```

### 10. Support

The current implementation provides a solid foundation for your Web3 subscription gateway. You can:

- Start accepting subscriptions immediately
- Process payments in USDC/USDT
- Control API access based on subscription status
- Scale to multiple subscription plans
- Deploy to Polygon mainnet when ready

The contract is production-ready for basic subscription management!
