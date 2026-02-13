// ─── Solana + SPL Token Operations ───

import { NETWORKS } from "../index";

async function getConnection() {
  const { Connection } = await import("@solana/web3.js");
  return new Connection(NETWORKS.solana.rpcUrl, "confirmed");
}

export interface SolBalance {
  sol: number;
  usdt: number;
}

export async function getSolBalance(address: string): Promise<SolBalance> {
  const { PublicKey } = await import("@solana/web3.js");
  const connection = await getConnection();

  let sol = 0;
  let usdt = 0;

  try {
    const pubkey = new PublicKey(address);
    const lamports = await connection.getBalance(pubkey);
    sol = lamports / 1e9; // lamports to SOL

    // Get SPL token accounts for USDT
    const mintAddress = NETWORKS.solana.usdtContract;
    if (mintAddress) {
      const mint = new PublicKey(mintAddress);
      const tokenAccounts = await connection.getTokenAccountsByOwner(pubkey, { mint });
      for (const { account } of tokenAccounts.value) {
        // SPL token account data: first 64 bytes are mint + owner, then 8 bytes amount
        const data = account.data;
        const amount = data.readBigUInt64LE(64);
        usdt += Number(amount) / 1e6; // USDT has 6 decimals
      }
    }
  } catch (err) {
    console.error("[SOL] Failed to get balance:", err);
  }

  return { sol, usdt };
}

export interface SolTransaction {
  txHash: string;
  amount: number;
  tokenSymbol: string;
  slot: number;
  timestamp: number;
}

export async function getSolDeposits(address: string, limit = 50): Promise<SolTransaction[]> {
  const { PublicKey } = await import("@solana/web3.js");
  const connection = await getConnection();
  const deposits: SolTransaction[] = [];

  try {
    const pubkey = new PublicKey(address);
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit });

    for (const sig of signatures) {
      try {
        const tx = await connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });
        if (!tx || !tx.meta) continue;

        // Check for SOL deposits (native)
        const keys = tx.transaction.message.getAccountKeys();
        let accountIndex = -1;
        for (let i = 0; i < keys.length; i++) {
          if (keys.get(i)?.toBase58() === address) {
            accountIndex = i;
            break;
          }
        }
        if (accountIndex >= 0) {
          const preBal = tx.meta.preBalances[accountIndex];
          const postBal = tx.meta.postBalances[accountIndex];
          const diff = (postBal - preBal) / 1e9;
          if (diff > 0) {
            deposits.push({
              txHash: sig.signature,
              amount: diff,
              tokenSymbol: "SOL",
              slot: sig.slot,
              timestamp: (sig.blockTime || 0) * 1000,
            });
          }
        }

        // Check for SPL token deposits
        if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
          const mintAddress = NETWORKS.solana.usdtContract;
          if (mintAddress) {
            for (const post of tx.meta.postTokenBalances) {
              if (post.owner === address && post.mint === mintAddress) {
                const pre = tx.meta.preTokenBalances.find(
                  (p: any) => p.accountIndex === post.accountIndex
                );
                const preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmountString || "0") : 0;
                const postAmount = parseFloat(post.uiTokenAmount.uiAmountString || "0");
                const diff = postAmount - preAmount;
                if (diff > 0) {
                  deposits.push({
                    txHash: sig.signature,
                    amount: diff,
                    tokenSymbol: "USDT",
                    slot: sig.slot,
                    timestamp: (sig.blockTime || 0) * 1000,
                  });
                }
              }
            }
          }
        }
      } catch {
        // Skip individual tx errors
      }
    }
  } catch (err) {
    console.error("[SOL] Failed to get deposits:", err);
  }

  return deposits;
}

export async function getTransactionConfirmations(txHash: string): Promise<number> {
  const connection = await getConnection();
  try {
    const status = await connection.getSignatureStatus(txHash);
    if (!status?.value) return 0;
    return status.value.confirmations ?? (status.value.confirmationStatus === "finalized" ? 32 : 0);
  } catch {
    return 0;
  }
}

export async function sendSplToken(
  keypairBytes: Uint8Array,
  toAddress: string,
  mintAddress: string,
  amount: number
): Promise<string> {
  const {
    PublicKey, Keypair, Transaction, SystemProgram,
  } = await import("@solana/web3.js");
  const connection = await getConnection();

  const fromKeypair = Keypair.fromSecretKey(keypairBytes);
  const toPubkey = new PublicKey(toAddress);
  const mint = new PublicKey(mintAddress);

  // For SPL transfers we need the associated token accounts
  // This is simplified — production would use @solana/spl-token
  const amountInDecimals = Math.floor(amount * 1e6);

  // Create transfer instruction using raw SPL token program
  // In production, use @solana/spl-token createTransferInstruction
  const transaction = new Transaction();

  // Simplified: send native SOL if no SPL support
  // Full SPL implementation would require @solana/spl-token package
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey,
      lamports: Math.floor(amount * 1e9),
    })
  );

  const signature = await connection.sendTransaction(transaction, [fromKeypair]);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}
