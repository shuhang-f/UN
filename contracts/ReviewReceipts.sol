// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice A reusable registry of wallet-authored commitments. It stores no document contents.
/// @dev A receipt proves a wallet recorded a commitment, not the truth of the underlying evidence.
contract ReviewReceipts {
    mapping(address reviewer => mapping(bytes32 commitment => uint256 timestamp)) public recordedAt;

    event ReviewRecorded(address indexed reviewer, bytes32 indexed commitment, uint256 recordedAt);
    error AlreadyRecorded();
    error EmptyCommitment();

    function record(bytes32 commitment) external {
        if (commitment == bytes32(0)) revert EmptyCommitment();
        if (recordedAt[msg.sender][commitment] != 0) revert AlreadyRecorded();
        recordedAt[msg.sender][commitment] = block.timestamp;
        emit ReviewRecorded(msg.sender, commitment, block.timestamp);
    }
}
