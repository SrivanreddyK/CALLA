// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./SubscriptionSmartWallet.sol";
import "./SubscriptionManager.sol";

/**
 * @title GasOptimizer
 * @dev Optimizes gas fees by monitoring network conditions and executing transactions at optimal times
 */
contract GasOptimizer is Ownable, ReentrancyGuard {
    using Math for uint256;
    
    // Gas optimization parameters
    struct GasOptimizationParams {
        uint256 maxGasPrice;        // Maximum gas price willing to pay
        uint256 targetGasPrice;     // Target gas price for execution
        uint256 gasPriceThreshold; // Threshold below which to execute
        uint256 maxWaitTime;       // Maximum time to wait for optimization
        bool autoRenewal;          // Enable automatic renewal
    }
    
    // Optimization session for a user
    struct OptimizationSession {
        address user;
        address wallet;
        uint256 planId;
        uint256 startTime;
        uint256 targetExecutionTime;
        bool active;
        GasOptimizationParams params;
    }
    
    // Gas price history for analysis
    struct GasPriceSnapshot {
        uint256 gasPrice;
        uint256 timestamp;
        uint256 blockNumber;
    }
    
    // Active optimization sessions
    mapping(address => OptimizationSession) public optimizationSessions;
    
    // Gas price history
    GasPriceSnapshot[] public gasPriceHistory;
    uint256 public constant MAX_HISTORY_SIZE = 1000;
    
    // Optimization statistics
    mapping(address => uint256) public optimizationCount;
    mapping(address => uint256) public totalGasSaved;
    
    // Events
    event OptimizationStarted(
        address indexed user,
        address indexed wallet,
        uint256 planId,
        uint256 targetExecutionTime
    );
    
    event OptimizationExecuted(
        address indexed user,
        uint256 gasPrice,
        uint256 gasSaved,
        uint256 timestamp
    );
    
    event OptimizationCancelled(address indexed user);
    
    event GasPriceSnapshotAdded(uint256 gasPrice, uint256 timestamp);
    
    // Modifiers
    modifier onlyActiveSession(address user) {
        require(optimizationSessions[user].active, "No active optimization session");
        _;
    }
    
    constructor() Ownable(msg.sender) {
        // Initialize with default gas optimization parameters
    }
    
    /**
     * @dev Start gas optimization for a user's subscription renewal
     * @param user User address
     * @param wallet User's smart wallet address
     * @param planId Subscription plan ID
     * @param params Gas optimization parameters
     */
    function startOptimization(
        address user,
        address wallet,
        uint256 planId,
        GasOptimizationParams memory params
    ) external onlyOwner nonReentrant {
        require(!optimizationSessions[user].active, "Optimization already active");
        require(params.maxGasPrice > 0, "Invalid max gas price");
        require(params.targetGasPrice > 0, "Invalid target gas price");
        require(params.maxWaitTime > 0, "Invalid max wait time");
        
        // Calculate target execution time (next billing - buffer time)
        uint256 nextBilling = SubscriptionSmartWallet(wallet).getTimeUntilNextBilling();
        uint256 targetExecutionTime = block.timestamp + nextBilling - 3600; // 1 hour buffer
        
        optimizationSessions[user] = OptimizationSession({
            user: user,
            wallet: wallet,
            planId: planId,
            startTime: block.timestamp,
            targetExecutionTime: targetExecutionTime,
            active: true,
            params: params
        });
        
        emit OptimizationStarted(user, wallet, planId, targetExecutionTime);
    }
    
    /**
     * @dev Execute optimization when gas conditions are met
     * This function should be called by a keeper or monitoring service
     */
    function executeOptimization(address user) external onlyActiveSession(user) nonReentrant {
        OptimizationSession storage session = optimizationSessions[user];
        
        // Check if it's time to execute
        require(block.timestamp >= session.targetExecutionTime, "Not time to execute");
        
        uint256 currentGasPrice = tx.gasprice;
        
        // Check if gas price is within acceptable range
        require(currentGasPrice <= session.params.maxGasPrice, "Gas price too high");
        
        // Record gas price snapshot
        _recordGasPriceSnapshot(currentGasPrice);
        
        // Execute subscription renewal
        SubscriptionSmartWallet(session.wallet).renewSubscription();
        
        // Calculate gas saved (compared to max gas price)
        uint256 gasSaved = session.params.maxGasPrice - currentGasPrice;
        
        // Update statistics
        optimizationCount[user]++;
        totalGasSaved[user] += gasSaved;
        
        // Deactivate session
        session.active = false;
        
        emit OptimizationExecuted(user, currentGasPrice, gasSaved, block.timestamp);
    }
    
    /**
     * @dev Cancel optimization session
     */
    function cancelOptimization(address user) external onlyActiveSession(user) {
        require(msg.sender == user || msg.sender == owner(), "Unauthorized");
        
        optimizationSessions[user].active = false;
        
        emit OptimizationCancelled(user);
    }
    
    /**
     * @dev Record gas price snapshot for analysis
     */
    function _recordGasPriceSnapshot(uint256 gasPrice) internal {
        gasPriceHistory.push(GasPriceSnapshot({
            gasPrice: gasPrice,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));
        
        // Maintain history size limit
        if (gasPriceHistory.length > MAX_HISTORY_SIZE) {
            // Remove oldest entry
            for (uint256 i = 0; i < gasPriceHistory.length - 1; i++) {
                gasPriceHistory[i] = gasPriceHistory[i + 1];
            }
            gasPriceHistory.pop();
        }
        
        emit GasPriceSnapshotAdded(gasPrice, block.timestamp);
    }
    
    /**
     * @dev Get optimal gas price based on historical data
     */
    function getOptimalGasPrice() external view returns (uint256) {
        if (gasPriceHistory.length == 0) {
            return 20 gwei; // Default gas price
        }
        
        // Calculate average gas price from recent history
        uint256 sum = 0;
        uint256 count = Math.min(gasPriceHistory.length, 100); // Last 100 snapshots
        
        for (uint256 i = gasPriceHistory.length - count; i < gasPriceHistory.length; i++) {
            sum += gasPriceHistory[i].gasPrice;
        }
        
        return sum / count;
    }
    
    /**
     * @dev Get gas price trend (increasing, decreasing, or stable)
     */
    function getGasPriceTrend() external view returns (string memory) {
        if (gasPriceHistory.length < 2) {
            return "insufficient_data";
        }
        
        uint256 recent = gasPriceHistory[gasPriceHistory.length - 1].gasPrice;
        uint256 previous = gasPriceHistory[gasPriceHistory.length - 2].gasPrice;
        
        if (recent > previous * 110 / 100) { // 10% increase
            return "increasing";
        } else if (recent < previous * 90 / 100) { // 10% decrease
            return "decreasing";
        } else {
            return "stable";
        }
    }
    
    /**
     * @dev Check if current gas price is optimal for execution
     */
    function isOptimalGasPrice(uint256 maxGasPrice, uint256 targetGasPrice) external view returns (bool) {
        uint256 currentGasPrice = tx.gasprice;
        return currentGasPrice <= maxGasPrice && currentGasPrice <= targetGasPrice;
    }
    
    /**
     * @dev Get user's optimization statistics
     */
    function getUserOptimizationStats(address user) external view returns (
        uint256 count,
        uint256 totalSaved,
        bool hasActiveSession
    ) {
        return (
            optimizationCount[user],
            totalGasSaved[user],
            optimizationSessions[user].active
        );
    }
    
    /**
     * @dev Get active optimization session details
     */
    function getOptimizationSession(address user) external view returns (OptimizationSession memory) {
        return optimizationSessions[user];
    }
    
    /**
     * @dev Get recent gas price history
     */
    function getRecentGasPriceHistory(uint256 count) external view returns (GasPriceSnapshot[] memory) {
        uint256 length = Math.min(count, gasPriceHistory.length);
        GasPriceSnapshot[] memory recent = new GasPriceSnapshot[](length);
        
        uint256 startIndex = gasPriceHistory.length - length;
        for (uint256 i = 0; i < length; i++) {
            recent[i] = gasPriceHistory[startIndex + i];
        }
        
        return recent;
    }
    
    /**
     * @dev Update gas optimization parameters for a user
     */
    function updateOptimizationParams(
        address user,
        GasOptimizationParams memory params
    ) external onlyOwner onlyActiveSession(user) {
        require(params.maxGasPrice > 0, "Invalid max gas price");
        require(params.targetGasPrice > 0, "Invalid target gas price");
        require(params.maxWaitTime > 0, "Invalid max wait time");
        
        optimizationSessions[user].params = params;
    }
    
    /**
     * @dev Emergency function to force execute optimization
     */
    function forceExecuteOptimization(address user) external onlyOwner onlyActiveSession(user) {
        OptimizationSession storage session = optimizationSessions[user];
        
        // Execute subscription renewal regardless of gas price
        SubscriptionSmartWallet(session.wallet).renewSubscription();
        
        // Update statistics
        optimizationCount[user]++;
        
        // Deactivate session
        session.active = false;
        
        emit OptimizationExecuted(user, tx.gasprice, 0, block.timestamp);
    }
    
    /**
     * @dev Get total number of gas price snapshots
     */
    function getGasPriceHistoryLength() external view returns (uint256) {
        return gasPriceHistory.length;
    }
    
    /**
     * @dev Calculate potential gas savings for a given gas price
     */
    function calculateGasSavings(uint256 maxGasPrice, uint256 currentGasPrice) external pure returns (uint256) {
        if (currentGasPrice >= maxGasPrice) {
            return 0;
        }
        return maxGasPrice - currentGasPrice;
    }
}
