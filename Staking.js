const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("Staking Contract", function () {
  async function deployStakingFixture() {
    const STAKE_AMOUNT = ethers.parseEther("100");
    const ETH_DEPOSIT = ethers.parseEther("100");

    const [owner, alice, bob] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("ERC20Permit");
    const token = await Token.deploy();

    const Staking = await ethers.getContractFactory("Staking");
    const staking = await Staking.deploy(await token.getAddress());

    await token.Register(alice.address, ethers.parseEther("500"));
    await token.Register(bob.address, ethers.parseEther("500"));

    await token
      .connect(alice)
      .approve(await staking.getAddress(), ethers.parseEther("500"));
    await token
      .connect(bob)
      .approve(await staking.getAddress(), ethers.parseEther("500"));

    await staking.connect(owner).deposit({ value: ETH_DEPOSIT });

    return { staking, token, owner, alice, bob, STAKE_AMOUNT, ETH_DEPOSIT };
  }

  describe("Deployment", async function () {
    it("should set the correct owner", async function () {
      const { staking, owner } = await loadFixture(deployStakingFixture);

      expect(await staking.owner()).to.equal(owner.address);
    });

    it("should set the correct staking token address", async function () {
      const { staking, token } = await loadFixture(deployStakingFixture);

      expect(await staking.stakingToken()).to.equal(await token.getAddress());
    });
  });

  describe("deposit", async function () {
    it("should allow owner to deposit ETH", async function () {
      const { staking, ETH_DEPOSIT } = await loadFixture(deployStakingFixture);

      expect(
        await ethers.provider.getBalance(await staking.getAddress()),
      ).to.equal(ETH_DEPOSIT);
    });

    it("should increase contract ETH balance on multiple deposits", async function () {
      const { staking, owner, ETH_DEPOSIT } = await loadFixture(
        deployStakingFixture,
      );

      await staking.connect(owner).deposit({ value: ETH_DEPOSIT });
      expect(
        await ethers.provider.getBalance(await staking.getAddress()),
      ).to.equal(ETH_DEPOSIT * 2n);
    });

    it("should revert if non-owner tries to deposit", async function () {
      const { staking, alice, ETH_DEPOSIT } = await loadFixture(
        deployStakingFixture,
      );

      await expect(
        staking.connect(alice).deposit({ value: ETH_DEPOSIT }),
      ).to.be.revertedWithCustomError(staking, "NotOwner");
    });

    it("should revert if deposit amount is 0", async function () {
      const { staking, owner } = await loadFixture(deployStakingFixture);

      await expect(
        staking.connect(owner).deposit({ value: 0 }),
      ).to.be.revertedWithCustomError(staking, "EmptyTransaction");
    });
  });

  describe("stake", async function () {
    it("should allow a user to stake tokens", async function () {
      const { staking, token, alice, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      await staking.connect(alice).stake(STAKE_AMOUNT);
      expect(await token.Members(await staking.getAddress())).to.equal(
        STAKE_AMOUNT,
      );
    });

    it("should deduct tokens from the staker's balance", async function () {
      const { staking, token, alice, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      const balanceBefore = await token.Members(alice.address);
      await staking.connect(alice).stake(STAKE_AMOUNT);
      expect(await token.Members(alice.address)).to.equal(
        balanceBefore - STAKE_AMOUNT,
      );
    });

    it("should revert if stake amount is 0", async function () {
      const { staking, alice } = await loadFixture(deployStakingFixture);

      await expect(
        staking.connect(alice).stake(0),
      ).to.be.revertedWithCustomError(staking, "InvalidAmount");
    });

    it("should accumulate stake correctly on a second stake", async function () {
      const { staking, token, alice, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      await staking.connect(alice).stake(STAKE_AMOUNT);
      await staking.connect(alice).stake(STAKE_AMOUNT);
      expect(await token.Members(await staking.getAddress())).to.equal(
        STAKE_AMOUNT * 2n,
      );
    });

    it("should allow multiple users to stake independently", async function () {
      const { staking, token, alice, bob, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      await staking.connect(alice).stake(STAKE_AMOUNT);
      await staking.connect(bob).stake(ethers.parseEther("50"));
      expect(await token.Members(await staking.getAddress())).to.equal(
        ethers.parseEther("150"),
      );
    });
  });

  describe("unstake", async function () {
    it("should allow a user to fully unstake", async function () {
      const { staking, token, alice, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      await staking.connect(alice).stake(STAKE_AMOUNT);
      await staking.connect(alice).unstake(STAKE_AMOUNT);
      expect(await token.Members(await staking.getAddress())).to.equal(0);
    });

    it("should return tokens to the staker after unstaking", async function () {
      const { staking, token, alice, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      await staking.connect(alice).stake(STAKE_AMOUNT);
      const balanceBefore = await token.Members(alice.address);
      await staking.connect(alice).unstake(STAKE_AMOUNT);
      expect(await token.Members(alice.address)).to.equal(
        balanceBefore + STAKE_AMOUNT,
      );
    });

    it("should allow partial unstake", async function () {
      const { staking, token, alice, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      await staking.connect(alice).stake(STAKE_AMOUNT);
      await staking.connect(alice).unstake(ethers.parseEther("50"));
      expect(await token.Members(await staking.getAddress())).to.equal(
        ethers.parseEther("50"),
      );
    });

    it("should revert if user has no stake", async function () {
      const { staking, alice, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      await expect(
        staking.connect(alice).unstake(STAKE_AMOUNT),
      ).to.be.revertedWithCustomError(staking, "StakeEmpty");
    });

    it("should not affect another user's stake when one user unstakes", async function () {
      const { staking, token, alice, bob, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      await staking.connect(alice).stake(STAKE_AMOUNT);
      await staking.connect(bob).stake(STAKE_AMOUNT);
      await staking.connect(alice).unstake(STAKE_AMOUNT);
      expect(await token.Members(await staking.getAddress())).to.equal(
        STAKE_AMOUNT,
      );
    });
  });

  describe("claimRewards", async function () {
    it("should revert if user has no stake", async function () {
      const { staking, alice } = await loadFixture(deployStakingFixture);

      await expect(
        staking.connect(alice).claimRewards(),
      ).to.be.revertedWithCustomError(staking, "StakeEmpty");
    });

    it("should send ETH rewards to the staker", async function () {
      const { staking, alice, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      await staking.connect(alice).stake(STAKE_AMOUNT);
      await ethers.provider.send("evm_increaseTime", [100]);
      await ethers.provider.send("evm_mine");

      const balanceBefore = await ethers.provider.getBalance(alice.address);
      const tx = await staking.connect(alice).claimRewards();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * tx.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(alice.address);

      expect(balanceAfter + gasCost).to.be.gt(balanceBefore);
    });

    it("should decrease contract ETH balance after rewards are claimed", async function () {
      const { staking, alice, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      await staking.connect(alice).stake(STAKE_AMOUNT);
      await ethers.provider.send("evm_increaseTime", [100]);
      await ethers.provider.send("evm_mine");

      const contractBalanceBefore = await ethers.provider.getBalance(
        await staking.getAddress(),
      );
      await staking.connect(alice).claimRewards();
      expect(
        await ethers.provider.getBalance(await staking.getAddress()),
      ).to.be.lt(contractBalanceBefore);
    });

    it("should reset reward timer after claiming", async function () {
      const { staking, alice, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      await staking.connect(alice).stake(STAKE_AMOUNT);
      await ethers.provider.send("evm_increaseTime", [1000]);
      await ethers.provider.send("evm_mine");

      const contractBefore = await ethers.provider.getBalance(
        await staking.getAddress(),
      );
      const firstTx = await staking.connect(alice).claimRewards();
      await firstTx.wait();
      const contractAfterFirst = await ethers.provider.getBalance(
        await staking.getAddress(),
      );
      const firstReward = contractBefore - contractAfterFirst;

      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine");

      const secondTx = await staking.connect(alice).claimRewards();
      await secondTx.wait();
      const contractAfterSecond = await ethers.provider.getBalance(
        await staking.getAddress(),
      );
      const secondReward = contractAfterFirst - contractAfterSecond;

      expect(secondReward).to.be.lt(firstReward);
    });

    it("should not allow a user who fully unstaked to claim", async function () {
      const { staking, alice, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      await staking.connect(alice).stake(STAKE_AMOUNT);
      await ethers.provider.send("evm_increaseTime", [50]);
      await ethers.provider.send("evm_mine");

      await staking.connect(alice).unstake(STAKE_AMOUNT);
      await expect(
        staking.connect(alice).claimRewards(),
      ).to.be.revertedWithCustomError(staking, "StakeEmpty");
    });

    it("should give more rewards to user who staked more", async function () {
      const { staking, alice, bob } = await loadFixture(deployStakingFixture);

      await staking.connect(alice).stake(ethers.parseEther("200"));
      await staking.connect(bob).stake(ethers.parseEther("100"));
      await ethers.provider.send("evm_increaseTime", [100]);
      await ethers.provider.send("evm_mine");

      const aliceBefore = await ethers.provider.getBalance(alice.address);
      const bobBefore = await ethers.provider.getBalance(bob.address);

      const aliceTx = await staking.connect(alice).claimRewards();
      const aliceReceipt = await aliceTx.wait();
      const aliceGas = aliceReceipt.gasUsed * aliceTx.gasPrice;

      const bobTx = await staking.connect(bob).claimRewards();
      const bobReceipt = await bobTx.wait();
      const bobGas = bobReceipt.gasUsed * bobTx.gasPrice;

      const aliceAfter = await ethers.provider.getBalance(alice.address);
      const bobAfter = await ethers.provider.getBalance(bob.address);

      const aliceNet = aliceAfter + aliceGas - aliceBefore;
      const bobNet = bobAfter + bobGas - bobBefore;

      expect(aliceNet).to.be.gt(bobNet);
    });

    it("should allow one user to claim while another remains staked", async function () {
      const { staking, token, alice, bob, STAKE_AMOUNT } = await loadFixture(
        deployStakingFixture,
      );

      await staking.connect(alice).stake(STAKE_AMOUNT);
      await staking.connect(bob).stake(STAKE_AMOUNT);
      await ethers.provider.send("evm_increaseTime", [100]);
      await ethers.provider.send("evm_mine");

      const contractETHBefore = await ethers.provider.getBalance(
        await staking.getAddress(),
      );
      await staking.connect(alice).claimRewards();
      const contractETHAfter = await ethers.provider.getBalance(
        await staking.getAddress(),
      );

      expect(contractETHAfter).to.be.lt(contractETHBefore);
      expect(await token.Members(await staking.getAddress())).to.equal(
        STAKE_AMOUNT * 2n,
      );
    });
  });
});
