// ─── BLAS345 Slot Provider API Client ───
// Seamless wallet model: they host games, we manage balances.

import crypto from "crypto";

const API_URL = () => (process.env.BLAS345_API_URL || "https://api.blas345.biz") + "/api/v1";
const ID_USER = () => process.env.BLAS345_ID_USER || "";
const PASSWORD = () => process.env.BLAS345_PASSWORD || "";

// ─── Hash: HMAC-SHA256 → hex → base64 ───
export function blas345Hash(params: Record<string, string>): string {
  const raw = new URLSearchParams(params).toString();
  const hmac = crypto.createHmac("sha256", PASSWORD()).update(raw).digest("hex");
  return Buffer.from(hmac).toString("base64");
}

// ─── Login: open a game session, get iframe URL ───
export async function blas345Login(opts: {
  customerId: number;
  balance: string;
  callbackUrl: string;
  gameId: string;
  exitUrl: string;
  language?: string;
}): Promise<{ done: number; url?: string; errors?: string }> {
  const params: Record<string, string> = {
    id_user: ID_USER(),
    id_customer: String(opts.customerId),
    balance: opts.balance,
    callback_url: opts.callbackUrl,
    id_game: opts.gameId,
    exit_url: opts.exitUrl,
    language: opts.language || "TR",
  };
  params.Hash = blas345Hash(params);

  const url = `${API_URL()}/login?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data as { done: number; url?: string; errors?: string };
}

// ─── Games: list all available games (cached 1 hour) ───
let gamesCache: { data: Blas345Game[]; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export type Blas345Game = {
  id_game: string;
  display_name: string;
  vendor: string;
  image: string;
  type?: string;
  [key: string]: unknown;
};

export async function blas345Games(): Promise<{ done: number; games: Blas345Game[] }> {
  if (gamesCache && Date.now() - gamesCache.ts < CACHE_TTL) {
    return { done: 1, games: gamesCache.data };
  }

  const params: Record<string, string> = { id_user: ID_USER() };
  params.Hash = blas345Hash(params);

  const url = `${API_URL()}/games?${new URLSearchParams(params)}`;
  console.log("[BLAS345] Fetching games from:", url);

  try {
    const res = await fetch(url);
    const data = await res.json() as { done: number; games?: Record<string, Blas345Game> | Blas345Game[] };
    console.log("[BLAS345] Response done:", data.done, "has games:", !!data.games);

    if (data.done === 1 && data.games) {
      // API returns games as { "1": {...}, "2": {...} } object — convert to array
      const games = Array.isArray(data.games) ? data.games : Object.values(data.games);
      gamesCache = { data: games, ts: Date.now() };
      return { done: 1, games };
    }
    console.error("[BLAS345] Unexpected response:", JSON.stringify(data).slice(0, 500));
    return { done: 0, games: [] };
  } catch (err: any) {
    console.error("[BLAS345] Fetch error:", err.message);
    return { done: 0, games: [] };
  }
}

// ─── Close: end a game session ───
export async function blas345Close(opts: {
  customerId: number;
}): Promise<{ done: number }> {
  const params: Record<string, string> = {
    id_user: ID_USER(),
    id_customer: String(opts.customerId),
  };
  params.Hash = blas345Hash(params);

  const url = `${API_URL()}/close?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data as { done: number };
}
