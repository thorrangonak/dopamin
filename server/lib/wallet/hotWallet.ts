// ─── Hot Wallet & Sweep Operations ───
// Moves funds from user deposit addresses to the platform hot wallet.

import { type NetworkId, NETWORKS } from "./index";
import { getActiveDepositAddresses } from "../../db";
import { getPrivateKey } from "./hdDerivation";
import * as tron from "./networks/tron";
import * as evm from "./networks/evm";
import * as bitcoin from "./networks/bitcoin";
import * as solana from "./networks/solana";

function getHotWalletAddress(network: NetworkId): string {
  switch (network) {
    case "tron":
      return process.env.HOT_WALLET_TRON || "";
    case "ethereum":
    case "bsc":
    case "polygon":
      return process.env.HOT_WALLET_EVM || "";
    case "solana":
      return process.env.HOT_WALLET_SOLANA || "";
    case "bitcoin":
      return process.env.HOT_WALLET_BITCOIN || "";
  }
}

// ─── Get balances of all deposit addresses per network ───

export interface WalletBalance {
  walletId: number;
  userId: number;
  network: NetworkId;
  address: string;
  addressIndex: number;
  balance: number; // USDT or native token amount
  nativeBalance?: number;
}

export async function getAllDepositBalances(): Promise<WalletBalance[]> {
  const results: WalletBalance[] = [];

  const networks: NetworkId[] = ["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"];

  for (const network of networks) {
    const wallets = await getActiveDepositAddresses(network);
    for (const wallet of wallets) {
      try {
        let balance = 0;
        let nativeBalance: number | undefined;

        switch (network) {
          case "tron": {
            const bal = await tron.getTronBalance(wallet.depositAddress);
            balance = bal.usdt;
            nativeBalance = bal.trx;
            break;
          }
          case "ethereum":
          case "bsc":
          case "polygon": {
            const bal = await evm.getEvmBalance(network, wallet.depositAddress);
            balance = bal.usdt;
            nativeBalance = bal.native;
            break;
          }
          case "solana": {
            const bal = await solana.getSolBalance(wallet.depositAddress);
            balance = bal.usdt;
            nativeBalance = bal.sol;
            break;
          }
          case "bitcoin": {
            const bal = await bitcoin.getBtcBalance(wallet.depositAddress);
            balance = bal.total;
            break;
          }
        }

        results.push({
          walletId: wallet.id,
          userId: wallet.userId,
          network,
          address: wallet.depositAddress,
          addressIndex: wallet.addressIndex,
          balance,
          nativeBalance,
        });
      } catch (err) {
        console.error(`[HotWallet] Failed to get balance for ${wallet.depositAddress}:`, err);
      }
    }
  }

  return results;
}

// ─── Sweep a single deposit address to hot wallet ───

export interface SweepResult {
  walletId: number;
  network: NetworkId;
  address: string;
  amount: number;
  txHash?: string;
  error?: string;
}

export async function sweepWallet(
  network: NetworkId,
  walletId: number,
  address: string,
  addressIndex: number,
  amount: number
): Promise<SweepResult> {
  const hotWallet = getHotWalletAddress(network);
  if (!hotWallet) {
    return { walletId, network, address, amount, error: "Hot wallet adresi ayarlanmamış" };
  }

  try {
    let txHash: string;

    switch (network) {
      case "tron": {
        const privateKey = await getPrivateKey("tron", addressIndex);
        txHash = await tron.sendTRC20(privateKey as string, hotWallet, amount);
        break;
      }
      case "ethereum":
      case "bsc":
      case "polygon": {
        const privateKey = await getPrivateKey(network, addressIndex);
        txHash = await evm.sendERC20(network, privateKey as string, hotWallet, amount);
        break;
      }
      case "solana": {
        const keypair = await getPrivateKey("solana", addressIndex);
        const mint = NETWORKS.solana.usdtContract;
        if (!mint) throw new Error("Solana USDT mint adresi ayarlanmamış");
        txHash = await solana.sendSplToken((keypair as any).secretKey, hotWallet, mint, amount);
        break;
      }
      case "bitcoin": {
        txHash = await bitcoin.sendBtc(addressIndex, hotWallet, amount);
        break;
      }
      default:
        return { walletId, network, address, amount, error: "Desteklenmeyen ağ" };
    }

    return { walletId, network, address, amount, txHash };
  } catch (err: any) {
    return { walletId, network, address, amount, error: err.message || "Sweep başarısız" };
  }
}

// ─── Sweep all deposit addresses with balance > 0 ───

export async function sweepAll(): Promise<{ results: SweepResult[]; totalSwept: number }> {
  const balances = await getAllDepositBalances();
  const results: SweepResult[] = [];
  let totalSwept = 0;

  for (const wallet of balances) {
    if (wallet.balance <= 0) continue;

    const result = await sweepWallet(
      wallet.network,
      wallet.walletId,
      wallet.address,
      wallet.addressIndex,
      wallet.balance
    );
    results.push(result);

    if (result.txHash) {
      totalSwept += wallet.balance;
    }
  }

  return { results, totalSwept };
}

// ─── Get hot wallet balances ───

export interface HotWalletBalance {
  network: NetworkId;
  address: string;
  balance: number;
  nativeBalance?: number;
}

export async function getHotWalletBalances(): Promise<HotWalletBalance[]> {
  const results: HotWalletBalance[] = [];
  const networks: NetworkId[] = ["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"];

  for (const network of networks) {
    const address = getHotWalletAddress(network);
    if (!address) continue;

    try {
      let balance = 0;
      let nativeBalance: number | undefined;

      switch (network) {
        case "tron": {
          const bal = await tron.getTronBalance(address);
          balance = bal.usdt;
          nativeBalance = bal.trx;
          break;
        }
        case "ethereum":
        case "bsc":
        case "polygon": {
          const bal = await evm.getEvmBalance(network, address);
          balance = bal.usdt;
          nativeBalance = bal.native;
          break;
        }
        case "solana": {
          const bal = await solana.getSolBalance(address);
          balance = bal.usdt;
          nativeBalance = bal.sol;
          break;
        }
        case "bitcoin": {
          const bal = await bitcoin.getBtcBalance(address);
          balance = bal.total;
          break;
        }
      }

      results.push({ network, address, balance, nativeBalance });
    } catch (err) {
      console.error(`[HotWallet] Failed to get hot wallet balance for ${network}:`, err);
    }
  }

  return results;
}
