// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SimpleSubscriptionManager
 * @dev Simplified subscription manager for testing and deployment
 */
contract SimpleSubscriptionManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // Subscription plan structure
    struct SubscriptionPlan {
        string name;
        address token;          // Payment token
        uint256 price;          // Price per interval
        uint256 interval;       // Billing interval in seconds
        bool active;            // Plan status
        uint256 maxSubscribers; // Maximum subscribers
        uint256 currentSubscribers; // Current subscriber count
    }
    
    // User subscription structure
    struct UserSubscription {
        uint256 planId;
        address user;           // User's EOA address
        uint256 startTime;
        uint256 lastPayment;
        uint256 nextPayment;
        bool active;
        bool apiAccess;         // API access status
    }
    
    // Subscription plans
    mapping(uint256 => SubscriptionPlan) public subscriptionPlans;
    uint256 public planCount;
    
    // User subscriptions
    mapping(address => UserSubscription) public userSubscriptions;
    
    // Supported payment tokens
    mapping(address => bool) public supportedTokens;
    
    // Revenue tracking
    mapping(address => uint256) public tokenRevenue;
    
    // Events
    event PlanCreated(
        uint256 indexed planId,
        string name,
        address token,
        uint256 price,
        uint256 interval
    );
    
    event SubscriptionStarted(
        address indexed user,
        uint256 indexed planId,
        uint256 startTime
    );
    
    event PaymentReceived(
        address indexed user,
        uint256 indexed planId,
        uint256 amount,
        uint256 nextPayment
    );
    
    event SubscriptionCancelled(address indexed user, uint256 indexed planId);
    
    event ApiAccessGranted(address indexed user);
    event ApiAccessRevoked(address indexed user);
    
    // Modifiers
    modifier onlyValidPlan(uint256 planId) {
        require(planId < planCount, "Invalid plan");
        require(subscriptionPlans[planId].active, "Plan inactive");
        _;
    }
    
    modifier onlySubscribedUser(address user) {
        require(userSubscriptions[user].active, "User not subscribed");
        _;
    }
    
    constructor() Ownable(msg.sender) {
        // Initialize with common payment tokens
        supportedTokens[0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174] = true; // USDC on Polygon
        supportedTokens[0xc2132D05D31c914a87C6611C10748AEb04B58e8F] = true; // USDT on Polygon
    }
    
    /**
     * @dev Create a new subscription plan
     */
    function createPlan(
        string memory name,
        address token,
        uint256 price,
        uint256 interval,
        uint256 maxSubscribers
    ) external onlyOwner {
        require(supportedTokens[token], "Token not supported");
        require(price > 0, "Invalid price");
        require(interval > 0, "Invalid interval");
        
        subscriptionPlans[planCount] = SubscriptionPlan({
            name: name,
            token: token,
            price: price,
            interval: interval,
            active: true,
            maxSubscribers: maxSubscribers,
            currentSubscribers: 0
        });
        
        emit PlanCreated(planCount, name, token, price, interval);
        planCount++;
    }
    
    /**
     * @dev Start a subscription for a user
     */
    function startSubscription(
        address user,
        uint256 planId
    ) external onlyValidPlan(planId) nonReentrant {
        require(!userSubscriptions[user].active, "User already subscribed");
        require(subscriptionPlans[planId].currentSubscribers < subscriptionPlans[planId].maxSubscribers, "Plan full");
        
        SubscriptionPlan storage plan = subscriptionPlans[planId];
        
        // Initialize user subscription
        userSubscriptions[user] = UserSubscription({
            planId: planId,
            user: user,
            startTime: block.timestamp,
            lastPayment: 0,
            nextPayment: block.timestamp + plan.interval,
            active: true,
            apiAccess: false // Will be granted after first payment
        });
        
        // Update plan subscriber count
        plan.currentSubscribers++;
        
        emit SubscriptionStarted(user, planId, block.timestamp);
    }
    
    /**
     * @dev Process subscription payment
     */
    function processPayment(
        address user,
        uint256 amount
    ) external onlySubscribedUser(user) {
        UserSubscription storage userSub = userSubscriptions[user];
        SubscriptionPlan storage plan = subscriptionPlans[userSub.planId];
        
        require(amount == plan.price, "Incorrect payment amount");
        require(block.timestamp >= userSub.nextPayment, "Payment not due");
        
        // Update payment tracking
        userSub.lastPayment = block.timestamp;
        userSub.nextPayment = block.timestamp + plan.interval;
        
        // Grant API access if this is the first payment
        if (!userSub.apiAccess) {
            userSub.apiAccess = true;
            emit ApiAccessGranted(user);
        }
        
        // Track revenue
        tokenRevenue[plan.token] += amount;
        
        emit PaymentReceived(user, userSub.planId, amount, userSub.nextPayment);
    }
    
    /**
     * @dev Cancel user subscription
     */
    function cancelSubscription(address user) external onlySubscribedUser(user) {
        require(msg.sender == user || msg.sender == owner(), "Unauthorized");
        
        UserSubscription storage userSub = userSubscriptions[user];
        SubscriptionPlan storage plan = subscriptionPlans[userSub.planId];
        
        // Update plan subscriber count
        plan.currentSubscribers--;
        
        // Deactivate subscription
        userSub.active = false;
        userSub.apiAccess = false;
        
        emit SubscriptionCancelled(user, userSub.planId);
        emit ApiAccessRevoked(user);
    }
    
    /**
     * @dev Check if user has API access
     */
    function hasApiAccess(address user) external view returns (bool) {
        return userSubscriptions[user].active && userSubscriptions[user].apiAccess;
    }
    
    /**
     * @dev Get user subscription details
     */
    function getUserSubscription(address user) external view returns (UserSubscription memory) {
        return userSubscriptions[user];
    }
    
    /**
     * @dev Get subscription plan details
     */
    function getPlan(uint256 planId) external view returns (SubscriptionPlan memory) {
        require(planId < planCount, "Invalid plan");
        return subscriptionPlans[planId];
    }
    
    /**
     * @dev Add supported payment token
     */
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }
    
    /**
     * @dev Remove supported payment token
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }
    
    /**
     * @dev Withdraw collected revenue
     */
    function withdrawRevenue(address token, uint256 amount) external onlyOwner {
        require(tokenRevenue[token] >= amount, "Insufficient revenue");
        
        IERC20(token).safeTransfer(owner(), amount);
        tokenRevenue[token] -= amount;
    }
    
    /**
     * @dev Emergency function to pause a plan
     */
    function pausePlan(uint256 planId) external onlyOwner {
        require(planId < planCount, "Invalid plan");
        subscriptionPlans[planId].active = false;
    }
    
    /**
     * @dev Resume a paused plan
     */
    function resumePlan(uint256 planId) external onlyOwner {
        require(planId < planCount, "Invalid plan");
        subscriptionPlans[planId].active = true;
    }
    
    /**
     * @dev Get total revenue for a token
     */
    function getTokenRevenue(address token) external view returns (uint256) {
        return tokenRevenue[token];
    }
}
