// ─── Vercel Cron: Check Deposits ───
// Runs every minute to scan for new deposits and update confirmations.
// Auth: CRON_SECRET header required.

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  const secret = req.headers["authorization"]?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { checkAllDeposits } = await import("../../server/lib/wallet/depositMonitor");
    const result = await checkAllDeposits();
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    console.error("[Cron] check-deposits error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
