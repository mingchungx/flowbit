import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { testUsdcAbi } from "./testUsdcAbi";

const rpcUrl =
  process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(rpcUrl),
});

// ── Configuration checks ──

export interface ChainConfigStatus {
  configured: boolean;
  rpcUrl: string;
  hasDeployerKey: boolean;
  deployerAddress: string | null;
  hasContractAddress: boolean;
  contractAddress: string | null;
}

export interface ChainHealthStatus extends ChainConfigStatus {
  rpcReachable: boolean;
  contractReadable: boolean;
  totalSupply: string | null;
  deployerEthBalance: string | null;
  deployerHasGas: boolean;
}

/**
 * Check whether on-chain integration is fully configured.
 * Returns true only when both TEST_USDC_ADDRESS and DEPLOYER_PRIVATE_KEY
 * are set, which is the minimum required for minting test USDC.
 */
export function isChainConfigured(): boolean {
  return !!(process.env.TEST_USDC_ADDRESS && process.env.DEPLOYER_PRIVATE_KEY);
}

/**
 * Return the current chain configuration status without making any RPC calls.
 * Safe to call at any time regardless of configuration.
 */
export function getChainConfigStatus(): ChainConfigStatus {
  const hasDeployerKey = !!process.env.DEPLOYER_PRIVATE_KEY;
  let deployerAddress: string | null = null;
  if (hasDeployerKey) {
    try {
      const account = privateKeyToAccount(
        process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`
      );
      deployerAddress = account.address;
    } catch {
      // Invalid key format — leave address null
    }
  }

  const hasContractAddress = !!process.env.TEST_USDC_ADDRESS;
  const contractAddress = hasContractAddress
    ? (process.env.TEST_USDC_ADDRESS as string)
    : null;

  return {
    configured: hasDeployerKey && hasContractAddress,
    rpcUrl,
    hasDeployerKey,
    deployerAddress,
    hasContractAddress,
    contractAddress,
  };
}

/**
 * Perform live health checks against Base Sepolia RPC and the TestUSDC contract.
 * Checks RPC connectivity, contract readability, and deployer gas balance.
 * Returns detailed status even when partially configured.
 */
export async function getChainStatus(): Promise<ChainHealthStatus> {
  const config = getChainConfigStatus();

  const result: ChainHealthStatus = {
    ...config,
    rpcReachable: false,
    contractReadable: false,
    totalSupply: null,
    deployerEthBalance: null,
    deployerHasGas: false,
  };

  // Check RPC connectivity
  try {
    await publicClient.getBlockNumber();
    result.rpcReachable = true;
  } catch {
    // RPC unreachable
    return result;
  }

  // Check contract readability
  if (config.hasContractAddress) {
    try {
      const supply = await publicClient.readContract({
        address: config.contractAddress as `0x${string}`,
        abi: testUsdcAbi,
        functionName: "totalSupply",
      });
      result.contractReadable = true;
      result.totalSupply = String(supply);
    } catch {
      // Contract not readable at this address
    }
  }

  // Check deployer ETH balance for gas
  if (config.deployerAddress) {
    try {
      const balance = await publicClient.getBalance({
        address: config.deployerAddress as `0x${string}`,
      });
      result.deployerEthBalance = formatEther(balance);
      result.deployerHasGas = balance > BigInt(0);
    } catch {
      // Could not check balance
    }
  }

  return result;
}

// ── Deployer client ──

/**
 * Create a wallet client for the deployer/minter account.
 * This account owns the TestUSDC contract and can mint tokens.
 */
export function getDeployerClient() {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY is not set. " +
        "To enable on-chain operations, add DEPLOYER_PRIVATE_KEY to apps/web/.env.local. " +
        "Generate one with: node -e \"console.log('0x' + require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
}

export function getDeployerAccount() {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY is not set. " +
        "To enable on-chain operations, add DEPLOYER_PRIVATE_KEY to apps/web/.env.local. " +
        "Generate one with: node -e \"console.log('0x' + require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return privateKeyToAccount(key as `0x${string}`);
}
