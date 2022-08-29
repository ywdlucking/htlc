const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const crypto = require('crypto')
const { ethers } = require("hardhat");

describe("MyNft", function () {
  async function deployHTLC() {
    // Contracts are deployed using the first signer/account by default
    const [one, two] = await ethers.getSigners();
    const Lock = await ethers.getContractFactory("HashedTimelock");
    const lock = await Lock.deploy();
    
    return { lock, one, two};
  }

  async function deployMyNft() {
    const MyNft = await ethers.getContractFactory("MyNft");
    const token = await MyNft.deploy();
    await token.deployed();
    const [one, two] = await ethers.getSigners();
    await token.mint(one.address);
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
    const MyNft = await ethers.getContractFactory("MyNft");
    const token = await MyNft.deploy();
    await token.deployed();
    const [one, two] = await ethers.getSigners();
    await token.mint(one.address);
    const bc = await token.balanceOf(one.address);
    expect(bc).to.equal(1);
  });

  describe("newHTLCNFT() test", function () {
    it("Should create newHTLCNFT", async function () {
      const { lock, one, two } = await deployHTLC();
      const NFT = await deployMyNft();
      const NFTAddress = NFT.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      //save erc20 to contract
      const approveTX = await NFT.approve(lock.address, 0);
      const tx = await lock.newHTLCNFT(receiver, hp.hash, unlockTime, NFTAddress, 0);

      const bc = await NFT.balanceOf(lock.address)
      
      expect(bc).to.equal(1);
    });

    it("Should return error when create newHTLCNFT with timelocks in the past", async function () {
      const { lock, one, two } = await deployHTLC();
      const NFT = await deployMyNft();
      const NFTAddress = NFT.address;
      const sender = one.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      const pastTime = (await time.latest()) - 60;
      const approveTX = await NFT.approve(lock.address, 0);
      await expect(lock.newHTLCNFT(receiver, hp.hash, pastTime, NFTAddress, 0)).to.be.revertedWith(
        "timelock time must be in the future"
      );
    });

    it("Should return error when create newHTLCNFT with same preimage", async function () {
      const { lock, one, two } = await deployHTLC();
      const NFT = await deployMyNft();
      const NFTAddress = NFT.address;
      const sender = one.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      await NFT.approve(lock.address, 0);
      await lock.newHTLCNFT(receiver, hp.hash, unlockTime,NFTAddress, 0);
      await expect(NFT.approve(lock.address, 0)).to.be.revertedWith("ERC721: approval to current owner");
      //second same preimage
      await expect(lock.newHTLCNFT(receiver, hp.hash, unlockTime, NFTAddress, 0)).to.be.revertedWith(
        "ERC721: transfer from incorrect owner"
      );
    });
  });

  describe("withdrawNFT() test", function () {
    it("Should success to extract the locked asset", async function () {
      const { lock, one, two } = await deployHTLC();
      const NFT = await deployMyNft();
      const NFTAddress = NFT.address;
      const sender = one.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      await NFT.approve(lock.address, 0);
      const tx = await lock.newHTLCNFT(receiver, hp.hash, unlockTime,NFTAddress, 0);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await NFT.balanceOf(lock.address)
      expect(bc).to.equal(1);

      await lock.connect(two).withdrawNFT(hashId, hp.preimage);
      const receiverBC = await NFT.balanceOf(receiver)

      expect(receiverBC).to.equal(1);
    });

    it("Should return error when hashlock hash does not match", async function () {
      const { lock, one, two } = await deployHTLC();
      const NFT = await deployMyNft();
      const NFTAddress = NFT.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      //save erc20 to contract
      await NFT.approve(lock.address, 0);
      const tx = await lock.newHTLCNFT(receiver, hp.hash, unlockTime, NFTAddress, 0);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await NFT.balanceOf(lock.address)
      expect(bc).to.equal(1);

      const hp_error = newHashPair();
      await expect(lock.connect(two).withdrawNFT(hashId, hp_error.preimage)).to.be.revertedWith(
        "hashlock hash does not match"
      );
    });

    it("Should return error when already withdrawNFTn", async function () {
      const { lock, one, two } = await deployHTLC();
      const NFT = await deployMyNft();
      const NFTAddress = NFT.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      //save erc20 to contract
      await NFT.approve(lock.address, 0);
      const tx = await lock.newHTLCNFT(receiver, hp.hash, unlockTime, NFTAddress, 0);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await NFT.balanceOf(lock.address)
      expect(bc).to.equal(1);

      await lock.connect(two).withdrawNFT(hashId, hp.preimage);
      await expect(lock.connect(two).withdrawNFT(hashId, hp.preimage)).to.be.revertedWith(
        "withdrawable: already withdrawn"
      );
    });

    it("Should return error when timeout", async () => {
      const { lock, one, two } = await deployHTLC();
      const NFT = await deployMyNft();
      const NFTAddress = NFT.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      //save erc20 to contract
      await NFT.approve(lock.address, 0);
      const tx = await lock.newHTLCNFT(receiver, hp.hash, unlockTime, NFTAddress, 0);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await NFT.balanceOf(lock.address)
      expect(bc).to.equal(1);

      // wait 3 second return error past the timelock time
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          expect(lock.connect(two).withdrawNFT(hashId, hp.preimage)).to.be.revertedWith(
            "withdrawable: timelock time must be in the future"
          );
          resolve();
        }, 3000)
      });
      
    });
  });

  describe("refundNFT() test", function () {
    it("Should sender calls this method to retrieve the locked asset", async () => {
      const { lock, one, two } = await deployHTLC();
      const NFT = await deployMyNft();
      const NFTAddress = NFT.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      const newTime = (await time.latest()) + 3;
      //save erc20 to contract
      await NFT.approve(lock.address, 0);
      const tx = await lock.newHTLCNFT(receiver, hp.hash, newTime, NFTAddress, 0);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await NFT.balanceOf(lock.address)
      expect(bc).to.equal(1);
      // set 3 second wait 5 second return error
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve();
        }, 5000)
      }).then(async () => {
        await lock.connect(one).refundNFT(hashId);
        const bc = await NFT.balanceOf(lock.address)
        expect(bc).to.equal(0);
      });
    });

    it("Should return error when already refunded", async () => {
      const { lock, one, two } = await deployHTLC();
      const NFT = await deployMyNft();
      const NFTAddress = NFT.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      const newTime = (await time.latest()) + 3;
      //save erc20 to contract
      await NFT.approve(lock.address, 0);
      const tx = await lock.newHTLCNFT(receiver, hp.hash, newTime, NFTAddress, 0);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await NFT.balanceOf(lock.address)
      expect(bc).to.equal(1);
      // set 3 second wait 5 second return error
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve();
        }, 5000)
      }).then(async () => {
        await lock.connect(one).refundNFT(hashId);
        //already refundNFTed
        await expect(lock.connect(one).refundNFT(hashId)).to.be.revertedWith(
          "refundable: already refunded"
        );
      });
    });

    it("Should return error when already withdrawn", async function () {
      const { lock, one, two } = await deployHTLC();
      const NFT = await deployMyNft();
      const NFTAddress = NFT.address;
      const receiver = two.address;
      const hp = newHashPair();
      const newTime = (await time.latest()) + 5;
      //save erc20 to contract
      await NFT.approve(lock.address, 0);
      const tx = await lock.newHTLCNFT(receiver, hp.hash, newTime, NFTAddress, 0);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await NFT.balanceOf(lock.address)
      expect(bc).to.equal(1);
      // already withdrawn
      await lock.connect(two).withdrawNFT(hashId, hp.preimage);
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve();
        }, 5000)
      }).then(async () => {         
        await expect(lock.connect(one).refundNFT(hashId)).to.be.revertedWith(
          "refundable: already withdrawn"
        );
      });
    });


    it("Should return error when timelock not yet passed", async () => {
      const { lock, one, two } = await deployHTLC();
      const NFT = await deployMyNft();
      const NFTAddress = NFT.address;
      const receiver = two.address;
      const hp = newHashPair();
      const { unlockTime, lockedAmount } = await lockTime();
      //save erc20 to contract
      await NFT.approve(lock.address, 0);
      const tx = await lock.newHTLCNFT(receiver, hp.hash, unlockTime, NFTAddress, 0);
      const txReceipt = await tx.wait();
      const hashId = txReceipt.logs[2].topics[1];
      const bc = await NFT.balanceOf(lock.address)
      expect(bc).to.equal(1);
      // set 5 second wait 2 second return error
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve();
        }, 2000)
      }).then(async () => {
        await expect(lock.connect(one).refundNFT(hashId)).to.be.revertedWith(
          "refundable: timelock not yet passed"
        );
      });
    });
  });
});