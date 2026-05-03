// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

error InvalidAddress();
error InvalidAmount();
error InsufficientBalance();
error NotOwner(address caller);
error NotAllowed();

contract Artemis {
    string public constant name = "Artemis";
    string public constant symbol = "ATM";
    uint8 public constant decimals = 18;
    uint256 public immutable totalSupply;
    address public immutable owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor() {
        owner = msg.sender;
        totalSupply = 1000000 * 10 ** decimals;
        balanceOf[owner] = totalSupply;
    }

    modifier checkAddress(address any) {
        require(any != address(0), InvalidAddress());
        _;
    }

    modifier checkBalance(address any, uint256 amount) {
        require(amount > 0, InvalidAmount());
        require(balanceOf[any] >= amount, InsufficientBalance());
        _;
    }

    event Transfer(address indexed sender, address indexed receiver, uint256 amount);
    event Approval(address indexed approver, address indexed spender, uint256 amount);

    function register(address member, uint256 amount) public
    checkAddress(member) {
        require(msg.sender == owner, NotOwner(msg.sender));
        require(amount > 0, InvalidAmount());
        require(balanceOf[owner] >= amount, InsufficientBalance());
        balanceOf[owner] -= amount;
        balanceOf[member] += amount;
        emit Transfer(owner, member, amount);
    }

    function transfer(address recipient, uint256 amount) public
    checkAddress(recipient)
    checkBalance(msg.sender, amount)
    returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public
    checkAddress(sender)
    checkAddress(recipient)
    checkBalance(sender, amount)
    returns (bool) {
        require(allowance[sender][msg.sender] >= amount, NotAllowed());
        allowance[sender][msg.sender] -= amount;
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(sender, recipient, amount);
        return true;
    }

    function approve(address spender, uint256 amount) public
    checkAddress(spender)
    returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
}
