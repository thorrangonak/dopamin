// ─── TRON TRC-20 Operations ───

import { NETWORKS } from "../index";

function getTronWeb() {
  const TronWeb = require("tronweb").default;
  const config = NETWORKS.tron;
  return new TronWeb({
    fullHost: config.rpcUrl,
    headers: process.env.TRON_API_KEY
      ? { "TRON-PRO-API-KEY": process.env.TRON_API_KEY }
      : undefined,
  });
}

export interface TronBalance {
  trx: number;
  usdt: number;
}

export async function getTronBalance(address: string): Promise<TronBalance> {
  const tronWeb = getTronWeb();
  const config = NETWORKS.tron;

  // Native TRX balance
  const trxBalance = await tronWeb.trx.getBalance(address);
  const trx = trxBalance / 1_000_000; // sun to TRX

  // USDT TRC-20 balance
  let usdt = 0;
  if (config.usdtContract) {
    try {
      const contract = await tronWeb.contract().at(config.usdtContract);
      const result = await contract.balanceOf(address).call();
      usdt = Number(result) / 1_000_000; // USDT has 6 decimals on TRON
    } catch (err) {
      console.error("[TRON] Failed to get USDT balance:", err);
    }
  }

  return { trx, usdt };
}

export interface TronTransaction {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  tokenSymbol: string;
  timestamp: number;
  confirmed: boolean;
}

export async function getTronDeposits(
  address: string,
  sinceTimestamp?: number
): Promise<TronTransaction[]> {
  const tronWeb = getTronWeb();
  const config = NETWORKS.tron;
  const deposits: TronTransaction[] = [];

  if (!config.usdtContract) return deposits;

  try {
    // Query TRC-20 transfer events for the deposit address
    const events = await tronWeb.getEventResult(config.usdtContract, {
      eventName: "Transfer",
      size: 100,
      onlyConfirmed: false,
      sinceTimestamp: sinceTimestamp || Date.now() - 24 * 60 * 60 * 1000,
    });

    for (const event of events) {
      const to = tronWeb.address.fromHex(event.result.to);
      if (to !== address) continue;

      const from = tronWeb.address.fromHex(event.result.from);
      const amount = Number(event.result.value) / 1_000_000;

      deposits.push({
        txHash: event.transaction,
        fromAddress: from,
        toAddress: to,
        amount,
        tokenSymbol: "USDT",
        timestamp: event.timestamp,
        confirmed: event.block !== undefined,
      });
    }
  } catch (err) {
    console.error("[TRON] Failed to get deposits:", err);
  }

  return deposits;
}

export async function getTransactionConfirmations(txHash: string): Promise<number> {
  const tronWeb = getTronWeb();
  try {
    const tx = await tronWeb.trx.getTransactionInfo(txHash);
    if (!tx || !tx.blockNumber) return 0;
    const currentBlock = await tronWeb.trx.getCurrentBlock();
    const currentBlockNum = currentBlock?.block_header?.raw_data?.number || 0;
    return Math.max(0, currentBlockNum - tx.blockNumber);
  } catch {
    return 0;
  }
}

export async function sendTRC20(
  privateKey: string,
  toAddress: string,
  amount: number
): Promise<string> {
  const TronWeb = require("tronweb").default;
  const config = NETWORKS.tron;

  const tronWeb = new TronWeb({
    fullHost: config.rpcUrl,
    privateKey,
    headers: process.env.TRON_API_KEY
      ? { "TRON-PRO-API-KEY": process.env.TRON_API_KEY }
      : undefined,
  });

  if (!config.usdtContract) throw new Error("TRON USDT contract not configured");

  const contract = await tronWeb.contract().at(config.usdtContract);
  const amountInSun = Math.floor(amount * 1_000_000);
  const result = await contract.transfer(toAddress, amountInSun).send();
  return result;
}
