/**
 * MySQL-over-WebSocket tunnel stream for Cloudflare Tunnel.
 * When TUNNEL_URL is set, Vercel serverless functions connect to the local
 * MySQL through a cloudflared quick tunnel (TCP wrapped in WebSocket).
 */
import { Duplex } from "stream";
import { createConnection, type Connection } from "mysql2/promise";
import WebSocket from "ws";

export async function createTunnelConnection(
  tunnelUrl: string,
  dbUrl?: string,
): Promise<Connection> {
  // Parse DATABASE_URL for credentials (host/port are irrelevant in tunnel mode)
  let user = "root";
  let password: string | undefined;
  let database = "betmap";

  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      user = parsed.username || "root";
      password = parsed.password || undefined;
      database = parsed.pathname?.slice(1) || "betmap";
    } catch {
      // Fallback to defaults
    }
  }

  const wsUrl = tunnelUrl
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://");

  const ws = new WebSocket(wsUrl);

  const stream = new Duplex({
    read() {},
    write(
      chunk: Buffer,
      _encoding: string,
      callback: (error?: Error | null) => void,
    ) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk, callback);
      } else {
        callback(new Error("WebSocket not open"));
      }
    },
    destroy(err: Error | null, callback: (error: Error | null) => void) {
      ws.close();
      callback(err);
    },
  });

  // Set up data handlers BEFORE waiting for open, so MySQL handshake packets
  // are captured immediately.
  ws.on("message", (data: Buffer) => stream.push(data));
  ws.on("close", () => stream.push(null));

  await new Promise<void>((resolve, reject) => {
    ws.on("open", () => resolve());
    ws.on("error", reject);
    setTimeout(() => reject(new Error("Tunnel connection timeout")), 10000);
  });

  return createConnection({
    stream,
    user,
    password,
    database,
  });
}
