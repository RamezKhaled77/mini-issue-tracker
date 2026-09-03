# Mini Issue Tracker — Project Overview

## 1. Project Summary

Mini Issue Tracker is a web application for small teams to track issues across workspaces and projects. It provides:

- **Authentication**: Sign up, sign in, sign out with Argon2id password hashing and signed session cookies
- **Workspaces**: Create workspaces, invite members via join tokens, owner-managed membership
- **Projects**: Create, rename, and delete projects within a workspace
- **Issues**: Create, read, update, delete issues with title, description, status, priority, assignee, labels, and due date
- **Comments**: Add comments to issues with @mentions
- **Activity history**: Chronological audit trail of issue changes
- **Labels**: Workspace-scoped labels with fixed color palette
- **Search**: Global search across all issues
- **Saved views**: Persisted filter configurations per workspace
- **My Issues**: Cross-workspace assigned workload with counts and searchable ledger
- **Dashboard**: Per-workspace status and priority counts
- **Bulk actions**: Set status, priority, assign, add/remove labels, or delete multiple issues

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript (all workspaces) |
| **Backend** | Express 5, Drizzle ORM, better-sqlite3 (SQLite WAL) |
| **Frontend** | React 18, Vite, React Router 6, Tailwind CSS 4 |
| **Shared** | Zod (runtime validation), shared TypeScript types |
| **Auth** | Argon2id password hashing, signed session cookies |
| **Testing** | Vitest (unit + integration), supertest (backend integration), React Testing Library (frontend), axe-core (accessibility) |
| **Linting** | ESLint 8 + @typescript-eslint |
| **Formatting** | Prettier |
| **Build** | tsc (TypeScript), Vite (frontend bundling) |
| **Runtime** | Node.js ≥ 20 |
| **Package manager** | npm (workspaces) |

## 3. Project Structure

```
mini-issue-tracker/
├── backend/                  Express API server
│   ├── src/
│   │   ├── app.ts            Express app factory & server bootstrap
│   │   ├── config.ts         Environment configuration loader
│   │   ├── db/
│   │   │   ├── client.ts     Drizzle ORM client + SQLite setup
│   │   │   ├── migrate.ts    Custom migration runner (user_version based)
│   │   │   ├── schema.ts     Drizzle ORM table definitions + relations
│   │   │   └── migrations/   SQL migration files (0001–0007)
│   │   ├── api/
│   │   │   ├── routes/       Express route handlers (auth, issues, workspaces, etc.)
│   │   │   ├── middleware/   Security, session, error handler
│   │   │   └── validators/   Zod validation schemas per resource
│   │   ├── services/         Business logic layer
│   │   ├── domain/           Entity constructors (pure data factories)
│   │   ├── lib/              Utilities (identity, labels, etc.)
│   │   └── tests/            Backend tests (unit + integration)
│   └── package.json
├── frontend/                 React SPA
│   ├── src/
│   │   ├── main.tsx          Entry point (ReactDOM root)
│   │   ├── App.tsx           Route definitions + Protected route wrapper
│   │   ├── api/client.ts     HTTP client (fetch wrapper + ApiError)
│   │   ├── context/auth.tsx  React auth context (user state + auth actions)
│   │   ├── components/       Reusable UI components (LedgerRow, FactRail, etc.)
│   │   ├── pages/            Page-level components (Dashboard, Issue, Workspace, etc.)
│   │   ├── lib/              Utilities (shortcuts, URL filters, workspace cache)
│   │   ├── styles/           CSS files (tokens, base, layout, ledger, overlays, pages)
│   │   └── tests/            Frontend tests (component + accessibility)
│   └── package.json
├── shared/                   Cross-layer TypeScript types + constants
│   └── index.ts              Exports all shared types, constants, validators
├── specs/                    Spec Kit artifacts (spec, plan, data-model, contracts, tasks)
├── scripts/                  Audit/playwright scripts
├── test-results/             Test result storage
└── package.json              Root workspace config
```

## 4. Core Modules / Components

