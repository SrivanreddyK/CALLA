// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./SubscriptionSmartWallet.sol";
import "./SubscriptionManager.sol";
import "./GasOptimizer.sol";

/**
 * @title SubscriptionSolver
 * @dev Solver contract that executes subscription transactions at optimal gas times
 * This contract acts as the "solver" in the ERC4337 context, executing transactions
 * when gas fees are lowest while maintaining subscription continuity
 */
contract SubscriptionSolver is Ownable, ReentrancyGuard {
    using Math for uint256;
    
    // Solver configuration
    struct SolverConfig {
        uint256 maxGasPrice;           // Maximum gas price willing to pay
        uint256 optimalGasPrice;       // Optimal gas price target
        uint256 executionBuffer;       // Time buffer before subscription expiry
        bool autoExecution;            // Enable automatic execution
        uint256 maxExecutionDelay;    // Maximum delay allowed for execution
    }
    
    // Pending transaction to be executed
    struct PendingTransaction {
        address user;
        address wallet;
        uint256 planId;
        uint256 targetExecutionTime;
        uint256 maxGasPrice;
        bool executed;
        uint256 executionTime;
        uint256 actualGasPrice;
    }
    
    // Solver statistics
    struct SolverStats {
        uint256 totalExecutions;
        uint256 totalGasSaved;
        uint256 averageGasPrice;
        uint256 successRate;
        uint256 lastExecutionTime;
    }
    
    // Contract references
    SubscriptionManager public subscriptionManager;
    GasOptimizer public gasOptimizer;
    
    // Solver configuration
    SolverConfig public config;
    
    // Pending transactions queue
    PendingTransaction[] public pendingTransactions;
    
    // Solver statistics
    SolverStats public stats;
    
    // User execution history
    mapping(address => uint256[]) public userExecutionHistory;
    
    // Events
    event TransactionQueued(
        address indexed user,
        address indexed wallet,
        uint256 indexed planId,
        uint256 targetExecutionTime
    );
    
    event TransactionExecuted(
        address indexed user,
        uint256 gasPrice,
        uint256 gasSaved,
        uint256 executionTime
    );
    
    event TransactionFailed(
        address indexed user,
        string reason,
        uint256 gasPrice
    );
    
    event ConfigUpdated(SolverConfig newConfig);
    
    // Modifiers
    modifier onlyValidWallet(address wallet) {
        require(wallet != address(0), "Invalid wallet address");
        _;
    }
    
    constructor(
        address _subscriptionManager,
        address _gasOptimizer
    ) Ownable(msg.sender) {
        subscriptionManager = SubscriptionManager(_subscriptionManager);
        gasOptimizer = GasOptimizer(_gasOptimizer);
        
        // Initialize default configuration
        config = SolverConfig({
            maxGasPrice: 50 gwei,
            optimalGasPrice: 20 gwei,
            executionBuffer: 3600, // 1 hour
            autoExecution: true,
            maxExecutionDelay: 7200 // 2 hours
        });
    }
    
    /**
     * @dev Queue a subscription renewal transaction for optimal execution
     * @param user User address
     * @param wallet User's smart wallet address
     * @param planId Subscription plan ID
     */
    function queueTransaction(
        address user,
        address wallet,
        uint256 planId
    ) external onlyOwner onlyValidWallet(wallet) nonReentrant {
        // Verify user has active subscription
        require(subscriptionManager.hasApiAccess(user), "User not subscribed");
        
        // Get subscription details
        (bool isDue, uint256 timeUntilBilling) = _getSubscriptionStatus(wallet);
        require(isDue || timeUntilBilling <= config.executionBuffer, "Subscription not due");
        
        // Calculate target execution time
        uint256 targetExecutionTime = block.timestamp + timeUntilBilling - config.executionBuffer;
        
        // Add to pending transactions
        pendingTransactions.push(PendingTransaction({
            user: user,
            wallet: wallet,
            planId: planId,
            targetExecutionTime: targetExecutionTime,
            maxGasPrice: config.maxGasPrice,
            executed: false,
            executionTime: 0,
            actualGasPrice: 0
        }));
        
        emit TransactionQueued(user, wallet, planId, targetExecutionTime);
    }
    
    /**
     * @dev Execute pending transactions when gas conditions are optimal
     * This function should be called by a keeper or monitoring service
     */
    function executePendingTransactions() external nonReentrant {
        uint256 currentGasPrice = tx.gasprice;
        
        // Check if gas price is optimal
        if (currentGasPrice > config.optimalGasPrice) {
            return; // Wait for better gas conditions
        }
        
        // Execute all eligible transactions
        for (uint256 i = 0; i < pendingTransactions.length; i++) {
            PendingTransaction storage txData = pendingTransactions[i];
            
            if (!txData.executed && 
                block.timestamp >= txData.targetExecutionTime &&
                currentGasPrice <= txData.maxGasPrice) {
                
                _executeTransaction(i, currentGasPrice);
            }
        }
        
        // Clean up executed transactions
        _cleanupExecutedTransactions();
    }
    
    /**
     * @dev Execute a specific transaction
     */
    function _executeTransaction(uint256 index, uint256 gasPrice) internal {
        PendingTransaction storage txData = pendingTransactions[index];
        
        try SubscriptionSmartWallet(txData.wallet).renewSubscription() {
            // Transaction successful
            txData.executed = true;
            txData.executionTime = block.timestamp;
            txData.actualGasPrice = gasPrice;
            
            // Update statistics
            stats.totalExecutions++;
            stats.totalGasSaved += txData.maxGasPrice - gasPrice;
            stats.lastExecutionTime = block.timestamp;
            
            // Record user execution
            userExecutionHistory[txData.user].push(block.timestamp);
            
            emit TransactionExecuted(
                txData.user,
                gasPrice,
                txData.maxGasPrice - gasPrice,
                block.timestamp
            );
            
        } catch Error(string memory reason) {
            emit TransactionFailed(txData.user, reason, gasPrice);
        } catch {
            emit TransactionFailed(txData.user, "Unknown error", gasPrice);
        }
    }
    
    /**
     * @dev Clean up executed transactions from the queue
     */
    function _cleanupExecutedTransactions() internal {
        uint256 writeIndex = 0;
        
        for (uint256 i = 0; i < pendingTransactions.length; i++) {
            if (!pendingTransactions[i].executed) {
                if (writeIndex != i) {
                    pendingTransactions[writeIndex] = pendingTransactions[i];
                }
                writeIndex++;
            }
        }
        
        // Resize array
        for (uint256 i = writeIndex; i < pendingTransactions.length; i++) {
            pendingTransactions.pop();
        }
    }
    
    /**
     * @dev Get subscription status for a wallet
     */
    function _getSubscriptionStatus(address wallet) internal view returns (bool isDue, uint256 timeUntilBilling) {
        isDue = SubscriptionSmartWallet(wallet).isSubscriptionDue();
        timeUntilBilling = SubscriptionSmartWallet(wallet).getTimeUntilNextBilling();
    }
    
    /**
     * @dev Force execute a specific transaction (emergency function)
     */
    function forceExecuteTransaction(uint256 index) external onlyOwner {
        require(index < pendingTransactions.length, "Invalid transaction index");
        require(!pendingTransactions[index].executed, "Transaction already executed");
        
        PendingTransaction storage txData = pendingTransactions[index];
        
        try SubscriptionSmartWallet(txData.wallet).renewSubscription() {
            txData.executed = true;
            txData.executionTime = block.timestamp;
            txData.actualGasPrice = tx.gasprice;
            
            stats.totalExecutions++;
            stats.lastExecutionTime = block.timestamp;
            
            emit TransactionExecuted(
                txData.user,
                tx.gasprice,
                0, // No gas savings in forced execution
                block.timestamp
            );
            
        } catch Error(string memory reason) {
            emit TransactionFailed(txData.user, reason, tx.gasprice);
        } catch {
            emit TransactionFailed(txData.user, "Unknown error", tx.gasprice);
        }
    }
    
    /**
     * @dev Update solver configuration
     */
    function updateConfig(SolverConfig memory newConfig) external onlyOwner {
        require(newConfig.maxGasPrice > 0, "Invalid max gas price");
        require(newConfig.optimalGasPrice > 0, "Invalid optimal gas price");
        require(newConfig.executionBuffer > 0, "Invalid execution buffer");
        
        config = newConfig;
        emit ConfigUpdated(newConfig);
    }
    
    /**
     * @dev Get pending transactions count
     */
    function getPendingTransactionsCount() external view returns (uint256) {
        return pendingTransactions.length;
    }
    
    /**
     * @dev Get pending transaction details
     */
    function getPendingTransaction(uint256 index) external view returns (PendingTransaction memory) {
        require(index < pendingTransactions.length, "Invalid index");
        return pendingTransactions[index];
    }
    
    /**
     * @dev Get all pending transactions for a user
     */
    function getUserPendingTransactions(address user) external view returns (uint256[] memory) {
        uint256 count = 0;
        
        // Count user's pending transactions
        for (uint256 i = 0; i < pendingTransactions.length; i++) {
            if (pendingTransactions[i].user == user && !pendingTransactions[i].executed) {
                count++;
            }
        }
        
        // Create array with indices
        uint256[] memory indices = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < pendingTransactions.length; i++) {
            if (pendingTransactions[i].user == user && !pendingTransactions[i].executed) {
                indices[index] = i;
                index++;
            }
        }
        
        return indices;
    }
    
    /**
     * @dev Get solver statistics
     */
    function getSolverStats() external view returns (SolverStats memory) {
        return stats;
    }
    
    /**
     * @dev Get user execution history
     */
    function getUserExecutionHistory(address user) external view returns (uint256[] memory) {
        return userExecutionHistory[user];
    }
    
    /**
     * @dev Calculate average gas price from recent executions
     */
    function calculateAverageGasPrice() external view returns (uint256) {
        if (stats.totalExecutions == 0) {
            return 0;
        }
        
        uint256 totalGasPrice = 0;
        uint256 count = 0;
        
        for (uint256 i = 0; i < pendingTransactions.length; i++) {
            if (pendingTransactions[i].executed) {
                totalGasPrice += pendingTransactions[i].actualGasPrice;
                count++;
            }
        }
        
        return count > 0 ? totalGasPrice / count : 0;
    }
    
    /**
     * @dev Check if gas conditions are optimal for execution
     */
    function isOptimalGasConditions() external view returns (bool) {
        return tx.gasprice <= config.optimalGasPrice;
    }
    
    /**
     * @dev Get next execution time for a user
     */
    function getNextExecutionTime(address user) external view returns (uint256) {
        for (uint256 i = 0; i < pendingTransactions.length; i++) {
            if (pendingTransactions[i].user == user && !pendingTransactions[i].executed) {
                return pendingTransactions[i].targetExecutionTime;
            }
        }
        return 0;
    }
    
    /**
     * @dev Emergency function to cancel all pending transactions
     */
    function cancelAllPendingTransactions() external onlyOwner {
        for (uint256 i = 0; i < pendingTransactions.length; i++) {
            if (!pendingTransactions[i].executed) {
                pendingTransactions[i].executed = true; // Mark as cancelled
            }
        }
    }
    
    /**
     * @dev Get current gas price
     */
    function getCurrentGasPrice() external view returns (uint256) {
        return tx.gasprice;
    }
}
