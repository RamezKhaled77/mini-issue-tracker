# Implementation Plan: Mini Issue Tracker

**Branch**: `001-mini-issue-tracker` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-mini-issue-tracker/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Build a web-based issue tracker for small teams. Users sign in with email and
password, create or join workspaces (owner controls membership; all members
manage projects/issues), organize work into projects, and track issues
(title, description, status Open/In Progress/Closed, priority Low/Medium/High/
Urgent, assignee, labels, due date). Users can comment on issues, search and
filter within a project, and view a workspace dashboard of issue statistics.
Auth is session-based; invitations work only for existing signed-in users.
Out of scope: real-time collaboration, notifications, file uploads, billing,
third-party integrations, AI.

Technical approach: a full-stack TypeScript web application — an Express API
with a typed SQLite data layer (Drizzle ORM) and a React SPA, deployed as a
single process. Technology decisions are resolved in [research.md](research.md)
per the constitution's deferral of technology choices to the planning phase.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 22 LTS) for backend and frontend

**Primary Dependencies**: Express 5 (API), Drizzle ORM + better-sqlite3
(storage), React 18 + Vite (frontend), zod (validation), argon2 or bcrypt
(password hashing)

**Storage**: SQLite (WAL mode) via better-sqlite3, accessed through Drizzle ORM

**Testing**: Vitest (unit + integration), React Testing Library (component),
axe-core (accessibility assertions)

**Target Platform**: Modern evergreen browsers; Linux/container host (single
process serving both API and built frontend assets)

**Project Type**: web application (frontend + backend)

**Performance Goals**: Project search/filter under 2s for 1,000 issues
(SC-004); page loads perceived as instant for a 25-member team

**Constraints**: Keyboard-only navigation and screen-reader readable
(SC-006); no silent data loss; secrets never committed or logged

**Scale/Scope**: ~25 members/workspace, ~1,000 issues/project, ~10 workspaces
per user; single-node deployment is sufficient

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Simplicity First | PASS | Single process, SQLite, minimal service layer; no message queues or microservices |
| II. Modular & Maintainable Design | PASS | Backend/frontend split; domain layer independent of storage/UI |
| III. Type Safety & Consistency | PASS | TypeScript end-to-end; zod-validated schemas; Drizzle typed queries |
| IV. Security by Default | PASS | Session auth, hashed passwords, validation/sanitization, least privilege (owner/member) |
| V. Test Critical Behavior | PASS | Tests target persistence, auth/permissions, contracts (SC-004, SC-006) |
| VI. User Experience & Accessibility | PASS | WCAG AA via axe-core; keyboard navigation baked into stories |
| VII. Requirements Before Implementation | PASS | Spec exists with all requirements and clarifications before this plan |
| VIII. No Silent Assumptions | PASS | Assumptions documented in spec; validation fails loudly on bad input |
| IX. Explicit Decisions | PASS | Tech decisions documented in research.md with rationale and alternatives |

No gate violations. Complexity Tracking is left empty (no unjustified
complexity).

**Post-Phase 1 re-check**: The design (data model, API contract, research
decisions) was reviewed against every principle again after Phase 1. No new
violations surfaced:

- I. Simplicity First: single process, one SQLite file, minimal dependency set
  (research.md §1–§9). No microservices, queues, or caches added.
- II. Modular & Maintainable Design: domain layer (`backend/src/domain`) is
  independent of storage (Drizzle) and UI (React SPA); shared types in
  `shared/` keep boundaries stable.
- III. Type Safety & Consistency: TypeScript end-to-end, zod schemas on every
  API boundary, Drizzle typed queries; no conflicting representations across
  layers.
- IV. Security by Default: session auth with HttpOnly/Secure/SameSite cookies,
  Argon2id hashing, login rate limiting, allowlisted fields, membership-scoped
  queries (contracts/api.md). Owner-only actions enforced server-side
  (FR-003a).
- V. Test Critical Behavior: tests target persistence, auth/permissions, API
  contracts, and accessibility (quickstart.md §run tests).
- VI. User Experience & Accessibility: WCAG AA via axe-core; keyboard
  navigation covered in quickstart scenario 8.
- VII. Requirements Before Implementation: every entity/field and endpoint
  traces to a spec FR or user story.
- VIII. No Silent Assumptions: zod validation fails loudly; scale/edge
  assumptions documented in data-model.md.
- IX. Explicit Decisions: all tech choices recorded in research.md with
  rationale and alternatives; clarification decisions (status/priority,
  invitations, permissions, search scope) recorded in spec.md.

## Project Structure

### Documentation (this feature)

```text
specs/001-mini-issue-tracker/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── schema.ts          # Drizzle table definitions
│   │   └── migrations/        # SQL migration files
│   ├── domain/                # entities, validation, business rules
│   ├── services/              # auth, workspace, project, issue use cases
│   ├── api/
│   │   ├── routes/            # HTTP route definitions
│   │   ├── middleware/        # auth/session, error handling
│   │   └── validators/        # zod request schemas
│   └── app.ts
└── tests/
    ├── unit/
    ├── integration/
    └── accessibility/

frontend/
├── src/
│   ├── components/
│   ├── pages/                 # auth, workspace, project, issue, dashboard
│   ├── api/                   # typed API client
│   └── styles/
└── tests/
    ├── component/
    └── accessibility/

shared/                        # types shared between backend and frontend
└── types/
```

**Structure Decision**: Full-stack TypeScript monorepo with `backend/`
(Express API + SQLite) and `frontend/` (React SPA) sharing `shared/` types.
Domain rules live in `backend/src/domain` and are exposed through typed API
contracts ([contracts/api.md](contracts/api.md)); storage stays behind Drizzle
so the domain is storage-independent per Principle II. This honors the
constitution's deferral of technology to planning while keeping a single
language for type safety (Principle III).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Not applicable.