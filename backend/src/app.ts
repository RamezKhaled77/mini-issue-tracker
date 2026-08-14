import { createServer } from "node:http";
import express from "express";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { applySecurity } from "./api/middleware/security.js";
import { errorHandler } from "./api/middleware/error-handler.js";
import { createSessionMiddleware, sessionCookieName, sessionCookieOptions } from "./api/middleware/session.js";
import { registerRoutes } from "./api/routes/index.js";

function parseCookies(req: express.Request) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function createApp(options?: { dbPath?: string; sessionSecret?: string; production?: boolean; enableRateLimit?: boolean }) {
  const config = loadConfig();
  const dbPath = options?.dbPath ?? config.dbPath;
  const sessionSecret = options?.sessionSecret ?? config.sessionSecret;
  const production = options?.production ?? config.nodeEnv === "production";
  const enableRateLimit = options?.enableRateLimit ?? true;

  const db = createDb({ dbPath, runMigrationsOnOpen: true });

  const app = express();
  app.disable("x-powered-by");

  applySecurity(app, {
    frontendOrigin: config.frontendOrigin,
    loginRateLimitWindowMs: config.loginRateLimitWindowMs,
    loginRateLimitMax: config.loginRateLimitMax,
    production,
    enableRateLimit,
  });

  app.use((req, _res, next) => {
    req.cookies = parseCookies(req);
    next();
  });
  app.use(express.json());

  app.use(
    createSessionMiddleware({
      db,
      secret: sessionSecret,
      sessionTtlMs: config.sessionTtlMs,
      production,
    })
  );

  registerRoutes(app, { db, sessionSecret, production, sessionTtlMs: config.sessionTtlMs });

  app.use(errorHandler);

  return { app, db };
}

declare global {
  namespace Express {
    interface Request {
      cookies?: Record<string, string>;
    }
  }
}

if (process.env.NODE_ENV !== "test" && process.argv[1]?.includes("app")) {
  const { app } = createApp();
  const server = createServer(app);
  server.listen(loadConfig().port, () => {
    console.log(`Backend listening on http://localhost:${loadConfig().port}`);
  });
}

export { sessionCookieName, sessionCookieOptions };
