import { expect } from "chai";
import hre from "hardhat";

describe("Staking Contract", function () {

    let staking: any;
    let token: any;
    let owner: any;
    let alice: any;
    let bob: any;

    const STAKE_AMOUNT = hre.ethers.parseEther("100");
    const ETH_DEPOSIT = hre.ethers.parseEther("10");

    beforeEach(async function () {
        [owner, alice, bob] = await hre.ethers.getSigners();

        // deploy Artemis ERC20
        const Token = await hre.ethers.getContractFactory("Artemis");
        token = await Token.deploy();

        // deploy staking contract
        const Staking = await hre.ethers.getContractFactory("Staking");
        staking = await Staking.deploy(await token.getAddress());

        // register tokens to alice and bob from owner
        await token.register(alice.address, hre.ethers.parseEther("1000"));
        await token.register(bob.address, hre.ethers.parseEther("1000"));

        // approve staking contract
        await token.connect(alice).approve(
            await staking.getAddress(),
            hre.ethers.parseEther("1000")
        );
        await token.connect(bob).approve(
            await staking.getAddress(),
            hre.ethers.parseEther("1000")
        );

        // fund contract with ETH for rewards
        await staking.connect(owner).depositETH({ value: ETH_DEPOSIT });
    });

    // ========================
    // DEPLOYMENT TESTS
    // ========================
    describe("Deployment", function () {

        it("should set the correct owner", async function () {
            expect(await staking.owner()).to.equal(owner.address);
        });

        it("should set the correct staking token", async function () {
            expect(await staking.stakingToken()).to.equal(await token.getAddress());
        });

        it("should revert if token address is zero", async function () {
            const Staking = await hre.ethers.getContractFactory("Staking");
            await expect(
                Staking.deploy(hre.ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(staking, "InvalidAmount");
        });

        it("should start with zero total staked", async function () {
            expect(await staking.totalStaked()).to.equal(0);
        });

        it("should have correct reward rate", async function () {
            expect(await staking.REWARD_RATE()).to.equal(1);
        });
    });

    // ========================
    // DEPOSIT ETH TESTS
    // ========================
    describe("depositETH", function () {

        it("should allow owner to deposit ETH", async function () {
            expect(await staking.getContractETHBalance()).to.equal(ETH_DEPOSIT);
        });

        it("should revert if non owner tries to deposit", async function () {
            await expect(
                staking.connect(alice).depositETH({ value: ETH_DEPOSIT })
            ).to.be.revertedWithCustomError(staking, "NotOwner");
        });

        it("should revert if deposit amount is 0", async function () {
            await expect(
                staking.connect(owner).depositETH({ value: 0 })
            ).to.be.revertedWithCustomError(staking, "EmptyTransaction");
        });

        it("should emit ETHDeposited event", async function () {
            await expect(
                staking.connect(owner).depositETH({ value: ETH_DEPOSIT })
            ).to.emit(staking, "ETHDeposited")
             .withArgs(owner.address, ETH_DEPOSIT);
        });
    });

    // ========================
    // STAKE TESTS
    // ========================
    describe("stake", function () {

        it("should allow user to stake tokens", async function () {
            await staking.connect(alice).stake(STAKE_AMOUNT);
            expect(await staking.getStake(alice.address)).to.equal(STAKE_AMOUNT);
        });

        it("should increase totalStaked", async function () {
            await staking.connect(alice).stake(STAKE_AMOUNT);
            expect(await staking.totalStaked()).to.equal(STAKE_AMOUNT);
        });

        it("should transfer tokens from user to contract", async function () {
            await staking.connect(alice).stake(STAKE_AMOUNT);
            expect(await staking.getContractTokenBalance()).to.equal(STAKE_AMOUNT);
        });

        it("should revert if stake amount is 0", async function () {
            await expect(
                staking.connect(alice).stake(0)
            ).to.be.revertedWithCustomError(staking, "InvalidAmount");
        });

        it("should save pending rewards on second stake", async function () {
            await staking.connect(alice).stake(STAKE_AMOUNT);

            await hre.ethers.provider.send("evm_increaseTime", [100]);
            await hre.ethers.provider.send("evm_mine", []);

            await staking.connect(alice).stake(STAKE_AMOUNT);

            const rewards = await staking.getPendingRewards(alice.address);
            expect(rewards).to.be.gt(0);
        });

        it("should emit Staked event", async function () {
            await expect(
                staking.connect(alice).stake(STAKE_AMOUNT)
            ).to.emit(staking, "Staked")
             .withArgs(alice.address, STAKE_AMOUNT);
        });

        it("should track multiple users stakes independently", async function () {
            await staking.connect(alice).stake(STAKE_AMOUNT);
            await staking.connect(bob).stake(hre.ethers.parseEther("50"));

            expect(await staking.getStake(alice.address)).to.equal(STAKE_AMOUNT);
            expect(await staking.getStake(bob.address)).to.equal(hre.ethers.parseEther("50"));
            expect(await staking.totalStaked()).to.equal(hre.ethers.parseEther("150"));
        });
    });

    // ========================
    // UNSTAKE TESTS
    // ========================
    describe("unstake", function () {

        beforeEach(async function () {
            await staking.connect(alice).stake(STAKE_AMOUNT);
        });

        it("should allow full unstake", async function () {
            await staking.connect(alice).unstake(STAKE_AMOUNT);
            expect(await staking.getStake(alice.address)).to.equal(0);
        });

        it("should allow partial unstake", async function () {
            await staking.connect(alice).unstake(hre.ethers.parseEther("50"));
            expect(await staking.getStake(alice.address)).to.equal(hre.ethers.parseEther("50"));
        });

        it("should return tokens to user", async function () {
            const balanceBefore = await token.balanceOf(alice.address);
            await staking.connect(alice).unstake(STAKE_AMOUNT);
            const balanceAfter = await token.balanceOf(alice.address);
            expect(balanceAfter).to.equal(balanceBefore + STAKE_AMOUNT);
        });

        it("should decrease totalStaked", async function () {
            await staking.connect(alice).unstake(STAKE_AMOUNT);
            expect(await staking.totalStaked()).to.equal(0);
        });

        it("should revert if user has no stake", async function () {
            await expect(
                staking.connect(bob).unstake(STAKE_AMOUNT)
            ).to.be.revertedWithCustomError(staking, "StakeEmpty");
        });

        it("should revert if unstake amount is 0", async function () {
            await expect(
                staking.connect(alice).unstake(0)
            ).to.be.revertedWithCustomError(staking, "InvalidAmount");
        });

        it("should revert if unstake amount exceeds stake", async function () {
            await expect(
                staking.connect(alice).unstake(hre.ethers.parseEther("200"))
            ).to.be.revertedWithCustomError(staking, "InvalidAmount");
        });

        it("should save pending rewards before unstaking", async function () {
            await hre.ethers.provider.send("evm_increaseTime", [100]);
            await hre.ethers.provider.send("evm_mine", []);

            await staking.connect(alice).unstake(hre.ethers.parseEther("50"));

            const rewards = await staking.getPendingRewards(alice.address);
            expect(rewards).to.be.gt(0);
        });

        it("should reset pending rewards to 0 on full unstake", async function () {
            await staking.connect(alice).unstake(STAKE_AMOUNT);
            expect(await staking.getPendingRewards(alice.address)).to.equal(0);
        });

        it("should emit Unstaked event", async function () {
            await expect(
                staking.connect(alice).unstake(STAKE_AMOUNT)
            ).to.emit(staking, "Unstaked")
             .withArgs(alice.address, STAKE_AMOUNT);
        });
    });

    // ========================
    // CLAIM REWARDS TESTS
    // ========================
    describe("claimRewards", function () {

        beforeEach(async function () {
            await staking.connect(alice).stake(STAKE_AMOUNT);
        });

        it("should revert if user has no stake", async function () {
            await expect(
                staking.connect(bob).claimRewards()
            ).to.be.revertedWithCustomError(staking, "StakeEmpty");
        });

        it("should revert if rewards are 0", async function () {
            await expect(
                staking.connect(alice).claimRewards()
            ).to.be.revertedWithCustomError(staking, "InvalidAmount");
        });

        it("should pay out ETH rewards", async function () {
            await hre.ethers.provider.send("evm_increaseTime", [100]);
            await hre.ethers.provider.send("evm_mine", []);

            const balanceBefore = await hre.ethers.provider.getBalance(alice.address);
            await staking.connect(alice).claimRewards();
            const balanceAfter = await hre.ethers.provider.getBalance(alice.address);

            expect(balanceAfter).to.be.gt(balanceBefore);
        });

        it("should reset pending rewards after claiming", async function () {
            await hre.ethers.provider.send("evm_increaseTime", [100]);
            await hre.ethers.provider.send("evm_mine", []);

            await staking.connect(alice).claimRewards();
            expect(await staking.getPendingRewards(alice.address)).to.equal(0);
        });

        it("should revert if contract has insufficient ETH", async function () {
            // register and stake a large amount to generate huge rewards
            await token.register(alice.address, hre.ethers.parseEther("7000"));
            await token.connect(alice).approve(
                await staking.getAddress(),
                hre.ethers.parseEther("7000")
            );
            await staking.connect(alice).stake(hre.ethers.parseEther("7000"));

            await hre.ethers.provider.send("evm_increaseTime", [100000]);
            await hre.ethers.provider.send("evm_mine", []);

            await expect(
                staking.connect(alice).claimRewards()
            ).to.be.revertedWithCustomError(staking, "InsufficientETHRewards");
        });

        it("should give more rewards to user who staked more", async function () {
            await staking.connect(bob).stake(hre.ethers.parseEther("50"));

            await hre.ethers.provider.send("evm_increaseTime", [100]);
            await hre.ethers.provider.send("evm_mine", []);

            const aliceRewards = await staking.getPendingRewards(alice.address);
            const bobRewards = await staking.getPendingRewards(bob.address);

            expect(aliceRewards).to.be.gt(bobRewards);
        });

        it("should emit RewardsClaimed event", async function () {
            await hre.ethers.provider.send("evm_increaseTime", [100]);
            await hre.ethers.provider.send("evm_mine", []);

            await expect(
                staking.connect(alice).claimRewards()
            ).to.emit(staking, "RewardsClaimed");
        });
    });

    // ========================
    // VIEW FUNCTION TESTS
    // ========================
    describe("View Functions", function () {

        beforeEach(async function () {
            await staking.connect(alice).stake(STAKE_AMOUNT);
        });

        it("should return correct stake for user", async function () {
            expect(await staking.getStake(alice.address)).to.equal(STAKE_AMOUNT);
        });

        it("should return 0 stake for user who has not staked", async function () {
            expect(await staking.getStake(bob.address)).to.equal(0);
        });

        it("should return correct ETH balance", async function () {
            expect(await staking.getContractETHBalance()).to.equal(ETH_DEPOSIT);
        });

        it("should return correct token balance", async function () {
            expect(await staking.getContractTokenBalance()).to.equal(STAKE_AMOUNT);
        });

        it("should return increasing pending rewards over time", async function () {
            const rewardsBefore = await staking.getPendingRewards(alice.address);

            await hre.ethers.provider.send("evm_increaseTime", [100]);
            await hre.ethers.provider.send("evm_mine", []);

            const rewardsAfter = await staking.getPendingRewards(alice.address);
            expect(rewardsAfter).to.be.gt(rewardsBefore);
        });

        it("should return 0 pending rewards for user who has not staked", async function () {
            expect(await staking.getPendingRewards(bob.address)).to.equal(0);
        });
    });
});
