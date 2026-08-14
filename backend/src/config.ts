import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env") });

export interface Config {
  nodeEnv: string;
  port: number;
  frontendOrigin: string;
  dbPath: string;
  sessionSecret: string;
  loginRateLimitWindowMs: number;
  loginRateLimitMax: number;
  sessionTtlMs: number;
}

const defaultSessionSecret = "dev-only-insecure-secret-change-me";

export function loadConfig(): Config {
  const sessionSecret = process.env.SESSION_SECRET || defaultSessionSecret;
  if (
    process.env.NODE_ENV === "production" &&
    sessionSecret === defaultSessionSecret
  ) {
    throw new Error("SESSION_SECRET must be set in production");
  }

  return {
    nodeEnv: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 3000),
    frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    dbPath: process.env.DB_PATH || "./data/app.db",
    sessionSecret,
    loginRateLimitWindowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 300000),
    loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX || 5),
    sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  };
}