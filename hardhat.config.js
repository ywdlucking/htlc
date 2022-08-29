require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.13",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    }
  },
  paths: {
    artifacts: './frontend/src/artifacts'
    // artifacts: './artifacts'
  },
  // networks: {
  //   hardhat: {
  //     mining: {
  //       auto: false,
  //       interval: 1000
  //     }
  //   },
  //   ropsten: {
  //     url: process.env.ROPSTEN_URL || '',
  //     accounts:
  //       process.env.TEST_ETH_ACCOUNT_PRIVATE_KEY !== undefined
  //         ? [process.env.TEST_ETH_ACCOUNT_PRIVATE_KEY]
  //         : []
  //   }
  // },
  
};
