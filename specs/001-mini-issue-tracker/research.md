# Research: Mini Issue Tracker Technology Decisions

**Branch**: `001-mini-issue-tracker` | **Date**: 2026-08-14

Phase 0 output for [plan.md](plan.md). Resolves all technology decisions that
the constitution defers to the planning phase.

## 1. Language: TypeScript

- **Decision**: TypeScript 5.x on Node.js 22 LTS for backend and frontend.
- **Rationale**: End-to-end type safety satisfies the constitution's Type
  Safety & Consistency principle (III). Single language keeps the codebase
  maintainable for a small team (Principle II). TypeScript is the dominant
  choice for full-stack web apps in 2026 with the strongest ecosystem support.
- **Alternatives considered**: JavaScript (simpler setup but loses compile-time
  safety); Python/Django (different language for frontend breaks the type
  story).

## 2. Backend Framework: Express 5

- **Decision**: Express 5.
- **Rationale**: Minimal, unopinionated, widely understood; ideal for a simple
  REST API serving a small team. Matches Simplicity First (Principle I).
- **Alternatives considered**: Fastify 5 (higher performance, more features —
  unnecessary for this scale); Next.js API routes (couples frontend framework
  to backend, heavier than needed).

## 3. Frontend Framework: React 18 + Vite

- **Decision**: React 18 with Vite as the build tool.
- **Rationale**: React remains the most widely adopted UI library (2026),
  giving a large hiring pool and predictable patterns. Vite provides fast,
  simple builds. Component model fits pages, forms, and the dashboard.
- **Alternatives considered**: Vue 3 / Svelte 5 (lighter, but smaller
  ecosystem and hiring pool); server-rendered templates (no rich dashboard/
  filter interactions without adding a client framework anyway).

## 4. Database & ORM: SQLite (WAL) + Drizzle ORM

- **Decision**: SQLite with WAL mode via better-sqlite3, accessed through
  Drizzle ORM.
- **Rationale**: Zero-infrastructure, file-based, crash-safe, and more than
  sufficient for ~25 members and ~1,000 issues per project. Drizzle is the
  lightest type-safe TypeScript ORM ("zero dependencies", SQL-like, serverless
  and edge-ready) and gives compile-time-checked queries that honor Type
  Safety (Principle III) without ORM heavyweight patterns.
- **Alternatives considered**: PostgreSQL (more operational overhead; no need
  at this scale, though Drizzle makes a later migration straightforward);
  Prisma (heavier codegen, slower in 2026 for TS stacks per research); raw SQL
  (regression in type safety).

## 5. Validation: zod

- **Decision**: zod for request validation and shared schema types.
- **Rationale**: Compile-time + runtime validation that composes with
  TypeScript types; enforces No Silent Assumptions (VIII) by failing loudly on
  malformed input. Used consistently across API and forms.
- **Alternatives considered**: Joi / Yup (older, weaker TS integration);
  hand-rolled guards (duplicated, error-prone).

## 6. Authentication: Session-based, Argon2id, HttpOnly cookies

- **Decision**: Server-side sessions stored in SQLite; passwords hashed with
  Argon2id; session cookie with `HttpOnly`, `Secure`, `SameSite=Lax`;
  session ID regenerated after login; CSRF protection via SameSite + token
  where needed; login rate limiting.
- **Rationale**: Session auth is recommended for typical web apps, easiest to
  revoke (delete session record), and avoids JWT token/refresh complexity.
  Argon2id is OWASP's first-choice password hash (memory-hard, GPU-resistant),
  superseding bcrypt in 2026 guidance. Cookie flags resist XSS/CSRF.
- **Alternatives considered**: JWT in cookies (revocation and refresh
  complexity — worse for a small app); bcrypt (still safe, but Argon2id is the
  2026 recommended default); third-party auth provider (Billing/integrations
  are out of scope; DIY keeps it simple).

## 7. Security Baseline

- **Decision**: helmet security headers (nosniff, frame deny, HSTS), CORS
  restricted to the app origin, rate limiting on login, allowlisted fields on
  update (mass-assignment protection), queries scoped to authenticated user
  (IDOR protection), secrets via environment variables only, `npm audit` in
  CI.
- **Rationale**: Directly enforces Security by Default (Principle IV) and No
  Silent Assumptions (VIII). Aligns with 2026 Node.js auth security guidance.
- **Alternatives considered**: Minimal/no headers and default config (rejected:
  fails Security by Default).

## 8. Testing: Vitest + React Testing Library + axe-core

- **Decision**: Vitest for unit and integration tests; React Testing Library
  for component tests; axe-core for automated accessibility assertions.
- **Rationale**: Single modern runner with good TS/ESM support; covers Test
  Critical Behavior (V) for persistence, auth/permissions, and contracts; axe
  automates the accessibility acceptance criteria (SC-006, Principle VI).
- **Alternatives considered**: Jest (heavier config, ESM friction); Cypress
  (good E2E but heavier than needed for phase-1 validation).

## 9. Deployment

- **Decision**: Single Node.js process serving the Express API and the built
  frontend static assets; deployable to any Linux host/container platform.
- **Rationale**: Simplest operational model consistent with the scale; one
  process, one SQLite file, no service mesh or orchestrators.
- **Alternatives considered**: Serverless functions (SQLite file handling and
  cold starts add complexity); separate frontend/backend deploys (unnecessary
  operational split for one small app).

## Resolved Unknowns Summary

| Unknown | Resolution |
|---------|------------|
| Language/Version | TypeScript 5.x, Node.js 22 LTS |
| Primary dependencies | Express 5, Drizzle ORM, better-sqlite3, React 18, Vite, zod, Argon2id |
| Storage | SQLite (WAL), Drizzle ORM |
| Testing | Vitest, React Testing Library, axe-core |
| Target platform | Evergreen browsers; Linux/container host |
| Project type | Web application (frontend + backend) |
| Performance goals | Project search/filter < 2s for 1,000 issues; instant perceived loads |
| Constraints | Keyboard-accessible, no silent data loss, secrets never logged |
| Scale/scope | ~25 members/workspace, ~1,000 issues/project, single node |