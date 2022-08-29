// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {

  const Lock = await hre.ethers.getContractFactory("HashedTimelock");
  const lock = await Lock.deploy();

  await lock.deployed();

  console.log(
    `Lock deployed to ${lock.address}`
  );

  const ethers = hre.ethers;
  const initialSupply = ethers.utils.parseEther('10000.0')
  const AKToken = await ethers.getContractFactory("AKToken");
  const token = await AKToken.deploy(initialSupply);
  await token.deployed();

  console.log("AKToken deployed to:", token.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
