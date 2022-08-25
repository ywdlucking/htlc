const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const crypto = require('crypto')
const { ethers } = require("hardhat");

describe("HTLC", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployHTLC() {


    // Contracts are deployed using the first signer/account by default
    const [one, two] = await ethers.getSigners();

    const Lock = await ethers.getContractFactory("HashedTimelock");
    const lock = await Lock.deploy();

    return { lock, one, two};
  }

  function bufToStr(buf) {
    return '0x' + buf.toString('hex');
  }

  function sha256(x) {
    return crypto.createHash('sha256').update(x).digest();
  }

  //htlc => obj
  function htlcArrayToObj(arr) {
    return {
      sender: arr[0],
      receiver: arr[1],
      amount: arr[2],
      hashlock: arr[3],
      timelock: arr[4],
      withdrawn: arr[5],
      refunded: arr[6],
      preimage: arr[7],
    }
  }

  async function lockTime() {
    const ONE_YEAR_IN_SECS = 24 * 60 * 60;
    const ONE_GWEI = 1_000_000_000;

    const lockedAmount = ONE_GWEI;
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

  const getBalance = async (address) => web3.utils.toBN(await web3.eth.getBalance(address));

  describe("Deployment", function () {
    it("Should set the right unlockTime", async function () {
      const { lock, one, two } = await loadFixture(deployHTLC);
      const hp = newHashPair();
      const htlc = await lock.getContract(hp.hash);
      
      expect(htlc.preimage).to.equal('0x307830');
    });
  });

  describe("HashedTimeLock", function () {
    describe("newHTLC() test", function () {
      it("Should create newHTLC", async function () {
        const { lock, one, two } = await loadFixture(deployHTLC);
        const sender = one.address;
        const receiver = two.address;
        const hp = newHashPair();
        console.log("hp", hp.hash);
        const { unlockTime, lockedAmount } = await lockTime();
        const tx = await lock.newHTLC(receiver, hp.hash, unlockTime, {from: sender, value: lockedAmount});
        const txReceipt = await tx.wait();

        const htlc = await lock.getContract(txReceipt.logs[0].topics[1]);

        expect(htlc.amount).to.equal(lockedAmount);
      });

      it("Should return error when create newHTLC with incorrect args", async function () {
        const { lock, one, two } = await loadFixture(deployHTLC);
        const sender = one.address;
        const receiver = two.address;
        const hp = newHashPair();
        const { unlockTime, lockedAmount } = await lockTime();
        await expect(lock.newHTLC(receiver, hp.hash, unlockTime, {from: sender, value: 0})).to.be.revertedWith(
          "msg.value must be > 0"
        );
      });

      it("Should return error when create newHTLC with timelocks in the past", async function () {
        const { lock, one, two } = await loadFixture(deployHTLC);
        const sender = one.address;
        const receiver = two.address;
        const hp = newHashPair();
        const { unlockTime, lockedAmount } = await lockTime();
        const pastTime = (await time.latest()) - 60;
        await expect(lock.newHTLC(receiver, hp.hash, pastTime, {from: sender, value: lockedAmount})).to.be.revertedWith(
          "timelock time must be in the future"
        );
      });

      it("Should return error when create newHTLC with same preimage", async function () {
        const { lock, one, two } = await loadFixture(deployHTLC);
        const sender = one.address;
        const receiver = two.address;
        const hp = newHashPair();
        const { unlockTime, lockedAmount } = await lockTime();
        await lock.newHTLC(receiver, hp.hash, unlockTime, {from: sender, value: lockedAmount});

        //second same preimage
        await expect(lock.newHTLC(receiver, hp.hash, unlockTime, {from: sender, value: lockedAmount})).to.be.revertedWith(
          "Contract already exists"
        );
      });
    });
    describe("withdraw() test", function () {
      it("Should success to extract the locked asset", async function () {
        const { lock, one, two } = await loadFixture(deployHTLC);
        const sender = one.address;
        const receiver = two.address;
        const hp = newHashPair();
        const { unlockTime, lockedAmount } = await lockTime();
        const tx = await lock.newHTLC(receiver, hp.hash, unlockTime, {from: sender, value: lockedAmount});
        const txReceipt = await tx.wait();
        const hashId = txReceipt.logs[0].topics[1];
        const before = await lock.provider.getBalance(lock.address);
        expect(before).to.equal(lockedAmount);
        console.log("withdraw:", hashId, hp.preimage)
        await lock.connect(two).withdraw(hashId, hp.preimage);
        const after = await lock.provider.getBalance(lock.address);
        expect(after).to.equal(0);
      });

      it("Should return error when hashlock hash does not match", async function () {
        const { lock, one, two } = await loadFixture(deployHTLC);
        const sender = one.address;
        const receiver = two.address;
        const hp = newHashPair();
        const { unlockTime, lockedAmount } = await lockTime();
        const tx = await lock.newHTLC(receiver, hp.hash, unlockTime, {from: sender, value: lockedAmount});
        const txReceipt = await tx.wait();
        const hashId = txReceipt.logs[0].topics[1];

        const hp_error = newHashPair();
        await expect(lock.connect(two).withdraw(hashId, hp_error.preimage)).to.be.revertedWith(
          "hashlock hash does not match"
        );
      });

      it("Should return error when already withdrawn", async function () {
        const { lock, one, two } = await loadFixture(deployHTLC);
        const sender = one.address;
        const receiver = two.address;
        const hp = newHashPair();
        const { unlockTime, lockedAmount } = await lockTime();
        const tx = await lock.newHTLC(receiver, hp.hash, unlockTime, {from: sender, value: lockedAmount});
        const txReceipt = await tx.wait();
        const hashId = txReceipt.logs[0].topics[1];
        await lock.connect(two).withdraw(hashId, hp.preimage);
        await expect(lock.connect(two).withdraw(hashId, hp.preimage)).to.be.revertedWith(
          "withdrawable: already withdrawn"
        );
      });

      it("Should return error when timeout", async () => {
        const { lock, one, two } = await loadFixture(deployHTLC);
        const sender = one.address;
        const receiver = two.address;
        const hp = newHashPair();
        const { unlockTime, lockedAmount } = await lockTime();
        const newTime = (await time.latest()) + 2;
        const tx = await lock.newHTLC(receiver, hp.hash, newTime, {from: sender, value: lockedAmount});
        const txReceipt = await tx.wait();
        const hashId = txReceipt.logs[0].topics[1];
        // wait 3 second return error past the timelock time
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            expect(lock.connect(two).withdraw(hashId, hp.preimage)).to.be.revertedWith(
              "withdrawable: timelock time must be in the future"
            );
            resolve();
          }, 3000)
        });
        
      });
    });

    describe("refund() test", function () {
      it("Should sender calls this method to retrieve the locked asset", async () => {
        const { lock, one, two } = await loadFixture(deployHTLC);
        const sender = one.address;
        const receiver = two.address;
        const hp = newHashPair();
        const { unlockTime, lockedAmount } = await lockTime();
        const newTime = (await time.latest()) + 2;
        const tx = await lock.newHTLC(receiver, hp.hash, newTime, {from: sender, value: lockedAmount});
        const txReceipt = await tx.wait();
        const hashId = txReceipt.logs[0].topics[1];
        // set 2 second wait 3 second return error
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve();
          }, 3000)
        }).then(async () => {
          await lock.connect(one).refund(hashId);
        });
      });

      it("Should return error when already refunded", async () => {
        const { lock, one, two } = await loadFixture(deployHTLC);
        const sender = one.address;
        const receiver = two.address;
        const hp = newHashPair();
        const { unlockTime, lockedAmount } = await lockTime();
        const newTime = (await time.latest()) + 2;
        const tx = await lock.newHTLC(receiver, hp.hash, newTime, {from: sender, value: lockedAmount});
        const txReceipt = await tx.wait();
        const hashId = txReceipt.logs[0].topics[1];
        // set 2 second wait 3 second return error
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve();
          }, 3000)
        }).then(async () => {
          await lock.connect(one).refund(hashId);
          //already refunded
          await expect(lock.connect(one).refund(hashId)).to.be.revertedWith(
            "refundable: already refunded"
          );
        });
      });

      it("Should return error when already withdrawn", async function () {
        const { lock, one, two } = await loadFixture(deployHTLC);
        const sender = one.address;
        const receiver = two.address;
        const hp = newHashPair();
        const { unlockTime, lockedAmount } = await lockTime();
        const newTime = (await time.latest()) + 3;
        const tx = await lock.newHTLC(receiver, hp.hash, newTime, {from: sender, value: lockedAmount});
        const txReceipt = await tx.wait();
        const hashId = txReceipt.logs[0].topics[1];
        // already withdrawn
        await lock.connect(two).withdraw(hashId, hp.preimage);
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve();
          }, 5000)
        }).then(async () => {         
          await expect(lock.connect(one).refund(hashId)).to.be.revertedWith(
            "refundable: already withdrawn"
          );
        });
      });


      it("Should return error when timelock not yet passed", async () => {
        const { lock, one, two } = await loadFixture(deployHTLC);
        const sender = one.address;
        const receiver = two.address;
        const hp = newHashPair();
        const { unlockTime, lockedAmount } = await lockTime();
        const newTime = (await time.latest()) + 5;
        const tx = await lock.newHTLC(receiver, hp.hash, newTime, {from: sender, value: lockedAmount});
        const txReceipt = await tx.wait();
        const hashId = txReceipt.logs[0].topics[1];
        // set 5 second wait 2 second return error
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve();
          }, 2000)
        }).then(async () => {
          await expect(lock.connect(one).refund(hashId)).to.be.revertedWith(
            "refundable: timelock not yet passed"
          );
        });
      });
    });

  });
});
