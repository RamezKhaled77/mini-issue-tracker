import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { Express } from "express";

export interface SecurityConfig {
  frontendOrigin: string;
  loginRateLimitWindowMs: number;
  loginRateLimitMax: number;
  production: boolean;
  enableRateLimit?: boolean;
}

export function applySecurity(app: Express, config: SecurityConfig) {
  app.use(
    helmet({
      contentSecurityPolicy: config.production ? undefined : false,
    })
  );

  app.use(
    cors({
      origin: config.frontendOrigin,
      credentials: true,
    })
  );

  if (config.enableRateLimit === false) return;

  app.use(
    "/api/auth/signin",
    rateLimit({
      windowMs: config.loginRateLimitWindowMs,
      limit: config.loginRateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMITED",
          message: "Too many sign-in attempts, please try again later.",
        },
      },
    })
  );

  app.use(
    "/api/auth/signup",
    rateLimit({
      windowMs: config.loginRateLimitWindowMs,
      limit: config.loginRateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMITED",
          message: "Too many sign-up attempts, please try again later.",
        },
      },
    })
  );
}
