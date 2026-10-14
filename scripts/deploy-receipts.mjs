import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function compileReviewReceipts() {
  const source = await readFile(resolve(root, "contracts/ReviewReceipts.sol"), "utf8");
  const input = {
    language: "Solidity", sources: { "contracts/ReviewReceipts.sol": { content: source } },
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "metadata"] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors?.some(error => error.severity === "error")) throw new Error("ReviewReceipts compilation failed.");
  const contract = output.contracts["contracts/ReviewReceipts.sol"].ReviewReceipts;
  return {
    compilerVersion: solc.version(), compilerInput: input, abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`, deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
  };
}

async function main() {
  const directory = resolve(root, ".data");
  await mkdir(directory, { recursive: true });
  const compiled = await compileReviewReceipts();
  await writeFile(resolve(directory, "ReviewReceipts.compilation.json"), JSON.stringify(compiled, null, 2));
  console.log(`Compiled ReviewReceipts with ${compiled.compilerVersion}. Public compiler input saved in .data/ReviewReceipts.compilation.json.`);
  if (!process.argv.includes("--deploy")) {
    console.log("Compile only. Pass --deploy to deploy using the existing funded Monad testnet key file.");
    return;
  }
  const rpcUrl = process.env.MONAD_RPC_URL?.trim() || monadTestnet.rpcUrls.default.http[0];
  if (new URL(rpcUrl).protocol !== "https:") throw new Error("Use an HTTPS testnet RPC endpoint.");
  const transport = http(rpcUrl, { timeout: 20_000 });
  const client = createPublicClient({ chain: monadTestnet, transport });
  if (await client.getChainId() !== 10143) throw new Error("Refusing to deploy outside Monad testnet.");
  const outputPath = resolve(directory, "monad-receipt-deployment.json");
  let deployment;
  try { deployment = JSON.parse(await readFile(outputPath, "utf8")); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  if (deployment?.chainId !== undefined && deployment.chainId !== 10143) throw new Error("Existing deployment metadata is for another network.");
  if (deployment?.contractAddress) {
    const bytecode = await client.getCode({ address: deployment.contractAddress });
    if (bytecode !== compiled.deployedBytecode) throw new Error("Existing deployment does not match this compiled contract.");
    console.log(JSON.stringify({ chainId: 10143, contractAddress: deployment.contractAddress, transactionHash: deployment.transactionHash, reused: true }));
    return;
  }
  if (!deployment?.transactionHash) {
    const keyFile = resolve(root, process.env.MONAD_DEPLOYER_KEY_FILE || ".data/monad-test-deployer.json");
    const credentials = JSON.parse(await readFile(keyFile, "utf8"));
    if (credentials.chainId !== 10143 || !/^0x[0-9a-fA-F]{64}$/.test(credentials.privateKey || "")) throw new Error("Invalid testnet key file.");
    const account = privateKeyToAccount(credentials.privateKey);
    if (account.address.toLowerCase() !== String(credentials.address).toLowerCase()) throw new Error("The testnet key file address does not match.");
    const wallet = createWalletClient({ chain: monadTestnet, transport, account });
    const transactionHash = await wallet.deployContract({ abi: compiled.abi, bytecode: compiled.bytecode });
    deployment = { chainId: 10143, deployer: account.address, transactionHash, compilerVersion: compiled.compilerVersion, status: "pending" };
    await writeFile(outputPath, JSON.stringify(deployment, null, 2), { mode: 0o600 });
    console.log(`Deployment submitted: ${transactionHash}`);
  }
  const receipt = await client.waitForTransactionReceipt({ hash: deployment.transactionHash, timeout: 120_000 });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("The deployment transaction did not succeed.");
  const bytecode = await client.getCode({ address: receipt.contractAddress });
  if (bytecode !== compiled.deployedBytecode) throw new Error("The deployed bytecode does not match the compiled contract.");
  deployment = { ...deployment, status: "confirmed", contractAddress: receipt.contractAddress, blockNumber: receipt.blockNumber.toString(), explorerUrl: `${monadTestnet.blockExplorers.default.url}/address/${receipt.contractAddress}`, deployedAt: new Date().toISOString() };
  await writeFile(outputPath, JSON.stringify(deployment, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(deployment, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    // RPC transport errors and malformed key files must never be printed with secrets.
    console.error("Receipt deployment did not finish. Check the testnet RPC, key-file format, account balance, and saved deployment metadata before retrying. No secret values are logged.");
    process.exitCode = 1;
  });
}
