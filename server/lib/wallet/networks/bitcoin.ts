// ─── Bitcoin Operations ───
// Uses Blockstream API for balance/tx queries

import { NETWORKS } from "../index";

const BLOCKSTREAM_BASE = "https://blockstream.info/testnet/api";

export interface BtcBalance {
  confirmed: number;
  unconfirmed: number;
  total: number;
}

export async function getBtcBalance(address: string): Promise<BtcBalance> {
  try {
    const res = await fetch(`${BLOCKSTREAM_BASE}/address/${address}`);
    if (!res.ok) throw new Error(`Blockstream API error: ${res.status}`);
    const data = await res.json();
    const confirmed = (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) / 1e8;
    const unconfirmed = (data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum) / 1e8;
    return { confirmed, unconfirmed, total: confirmed + unconfirmed };
  } catch (err) {
    console.error("[BTC] Failed to get balance:", err);
    return { confirmed: 0, unconfirmed: 0, total: 0 };
  }
}

export interface BtcTransaction {
  txHash: string;
  amount: number;
  confirmations: number;
  timestamp: number;
}

export async function getBtcTransactions(address: string): Promise<BtcTransaction[]> {
  const transactions: BtcTransaction[] = [];
  try {
    const res = await fetch(`${BLOCKSTREAM_BASE}/address/${address}/txs`);
    if (!res.ok) throw new Error(`Blockstream API error: ${res.status}`);
    const txs = await res.json();

    // Get current block height for confirmation count
    const tipRes = await fetch(`${BLOCKSTREAM_BASE}/blocks/tip/height`);
    const tipHeight = parseInt(await tipRes.text());

    for (const tx of txs) {
      // Calculate amount received at this address
      let received = 0;
      for (const vout of tx.vout) {
        if (vout.scriptpubkey_address === address) {
          received += vout.value;
        }
      }
      if (received <= 0) continue;

      const confirmations = tx.status.confirmed
        ? tipHeight - tx.status.block_height + 1
        : 0;

      transactions.push({
        txHash: tx.txid,
        amount: received / 1e8,
        confirmations,
        timestamp: tx.status.block_time ? tx.status.block_time * 1000 : Date.now(),
      });
    }
  } catch (err) {
    console.error("[BTC] Failed to get transactions:", err);
  }
  return transactions;
}

export async function getTransactionConfirmations(txHash: string): Promise<number> {
  try {
    const txRes = await fetch(`${BLOCKSTREAM_BASE}/tx/${txHash}`);
    if (!txRes.ok) return 0;
    const tx = await txRes.json();
    if (!tx.status.confirmed) return 0;

    const tipRes = await fetch(`${BLOCKSTREAM_BASE}/blocks/tip/height`);
    const tipHeight = parseInt(await tipRes.text());
    return tipHeight - tx.status.block_height + 1;
  } catch {
    return 0;
  }
}

export async function sendBtc(
  userIndex: number,
  toAddress: string,
  amountBtc: number
): Promise<string> {
  // Bitcoin UTXO-based sending requires more complex logic
  // This is a simplified version for the MVP
  const bitcoin = await import("bitcoinjs-lib");
  const ecc = await import("tiny-secp256k1");
  const { BIP32Factory } = await import("bip32");
  const bip39 = await import("bip39");

  const bip32 = BIP32Factory(ecc);
  const mnemonic = process.env.WALLET_MNEMONIC;
  if (!mnemonic) throw new Error("WALLET_MNEMONIC not set");

  const seed = await bip39.mnemonicToSeed(mnemonic);
  const root = bip32.fromSeed(seed, bitcoin.networks.testnet);
  const path = `m/44'/0'/${userIndex}'/0/0`;
  const child = root.derivePath(path);

  const { address: fromAddress } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network: bitcoin.networks.testnet,
  });

  if (!fromAddress) throw new Error("Failed to derive source address");

  // Get UTXOs
  const utxoRes = await fetch(`${BLOCKSTREAM_BASE}/address/${fromAddress}/utxo`);
  const utxos = await utxoRes.json();

  if (!utxos.length) throw new Error("No UTXOs available");

  const amountSats = Math.floor(amountBtc * 1e8);
  const feeSats = 1000; // ~1000 sats fee for testnet

  // Simple UTXO selection
  let inputSum = 0;
  const selectedUtxos: any[] = [];
  for (const utxo of utxos) {
    selectedUtxos.push(utxo);
    inputSum += utxo.value;
    if (inputSum >= amountSats + feeSats) break;
  }

  if (inputSum < amountSats + feeSats) throw new Error("Insufficient BTC balance");

  const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

  for (const utxo of selectedUtxos) {
    const txHexRes = await fetch(`${BLOCKSTREAM_BASE}/tx/${utxo.txid}/hex`);
    const txHex = await txHexRes.text();

    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: bitcoin.payments.p2wpkh({
          pubkey: Buffer.from(child.publicKey),
          network: bitcoin.networks.testnet,
        }).output!,
        value: BigInt(utxo.value),
      },
    } as any);
  }

  psbt.addOutput({ address: toAddress, value: BigInt(amountSats) });

  const change = inputSum - amountSats - feeSats;
  if (change > 546) {
    psbt.addOutput({ address: fromAddress, value: BigInt(change) });
  }

  // Sign
  for (let i = 0; i < selectedUtxos.length; i++) {
    psbt.signInput(i, {
      publicKey: Buffer.from(child.publicKey),
      privateKey: Buffer.from(child.privateKey!),
      sign: (hash: Buffer) => {
        return Buffer.from(ecc.sign(hash, child.privateKey!));
      },
    } as any);
  }

  psbt.finalizeAllInputs();
  const txHex = psbt.extractTransaction().toHex();

  // Broadcast
  const broadcastRes = await fetch(`${BLOCKSTREAM_BASE}/tx`, {
    method: "POST",
    body: txHex,
  });

  if (!broadcastRes.ok) {
    const errText = await broadcastRes.text();
    throw new Error(`Broadcast failed: ${errText}`);
  }

  return await broadcastRes.text(); // Returns txid
}
