const { ethers } = require("ethers");
const crypto = require("crypto");

/**
 * Intent Verification Service
 * Handles off-chain intent signing and verification for user commitment
 */
class IntentVerifier {
  constructor(config) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.intentManagerAddress = config.intentManagerAddress;
    this.privateKey = config.privateKey;
    this.wallet = new ethers.Wallet(this.privateKey, this.provider);
    
    this.intentManager = new ethers.Contract(
      this.intentManagerAddress,
      this.getIntentManagerABI(),
      this.wallet
    );
    
    this.pendingIntents = new Map();
    this.verifiedIntents = new Map();
  }
  
  /**
   * Create a new intent for subscription commitment
   * @param {Object} intentData - Intent data
   * @returns {Object} Intent creation result
   */
  async createIntent(intentData) {
    try {
      const {
        user,
        wallet,
        planId,
        amount,
        interval
      } = intentData;
      
      // Generate intent hash
      const intentHash = this.generateIntentHash(intentData);
      
      // Create intent on-chain
      const tx = await this.intentManager.createIntent(
        user,
        wallet,
        planId,
        amount,
        interval,
        intentHash
      );
      
      await tx.wait();
      
      // Store pending intent
      this.pendingIntents.set(intentHash, {
        ...intentData,
        intentHash,
        status: "pending",
        createdAt: Date.now()
      });
      
      console.log(`✅ Intent created for user ${user}: ${intentHash}`);
      
      return {
        success: true,
        intentHash,
        status: "pending",
        message: "Intent created successfully"
      };
      
    } catch (error) {
      console.error("❌ Error creating intent:", error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Verify an intent with user signature
   * @param {string} user - User address
   * @param {string} signature - User's signature
   * @returns {Object} Verification result
   */
  async verifyIntent(user, signature) {
    try {
      // Verify intent on-chain
      const tx = await this.intentManager.verifyIntent(user, signature);
      await tx.wait();
      
      // Get intent details
      const intent = await this.intentManager.getIntent(user);
      
      // Update local state
      this.pendingIntents.delete(intent.intentHash);
      this.verifiedIntents.set(intent.intentHash, {
        ...intent,
        status: "verified",
        verifiedAt: Date.now()
      });
      
      console.log(`✅ Intent verified for user ${user}: ${intent.intentHash}`);
      
      return {
        success: true,
        intentHash: intent.intentHash,
        status: "verified",
        message: "Intent verified successfully"
      };
      
    } catch (error) {
      console.error("❌ Error verifying intent:", error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Revoke an intent
   * @param {string} user - User address
   * @param {string} reason - Reason for revocation
   * @returns {Object} Revocation result
   */
  async revokeIntent(user, reason = "User requested") {
    try {
      const tx = await this.intentManager.revokeIntent(user, reason);
      await tx.wait();
      
      // Update local state
      const intent = await this.intentManager.getIntent(user);
      this.pendingIntents.delete(intent.intentHash);
      this.verifiedIntents.delete(intent.intentHash);
      
      console.log(`✅ Intent revoked for user ${user}: ${reason}`);
      
      return {
        success: true,
        message: "Intent revoked successfully"
      };
      
    } catch (error) {
      console.error("❌ Error revoking intent:", error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Check if user has valid intent
   * @param {string} user - User address
   * @returns {Object} Intent status
   */
  async checkIntentStatus(user) {
    try {
      const isValid = await this.intentManager.isIntentValid(user);
      const status = await this.intentManager.getIntentStatus(user);
      const intent = await this.intentManager.getIntent(user);
      
      return {
        isValid,
        status: this.mapIntentStatus(status),
        intent: intent,
        message: `Intent status: ${this.mapIntentStatus(status)}`
      };
      
    } catch (error) {
      console.error("❌ Error checking intent status:", error.message);
      return {
        isValid: false,
        status: "error",
        error: error.message
      };
    }
  }
  
  /**
   * Generate intent hash for off-chain commitment
   * @param {Object} intentData - Intent data
   * @returns {string} Intent hash
   */
  generateIntentHash(intentData) {
    const {
      user,
      wallet,
      planId,
      amount,
      interval,
      timestamp = Date.now()
    } = intentData;
    
    const data = {
      user,
      wallet,
      planId,
      amount: amount.toString(),
      interval: interval.toString(),
      timestamp: timestamp.toString(),
      nonce: crypto.randomBytes(32).toString('hex')
    };
    
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return ethers.keccak256(ethers.toUtf8Bytes(dataString));
  }
  
  /**
   * Create message for user to sign
   * @param {Object} intentData - Intent data
   * @returns {string} Message to sign
   */
  createSigningMessage(intentData) {
    const {
      user,
      wallet,
      planId,
      amount,
      interval,
      startTime,
      endTime
    } = intentData;
    
    const messageHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [
        intentData.intentHash || this.generateIntentHash(intentData),
        user,
        wallet,
        planId,
        amount,
        interval,
        startTime || Math.floor(Date.now() / 1000),
        endTime || Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
      ]
    ));
    
    return messageHash;
  }
  
  /**
   * Verify signature off-chain
   * @param {string} user - User address
   * @param {string} signature - Signature to verify
   * @returns {boolean} Verification result
   */
  async verifySignatureOffChain(user, signature) {
    try {
      const isValid = await this.intentManager.verifyIntentSignature(user, signature);
      return isValid;
    } catch (error) {
      console.error("❌ Error verifying signature:", error.message);
      return false;
    }
  }
  
  /**
   * Clean up expired intents
   * @param {Array} users - Array of user addresses to clean up
   * @returns {Object} Cleanup result
   */
  async cleanupExpiredIntents(users = []) {
    try {
      if (users.length === 0) {
        // Get all users with pending intents
        users = Array.from(this.pendingIntents.keys()).map(hash => 
          this.pendingIntents.get(hash).user
        );
      }
      
      const tx = await this.intentManager.cleanupExpiredIntents(users);
      await tx.wait();
      
      // Update local state
      for (const user of users) {
        const intent = await this.intentManager.getIntent(user);
        if (intent.intentHash !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          this.pendingIntents.delete(intent.intentHash);
          this.verifiedIntents.delete(intent.intentHash);
        }
      }
      
      console.log(`✅ Cleaned up expired intents for ${users.length} users`);
      
      return {
        success: true,
        cleanedUsers: users.length,
        message: "Expired intents cleaned up successfully"
      };
      
    } catch (error) {
      console.error("❌ Error cleaning up expired intents:", error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get intent statistics
   * @returns {Object} Statistics
   */
  getIntentStats() {
    const pending = this.pendingIntents.size;
    const verified = this.verifiedIntents.size;
    
    return {
      pending,
      verified,
      total: pending + verified,
      pendingIntents: Array.from(this.pendingIntents.values()),
      verifiedIntents: Array.from(this.verifiedIntents.values())
    };
  }
  
  /**
   * Map intent status enum to string
   * @param {number} status - Status enum value
   * @returns {string} Status string
   */
  mapIntentStatus(status) {
    const statusMap = {
      0: "pending",
      1: "verified", 
      2: "revoked",
      3: "expired"
    };
    
    return statusMap[status] || "unknown";
  }
  
  /**
   * Get intent manager ABI
   * @returns {Array} ABI
   */
  getIntentManagerABI() {
    return [
      "function createIntent(address user, address wallet, uint256 planId, uint256 amount, uint256 interval, bytes32 intentHash) external",
      "function verifyIntent(address user, bytes signature) external",
      "function revokeIntent(address user, string reason) external",
      "function isIntentValid(address user) external view returns (bool)",
      "function getIntentStatus(address user) external view returns (uint8)",
      "function getIntent(address user) external view returns (tuple(address user, address wallet, uint256 planId, uint256 amount, uint256 interval, uint256 startTime, uint256 endTime, bytes32 intentHash, bool verified, bool revoked, uint256 createdAt))",
      "function verifyIntentSignature(address user, bytes signature) external view returns (bool)",
      "function cleanupExpiredIntents(address[] users) external",
      "function getTimeUntilExpiry(address user) external view returns (uint256)"
    ];
  }
}

module.exports = IntentVerifier;

// Example usage
if (require.main === module) {
  const config = {
    rpcUrl: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
    intentManagerAddress: process.env.INTENT_MANAGER_ADDRESS,
    privateKey: process.env.PRIVATE_KEY
  };
  
  const verifier = new IntentVerifier(config);
  
  // Example: Create intent
  const intentData = {
    user: "0x1234567890123456789012345678901234567890",
    wallet: "0x0987654321098765432109876543210987654321",
    planId: 0,
    amount: ethers.parseUnits("10", 6),
    interval: 30 * 24 * 60 * 60
  };
  
  console.log("Intent Verifier Service Ready");
  console.log("Use verifier.createIntent(), verifier.verifyIntent(), etc.");
}
