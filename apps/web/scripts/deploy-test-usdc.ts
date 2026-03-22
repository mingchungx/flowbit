/**
 * Deploy TestUSDC contract to Base Sepolia.
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... npx tsx scripts/deploy-test-usdc.ts
 *
 * Requires the deployer to have Base Sepolia ETH for gas.
 * Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
 */

import * as solc from "solc";
import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) {
    console.error("Error: DEPLOYER_PRIVATE_KEY env var is required");
    console.error(
      "Generate one with: node -e \"console.log('0x' + require('crypto').randomBytes(32).toString('hex'))\""
    );
    process.exit(1);
  }

  const rpcUrl =
    process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

  // Read contract source
  const contractPath = path.resolve(
    __dirname,
    "../../../contracts/TestUSDC.sol"
  );
  const source = fs.readFileSync(contractPath, "utf-8");

  // Compile
  console.log("Compiling TestUSDC.sol...");
  const input = {
    language: "Solidity",
    sources: { "TestUSDC.sol": { content: source } },
    settings: {
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors?.some((e: { severity: string }) => e.severity === "error")) {
    console.error("Compilation errors:");
    for (const err of output.errors) {
      console.error(err.formattedMessage);
    }
    process.exit(1);
  }

  const contract = output.contracts["TestUSDC.sol"]["TestUSDC"];
  const bytecode = `0x${contract.evm.bytecode.object}` as `0x${string}`;
  const abi = contract.abi;

  // Deploy
  const account = privateKeyToAccount(deployerKey as `0x${string}`);
  console.log(`Deployer address: ${account.address}`);

  const publicCl = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const walletCl = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  // Check deployer has ETH
  const balance = await publicCl.getBalance({ address: account.address });
  console.log(
    `Deployer ETH balance: ${Number(balance) / 1e18} ETH`
  );
  if (balance === 0n) {
    console.error(
      "Error: Deployer has no ETH. Get testnet ETH from a Base Sepolia faucet."
    );
    process.exit(1);
  }

  console.log("Deploying TestUSDC to Base Sepolia...");
  const hash = await walletCl.deployContract({
    abi,
    bytecode,
  });

  console.log(`Deploy tx: ${hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await publicCl.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress;

  console.log(`\nTestUSDC deployed at: ${contractAddress}`);
  console.log(`\nAdd to your .env.local:`);
  console.log(`TEST_USDC_ADDRESS=${contractAddress}`);
  console.log(`DEPLOYER_PRIVATE_KEY=${deployerKey}`);
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
