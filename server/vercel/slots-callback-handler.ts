// ─── BLAS345 Seamless Wallet Callback ───
// Called by BLAS345 on every spin/gamble/bonus via GET request.
// We verify the hash, update balance, record transaction, and return JSON.

import type { IncomingMessage, ServerResponse } from "http";
import { URL } from "url";
import { blas345Hash } from "../lib/blas345";
import {
  getOrCreateBalance, updateBalance, addTransaction, addVipXp,
  updateRtpTracking, createSlotTransaction, getActiveSlotSession,
} from "../db";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");

  try {
    // Parse query params from GET request
    const fullUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const q = Object.fromEntries(fullUrl.searchParams.entries());

    const {
      id_customer, id_game, id_stat, type, bet, win, Hash,
    } = q;

    // Validate required fields
    if (!id_customer || !id_game || !id_stat || !type || !Hash) {
      res.statusCode = 400;
      res.end(JSON.stringify({ done: 0, errors: "Missing required parameters" }));
      return;
    }

    // Verify hash — rebuild without Hash param itself
    const paramsForHash: Record<string, string> = {};
    fullUrl.searchParams.forEach((v, k) => {
      if (k !== "Hash") paramsForHash[k] = v;
    });
    const expectedHash = blas345Hash(paramsForHash);
    if (Hash !== expectedHash) {
      res.statusCode = 403;
      res.end(JSON.stringify({ done: 0, errors: "Invalid hash" }));
      return;
    }

    const userId = parseInt(id_customer, 10);
    const betAmount = parseFloat(bet || "0");
    const winAmount = parseFloat(win || "0");
    const delta = winAmount - betAmount;

    // Get balance before
    const balBefore = await getOrCreateBalance(userId);
    if (!balBefore) {
      res.statusCode = 400;
      res.end(JSON.stringify({ done: 0, errors: "User not found" }));
      return;
    }
    const balanceBeforeNum = parseFloat(balBefore.amount);

    // Update balance
    if (delta !== 0) {
      await updateBalance(userId, delta.toFixed(2));
    }

    const balanceAfterNum = balanceBeforeNum + delta;

    // Record platform transactions
    if (betAmount > 0) {
      await addTransaction(userId, "bet_place", betAmount.toFixed(2), `Slot: ${id_game} (spin)`);
    }
    if (winAmount > 0) {
      await addTransaction(userId, "bet_win", winAmount.toFixed(2), `Slot: ${id_game} (win)`);
    }

    // Record slot transaction
    const session = await getActiveSlotSession(userId);
    const txId = await createSlotTransaction({
      userId,
      sessionId: session?.id ?? null,
      blas345StatId: id_stat,
      gameId: id_game,
      type: parseInt(type, 10),
      bet: betAmount.toFixed(2),
      win: winAmount.toFixed(2),
      balanceBefore: balanceBeforeNum.toFixed(2),
      balanceAfter: balanceAfterNum.toFixed(2),
    });

    // VIP XP: 1 XP per 10 USDT bet
    if (betAmount > 0) {
      await addVipXp(userId, Math.floor(betAmount / 10), betAmount);
    }

    // RTP tracking
    if (betAmount > 0 || winAmount > 0) {
      await updateRtpTracking("blas345_slot", betAmount, winAmount);
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
      done: 1,
      balance: balanceAfterNum.toFixed(2),
      id_stat: txId || id_stat,
    }));
  } catch (err: any) {
    console.error("[BLAS345 Callback] Error:", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ done: 0, errors: err.message || "Internal error" }));
  }
}
