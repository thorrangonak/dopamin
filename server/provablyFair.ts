/**
 * Provably Fair RNG Module
 * Uses HMAC-SHA256 for deterministic, verifiable game results.
 *
 * combined = HMAC-SHA256(serverSeed, clientSeed + ":" + nonce)
 */
import crypto from "crypto";

/** Generate a cryptographically secure 64-char hex server seed */
export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** SHA256 hash of server seed — shown to player before games as commitment */
export function hashServerSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

/** Generate HMAC-SHA256 hex for a game round */
export function generateGameHmac(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): string {
  return crypto
    .createHmac("sha256", serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest("hex");
}

/** Convert first 4 bytes of HMAC hex to a float in [0, 1) */
export function hmacToFloat(hmac: string): number {
  const int = parseInt(hmac.substring(0, 8), 16);
  return int / 0x100000000; // 2^32
}

/** Convert HMAC to integer in [0, max) */
export function hmacToInt(hmac: string, max: number): number {
  return Math.floor(hmacToFloat(hmac) * max);
}

/** Convert HMAC hex to an array of byte values (0-255) */
export function hmacToBytes(hmac: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hmac.length; i += 2) {
    bytes.push(parseInt(hmac.substring(i, i + 2), 16));
  }
  return bytes;
}

/**
 * HMAC-based Fisher-Yates shuffle.
 * Returns an array of indices [0..length-1] shuffled deterministically.
 */
export function hmacToShuffle(hmac: string, length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i);
  const bytes = hmacToBytes(hmac);

  for (let i = length - 1; i > 0; i--) {
    // Use 2 bytes per swap for better distribution
    const byteIdx = (length - 1 - i) * 2;
    const b0 = bytes[byteIdx % bytes.length];
    const b1 = bytes[(byteIdx + 1) % bytes.length];
    const j = ((b0 << 8) | b1) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}
