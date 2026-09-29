// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentMeshEscrow
 * @dev Autonomous task escrow and settlement smart contract on MST Blockchain.
 * Holds native MSTC deposits from users until specialized AI agents execute their tasks,
 * settling payouts to agents upon validated completion or refunding users on failure/expiration.
 *
 * GUARANTEES:
 * 1. Native MSTC only (uses msg.value, zero ERC-20 dependency).
 * 2. Checks-effects-interactions and reentrancy protection across all state transitions.
 * 3. Deterministic task tracking via keccak256 task IDs.
 * 4. Dual settlement authorization (Owner & verified Orchestrator Executors).
 * 5. Permissionless expired task refund to protect user funds against system crashes.
 */
contract AgentMeshEscrow {
    enum TaskStatus {
        None,
        Funded,
        Completed,
        Failed,
        Refunded,
        Cancelled
    }

    struct Task {
        bytes32 taskId;
        address payer;
        address agent;
        uint256 amount;
        uint256 createdAt;
        uint256 deadline;
        TaskStatus status;
    }

    address public owner;
    mapping(address => bool) public isExecutor;
    mapping(bytes32 => Task) public tasks;

    // Simple reentrancy lock
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    // Events
    event TaskCreated(
        bytes32 indexed taskId,
        address indexed payer,
        address indexed agent,
        uint256 amount,
        uint256 deadline
    );
    event TaskCompleted(
        bytes32 indexed taskId,
        address indexed agent,
        uint256 amount
    );
    event TaskFailed(
        bytes32 indexed taskId,
        address indexed payer,
        uint256 amount
    );
    event TaskRefunded(
        bytes32 indexed taskId,
        address indexed payer,
        uint256 amount
    );
    event ExecutorUpdated(address indexed executor, bool authorized);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "AgentMeshEscrow: caller is not owner");
        _;
    }

    modifier onlyOwnerOrExecutor() {
        require(
            msg.sender == owner || isExecutor[msg.sender],
            "AgentMeshEscrow: caller is not authorized executor or owner"
        );
        _;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "AgentMeshEscrow: reentrancy guard violation");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor(address initialOwner) {
        require(initialOwner != address(0), "AgentMeshEscrow: initial owner cannot be zero address");
        owner = initialOwner;
        isExecutor[initialOwner] = true;
        _status = _NOT_ENTERED;

        emit OwnershipTransferred(address(0), initialOwner);
        emit ExecutorUpdated(initialOwner, true);
    }

    /**
     * @notice Add or revoke an authorized orchestrator executor.
     */
    function setExecutor(address executor, bool authorized) external onlyOwner {
        require(executor != address(0), "AgentMeshEscrow: executor cannot be zero address");
        isExecutor[executor] = authorized;
        emit ExecutorUpdated(executor, authorized);
    }

    /**
     * @notice Transfer contract ownership.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "AgentMeshEscrow: new owner cannot be zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @notice Create and fund a task escrow with native MSTC.
     * @param taskId Unique bytes32 task identifier (keccak256 of AgentGuild jobId).
     * @param agent Wallet address of the hired agent to receive payout upon success.
     * @param deadline Unix timestamp after which the task can be refunded by the payer.
     */
    function createTask(
        bytes32 taskId,
        address agent,
        uint256 deadline
    ) external payable nonReentrant {
        require(taskId != bytes32(0), "AgentMeshEscrow: invalid task ID");
        require(tasks[taskId].status == TaskStatus.None, "AgentMeshEscrow: task already exists");
        require(agent != address(0), "AgentMeshEscrow: agent cannot be zero address");
        require(msg.value > 0, "AgentMeshEscrow: amount must be greater than zero");
        require(deadline > block.timestamp, "AgentMeshEscrow: deadline must be in the future");

        tasks[taskId] = Task({
            taskId: taskId,
            payer: msg.sender,
            agent: agent,
            amount: msg.value,
            createdAt: block.timestamp,
            deadline: deadline,
            status: TaskStatus.Funded
        });

        emit TaskCreated(taskId, msg.sender, agent, msg.value, deadline);
    }

    /**
     * @notice Complete a task and release escrowed MSTC to the designated agent.
     * @dev Only callable by an authorized orchestrator/executor after validation passes.
     */
    function completeTask(bytes32 taskId) external onlyOwnerOrExecutor nonReentrant {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.Funded, "AgentMeshEscrow: task is not funded");

        // Checks-effects-interactions
        t.status = TaskStatus.Completed;
        uint256 payoutAmount = t.amount;
        address agentRecipient = t.agent;

        emit TaskCompleted(taskId, agentRecipient, payoutAmount);

        (bool success, ) = agentRecipient.call{value: payoutAmount}("");
        require(success, "AgentMeshEscrow: native MSTC payout transfer failed");
    }

    /**
     * @notice Fail a task and refund the escrowed MSTC back to the original payer.
     * @dev Only callable by an authorized orchestrator/executor upon validation failure or cancellation.
     */
    function failTask(bytes32 taskId) external onlyOwnerOrExecutor nonReentrant {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.Funded, "AgentMeshEscrow: task is not funded");

        // Checks-effects-interactions
        t.status = TaskStatus.Refunded;
        uint256 refundAmount = t.amount;
        address payerRecipient = t.payer;

        emit TaskFailed(taskId, payerRecipient, refundAmount);
        emit TaskRefunded(taskId, payerRecipient, refundAmount);

        (bool success, ) = payerRecipient.call{value: refundAmount}("");
        require(success, "AgentMeshEscrow: native MSTC refund transfer failed");
    }

    /**
     * @notice Permissionless refund for expired tasks whose deadline has passed.
     * Prevents user funds from remaining locked if an orchestrator crashes or becomes unavailable.
     */
    function refundExpiredTask(bytes32 taskId) external nonReentrant {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.Funded, "AgentMeshEscrow: task is not funded");
        require(block.timestamp >= t.deadline, "AgentMeshEscrow: task deadline has not expired yet");

        // Checks-effects-interactions
        t.status = TaskStatus.Refunded;
        uint256 refundAmount = t.amount;
        address payerRecipient = t.payer;

        emit TaskRefunded(taskId, payerRecipient, refundAmount);

        (bool success, ) = payerRecipient.call{value: refundAmount}("");
        require(success, "AgentMeshEscrow: native MSTC expired refund transfer failed");
    }

    /**
     * @notice Read task state.
     */
    function getTask(bytes32 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }
}
