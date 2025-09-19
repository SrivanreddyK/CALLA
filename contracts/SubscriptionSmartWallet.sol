// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SubscriptionSmartWallet
 * @dev Smart wallet implementation for subscription payments using ERC4337 Account Abstraction
 * This wallet handles subscription payments, gas optimization, and user intent management
 */
contract SubscriptionSmartWallet is BaseAccount {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    using SafeERC20 for IERC20;

    // EntryPoint contract for ERC4337
    IEntryPoint private immutable _entryPoint;
    
    // Subscription manager contract
    address public subscriptionManager;
    
    // Gas optimizer contract
    address public gasOptimizer;
    
    // User's EOA address
    address public owner;
    
    // Subscription details
    struct Subscription {
        address token;           // Payment token (USDC, USDT, etc.)
        uint256 amount;         // Subscription amount
        uint256 interval;       // Billing interval in seconds
        uint256 nextBilling;    // Next billing timestamp
        bool active;            // Subscription status
        bytes32 intentHash;     // Off-chain intent hash for commitment
    }
    
    // User's subscription
    Subscription public userSubscription;
    
    // Events
    event SubscriptionCreated(
        address indexed user,
        address token,
        uint256 amount,
        uint256 interval,
        bytes32 intentHash
    );
    
    event SubscriptionRenewed(
        address indexed user,
        uint256 amount,
        uint256 nextBilling
    );
    
    event SubscriptionCancelled(address indexed user);
    
    event GasOptimized(
        address indexed user,
        uint256 gasPrice,
        uint256 timestamp
    );
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlySubscriptionManager() {
        require(msg.sender == subscriptionManager, "Not subscription manager");
        _;
    }
    
    modifier onlyGasOptimizer() {
        require(msg.sender == gasOptimizer, "Not gas optimizer");
        _;
    }
    
    constructor(
        IEntryPoint entryPoint_,
        address _owner,
        address _subscriptionManager,
        address _gasOptimizer
    ) {
        _entryPoint = entryPoint_;
        owner = _owner;
        subscriptionManager = _subscriptionManager;
        gasOptimizer = _gasOptimizer;
    }
    
    /**
     * @dev Create a new subscription with off-chain intent commitment
     * @param token Payment token address
     * @param amount Subscription amount
     * @param interval Billing interval in seconds
     * @param intentHash Hash of the off-chain intent for user commitment
     */
    function createSubscription(
        address token,
        uint256 amount,
        uint256 interval,
        bytes32 intentHash
    ) external onlySubscriptionManager {
        require(!userSubscription.active, "Subscription already active");
        require(token != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");
        require(interval > 0, "Invalid interval");
        
        userSubscription = Subscription({
            token: token,
            amount: amount,
            interval: interval,
            nextBilling: block.timestamp + interval,
            active: true,
            intentHash: intentHash
        });
        
        emit SubscriptionCreated(owner, token, amount, interval, intentHash);
    }
    
    /**
     * @dev Renew subscription payment
     * Called by gas optimizer when optimal gas conditions are met
     */
    function renewSubscription() external onlyGasOptimizer {
        require(userSubscription.active, "No active subscription");
        require(block.timestamp >= userSubscription.nextBilling, "Not time for renewal");
        
        IERC20 token = IERC20(userSubscription.token);
        uint256 amount = userSubscription.amount;
        
        // Check if wallet has sufficient balance
        require(token.balanceOf(address(this)) >= amount, "Insufficient balance");
        
        // Transfer payment to subscription manager
        token.safeTransfer(subscriptionManager, amount);
        
        // Update next billing time
        userSubscription.nextBilling = block.timestamp + userSubscription.interval;
        
        emit SubscriptionRenewed(owner, amount, userSubscription.nextBilling);
    }
    
    /**
     * @dev Cancel subscription
     */
    function cancelSubscription() external onlyOwner {
        require(userSubscription.active, "No active subscription");
        
        userSubscription.active = false;
        
        emit SubscriptionCancelled(owner);
    }
    
    /**
     * @dev Deposit funds to wallet for subscription payments
     * @param token Token address
     * @param amount Amount to deposit
     */
    function depositFunds(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }
    
    /**
     * @dev Withdraw funds from wallet (only if no active subscription)
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function withdrawFunds(address token, uint256 amount) external onlyOwner {
        require(!userSubscription.active, "Cannot withdraw with active subscription");
        IERC20(token).safeTransfer(owner, amount);
    }
    
    /**
     * @dev Execute transaction with gas optimization
     * Called by gas optimizer when conditions are optimal
     */
    function executeOptimizedTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlyGasOptimizer {
        (bool success, ) = to.call{value: value}(data);
        require(success, "Transaction failed");
    }
    
    /**
     * @dev Validate user operation for ERC4337
     */
    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view override returns (uint256 validationData) {
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        address recovered = hash.recover(userOp.signature);
        
        if (recovered != owner) {
            return SIG_VALIDATION_FAILED;
        }
        
        return 0;
    }
    
    /**
     * @dev Get entry point address
     */
    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }
    
    /**
     * @dev Get wallet nonce
     */
    function getNonce() public view override returns (uint256) {
        return _entryPoint.getNonce(address(this), 0);
    }
    
    /**
     * @dev Get subscription details
     */
    function getSubscription() external view returns (Subscription memory) {
        return userSubscription;
    }
    
    /**
     * @dev Check if subscription is due for renewal
     */
    function isSubscriptionDue() external view returns (bool) {
        return userSubscription.active && block.timestamp >= userSubscription.nextBilling;
    }
    
    /**
     * @dev Get time until next billing
     */
    function getTimeUntilNextBilling() external view returns (uint256) {
        if (!userSubscription.active) return 0;
        if (block.timestamp >= userSubscription.nextBilling) return 0;
        return userSubscription.nextBilling - block.timestamp;
    }
    
}
