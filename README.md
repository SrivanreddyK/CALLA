<<<<<<< HEAD
# Web3 Subscription Gateway

A crypto payment gateway for web3 subscriptions using ERC4337 Account Abstraction on Polygon. This system enables seamless subscription payments with gas optimization and user intent management.

## Features

- **ERC4337 Account Abstraction**: Smart wallets for users with gasless transactions
- **Gas Optimization**: Automatic execution of subscription renewals at optimal gas prices
- **Intent Management**: Off-chain intent signing to prevent user mischief
- **Subscription Management**: Flexible subscription plans with multiple payment tokens
- **Solver System**: Automated transaction execution when gas conditions are optimal
- **API Access Control**: Service access granted only after successful payments

## Architecture

### Core Contracts

1. **SubscriptionSmartWallet**: ERC4337 smart wallet implementation
2. **SubscriptionManager**: Manages subscription plans and payments
3. **GasOptimizer**: Monitors gas prices and optimizes execution timing
4. **SubscriptionSolver**: Executes transactions at optimal gas times
5. **IntentManager**: Handles off-chain intent signing for user commitment
6. **SubscriptionSmartWalletFactory**: Creates smart wallets using CREATE2

### Workflow

1. **User Onboarding**:
   - User connects wallet
   - Smart wallet is created via factory
   - User signs off-chain intent for subscription commitment

2. **First Subscription**:
   - Company sponsors gas fees (even at a loss)
   - User pays fixed subscription price
   - API access is granted after payment

3. **Subsequent Renewals**:
   - Solver monitors gas prices
   - Executes renewal when gas is optimal
   - User pays fixed price, not worried about gas fees

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Hardhat
- Polygon testnet tokens (Mumbai)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd web3-subscription-gateway
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
PRIVATE_KEY=your_private_key_here
POLYGON_MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
POLYGON_MAINNET_RPC_URL=https://polygon-rpc.com
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here
REPORT_GAS=true
```

### Deployment

1. Compile contracts:
```bash
npm run compile
```

2. Run tests:
```bash
npm test
```

3. Deploy to Mumbai testnet:
```bash
npm run deploy:testnet
```

4. Deploy to Polygon mainnet:
```bash
npm run deploy:mainnet
```

### Contract Addresses

After deployment, contract addresses will be saved to `deployments/` directory:
- `deployments/mumbai.json` - Mumbai testnet addresses
- `deployments/polygon.json` - Polygon mainnet addresses

## Usage

### Creating Subscription Plans

```javascript
const subscriptionManager = await ethers.getContractAt("SubscriptionManager", address);

await subscriptionManager.createPlan(
  "Basic Plan",           // Plan name
  USDC_ADDRESS,          // Payment token
  ethers.parseUnits("10", 6), // Price (10 USDC)
  30 * 24 * 60 * 60,     // Interval (30 days)
  1000                   // Max subscribers
);
```

### Starting Subscription

```javascript
// 1. Create smart wallet
const wallet = await smartWalletFactory.createWallet(userAddress, salt);

// 2. Create intent
const intentHash = ethers.keccak256(ethers.toUtf8Bytes("subscription intent"));
await intentManager.createIntent(
  userAddress,
  wallet,
  planId,
  amount,
  interval,
  intentHash
);

// 3. Start subscription
await subscriptionManager.startSubscription(
  userAddress,
  planId,
  wallet,
  intentHash
);
```

### Gas Optimization

```javascript
const gasOptimizer = await ethers.getContractAt("GasOptimizer", address);

// Start optimization
await gasOptimizer.startOptimization(
  userAddress,
  walletAddress,
  planId,
  {
    maxGasPrice: ethers.parseUnits("50", "gwei"),
    targetGasPrice: ethers.parseUnits("20", "gwei"),
    executionBuffer: 3600,
    autoExecution: true,
    maxExecutionDelay: 7200
  }
);
```

## API Integration

### Check API Access

```javascript
const hasAccess = await subscriptionManager.hasApiAccess(userAddress);
if (hasAccess) {
  // Grant API access
  // Provide service to user
}
```

### Monitor Subscription Status

```javascript
const subscription = await subscriptionManager.getUserSubscription(userAddress);
const isActive = subscription.active;
const nextPayment = subscription.nextPayment;
```

## Gas Optimization Strategy

1. **Monitoring**: Continuously monitor gas prices on Polygon
2. **Prediction**: Use historical data to predict optimal execution times
3. **Execution**: Execute renewals when gas price is below threshold
4. **Fallback**: Force execution if subscription is about to expire

## Security Features

- **Intent Signing**: Users commit to subscription payments off-chain
- **Wallet Protection**: Smart wallets prevent user from emptying funds
- **Access Control**: API access only granted after successful payments
- **Gas Sponsorship**: Company can sponsor gas fees for first-time users

## Supported Tokens

- USDC (Polygon)
- USDT (Polygon)
- Custom ERC20 tokens (configurable)

## Testing

Run the test suite:
```bash
npm test
```

Test coverage:
```bash
npm run coverage
```

## Gas Optimization Parameters

- **Max Gas Price**: Maximum gas price willing to pay
- **Target Gas Price**: Optimal gas price for execution
- **Execution Buffer**: Time buffer before subscription expiry
- **Max Execution Delay**: Maximum delay allowed for execution

## Monitoring

The system provides several monitoring endpoints:

- Gas price history
- Optimization statistics
- Subscription status
- Execution success rates

## Troubleshooting

### Common Issues

1. **Deployment Fails**: Check RPC URL and private key
2. **Gas Estimation Fails**: Increase gas limit in hardhat.config.js
3. **Contract Verification Fails**: Check PolygonScan API key

### Support

For issues and questions:
- Check the test files for usage examples
- Review contract documentation
- Check deployment logs for errors

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Roadmap

- [ ] Multi-chain support
- [ ] Advanced gas prediction algorithms
- [ ] Mobile SDK
- [ ] Dashboard for monitoring
- [ ] Integration with popular payment processors
=======
# CALLA
Open Source ERC20 Payment Gateway
>>>>>>> 9407e099eca9f67195e9f4ea14796e46a19b1b89
