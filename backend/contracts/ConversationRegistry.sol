// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ConversationRegistry
/// @notice Stores immutable keccak256 hashes of user‐agent conversations.
///         No raw data or PII is ever stored on‐chain—only the 32‐byte hash.
contract ConversationRegistry {
    // An array of all conversation hashes ever recorded.
    bytes32[] public conversationHashes;

    // Event emitted whenever a new conversation hash is recorded.
    event ConversationRecorded(
        uint256 indexed index,
        bytes32 indexed convoHash,
        address indexed recorder,
        uint256 timestamp
    );

    /// @notice Record a new conversation hash. Appends to `conversationHashes`.
    /// @param convoHash keccak256 hash of (userMessage || "||" || agentReply)
    function recordConversation(bytes32 convoHash) external {
        conversationHashes.push(convoHash);
        uint256 idx = conversationHashes.length - 1;
        emit ConversationRecorded(idx, convoHash, msg.sender, block.timestamp);
    }

    /// @notice Get the conversation hash stored at `index`.
    /// @param index The index in the array (0‐based).
    /// @return The stored bytes32 hash.
    function getConversationHash(uint256 index) external view returns (bytes32) {
        require(index < conversationHashes.length, "Index out of range");
        return conversationHashes[index];
    }

    /// @notice Returns the total number of conversations recorded.
    function totalConversations() external view returns (uint256) {
        return conversationHashes.length;
    }
}
