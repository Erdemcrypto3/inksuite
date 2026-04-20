require('@nomicfoundation/hardhat-toolbox');
const { execSync } = require('child_process');

/**
 * Resolve deploy key, preferring Windows Credential Manager over env var.
 * Falls back to env var (for CI) and finally to empty (local hardhat node).
 */
function getDeployKey() {
  if (process.env.DEPLOY_KEY) return process.env.DEPLOY_KEY;
  if (process.platform !== 'win32') return undefined;
  try {
    const key = execSync(
      `powershell -NoProfile -Command "(Get-StoredCredential -Target BasePress-DeployKey).GetNetworkCredential().Password"`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    return key || undefined;
  } catch {
    return undefined;
  }
}

const deployKey = getDeployKey();
const accounts = deployKey ? [deployKey] : [];

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
      accounts,
    },
    ink: {
      url: process.env.INK_RPC || 'https://rpc-gel.inkonchain.com',
      accounts,
    },
  },
};
