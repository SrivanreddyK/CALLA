// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "./SubscriptionSmartWallet.sol";

/**
 * @title SubscriptionSmartWalletFactory
 * @dev Factory contract for creating SubscriptionSmartWallet instances
 * Uses CREATE2 for deterministic address generation
 */
contract SubscriptionSmartWalletFactory is Ownable {
    // EntryPoint contract for ERC4337
    address public immutable entryPoint;
    
    // Subscription manager contract
    address public subscriptionManager;
    
    // Gas optimizer contract
    address public gasOptimizer;
    
    // Mapping of user addresses to their smart wallet addresses
    mapping(address => address) public userWallets;
    
    // Mapping of smart wallet addresses to user addresses
    mapping(address => address) public walletUsers;
    
    // Array of all created wallets
    address[] public allWallets;
    
    // Events
    event WalletCreated(
        address indexed user,
        address indexed wallet,
        address indexed entryPoint
    );
    
    event SubscriptionManagerUpdated(address indexed newManager);
    event GasOptimizerUpdated(address indexed newOptimizer);
    
    constructor(
        address _entryPoint,
        address _subscriptionManager,
        address _gasOptimizer
    ) Ownable(msg.sender) {
        require(_entryPoint != address(0), "Invalid entry point");
        require(_subscriptionManager != address(0), "Invalid subscription manager");
        require(_gasOptimizer != address(0), "Invalid gas optimizer");
        
        entryPoint = _entryPoint;
        subscriptionManager = _subscriptionManager;
        gasOptimizer = _gasOptimizer;
    }
    
    /**
     * @dev Create a new smart wallet for a user
     * @param user User's EOA address
     * @param salt Salt for CREATE2 deployment
     * @return wallet Address of the created wallet
     */
    function createWallet(
        address user,
        uint256 salt
    ) external onlyOwner returns (address wallet) {
        require(user != address(0), "Invalid user address");
        require(userWallets[user] == address(0), "Wallet already exists");
        
        // Calculate wallet address using CREATE2
        bytes32 saltBytes = bytes32(salt);
        bytes memory bytecode = abi.encodePacked(
            type(SubscriptionSmartWallet).creationCode,
            abi.encode(
                IEntryPoint(entryPoint),
                user,
                subscriptionManager,
                gasOptimizer
            )
        );
        
        wallet = Create2.deploy(0, saltBytes, bytecode);
        
        // Store wallet mapping
        userWallets[user] = wallet;
        walletUsers[wallet] = user;
        allWallets.push(wallet);
        
        emit WalletCreated(user, wallet, entryPoint);
        
        return wallet;
    }
    
    /**
     * @dev Get the address of a wallet that would be created for a user
     * @param user User's EOA address
     * @param salt Salt for CREATE2 deployment
     * @return wallet Address of the wallet that would be created
     */
    function getWalletAddress(
        address user,
        uint256 salt
    ) external view returns (address wallet) {
        bytes32 saltBytes = bytes32(salt);
        bytes memory bytecode = abi.encodePacked(
            type(SubscriptionSmartWallet).creationCode,
            abi.encode(
                IEntryPoint(entryPoint),
                user,
                subscriptionManager,
                gasOptimizer
            )
        );
        
        wallet = Create2.computeAddress(saltBytes, keccak256(bytecode));
        return wallet;
    }
    
    /**
     * @dev Check if a user has a wallet
     * @param user User's EOA address
     * @return hasWallet True if user has a wallet
     */
    function hasWallet(address user) external view returns (bool) {
        return userWallets[user] != address(0);
    }
    
    /**
     * @dev Get user's wallet address
     * @param user User's EOA address
     * @return wallet User's wallet address
     */
    function getUserWallet(address user) external view returns (address wallet) {
        return userWallets[user];
    }
    
    /**
     * @dev Get user address from wallet address
     * @param wallet Wallet address
     * @return user User's EOA address
     */
    function getWalletUser(address wallet) external view returns (address user) {
        return walletUsers[wallet];
    }
    
    /**
     * @dev Get total number of created wallets
     * @return count Total wallet count
     */
    function getWalletCount() external view returns (uint256 count) {
        return allWallets.length;
    }
    
    /**
     * @dev Get all wallet addresses
     * @return wallets Array of all wallet addresses
     */
    function getAllWallets() external view returns (address[] memory wallets) {
        return allWallets;
    }
    
    /**
     * @dev Update subscription manager address
     * @param newManager New subscription manager address
     */
    function updateSubscriptionManager(address newManager) external onlyOwner {
        require(newManager != address(0), "Invalid manager address");
        subscriptionManager = newManager;
        emit SubscriptionManagerUpdated(newManager);
    }
    
    /**
     * @dev Update gas optimizer address
     * @param newOptimizer New gas optimizer address
     */
    function updateGasOptimizer(address newOptimizer) external onlyOwner {
        require(newOptimizer != address(0), "Invalid optimizer address");
        gasOptimizer = newOptimizer;
        emit GasOptimizerUpdated(newOptimizer);
    }
    
    /**
     * @dev Batch create wallets for multiple users
     * @param users Array of user addresses
     * @param salts Array of salts for each user
     * @return wallets Array of created wallet addresses
     */
    function batchCreateWallets(
        address[] calldata users,
        uint256[] calldata salts
    ) external onlyOwner returns (address[] memory wallets) {
        require(users.length == salts.length, "Array length mismatch");
        require(users.length > 0, "Empty arrays");
        
        wallets = new address[](users.length);
        
        for (uint256 i = 0; i < users.length; i++) {
            require(users[i] != address(0), "Invalid user address");
            require(userWallets[users[i]] == address(0), "Wallet already exists");
            
            // Calculate wallet address using CREATE2
            bytes32 saltBytes = bytes32(salts[i]);
            bytes memory bytecode = abi.encodePacked(
                type(SubscriptionSmartWallet).creationCode,
                abi.encode(
                    IEntryPoint(entryPoint),
                    users[i],
                    subscriptionManager,
                    gasOptimizer
                )
            );
            
            address wallet = Create2.deploy(0, saltBytes, bytecode);
            
            // Store wallet mapping
            userWallets[users[i]] = wallet;
            walletUsers[wallet] = users[i];
            allWallets.push(wallet);
            
            wallets[i] = wallet;
            
            emit WalletCreated(users[i], wallet, entryPoint);
        }
        
        return wallets;
    }
    
    /**
     * @dev Get wallet creation bytecode
     * @param user User's EOA address
     * @return bytecode Wallet creation bytecode
     */
    function getWalletBytecode(address user) external view returns (bytes memory bytecode) {
        return abi.encodePacked(
            type(SubscriptionSmartWallet).creationCode,
            abi.encode(
                IEntryPoint(entryPoint),
                user,
                subscriptionManager,
                gasOptimizer
            )
        );
    }
    
    /**
     * @dev Check if a wallet address is valid for a user
     * @param user User's EOA address
     * @param wallet Wallet address to check
     * @return isValid True if wallet is valid for user
     */
    function isValidWallet(address user, address wallet) external view returns (bool isValid) {
        return userWallets[user] == wallet && walletUsers[wallet] == user;
    }
    
    /**
     * @dev Get wallet statistics
     * @return totalWallets Total number of wallets created
     * @return factoryAddress Factory contract address
     * @return entryPointAddress EntryPoint contract address
     */
    function getFactoryStats() external view returns (
        uint256 totalWallets,
        address factoryAddress,
        address entryPointAddress
    ) {
        return (
            allWallets.length,
            address(this),
            entryPoint
        );
    }
}
