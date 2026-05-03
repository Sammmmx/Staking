# Artemis Staking Protocol

A decentralized staking protocol built on Ethereum. Users stake **Artemis (ATM)** tokens and earn ETH rewards over time based on the amount staked and duration.

---

## Contracts

### Artemis.sol
ERC-20 token with the following properties:
- Name: `Artemis`
- Symbol: `ATM`
- Total Supply: `1,000,000 ATM`
- Fixed supply — no minting after deployment

### Staking.sol
Staking contract where users lock ATM tokens to earn ETH rewards.
- Reward rate: `1 wei per token per second`
- Owner funds the contract with ETH to pay out rewards
- Rewards accumulate in real time based on stake amount and time

---

## Features

- Stake and unstake ATM tokens at any time
- Earn ETH rewards proportional to stake size and duration
- Partial unstaking supported — rewards are saved before updating stake
- Owner can fund the contract with ETH for rewards
- Full event logging for staking, unstaking, and reward claims
- Custom errors for gas efficient reverts
- Reentrancy protected — state updates before external calls

---

## Tech Stack

- Solidity `0.8.26`
- Hardhat
- Ethers.js
- TypeScript
- Chai

---

## Getting Started

### Prerequisites
- Node.js v18+
- npm

### Installation

```bash
git clone https://github.com/Sammmmx/your-repo-name.git
cd your-repo-name
npm install
```

### Environment Setup

- Create a `.env` file in the root:
- ALCHEMY_URL=your_alchemy_url
- PRIVATE_KEY=your_private_key
- ETHERSCAN_API_KEY=your_etherscan_api_key

---

## Usage

### Compile

```bash
npx hardhat compile
```

### Test

```bash
npx hardhat test
```

### Deploy locally

```bash
npx hardhat node
npx hardhat ignition deploy ignition/modules/deploy.ts --network localhost
```

### Deploy to Sepolia

```bash
npx hardhat ignition deploy ignition/modules/deploy.ts --network sepolia
```

### Verify on Etherscan

```bash
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS "CONSTRUCTOR_ARG"
```

---

## Contract Interaction

### Owner Flow
1. Deploy `Artemis` token
2. Deploy `Staking` with Artemis contract address
3. Call `depositETH()` to fund rewards
4. Call `register()` on Artemis to distribute tokens to users

### User Flow
1. Call `approve()` on Artemis to allow staking contract to spend tokens
2. Call `stake(amount)` to start earning rewards
3. Call `getPendingRewards(address)` to check accumulated rewards
4. Call `claimRewards()` to withdraw ETH rewards
5. Call `unstake(amount)` to withdraw staked tokens

---

## Deployed Contracts (Sepolia Testnet)

| Contract | Address |
|----------|---------|
| Artemis (ATM) | `0x...` |
| Staking | `0x...` |

---

## Test Coverage

| Category | Tests |
|----------|-------|
| Deployment | 5 |
| depositETH | 4 |
| stake | 7 |
| unstake | 8 |
| claimRewards | 7 |
| View Functions | 6 |
| **Total** | **37** |

---

## Security

- Checks-Effects-Interactions pattern followed throughout
- Custom errors instead of require strings
- `immutable` and `constant` used where applicable
- No floating pragma — pinned to `0.8.26`
- Zero address validation on deployment

---

## License

MIT
