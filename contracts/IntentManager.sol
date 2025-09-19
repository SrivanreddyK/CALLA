// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title IntentManager
 * @dev Manages off-chain intent signing for user commitment to subscription payments
 * This ensures users cannot empty their wallets before subscription renewals
 */
contract IntentManager is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    // Intent structure
    struct Intent {
        address user;            // User's EOA address
        address wallet;         // User's smart wallet address
        uint256 planId;         // Subscription plan ID
        uint256 amount;         // Subscription amount
        uint256 interval;       // Billing interval
        uint256 startTime;      // Subscription start time
        uint256 endTime;        // Subscription end time
        bytes32 intentHash;     // Hash of the intent
        bool verified;          // Intent verification status
        bool revoked;           // Intent revocation status
        uint256 createdAt;      // Intent creation timestamp
    }
    
    // Intent verification status
    enum IntentStatus {
        PENDING,    // Intent created but not verified
        VERIFIED,   // Intent verified and active
        REVOKED,    // Intent revoked by user
        EXPIRED     // Intent expired
    }
    
    // User intents mapping
    mapping(address => Intent) public userIntents;
    
    // Intent hash to user mapping for quick lookup
    mapping(bytes32 => address) public intentToUser;
    
    // Intent verification threshold (number of required signatures)
    uint256 public verificationThreshold = 1;
    
    // Intent validity period (in seconds)
    uint256 public intentValidityPeriod = 7 days;
    
    // Events
    event IntentCreated(
        address indexed user,
        address indexed wallet,
        uint256 indexed planId,
        bytes32 intentHash,
        uint256 amount,
        uint256 interval
    );
    
    event IntentVerified(
        address indexed user,
        bytes32 indexed intentHash,
        address verifier
    );
    
    event IntentRevoked(
        address indexed user,
        bytes32 indexed intentHash,
        string reason
    );
    
    event IntentExpired(
        address indexed user,
        bytes32 indexed intentHash
    );
    
    event VerificationThresholdUpdated(uint256 newThreshold);
    event ValidityPeriodUpdated(uint256 newPeriod);
    
    // Modifiers
    modifier onlyValidUser(address user) {
        require(user != address(0), "Invalid user address");
        _;
    }
    
    modifier onlyVerifiedIntent(address user) {
        require(userIntents[user].verified, "Intent not verified");
        require(!userIntents[user].revoked, "Intent revoked");
        require(block.timestamp <= userIntents[user].endTime, "Intent expired");
        _;
    }
    
    constructor() Ownable(msg.sender) {
        // Initialize with default values
    }
    
    /**
     * @dev Create a new intent for subscription commitment
     * @param user User's EOA address
     * @param wallet User's smart wallet address
     * @param planId Subscription plan ID
     * @param amount Subscription amount
     * @param interval Billing interval in seconds
     * @param intentHash Hash of the off-chain intent
     */
    function createIntent(
        address user,
        address wallet,
        uint256 planId,
        uint256 amount,
        uint256 interval,
        bytes32 intentHash
    ) external onlyOwner onlyValidUser(user) nonReentrant {
        require(userIntents[user].intentHash == bytes32(0), "Intent already exists");
        require(intentToUser[intentHash] == address(0), "Intent hash already used");
        require(amount > 0, "Invalid amount");
        require(interval > 0, "Invalid interval");
        
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + intentValidityPeriod;
        
        userIntents[user] = Intent({
            user: user,
            wallet: wallet,
            planId: planId,
            amount: amount,
            interval: interval,
            startTime: startTime,
            endTime: endTime,
            intentHash: intentHash,
            verified: false,
            revoked: false,
            createdAt: block.timestamp
        });
        
        intentToUser[intentHash] = user;
        
        emit IntentCreated(user, wallet, planId, intentHash, amount, interval);
    }
    
    /**
     * @dev Verify an intent with signature
     * @param user User address
     * @param signature User's signature of the intent
     */
    function verifyIntent(
        address user,
        bytes memory signature
    ) external onlyValidUser(user) nonReentrant {
        Intent storage intent = userIntents[user];
        require(intent.intentHash != bytes32(0), "Intent does not exist");
        require(!intent.verified, "Intent already verified");
        require(!intent.revoked, "Intent revoked");
        require(block.timestamp <= intent.endTime, "Intent expired");
        
        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            intent.intentHash,
            intent.user,
            intent.wallet,
            intent.planId,
            intent.amount,
            intent.interval,
            intent.startTime,
            intent.endTime
        ));
        
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address signer = ethSignedMessageHash.recover(signature);
        
        require(signer == user, "Invalid signature");
        
        intent.verified = true;
        
        emit IntentVerified(user, intent.intentHash, msg.sender);
    }
    
    /**
     * @dev Revoke an intent
     * @param user User address
     * @param reason Reason for revocation
     */
    function revokeIntent(
        address user,
        string memory reason
    ) external onlyValidUser(user) nonReentrant {
        Intent storage intent = userIntents[user];
        require(intent.intentHash != bytes32(0), "Intent does not exist");
        require(!intent.revoked, "Intent already revoked");
        require(msg.sender == user || msg.sender == owner(), "Unauthorized");
        
        intent.revoked = true;
        
        emit IntentRevoked(user, intent.intentHash, reason);
    }
    
    /**
     * @dev Check if an intent is valid and verified
     * @param user User address
     * @return isValid True if intent is valid and verified
     */
    function isIntentValid(address user) external view returns (bool isValid) {
        Intent memory intent = userIntents[user];
        
        if (intent.intentHash == bytes32(0)) {
            return false; // No intent exists
        }
        
        if (intent.revoked) {
            return false; // Intent revoked
        }
        
        if (block.timestamp > intent.endTime) {
            return false; // Intent expired
        }
        
        return intent.verified;
    }
    
    /**
     * @dev Get intent status for a user
     * @param user User address
     * @return status Intent status
     */
    function getIntentStatus(address user) external view returns (IntentStatus status) {
        Intent memory intent = userIntents[user];
        
        if (intent.intentHash == bytes32(0)) {
            return IntentStatus.PENDING; // No intent exists
        }
        
        if (intent.revoked) {
            return IntentStatus.REVOKED;
        }
        
        if (block.timestamp > intent.endTime) {
            return IntentStatus.EXPIRED;
        }
        
        if (intent.verified) {
            return IntentStatus.VERIFIED;
        }
        
        return IntentStatus.PENDING;
    }
    
    /**
     * @dev Get intent details for a user
     * @param user User address
     * @return intent Intent details
     */
    function getIntent(address user) external view returns (Intent memory intent) {
        return userIntents[user];
    }
    
    /**
     * @dev Get user address from intent hash
     * @param intentHash Intent hash
     * @return user User address
     */
    function getUserFromIntentHash(bytes32 intentHash) external view returns (address user) {
        return intentToUser[intentHash];
    }
    
    /**
     * @dev Update verification threshold
     * @param newThreshold New verification threshold
     */
    function updateVerificationThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold > 0, "Invalid threshold");
        verificationThreshold = newThreshold;
        emit VerificationThresholdUpdated(newThreshold);
    }
    
    /**
     * @dev Update intent validity period
     * @param newPeriod New validity period in seconds
     */
    function updateValidityPeriod(uint256 newPeriod) external onlyOwner {
        require(newPeriod > 0, "Invalid period");
        intentValidityPeriod = newPeriod;
        emit ValidityPeriodUpdated(newPeriod);
    }
    
    /**
     * @dev Clean up expired intents
     * @param users Array of user addresses to clean up
     */
    function cleanupExpiredIntents(address[] calldata users) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            Intent storage intent = userIntents[user];
            
            if (intent.intentHash != bytes32(0) && 
                block.timestamp > intent.endTime && 
                !intent.revoked) {
                
                intent.revoked = true;
                emit IntentExpired(user, intent.intentHash);
            }
        }
    }
    
    /**
     * @dev Verify intent signature off-chain
     * @param user User address
     * @param signature Signature to verify
     * @return isValid True if signature is valid
     */
    function verifyIntentSignature(
        address user,
        bytes memory signature
    ) external view returns (bool isValid) {
        Intent memory intent = userIntents[user];
        
        if (intent.intentHash == bytes32(0)) {
            return false;
        }
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            intent.intentHash,
            intent.user,
            intent.wallet,
            intent.planId,
            intent.amount,
            intent.interval,
            intent.startTime,
            intent.endTime
        ));
        
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address signer = ethSignedMessageHash.recover(signature);
        
        return signer == user;
    }
    
    /**
     * @dev Get intent hash for a user
     * @param user User address
     * @return intentHash Intent hash
     */
    function getIntentHash(address user) external view returns (bytes32 intentHash) {
        return userIntents[user].intentHash;
    }
    
    /**
     * @dev Check if user has a valid intent
     * @param user User address
     * @return hasValidIntent True if user has valid intent
     */
    function hasValidIntent(address user) external view returns (bool) {
        Intent memory intent = userIntents[user];
        
        return intent.intentHash != bytes32(0) &&
               intent.verified &&
               !intent.revoked &&
               block.timestamp <= intent.endTime;
    }
    
    /**
     * @dev Get time until intent expires
     * @param user User address
     * @return timeUntilExpiry Time in seconds until expiry
     */
    function getTimeUntilExpiry(address user) external view returns (uint256 timeUntilExpiry) {
        Intent memory intent = userIntents[user];
        
        if (intent.intentHash == bytes32(0) || block.timestamp >= intent.endTime) {
            return 0;
        }
        
        return intent.endTime - block.timestamp;
    }
}