### Backend

| Module | Responsibility |
|--------|---------------|
| **`app.ts`** | Creates the Express app, wires middleware (security, session, JSON), registers routes |
| **`config.ts`** | Loads environment variables; validates production requirements |
| **`db/client.ts`** | Creates the Drizzle ORM client over better-sqlite3; runs migrations on open |
| **`db/schema.ts`** | Drizzle ORM table definitions with relations (18 tables) |
| **`db/migrate.ts`** | Custom migration runner using `user_version` pragma |
| **`api/routes/*.ts`** | Express route handlers for each resource (auth, issues, workspaces, projects, comments, labels, dashboard, myIssues, activities, search, savedViews) |
| **`api/middleware/session.ts`** | Signed cookie session management |
| **`api/middleware/security.ts`** | Helmet, CORS, rate limiting |
| **`api/middleware/error-handler.ts`** | Centralized error handling (ApiError → JSON response) |
| **`api/validators/*.ts`** | Zod schemas for request validation |
| **`services/*.ts`** | Business logic (auth, issue, workspace, project, comment, label, dashboard, membership, myIssues, activity, search, savedView) |
| **`domain/*.ts`** | Pure entity constructors (issue, user, activity, comment, etc.) |
| **`lib/identity.ts`** | Display name resolution |
| **`lib/labels.ts`** | Label map builder |

### Frontend

| Module | Responsibility |
|--------|---------------|
| **`main.tsx`** | Entry point — renders `<App>` inside `<AuthProvider>` and `<BrowserRouter>` |
| **`App.tsx`** | Route definitions with protected routes |
| **`context/auth.tsx`** | Auth context providing user, loading, signin/signup/signout |
| **`api/client.ts`** | Typed HTTP client wrapping fetch; exports `api` object and `ApiError` |
| **`components/LedgerRow.tsx`** | Canonical ticket ledger row (used by all surfaces) |
| **`components/FactRail.tsx`** | Structured fact-sheet component for issue detail |
| **`components/Layout.tsx`** | App shell with sidebar/navigation |
| **`components/WorkspaceSwitcher.tsx`** | Workspace selector popover |
| **`components/FilterBar.tsx`** | Search/filter/sort control bar |
| **`components/BulkToolbar.tsx`** | Bulk selection action toolbar |
| **`components/PageHeader.tsx`** | Issue page masthead (breadcrumb, key, title, metadata, actions) |
| **`components/ConfirmDialog.tsx`** | Destructive action confirmation dialog |
| **`components/Dialog.tsx`** | Generic dialog with focus trap |
| **`pages/*.tsx`** | Page-level components for each route |
| **`styles/tokens.css`** | All design tokens (colors, spacing, typography, radii) |
| **`styles/ledger.css`** | Ticket ledger row styles (the visual signature) |

### Shared

| Module | Responsibility |
|--------|---------------|
| **`shared/index.ts`** | All shared types (User, Issue, Comment, Activity, Label, SavedView, etc.), constants (ISSUE_STATUSES, ISSUE_PRIORITIES, LABEL_COLORS), Zod schemas, and API shape contracts |

## 5. Entry Points

### Backend
- **File**: `backend/src/app.ts` (lines 74–80)
- **How it starts**: When run directly (`node dist/app.js` or `tsx watch src/app.ts`), it calls `createApp()` and starts an HTTP server on the configured `PORT` (default 3000).
- **Exports**: `createApp()` factory function for programmatic use (e.g., in tests).

### Frontend
- **File**: `frontend/src/main.tsx`
- **How it starts**: `npm run dev` → Vite dev server on port 5173. `main.tsx` renders the React tree: `BrowserRouter > AuthProvider > App`.
- **Production build**: `npm run build` → outputs to `frontend/dist/`.

