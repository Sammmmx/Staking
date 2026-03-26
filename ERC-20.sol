// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.6.0
pragma solidity ^0.8.27;

contract ERC20Permit {
    string public name = "JobToken";
    string public symbol = "JBT";
    uint8 public decimals = 18;
    uint256 public totalSupply = 1000000 * 10 ** decimals;
    address public owner;


    mapping(address => uint256) public Members;
    
    constructor() {
    owner = msg.sender;
    Members[owner] = totalSupply;
    }

    mapping(address => mapping(address => uint256)) public Allowances;

    modifier checkAddress(address any) {
        require(any != address(0), "Invalid Address");
        _;
    }

    modifier checkBalance(address any, uint256 amount) {
        require(amount> 0, "Invalid amount");
        require(Members[any] >= amount);
        _;
    }

    event _transfer(address _sender, address receiver, uint256 _amount);
    event _transferFrom(address _sender, address receiver, uint256 _amount);
    event _approve(address approver, address receiver, uint256 _amount);

    function Register(address member, uint256 amount) public {
        require(msg.sender == owner, "Not authorized to register");
        require(amount > 0, "Invalid amount");
        require(Members[owner] >= amount, "Insufficient balance");
        Members[owner] -= amount;
        Members[member] += amount;
    }

    function transfer(address _recepient, uint256 amount) public
    checkAddress(_recepient) 
    checkBalance(msg.sender, amount) {

        Members[msg.sender] -= amount;
        Members[_recepient] += amount;

        emit _transfer(msg.sender, _recepient, amount);
    }

    function transferFrom(address sender, address _recepient, uint256 amount) public
    checkAddress(sender) 
    checkAddress(_recepient) 
    checkBalance(sender, amount) {
        require(Allowances[sender][msg.sender] >= amount, "You are not allowed");
        Members[sender] -= amount;
        Members[_recepient] += amount;
        Allowances[sender][msg.sender] -= amount;

        emit _transferFrom(sender, _recepient, amount);
    }

    function approve(address _recepient, uint256 amount) public  
    checkAddress(_recepient) 
    checkBalance(msg.sender, amount){
        Allowances[msg.sender][_recepient] = amount;

        emit _approve(msg.sender, _recepient, amount);
    }

}