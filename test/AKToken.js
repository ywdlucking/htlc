const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const crypto = require('crypto')
const { ethers } = require("hardhat");

describe("AKToken", function () {
  async function deployHTLC() {
    // Contracts are deployed using the first signer/account by default
    const [one, two] = await ethers.getSigners();
    const Lock = await ethers.getContractFactory("HashedTimelock");
    const lock = await Lock.deploy();
    
    return { lock, one, two};
  }

  async function deployAKToken() {
    // Contracts are deployed using the first signer/account by default
    const initialSupply = ethers.utils.parseEther('1000000.0')
    const AKToken = await ethers.getContractFactory("AKToken");
    const token = await AKToken.deploy(initialSupply);
    return token;
  }

  function bufToStr(buf) {
    return '0x' + buf.toString('hex');
  }

  function sha256(x) {
    return crypto.createHash('sha256').update(x).digest();
  }

  async function lockTime() {
    const ONE_YEAR_IN_SECS = 24 * 60 * 60;

    // const lockedAmount = ethers.utils.parseEther('101.0');
    const ONE_GWEI = 1_000_000_000;
    const lockedAmount =  ONE_GWEI;
    const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
    return { unlockTime, lockedAmount };
  }

  //create hash pair
  function newHashPair() {
    const preimage_buf = crypto.randomBytes(8);
    const hash_buf = sha256(preimage_buf);
    return {
      preimage: bufToStr(preimage_buf),
      hash: bufToStr(hash_buf),
    }
  }

  it("Should have the correct initial supply", async function () {
    const initialSupply = ethers.utils.parseEther('1000000.0')
    const AKToken = await ethers.getContractFactory("AKToken");
    const token = await AKToken.deploy(initialSupply);
    await token.deployed();

    expect(await token.totalSupply()).to.equal(initialSupply);
  });

  describe("newHTLCERC20() test", function () {
    it("Should create newHTLCERC20", async function () {
      const { lock, one, two } = await deployHTLC();
      const ak = await deployAKToken();
      const akAddress = ak.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      //save erc20 to contract
      const approveTX = await ak.approve(lock.address, lockedAmount);
      const tx = await lock.newHTLCERC20(receiver, hp.hash, unlockTime, akAddress, lockedAmount);

      const bc = await ak.balanceOf(lock.address)
      
      expect(bc).to.equal(lockedAmount);
    });

    it("Should return error when create newHTLCERC20 with timelocks in the past", async function () {
      const { lock, one, two } = await deployHTLC();
      const ak = await deployAKToken();
      const akAddress = ak.address;
      const sender = one.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      const pastTime = (await time.latest()) - 60;
      const approveTX = await ak.approve(lock.address, lockedAmount);
      await expect(lock.newHTLCERC20(receiver, hp.hash, pastTime, akAddress, lockedAmount)).to.be.revertedWith(
        "timelock time must be in the future"
      );
    });

    it("Should return error when create newHTLCERC20 with same preimage", async function () {
      const { lock, one, two } = await deployHTLC();
      const ak = await deployAKToken();
      const akAddress = ak.address;
      const sender = one.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      await ak.approve(lock.address, lockedAmount);
      await lock.newHTLCERC20(receiver, hp.hash, unlockTime,akAddress, lockedAmount);
      await ak.approve(lock.address, lockedAmount);
      //second same preimage
      await expect(lock.newHTLCERC20(receiver, hp.hash, unlockTime, akAddress, lockedAmount)).to.be.revertedWith(
        "Contract already exists"
      );
    });
  });

  describe("withdrawERC20() test", function () {
    it("Should success to extract the locked asset", async function () {
      const { lock, one, two } = await deployHTLC();
      const ak = await deployAKToken();
      const akAddress = ak.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      //save erc20 to contract
      await ak.approve(lock.address, lockedAmount);
      const tx = await lock.newHTLCERC20(receiver, hp.hash, unlockTime, akAddress, lockedAmount);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await ak.balanceOf(lock.address)
      expect(bc).to.equal(lockedAmount);

      await lock.connect(two).withdrawERC20(hashId, hp.preimage, akAddress);
      const receiverBC = await ak.balanceOf(receiver)

      expect(receiverBC).to.equal(lockedAmount);
    });

    it("Should return error when hashlock hash does not match", async function () {
      const { lock, one, two } = await deployHTLC();
      const ak = await deployAKToken();
      const akAddress = ak.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      //save erc20 to contract
      await ak.approve(lock.address, lockedAmount);
      const tx = await lock.newHTLCERC20(receiver, hp.hash, unlockTime, akAddress, lockedAmount);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await ak.balanceOf(lock.address)
      expect(bc).to.equal(lockedAmount);

      const hp_error = newHashPair();
      await expect(lock.connect(two).withdrawERC20(hashId, hp_error.preimage, akAddress)).to.be.revertedWith(
        "hashlock hash does not match"
      );
    });

    it("Should return error when already withdrawERC20n", async function () {
      const { lock, one, two } = await deployHTLC();
      const ak = await deployAKToken();
      const akAddress = ak.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      //save erc20 to contract
      await ak.approve(lock.address, lockedAmount);
      const tx = await lock.newHTLCERC20(receiver, hp.hash, unlockTime, akAddress, lockedAmount);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await ak.balanceOf(lock.address)
      expect(bc).to.equal(lockedAmount);

      await lock.connect(two).withdrawERC20(hashId, hp.preimage, akAddress);
      await expect(lock.connect(two).withdrawERC20(hashId, hp.preimage, akAddress)).to.be.revertedWith(
        "withdrawable: already withdrawn"
      );
    });

    it("Should return error when timeout", async () => {
      const { lock, one, two } = await deployHTLC();
      const ak = await deployAKToken();
      const akAddress = ak.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      //save erc20 to contract
      await ak.approve(lock.address, lockedAmount);
      const tx = await lock.newHTLCERC20(receiver, hp.hash, unlockTime, akAddress, lockedAmount);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await ak.balanceOf(lock.address)
      expect(bc).to.equal(lockedAmount);

      // wait 3 second return error past the timelock time
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          expect(lock.connect(two).withdrawERC20(hashId, hp.preimage)).to.be.revertedWith(
            "withdrawable: timelock time must be in the future"
          );
          resolve();
        }, 3000)
      });
      
    });
  });

  describe("refundERC20() test", function () {
    it("Should sender calls this method to retrieve the locked asset", async () => {
      const { lock, one, two } = await deployHTLC();
      const ak = await deployAKToken();
      const akAddress = ak.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      const newTime = (await time.latest()) + 3;
      //save erc20 to contract
      await ak.approve(lock.address, lockedAmount);
      const tx = await lock.newHTLCERC20(receiver, hp.hash, newTime, akAddress, lockedAmount);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await ak.balanceOf(lock.address)
      expect(bc).to.equal(lockedAmount);
      // set 3 second wait 5 second return error
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve();
        }, 5000)
      }).then(async () => {
        await lock.connect(one).refundERC20(hashId, akAddress);
        const bc = await ak.balanceOf(lock.address)
        expect(bc).to.equal(0);
      });
    });

    it("Should return error when already refunded", async () => {
      const { lock, one, two } = await deployHTLC();
      const ak = await deployAKToken();
      const akAddress = ak.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      const newTime = (await time.latest()) + 3;
      //save erc20 to contract
      await ak.approve(lock.address, lockedAmount);
      const tx = await lock.newHTLCERC20(receiver, hp.hash, newTime, akAddress, lockedAmount);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await ak.balanceOf(lock.address)
      expect(bc).to.equal(lockedAmount);
      // set 3 second wait 5 second return error
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve();
        }, 5000)
      }).then(async () => {
        await lock.connect(one).refundERC20(hashId, akAddress);
        //already refundERC20ed
        await expect(lock.connect(one).refundERC20(hashId, akAddress)).to.be.revertedWith(
          "refundable: already refunded"
        );
      });
    });

    it("Should return error when already withdrawn", async function () {
      const { lock, one, two } = await deployHTLC();
      const ak = await deployAKToken();
      const akAddress = ak.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      const newTime = (await time.latest()) + 5;
      //save erc20 to contract
      await ak.approve(lock.address, lockedAmount);
      const tx = await lock.newHTLCERC20(receiver, hp.hash, newTime, akAddress, lockedAmount);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await ak.balanceOf(lock.address)
      expect(bc).to.equal(lockedAmount);
      // already withdrawn
      await lock.connect(two).withdrawERC20(hashId, hp.preimage, akAddress);
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve();
        }, 5000)
      }).then(async () => {         
        await expect(lock.connect(one).refundERC20(hashId, akAddress)).to.be.revertedWith(
          "refundable: already withdrawn"
        );
      });
    });


    it("Should return error when timelock not yet passed", async () => {
      const { lock, one, two } = await deployHTLC();
      const ak = await deployAKToken();
      const akAddress = ak.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      //save erc20 to contract
      await ak.approve(lock.address, lockedAmount);
      const tx = await lock.newHTLCERC20(receiver, hp.hash, unlockTime, akAddress, lockedAmount);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await ak.balanceOf(lock.address)
      expect(bc).to.equal(lockedAmount);
      // set 5 second wait 2 second return error
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve();
        }, 2000)
      }).then(async () => {
        await expect(lock.connect(one).refundERC20(hashId, akAddress)).to.be.revertedWith(
          "refundable: timelock not yet passed"
        );
      });
    });
  });
});