//SPDX-License-Identifier:MIT

pragma solidity ^0.8.23;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract Staking {

    uint256 Token_storage;
    uint256 ETH_storage;
    address public owner;

    IERC20 public stakingToken;

    constructor(address _tokenAddress) {
        owner = msg.sender;
        stakingToken = IERC20(_tokenAddress);
    }

    struct details{
        uint256 Total_Stake;
        uint256 Time_Deposited;
        uint256 Total_Rewards;
    } 
    mapping(address => details) Stakers;

    modifier checkStake() {
        require(Stakers[msg.sender].Total_Stake > 0, "Your stake is empty");
        _;
    }

    function deposit()public payable{
        require(msg.sender == owner, "You are not Authorized");
        require(msg.value > 0, "Empty Transaction");
        ETH_storage += msg.value;
    }

    function stake(uint256 amount) public {
        require(amount > 0, "Amount needs to be something");
        uint256 _stake = Stakers[msg.sender].Total_Stake;
        uint256 current_time = block.timestamp;
        if(_stake > 0) {
            Stakers[msg.sender].Total_Rewards =  CalculateRewards(Stakers[msg.sender].Total_Rewards, Stakers[msg.sender].Time_Deposited, _stake);
            Stakers[msg.sender].Time_Deposited = current_time;
        } else {
            Stakers[msg.sender].Time_Deposited = current_time;
        }
        Token_storage += amount;
        Stakers[msg.sender].Total_Stake += amount;
        stakingToken.transferFrom(msg.sender, address(this), amount);
    }
    

    function unstake(uint256 amount) public checkStake() {
        uint256 _stake = Stakers[msg.sender].Total_Stake;
        Stakers[msg.sender].Total_Rewards = CalculateRewards(Stakers[msg.sender].Total_Rewards, Stakers[msg.sender].Time_Deposited, _stake);
        if(_stake == amount){
            Stakers[msg.sender].Time_Deposited = 0;
        } else {
            Stakers[msg.sender].Time_Deposited = block.timestamp;
        }
        Stakers[msg.sender].Total_Stake -= amount;
        Token_storage -= amount;
        stakingToken.transfer(msg.sender, amount);
    }

    function claimRewards() public checkStake() {
        uint256 rewards = CalculateRewards(Stakers[msg.sender].Total_Rewards, Stakers[msg.sender].Time_Deposited, Stakers[msg.sender].Total_Stake);
        Stakers[msg.sender].Total_Rewards = 0;
        ETH_storage -= rewards;
        Stakers[msg.sender].Time_Deposited = block.timestamp;
        (bool success, ) = (msg.sender).call{value:rewards}("");
        require(success, "Transaction Failed");
    }

    function CalculateRewards(uint256 current, uint256 time, uint256 _stake) internal view returns(uint256) {
        return current + ((block.timestamp - time) * _stake);
    }

}