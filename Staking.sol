// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// Custom errors
error NotOwner(address caller);
error EmptyTransaction();
error InvalidAmount();
error StakeEmpty();
error TransactionFailed();
error InsufficientETHRewards();

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Staking {

    uint256 public totalStaked;
    address public immutable owner;
    IERC20 public immutable stakingToken;

    // reward rate: 1 token per second per staked token
    uint256 public constant REWARD_RATE = 1;

    constructor(address _tokenAddress) {
        if(_tokenAddress == address(0)) revert InvalidAmount();
        owner = msg.sender;
        stakingToken = IERC20(_tokenAddress);
    }

    struct StakeDetails {
        uint256 totalStake;
        uint256 timeDeposited;
        uint256 pendingRewards;
    }
    mapping(address => StakeDetails) private stakers;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event ETHDeposited(address indexed owner, uint256 amount);

    modifier onlyOwner() {
        if(msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    modifier hasStake() {
        if(stakers[msg.sender].totalStake == 0) revert StakeEmpty();
        _;
    }

    // owner deposits ETH to fund rewards
    function depositETH() public payable onlyOwner {
        if(msg.value == 0) revert EmptyTransaction();
        emit ETHDeposited(msg.sender, msg.value);
    }

    function stake(uint256 amount) public {
        if(amount == 0) revert InvalidAmount();

        uint256 currentStake = stakers[msg.sender].totalStake;

        // save pending rewards before updating stake
        if(currentStake > 0) {
            stakers[msg.sender].pendingRewards = _calculateRewards(
                stakers[msg.sender].pendingRewards,
                stakers[msg.sender].timeDeposited,
                currentStake
            );
        }

        stakers[msg.sender].timeDeposited = block.timestamp;
        stakers[msg.sender].totalStake += amount;
        totalStaked += amount;

        // interactions last — reentrancy protection
        stakingToken.transferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) public hasStake {
        if(amount == 0) revert InvalidAmount();
        uint256 currentStake = stakers[msg.sender].totalStake;
        if(amount > currentStake) revert InvalidAmount();

        // save pending rewards before updating stake
        stakers[msg.sender].pendingRewards = _calculateRewards(
            stakers[msg.sender].pendingRewards,
            stakers[msg.sender].timeDeposited,
            currentStake
        );

        // reset timer if fully unstaking
        stakers[msg.sender].timeDeposited = currentStake == amount ? 0 : block.timestamp;
        stakers[msg.sender].totalStake -= amount;
        totalStaked -= amount;

        // interactions last — reentrancy protection
        stakingToken.transfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    function claimRewards() public hasStake {
        uint256 rewards = _calculateRewards(
            stakers[msg.sender].pendingRewards,
            stakers[msg.sender].timeDeposited,
            stakers[msg.sender].totalStake
        );

        if(rewards == 0) revert InvalidAmount();
        if(address(this).balance < rewards) revert InsufficientETHRewards();

        // update state before external call — reentrancy protection
        stakers[msg.sender].pendingRewards = 0;
        stakers[msg.sender].timeDeposited = block.timestamp;

        (bool success, ) = msg.sender.call{value: rewards}("");
        if(!success) revert TransactionFailed();

        emit RewardsClaimed(msg.sender, rewards);
    }

    // view functions
    function getStake(address user) public view returns (uint256) {
        return stakers[user].totalStake;
    }

    function getPendingRewards(address user) public view returns (uint256) {
        return _calculateRewards(
            stakers[user].pendingRewards,
            stakers[user].timeDeposited,
            stakers[user].totalStake
        );
    }

    function getContractETHBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getContractTokenBalance() public view returns (uint256) {
        return stakingToken.balanceOf(address(this));
    }

    function _calculateRewards(
        uint256 pending,
        uint256 timeDeposited,
        uint256 stakedAmount
    ) internal view returns (uint256) {
        if(timeDeposited == 0 || stakedAmount == 0) return pending;
        return pending + ((block.timestamp - timeDeposited) * stakedAmount * REWARD_RATE);
    }

    receive() external payable {}
}
