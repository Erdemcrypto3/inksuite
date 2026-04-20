require('@nomicfoundation/hardhat-toolbox');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: false,
    },
  },
  paths: {
    sources: './inkpoll',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    inkSepolia: {
      url: process.env.INK_SEPOLIA_RPC || 'https://rpc-gel-sepolia.inkonchain.com',
      accounts: process.env.DEPLOY_KEY ? [process.env.DEPLOY_KEY] : [],
    },
    ink: {
      url: process.env.INK_RPC || 'https://rpc-gel.inkonchain.com',
      accounts: process.env.DEPLOY_KEY ? [process.env.DEPLOY_KEY] : [],
    },
  },
};
