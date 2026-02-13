// ─── Deposit Monitor ───
// Scans active deposit addresses for new incoming transactions.
// Called by Vercel Cron or server interval.

import { type NetworkId, NETWORKS } from "./index";
import { getPrivateKey } from "./hdDerivation";
import {
  getActiveDepositAddresses,
  createCryptoDeposit,
  updateDepositStatus,
  creditDeposit,
  getPendingDeposits,
} from "../../db";

import * as tron from "./networks/tron";
import * as evm from "./networks/evm";
import * as bitcoin from "./networks/bitcoin";
import * as solana from "./networks/solana";

// ─── Scan for new deposits per network ───

async function scanTronDeposits() {
  const addresses = await getActiveDepositAddresses("tron");
  const config = NETWORKS.tron;

  for (const wallet of addresses) {
    try {
      const deposits = await tron.getTronDeposits(wallet.depositAddress);
      for (const dep of deposits) {
        if (dep.amount < config.minDeposit) continue;
        await createCryptoDeposit({
          userId: wallet.userId,
          walletId: wallet.id,
          network: "tron",
          txHash: dep.txHash,
          fromAddress: dep.fromAddress,
          amount: dep.amount.toFixed(8),
          tokenSymbol: dep.tokenSymbol,
          requiredConfirmations: config.confirmations,
        });
      }
    } catch (err) {
      console.error(`[DepositMonitor] TRON scan error for ${wallet.depositAddress}:`, err);
    }
  }
}

async function scanEvmDeposits(networkId: "ethereum" | "bsc" | "polygon") {
  const addresses = await getActiveDepositAddresses(networkId);
  const config = NETWORKS[networkId];

  for (const wallet of addresses) {
    try {
      const deposits = await evm.getEvmDeposits(networkId, wallet.depositAddress);
      for (const dep of deposits) {
        if (dep.amount < config.minDeposit) continue;
        await createCryptoDeposit({
          userId: wallet.userId,
          walletId: wallet.id,
          network: networkId,
          txHash: dep.txHash,
          fromAddress: dep.fromAddress,
          amount: dep.amount.toFixed(8),
          tokenSymbol: dep.tokenSymbol,
          requiredConfirmations: config.confirmations,
        });
      }
    } catch (err) {
      console.error(`[DepositMonitor] ${networkId} scan error for ${wallet.depositAddress}:`, err);
    }
  }
}

async function scanBitcoinDeposits() {
  const addresses = await getActiveDepositAddresses("bitcoin");
  const config = NETWORKS.bitcoin;

  for (const wallet of addresses) {
    try {
      const txs = await bitcoin.getBtcTransactions(wallet.depositAddress);
      for (const tx of txs) {
        if (tx.amount < config.minDeposit) continue;
        await createCryptoDeposit({
          userId: wallet.userId,
          walletId: wallet.id,
          network: "bitcoin",
          txHash: tx.txHash,
          fromAddress: "",
          amount: tx.amount.toFixed(8),
          tokenSymbol: "BTC",
          requiredConfirmations: config.confirmations,
        });
      }
    } catch (err) {
      console.error(`[DepositMonitor] BTC scan error for ${wallet.depositAddress}:`, err);
    }
  }
}

async function scanSolanaDeposits() {
  const addresses = await getActiveDepositAddresses("solana");
  const config = NETWORKS.solana;

  for (const wallet of addresses) {
    try {
      const deposits = await solana.getSolDeposits(wallet.depositAddress);
      for (const dep of deposits) {
        if (dep.tokenSymbol === "USDT" && dep.amount < config.minDeposit) continue;
        await createCryptoDeposit({
          userId: wallet.userId,
          walletId: wallet.id,
          network: "solana",
          txHash: dep.txHash,
          fromAddress: "",
          amount: dep.amount.toFixed(8),
          tokenSymbol: dep.tokenSymbol,
          requiredConfirmations: config.confirmations,
        });
      }
    } catch (err) {
      console.error(`[DepositMonitor] SOL scan error for ${wallet.depositAddress}:`, err);
    }
  }
}

// ─── Update confirmations for pending deposits ───

async function updateConfirmations() {
  const pending = await getPendingDeposits();

  for (const deposit of pending) {
    try {
      let confirmations = 0;

      switch (deposit.network) {
        case "tron":
          confirmations = await tron.getTransactionConfirmations(deposit.txHash);
          break;
        case "ethereum":
        case "bsc":
        case "polygon":
          confirmations = await evm.getTransactionConfirmations(
            deposit.network as "ethereum" | "bsc" | "polygon",
            deposit.txHash
          );
          break;
        case "bitcoin":
          confirmations = await bitcoin.getTransactionConfirmations(deposit.txHash);
          break;
        case "solana":
          confirmations = await solana.getTransactionConfirmations(deposit.txHash);
          break;
      }

      if (confirmations > 0) {
        const status = confirmations >= deposit.requiredConfirmations ? "confirmed" : "confirming";
        await updateDepositStatus(deposit.id, status, confirmations);

        // Credit the deposit if confirmed
        if (status === "confirmed") {
          await creditDeposit(deposit.id);
        }
      }
    } catch (err) {
      console.error(`[DepositMonitor] Confirmation check error for deposit ${deposit.id}:`, err);
    }
  }
}

// ─── Sweep to hot wallet ───

async function sweepDeposits() {
  // TODO: implement sweep logic — move funds from user deposit addresses to hot wallet
  // This would run after deposits are credited
  // For MVP, deposits remain in user addresses
}

// ─── Main check function (called by cron) ───

export async function checkAllDeposits(): Promise<{ scanned: number; updated: number }> {
  let scanned = 0;
  let updated = 0;

  console.log("[DepositMonitor] Starting deposit scan...");

  try {
    await scanTronDeposits();
    scanned++;
  } catch (err) {
    console.error("[DepositMonitor] TRON scan failed:", err);
  }

  try {
    await scanEvmDeposits("ethereum");
    scanned++;
  } catch (err) {
    console.error("[DepositMonitor] ETH scan failed:", err);
  }

  try {
    await scanEvmDeposits("bsc");
    scanned++;
  } catch (err) {
    console.error("[DepositMonitor] BSC scan failed:", err);
  }

  try {
    await scanEvmDeposits("polygon");
    scanned++;
  } catch (err) {
    console.error("[DepositMonitor] Polygon scan failed:", err);
  }

  try {
    await scanBitcoinDeposits();
    scanned++;
  } catch (err) {
    console.error("[DepositMonitor] BTC scan failed:", err);
  }

  try {
    await scanSolanaDeposits();
    scanned++;
  } catch (err) {
    console.error("[DepositMonitor] SOL scan failed:", err);
  }

  // Update confirmations for all pending deposits
  try {
    await updateConfirmations();
    updated++;
  } catch (err) {
    console.error("[DepositMonitor] Confirmation update failed:", err);
  }

  console.log(`[DepositMonitor] Scan complete. Networks: ${scanned}, Confirmations updated: ${updated}`);
  return { scanned, updated };
}