## 6. Data Flow / Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  React SPA  │────▶│  Express API │────▶│  Drizzle ORM    │────▶│  SQLite (WAL)│
│  :5173      │     │  :3000       │     │  (backend/src/  │     │  (app.db)    │
│             │     │              │     │   db/schema.ts) │     │              │
└─────────────┘     └──────────────┘     └─────────────────┘     └──────────────┘
      │                   │                      │
      │  HTTP/JSON        │  Drizzle queries     │  better-sqlite3
      │  (fetch)          │  (ORM)               │  (SQLite driver)
      ▼                   ▼                      ▼
  AuthContext        Services               Schema +
  (user state)       (business logic)       Migrations
```

**Frontend → Backend**:
1. User interacts with React components
2. Components call `api.*` methods in `frontend/src/api/client.ts`
3. HTTP requests go to `/api/*` (proxied via Vite in dev, direct in production)
4. Session cookie sent with each request

**Backend → Database**:
1. Express routes call service functions
2. Services validate permissions (membership checks) and business rules
3. Services call Drizzle ORM queries against the schema
4. Drizzle translates to SQL executed via better-sqlite3 on SQLite WAL

**Auth flow**:
1. Signup → Argon2 hash password → create user → create session → signed cookie
2. Signin → verify password → create session → signed cookie
3. Subsequent requests → session cookie parsed → session looked up → user attached to `req.user`

**Shared types**: Both frontend and backend import `@mini-issue-tracker/shared` for type safety across the stack.

## 7. Database / Models

The app uses **SQLite** (file-based, WAL mode) via **Drizzle ORM**. The schema is defined in `backend/src/db/schema.ts` and migrations live in `backend/src/db/migrations/`.

### Tables

| Table | Purpose | Key Relations |
|-------|---------|---------------|
| `users` | User accounts (email, password hash, name) | — |
| `sessions` | Signed session cookies | `user_id` → users |
| `workspaces` | Workspace containers | `owner_id` → users |
| `memberships` | User ↔ workspace membership | `user_id` → users, `workspace_id` → workspaces |
| `invitations` | Workspace join invitations | `workspace_id` → workspaces |
| `projects` | Projects within a workspace | `workspace_id` → workspaces |
| `issues` | Core issue records | `project_id` → projects, `assignee_id` → users |
| `comments` | Comments on issues | `issue_id` → issues, `author_id` → users |
| `comment_mentions` | @mentions in comments | `comment_id` → comments, `mentioned_user_id` → users |
| `labels` | Workspace labels (violet, magenta, indigo, olive, sand, plum) | `workspace_id` → workspaces |
| `issue_labels` | Issue ↔ label many-to-many | `issue_id` → issues, `label_id` → labels |
| `activities` | Audit trail of issue changes | `issue_id` → issues, `actor_id` → users |
| `saved_views` | Persisted filter configurations | `workspace_id` → workspaces, `created_by_id` → users |

### Key Relationships
- Users can own many workspaces and belong to many workspaces via memberships
- Workspaces contain projects, issues, labels, invitations, saved views
- Projects contain issues
- Issues have comments, labels, activities, and an assignee
- Comments can mention users

## 8. APIs / Endpoints

All API routes are prefixed with `/api`. Authentication required for all endpoints (except auth routes).

### Auth
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/signup` | Create account + session |
| POST | `/api/auth/signin` | Sign in + session |
| POST | `/api/auth/signout` | Sign out + clear cookie |
| GET | `/api/auth/me` | Get current user |

### Workspaces
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces` | List workspaces |
| GET | `/api/workspaces/:id` | Get workspace |
| POST | `/api/workspaces/:id/invitations` | Create join invitation |
| POST | `/api/workspaces/join` | Join workspace via token |
| GET | `/api/workspaces/:id/members` | List members |
| DELETE | `/api/workspaces/:id/members/:userId` | Remove member |

### Projects
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/workspaces/:workspaceId/projects` | Create project |
| GET | `/api/workspaces/:workspaceId/projects` | List projects |
| PATCH | `/api/projects/:id` | Rename project |
| DELETE | `/api/projects/:id` | Delete project |

### Issues
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/projects/:projectId/issues` | Create issue |
| GET | `/api/projects/:projectId/issues` | List issues (search/filter/paginate) |
| GET | `/api/issues/:id` | Get issue |
| PATCH | `/api/issues/:id` | Update issue |
| POST | `/api/issues/bulk` | Bulk update issues |
| DELETE | `/api/issues/:id` | Delete issue |

### Comments
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/issues/:issueId/comments` | Add comment |
| GET | `/api/issues/:issueId/comments` | List comments |

### Labels
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/workspaces/:workspaceId/labels` | Create label |
| GET | `/api/workspaces/:workspaceId/labels` | List labels |
| PATCH | `/api/labels/:id` | Update label |
| DELETE | `/api/labels/:id` | Delete label |

### Dashboard
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/workspaces/:id/dashboard` | Get workspace stats |

### My Issues
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/my-issues` | Get cross-workspace assigned issues |

### Activities
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/issues/:id/activity` | List activity history |

### Search
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/search` | Global issue search |

### Saved Views
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/workspaces/:workspaceId/views` | Create saved view |
| GET | `/api/workspaces/:workspaceId/views` | List saved views |
| PATCH | `/api/views/:id` | Update saved view |
| DELETE | `/api/views/:id` | Delete saved view |

## 9. Environment Variables & Configuration

All configuration is loaded from `.env` (root and `backend/.env`). Defaults are provided in `config.ts`.

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | Backend server port |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Frontend origin for CORS |
| `DB_PATH` | `./data/app.db` | SQLite database file path |
| `SESSION_SECRET` | _(required)_ | Long random secret for signed cookies; throws in production if default |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `300000` | Rate limit window for login attempts (ms) |
| `LOGIN_RATE_LIMIT_MAX` | `5` | Max login attempts per window |
| `SESSION_TTL_MS` | `604800000` (7 days) | Session time-to-live |

**Configuration files**:
- `.env` / `.env.example` — environment variables
- `backend/tsconfig.json`, `frontend/tsconfig.json`, `tsconfig.base.json` — TypeScript configs
- `frontend/vite.config.ts` — Vite config (dev proxy, build)
- `frontend/tailwind.config.js` — Tailwind CSS config
- `frontend/postcss.config.cjs` — PostCSS config
- `.prettierrc.json`, `.prettierignore` — Prettier config
- `eslint.config.cjs` — ESLint config
- `.npmrc` — npm configuration

## 10. Dependencies Between Modules

```
frontend ──▶ @mini-issue-tracker/shared ◀── backend
     │                        │
     │  api/client.ts         │  db/schema.ts
     │  context/auth.tsx      │  services/*.ts
     │  pages/*.tsx          │  domain/*.ts
     │                       │
     │  ◀── HTTP/JSON ──────▶│
     │                        │
     │  shared types          │  shared types + Zod schemas
```

**Key dependency relationships**:

- **`frontend` ↔ `backend`**: Communicates exclusively via HTTP/JSON at `/api/*`. The shared package provides types for both sides.
- **`backend` → `shared`**: Backend imports shared types and Zod schemas for request/response validation and domain definitions.
- **`frontend` → `shared`**: Frontend imports shared types for type-safe API calls and constants for UI rendering.
- **Services layer**: Each service (`issueService`, `workspaceService`, etc.) is instantiated in `api/routes/index.ts` and injected into route handlers. Services depend on `db` and other services (e.g., `issueService` depends on `membershipService`, `projectService`, `activityService`).
- **Routes → Services → Domain → DB**: Clean layered architecture. Routes validate input, services contain business logic, domain modules create entities, DB layer persists.
- **Membership propagation**: Most resource operations require membership checks. Services call `membershipService.requireMember()` to verify the user belongs to the workspace.

## 11. Known Issues / TODOs / Technical Debt

- **No automated test runner in CI**: Tests are run manually via `npm test`. No CI configuration file detected.
- **Migration system is custom, not Drizzle Kit**: The project uses a custom `runMigrations()` in `migrate.ts` that reads SQL files and applies them based on `user_version`. `drizzle-kit push` is also available as a script. These two systems could diverge.
- **TypeScript strictness**: The `tsconfig.base.json` may have relaxed settings; the project uses `tsc --noEmit` for type checking but no explicit `strict` mode confirmation in the base config.
- **No API versioning**: All endpoints are at `/api/*` with no version prefix.
- **Session storage in SQLite**: Sessions are stored in the same SQLite database as application data — not separated.
- **Global state in `lib/workspaceCache.ts`**: Frontend has a workspace cache that may not always be synchronized with the server.
- **Spec artifacts in `specs/`**: The `specs/` directory contains 12 feature specs (001–012) that are development artifacts, not production code.
- **`.opencode/` directory**: Contains opencode agent configuration and speckit commands — these are development tooling, not application code.
- **`inspiration & references/`**: Contains reference screenshots for the visual design.
- **`scripts/`**: Contains playwright audit scripts and UI audit scripts — not part of the core application.

## 12. How to Run the Project

### Prerequisites
- Node.js ≥ 22 LTS
- npm
- Linux/macOS (SQLite is file-based; WSL works on Windows)

### Setup

```sh
# 1. Install all dependencies across workspaces
npm install

# 2. Create environment file
cp .env.example .env

# 3. Edit .env and set SESSION_SECRET to a long random value
#    (default "change-me-to-a-long-random-secret" is for dev only)

# 4. Apply database migrations (also runs automatically on server start)
npm run db:migrate
```

### Development

```sh
# Start both backend and frontend in dev mode
npm run dev
# Backend API at http://localhost:3000/api
# Frontend SPA at http://localhost:5173
```

Or run individually:

```sh
# Backend only (port 3000)
npm run dev -w backend

# Frontend only (port 5173)
npm run dev -w frontend
```

### Production Build

```sh
# Build all workspaces
npm run build

# Start the built backend API
npm run start -w backend
# Serves at PORT (default 3000)

# Serve frontend/dist with any static host
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both backend and frontend in dev mode |
| `npm run build` | Build all workspaces (shared → backend → frontend) |
| `npm run start -w backend` | Start the built backend |
| `npm run db:migrate` | Run database migrations |
| `npm test` | Run backend integration tests + frontend component tests |
| `npm run test:ui` | Run frontend component tests |
| `npm run test:a11y` | Run accessibility tests |
| `npm run lint` | ESLint across all workspaces |
| `npm run typecheck` | TypeScript checks across all workspaces |

## 13. Testing

### Backend Tests
- **Framework**: Vitest (node environment)
- **Location**: `backend/tests/`
  - `tests/api.test.ts` — API integration tests with supertest
  - `tests/integration/` — Integration tests for all major features (issues, comments, labels, workspaces, projects, dashboard, search, saved views, activities, my-issues, bulk-issues, comments, performance)
  - `tests/unit/` — Unit tests for services, validators, migrations, security, search
  - `tests/helpers.ts` — Test helpers
- **Run**: `npm run test -w backend` or `cd backend && npx vitest run`
- **Watch mode**: `cd backend && npx vitest`

### Frontend Tests
- **Framework**: Vitest (jsdom environment) + React Testing Library + @testing-library/user-event
- **Location**: `frontend/tests/`
  - `tests/component/` — Component tests for all UI components and pages
  - `tests/accessibility/` — Accessibility tests using axe-core
  - `tests/setup.ts` — Test setup file
- **Run**: `npm run test -w frontend` or `cd frontend && npx vitest run`
- **Accessibility**: `npm run test:a11y` runs `vitest run tests/accessibility`
- **Watch mode**: `cd frontend && npx vitest`

### Shared Tests
- No dedicated test directory for the shared package. Shared types are validated through TypeScript compilation (`npm run typecheck`).

### Test Tools
- **supertest**: Used for backend HTTP integration testing
- **React Testing Library**: Used for frontend component testing
- **axe-core**: Used for accessibility assertions
- **jsdom**: Frontend test environment simulation
