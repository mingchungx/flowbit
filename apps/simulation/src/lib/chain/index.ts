import { parseUnits, formatUnits } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { publicClient, getDeployerClient } from "./client";
import { testUsdcAbi } from "./testUsdcAbi";

function getContractAddress(): `0x${string}` {
  const addr = process.env.TEST_USDC_ADDRESS;
  if (!addr) {
    throw new Error("TEST_USDC_ADDRESS env var is required");
  }
  return addr as `0x${string}`;
}

/**
 * Generate a new keypair for a custodial wallet.
 */
export function generateWalletKeypair() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    address: account.address,
    privateKey,
  };
}

/**
 * Mint testnet USDC to an address.
 * Calls the TestUSDC contract's mint function from the deployer.
 */
export async function mintTestUsdc(
  toAddress: `0x${string}`,
  amount: number
): Promise<`0x${string}`> {
  const deployer = getDeployerClient();
  const contractAddress = getContractAddress();

  // TestUSDC uses 6 decimals like real USDC
  const amountInUnits = parseUnits(amount.toString(), 6);

  const hash = await deployer.writeContract({
    address: contractAddress,
    abi: testUsdcAbi,
    functionName: "mint",
    args: [toAddress, amountInUnits],
  });

  // Wait for the transaction to be mined
  await publicClient.waitForTransactionReceipt({ hash });

  return hash;
}

/**
 * Get the on-chain USDC balance for an address.
 */
export async function getOnChainBalance(
  address: `0x${string}`
): Promise<string> {
  const contractAddress = getContractAddress();

  const balance = await publicClient.readContract({
    address: contractAddress,
    abi: testUsdcAbi,
    functionName: "balanceOf",
    args: [address],
  });

  return formatUnits(balance, 6);
}

/**
 * Transfer testnet USDC between addresses on-chain.
 * Uses the sender's private key to sign the transaction.
 */
export async function transferOnChain(
  senderPrivateKey: `0x${string}`,
  toAddress: `0x${string}`,
  amount: number
): Promise<`0x${string}`> {
  const { createWalletClient, http } = await import("viem");
  const { baseSepolia } = await import("viem/chains");

  const account = privateKeyToAccount(senderPrivateKey);
  const client = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(
      process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
    ),
  });

  const contractAddress = getContractAddress();
  const amountInUnits = parseUnits(amount.toString(), 6);

  const hash = await client.writeContract({
    address: contractAddress,
    abi: testUsdcAbi,
    functionName: "transfer",
    args: [toAddress, amountInUnits],
  });

  await publicClient.waitForTransactionReceipt({ hash });

  return hash;
}
