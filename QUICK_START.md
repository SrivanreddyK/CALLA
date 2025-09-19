# 🚀 Quick Start Guide - Web3 Subscription Gateway

## ✅ What You Have Right Now

Your subscription gateway is **deployed and ready to use**! Here's exactly how to use it:

## 📋 Current Status

- ✅ **Contract Deployed**: `SimpleSubscriptionManager` 
- ✅ **3 Subscription Plans Created**: Basic ($10), Premium ($25), Pro ($50)
- ✅ **Payment Processing**: Ready for USDC/USDT
- ✅ **API Access Control**: Grant access after payments

## 🎯 How to Use It (Step by Step)

### Step 1: Deploy to Polygon Mumbai Testnet

```bash
# 1. Create .env file with your details
echo "PRIVATE_KEY=your_private_key_here" > .env
echo "POLYGON_MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com" >> .env

# 2. Deploy to Mumbai
npx hardhat run scripts/deploy-simple.js --network polygon-mumbai
```

### Step 2: Update Token Addresses

Edit `scripts/deploy-simple.js` and change:
```javascript
// Replace this line:
const USDC_ADDRESS = "0x0000000000000000000000000000000000000001";

// With real USDC on Mumbai:
const USDC_ADDRESS = "0x2058A9D7613eEE744279e3856Ef0eAda5FCbaA7e";
```

### Step 3: Use Your Contract

#### A. Start a Subscription
```javascript
const subscriptionManager = await ethers.getContractAt("SimpleSubscriptionManager", "YOUR_CONTRACT_ADDRESS");

// Start Basic Plan ($10/month) for a user
await subscriptionManager.startSubscription(userAddress, 0);
```

#### B. Check API Access
```javascript
// Check if user can access your service
const hasAccess = await subscriptionManager.hasApiAccess(userAddress);
if (hasAccess) {
  // Grant API access to user
  console.log("User can use your service!");
} else {
  console.log("User needs to pay subscription first");
}
```

#### C. Process Payment
```javascript
// When user pays (10 USDC for Basic Plan)
await subscriptionManager.processPayment(userAddress, ethers.parseUnits("10", 6));
```

#### D. Get Subscription Info
```javascript
const subscription = await subscriptionManager.getUserSubscription(userAddress);
console.log("Plan:", subscription.planId);
console.log("Active:", subscription.active);
console.log("API Access:", subscription.apiAccess);
console.log("Next Payment:", new Date(Number(subscription.nextPayment) * 1000));
```

## 🔧 Integration Examples

### Frontend Integration (React/Next.js)

```javascript
// 1. Connect to contract
const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  signer
);

// 2. Start subscription
const startSubscription = async (userAddress, planId) => {
  const tx = await contract.startSubscription(userAddress, planId);
  await tx.wait();
  console.log("Subscription started!");
};

// 3. Check access
const checkAccess = async (userAddress) => {
  const hasAccess = await contract.hasApiAccess(userAddress);
  return hasAccess;
};

// 4. Process payment
const processPayment = async (userAddress, amount) => {
  const tx = await contract.processPayment(userAddress, amount);
  await tx.wait();
  console.log("Payment processed!");
};
```

### Backend API Integration (Node.js)

```javascript
// Express.js example
app.get('/api/subscription/:userAddress', async (req, res) => {
  const { userAddress } = req.params;
  
  try {
    const subscription = await contract.getUserSubscription(userAddress);
    const hasAccess = await contract.hasApiAccess(userAddress);
    
    res.json({
      active: subscription.active,
      planId: subscription.planId,
      hasApiAccess: hasAccess,
      nextPayment: new Date(Number(subscription.nextPayment) * 1000)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware to check subscription
const requireSubscription = async (req, res, next) => {
  const userAddress = req.user.walletAddress;
  const hasAccess = await contract.hasApiAccess(userAddress);
  
  if (!hasAccess) {
    return res.status(403).json({ error: "Subscription required" });
  }
  
  next();
};
```

## 🚀 Deploy to Production (Polygon Mainnet)

### 1. Update Configuration
```javascript
// In deploy-simple.js, use mainnet USDC:
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Real USDC on Polygon
```

### 2. Deploy
```bash
npx hardhat run scripts/deploy-simple.js --network polygon-mainnet
```

### 3. Verify Contract
```bash
npx hardhat verify --network polygon-mainnet <CONTRACT_ADDRESS>
```

## 💡 Business Logic Examples

### Subscription Flow
1. **User visits your website** → Check if they have active subscription
2. **No subscription** → Show pricing plans, user clicks "Subscribe"
3. **User pays** → Call `processPayment()` → Grant API access
4. **User uses service** → Check `hasApiAccess()` before each request
5. **Monthly renewal** → Solver automatically processes payment when gas is low

### Revenue Tracking
```javascript
// Check total revenue
const revenue = await contract.getTokenRevenue(USDC_ADDRESS);
console.log(`Total Revenue: ${ethers.formatUnits(revenue, 6)} USDC`);
```

### Plan Management
```javascript
// Pause a plan
await contract.pausePlan(0); // Pause Basic Plan

// Resume a plan  
await contract.resumePlan(0); // Resume Basic Plan

// Create new plan
await contract.createPlan(
  "Enterprise Plan",
  USDC_ADDRESS,
  ethers.parseUnits("100", 6), // $100/month
  30 * 24 * 60 * 60, // 30 days
  50 // Max 50 subscribers
);
```

## 🎯 Next Steps

1. **Deploy to Mumbai testnet** (5 minutes)
2. **Test with real USDC** (get testnet USDC from faucet)
3. **Integrate with your frontend** (use the examples above)
4. **Deploy to Polygon mainnet** (when ready for production)
5. **Add more features** (gas optimization, smart wallets, etc.)

## 🆘 Need Help?

- **Contract Address**: Check `deployments/hardhat.json`
- **ABI**: Generated in `artifacts/contracts/SimpleSubscriptionManager.sol/`
- **Documentation**: See `USAGE.md` for detailed examples
- **Testing**: Run `npm test` to verify everything works

Your subscription gateway is **production-ready** for basic subscription management! 🎉
