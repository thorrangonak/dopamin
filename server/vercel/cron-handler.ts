// ─── Vercel Cron: Check Deposits ───
// Runs every minute to scan for new deposits and update confirmations.
// Auth: CRON_SECRET header required.

import type { IncomingMessage, ServerResponse } from "http";
import { checkAllDeposits } from "../lib/wallet/depositMonitor";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const auth = req.headers["authorization"];
  const secret = typeof auth === "string" ? auth.replace("Bearer ", "") : "";
  if (secret !== process.env.CRON_SECRET) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  try {
    const result = await checkAllDeposits();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true, ...result }));
  } catch (err: any) {
    console.error("[Cron] check-deposits error:", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || "Internal error" }));
  }
}
