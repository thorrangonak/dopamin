// ─── EVM (ETH/BSC/Polygon) Shared Operations ───

import { type NetworkId, NETWORKS } from "../index";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

async function getProvider(networkId: NetworkId) {
  const { ethers } = await import("ethers");
  const config = NETWORKS[networkId];
  return new ethers.JsonRpcProvider(config.rpcUrl);
}

export interface EvmBalance {
  native: number;
  usdt: number;
}

export async function getEvmBalance(
  networkId: NetworkId,
  address: string
): Promise<EvmBalance> {
  const { ethers } = await import("ethers");
  const provider = await getProvider(networkId);
  const config = NETWORKS[networkId];

  // Native balance
  const nativeBal = await provider.getBalance(address);
  const native = parseFloat(ethers.formatEther(nativeBal));

  // USDT balance
  let usdt = 0;
  if (config.usdtContract) {
    try {
      const contract = new ethers.Contract(config.usdtContract, ERC20_ABI, provider);
      const decimals = await contract.decimals();
      const balance = await contract.balanceOf(address);
      usdt = parseFloat(ethers.formatUnits(balance, decimals));
    } catch (err) {
      console.error(`[${networkId.toUpperCase()}] Failed to get USDT balance:`, err);
    }
  }

  return { native, usdt };
}

export interface EvmDeposit {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  tokenSymbol: string;
  blockNumber: number;
  confirmations: number;
}

export async function getEvmDeposits(
  networkId: NetworkId,
  address: string,
  fromBlock: number = 0
): Promise<EvmDeposit[]> {
  const { ethers } = await import("ethers");
  const provider = await getProvider(networkId);
  const config = NETWORKS[networkId];
  const deposits: EvmDeposit[] = [];

  if (!config.usdtContract) return deposits;

  try {
    const contract = new ethers.Contract(config.usdtContract, ERC20_ABI, provider);
    const decimals = await contract.decimals();
    const currentBlock = await provider.getBlockNumber();

    // Query Transfer events to our address
    const filter = contract.filters.Transfer(null, address);
    const events = await contract.queryFilter(filter, fromBlock || currentBlock - 5000, currentBlock);

    for (const event of events) {
      const log = event as any;
      const amount = parseFloat(ethers.formatUnits(log.args.value, decimals));
      const confirmations = currentBlock - log.blockNumber;

      deposits.push({
        txHash: log.transactionHash,
        fromAddress: log.args.from,
        toAddress: log.args.to,
        amount,
        tokenSymbol: "USDT",
        blockNumber: log.blockNumber,
        confirmations,
      });
    }
  } catch (err) {
    console.error(`[${networkId.toUpperCase()}] Failed to get deposits:`, err);
  }

  return deposits;
}

export async function getTransactionConfirmations(
  networkId: NetworkId,
  txHash: string
): Promise<number> {
  const provider = await getProvider(networkId);
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || !receipt.blockNumber) return 0;
    const currentBlock = await provider.getBlockNumber();
    return Math.max(0, currentBlock - receipt.blockNumber);
  } catch {
    return 0;
  }
}

export async function sendERC20(
  networkId: NetworkId,
  privateKey: string,
  toAddress: string,
  amount: number
): Promise<string> {
  const { ethers } = await import("ethers");
  const provider = await getProvider(networkId);
  const config = NETWORKS[networkId];

  if (!config.usdtContract) throw new Error(`${networkId} USDT contract not configured`);

  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(config.usdtContract, ERC20_ABI, wallet);
  const decimals = await contract.decimals();
  const amountInUnits = ethers.parseUnits(amount.toString(), decimals);

  const tx = await contract.transfer(toAddress, amountInUnits);
  const receipt = await tx.wait();
  return receipt.hash;
}
