// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

/**
 * @title EntryPoint
 * @dev Simplified EntryPoint implementation for ERC4337 Account Abstraction
 * This is a basic implementation for testing purposes
 */
contract EntryPoint is IEntryPoint {
    // User operation nonces
    mapping(address => mapping(uint192 => uint256)) public nonces;
    
    // Events
    event UserOperationEvent(
        bytes32 indexed userOpHash,
        address indexed sender,
        address indexed paymaster,
        uint256 nonce,
        bool success,
        uint256 actualGasCost,
        uint256 actualGasUsed
    );
    
    /**
     * @dev Execute a user operation
     */
    function handleOps(
        UserOperation[] calldata ops,
        address payable beneficiary
    ) external override {
        for (uint256 i = 0; i < ops.length; i++) {
            _handleOp(ops[i], beneficiary);
        }
    }
    
    /**
     * @dev Handle a single user operation
     */
    function _handleOp(UserOperation calldata op, address payable beneficiary) internal {
        // Validate nonce
        require(nonces[op.sender][op.nonce] == 0, "Nonce already used");
        nonces[op.sender][op.nonce] = 1;
        
        // Execute the operation
        (bool success, ) = op.sender.call(op.callData);
        
        emit UserOperationEvent(
            getUserOpHash(op),
            op.sender,
            op.paymaster,
            op.nonce,
            success,
            op.maxFeePerGas * op.callGasLimit,
            op.callGasLimit
        );
    }
    
    /**
     * @dev Get user operation hash
     */
    function getUserOpHash(UserOperation calldata userOp) public pure override returns (bytes32) {
        return keccak256(abi.encode(
            userOp.sender,
            userOp.nonce,
            keccak256(userOp.initCode),
            keccak256(userOp.callData),
            userOp.callGasLimit,
            userOp.verificationGasLimit,
            userOp.preVerificationGas,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            userOp.paymaster,
            userOp.paymasterVerificationGasLimit,
            userOp.paymasterPostOpGasLimit,
            userOp.paymasterData
        ));
    }
    
    /**
     * @dev Get nonce for an account
     */
    function getNonce(address sender, uint192 key) external view override returns (uint256) {
        return nonces[sender][key];
    }
    
    /**
     * @dev Simulate user operation validation
     */
    function simulateValidation(UserOperation calldata userOp) external override {
        // Basic validation - in production this would be more comprehensive
        require(userOp.sender != address(0), "Invalid sender");
        require(userOp.nonce >= nonces[userOp.sender][userOp.nonce], "Invalid nonce");
    }
    
    /**
     * @dev Simulate user operation execution
     */
    function simulateHandleOp(UserOperation calldata op, address target, bytes calldata targetCallData) external override {
        // Simulate the operation without actually executing it
        // This is used for gas estimation
    }
}
