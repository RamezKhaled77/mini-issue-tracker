# Mini Issue Tracker

A web app for small teams to track issues across workspaces and projects.
Built with a React SPA, an Express API, and SQLite (Drizzle ORM).

- **Backend**: Express 5 + Drizzle ORM + better-sqlite3 (SQLite WAL), Argon2id
  password hashing, signed session cookies, zod validation
- **Frontend**: React 18 + Vite + React Router
- **Shared**: cross-layer TypeScript types (`@mini-issue-tracker/shared`)
- **Tests**: Vitest + supertest (integration), React Testing Library
  (component), axe-core (accessibility)

## Features

- Sign up / sign in / sign out
- Workspaces with join invitations and owner-managed membership
- Projects (create, rename, delete)
- Issues with title, description, status, priority, assignee, labels, and due date
- Comments on issues
- Search and filter issues within a project (title/description, status,
  priority, assignee, label)
- Per-workspace dashboard counts by status and priority
- My Issues — cross-workspace assigned workload (open/in-progress/overdue
  counts plus a searchable ledger of the user's assigned issues)

## Requirements

- Node.js 22 LTS and npm
- Linux/macOS (SQLite is file-based; WSL works on Windows)
- No external services required

## Setup

```sh
npm install

# Create your environment file and set a long random SESSION_SECRET
cp .env.example .env

# Apply database migrations (also runs automatically on server start)
npm run db:migrate
```

## Development

```sh
npm run dev
# Backend API at http://localhost:3000/api
# Frontend SPA at http://localhost:5173
```

## Production build

```sh
npm run build
npm run start -w backend   # serve the built API (dist/app.js)
# Serve frontend/dist with any static host (see quickstart.md)
```

## Tests

```sh
npm test          # backend integration + frontend component tests
npm run test:ui   # frontend component tests (React Testing Library)
npm run test:a11y # accessibility assertions (axe-core)
npm run lint      # ESLint across all workspaces
npm run typecheck # TypeScript checks across all workspaces
```

## Project structure

```
backend/   Express API, Drizzle schema + migrations, services, routes
frontend/  React SPA (pages, components, auth context, api client)
shared/    Shared TypeScript types and constants
specs/     Spec Kit artifacts (spec, plan, data-model, contracts, tasks)
```

## Validation

See `specs/001-mini-issue-tracker/quickstart.md` for end-to-end validation
scenarios covering every user story.

## Troubleshooting

- **Port in use**: adjust `PORT` in `.env`.
- **Migrations not applied**: run `npm run db:migrate`; check `DB_PATH`.
- **Login rate-limited**: wait for the rate-limit window to reset.
