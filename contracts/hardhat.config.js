require('@nomicfoundation/hardhat-toolbox');
const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Resolve the deploy key from a platform-native secret store with graceful
 * fallback. Order:
 *   1. process.env.DEPLOY_KEY                       (CI / explicit override)
 *   2. Windows Credential Manager (target=BasePress-DeployKey) on win32
 *   3. macOS Keychain (service=BasePress-DeployKey) on darwin
 *   4. ~/.config/inksuite/key on linux/darwin       (PAI-0037 fallback)
 *   5. undefined                                    (local hardhat node)
 *
 * NEVER read .env files for keys — secrets stay in OS-native stores.
 */
function getDeployKey() {
  if (process.env.DEPLOY_KEY) return process.env.DEPLOY_KEY;

  if (process.platform === 'win32') {
    try {
      const key = execSync(
        `powershell -NoProfile -Command "(Get-StoredCredential -Target BasePress-DeployKey).GetNetworkCredential().Password"`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      if (key) return key;
    } catch { /* fall through */ }
  }

  if (process.platform === 'darwin') {
    try {
      const key = execSync(
        `security find-generic-password -s BasePress-DeployKey -w`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      if (key) return key;
    } catch { /* fall through */ }
  }

  // [PAI-0037] Linux/macOS file fallback. Path lives outside repo.
  if (process.platform !== 'win32') {
    const candidate = path.join(os.homedir(), '.config', 'inksuite', 'key');
    try {
      if (fs.existsSync(candidate)) {
        const key = fs.readFileSync(candidate, 'utf-8').trim();
        if (key) return key;
      }
    } catch { /* fall through */ }
  }

  return undefined;
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
  etherscan: {
    apiKey: {
      ink: 'empty',
    },
    customChains: [
      {
        network: 'ink',
        chainId: 57073,
        urls: {
          apiURL: 'https://explorer.inkonchain.com/api',
          browserURL: 'https://explorer.inkonchain.com',
        },
      },
    ],
  },
};
