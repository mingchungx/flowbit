import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrl =
  process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(rpcUrl),
});

/**
 * Create a wallet client for the deployer/minter account.
 * This account owns the TestUSDC contract and can mint tokens.
 */
export function getDeployerClient() {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY env var is required for on-chain operations"
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
      "DEPLOYER_PRIVATE_KEY env var is required for on-chain operations"
    );
  }
  return privateKeyToAccount(key as `0x${string}`);
}
