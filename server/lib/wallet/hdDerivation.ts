// ─── HD Wallet Derivation (BIP-44) ───
// Master seed from env, never stored in DB.
// Path: m/44'/{coinType}'/{userIndex}'/0/0

import * as bip39 from "bip39";
import { createHash } from "crypto";
import { type NetworkId, NETWORKS } from "./index";

function getMnemonic(): string {
  const mnemonic = process.env.WALLET_MNEMONIC;
  if (!mnemonic) throw new Error("WALLET_MNEMONIC not set in environment");
  if (!bip39.validateMnemonic(mnemonic)) throw new Error("Invalid WALLET_MNEMONIC");
  return mnemonic;
}

async function getSeedBuffer(): Promise<Buffer> {
  return bip39.mnemonicToSeed(getMnemonic());
}

// ─── EVM Address Derivation (ETH/BSC/Polygon) ───
async function deriveEvmAddress(userIndex: number): Promise<{ address: string; path: string }> {
  const { ethers } = await import("ethers");
  const mnemonic = getMnemonic();
  const path = `m/44'/60'/${userIndex}'/0/0`;
  const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), path);
  return { address: wallet.address, path };
}

async function getEvmPrivateKey(userIndex: number): Promise<string> {
  const { ethers } = await import("ethers");
  const mnemonic = getMnemonic();
  const path = `m/44'/60'/${userIndex}'/0/0`;
  const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), path);
  return wallet.privateKey;
}

// ─── TRON Address Derivation ───
// TRON address = Base58Check( 0x41 + ETH address bytes )
function base58Encode(buffer: Buffer): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    let carry = buffer[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = "";
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    result += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += ALPHABET[digits[i]];
  }
  return result;
}

function ethAddressToTron(ethAddress: string): string {
  const hex = ethAddress.slice(2);
  const tronHex = "41" + hex;
  const bytes = Buffer.from(tronHex, "hex");
  const hash1 = createHash("sha256").update(bytes).digest();
  const hash2 = createHash("sha256").update(hash1).digest();
  const checksum = hash2.slice(0, 4);
  const addressBytes = Buffer.concat([bytes, checksum]);
  return base58Encode(addressBytes);
}

async function deriveTronAddress(userIndex: number): Promise<{ address: string; path: string }> {
  const { ethers } = await import("ethers");
  const mnemonic = getMnemonic();
  const path = `m/44'/195'/${userIndex}'/0/0`;
  const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), path);
  const tronAddress = ethAddressToTron(wallet.address);
  return { address: tronAddress, path };
}

async function getTronPrivateKey(userIndex: number): Promise<string> {
  const { ethers } = await import("ethers");
  const mnemonic = getMnemonic();
  const path = `m/44'/195'/${userIndex}'/0/0`;
  const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), path);
  return wallet.privateKey.slice(2); // Remove 0x prefix for TronWeb
}

// ─── Solana Address Derivation ───
async function deriveSolanaAddress(userIndex: number): Promise<{ address: string; path: string }> {
  const { derivePath } = await import("ed25519-hd-key");
  const { Keypair } = await import("@solana/web3.js");
  const seed = await getSeedBuffer();
  const path = `m/44'/501'/${userIndex}'/0'`;
  const derived = derivePath(path, seed.toString("hex"));
  const keypair = Keypair.fromSeed(derived.key);
  return { address: keypair.publicKey.toBase58(), path };
}

async function getSolanaKeypair(userIndex: number): Promise<any> {
  const { derivePath } = await import("ed25519-hd-key");
  const { Keypair } = await import("@solana/web3.js");
  const seed = await getSeedBuffer();
  const path = `m/44'/501'/${userIndex}'/0'`;
  const derived = derivePath(path, seed.toString("hex"));
  return Keypair.fromSeed(derived.key);
}

// ─── Bitcoin Address Derivation ───
async function deriveBitcoinAddress(userIndex: number): Promise<{ address: string; path: string }> {
  const bitcoin = await import("bitcoinjs-lib");
  const ecc = await import("tiny-secp256k1");
  const { BIP32Factory } = await import("bip32");
  const bip32 = BIP32Factory(ecc);
  const seed = await getSeedBuffer();
  const path = `m/44'/0'/${userIndex}'/0/0`;
  const root = bip32.fromSeed(seed, bitcoin.networks.testnet);
  const child = root.derivePath(path);
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network: bitcoin.networks.testnet,
  });
  if (!address) throw new Error("Failed to derive Bitcoin address");
  return { address, path };
}

// ─── Public API ───

export async function generateAddress(
  network: NetworkId,
  userIndex: number
): Promise<{ address: string; path: string }> {
  switch (network) {
    case "tron":
      return deriveTronAddress(userIndex);
    case "ethereum":
    case "bsc":
    case "polygon":
      return deriveEvmAddress(userIndex);
    case "solana":
      return deriveSolanaAddress(userIndex);
    case "bitcoin":
      return deriveBitcoinAddress(userIndex);
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

export async function getPrivateKey(network: NetworkId, userIndex: number): Promise<string | object> {
  switch (network) {
    case "tron":
      return getTronPrivateKey(userIndex);
    case "ethereum":
    case "bsc":
    case "polygon":
      return getEvmPrivateKey(userIndex);
    case "solana":
      return getSolanaKeypair(userIndex);
    case "bitcoin":
      throw new Error("Use bitcoin module for private key operations");
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

export function generateMnemonic(): string {
  return bip39.generateMnemonic(256); // 24 words
}
