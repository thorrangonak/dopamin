import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

/**
 * Development-only auth routes.
 * Provides a /dev-login endpoint that creates a session for a test user
 * without requiring the Manus OAuth server.
 */
export function registerDevAuthRoutes(app: Express) {
  // Quick dev login - creates/uses a test user
  app.get("/dev-login", async (_req: Request, res: Response) => {
    try {
      const testOpenId = "dev-local-user-001";
      const testName = "Dev User";
      const testEmail = "dev@localhost";

      // Upsert the dev user
      await db.upsertUser({
        openId: testOpenId,
        name: testName,
        email: testEmail,
        loginMethod: "dev",
        lastSignedIn: new Date(),
        role: "admin", // Give admin role for full access during development
      });

      // Create session token
      const sessionToken = await sdk.createSessionToken(testOpenId, {
        name: testName,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(_req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[DevAuth] Login failed:", error);
      res.status(500).json({ error: "Dev login failed", details: String(error) });
    }
  });
}
