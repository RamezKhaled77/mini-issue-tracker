# Implementation Plan: User Display Name — Mini Issue Tracker

**Branch**: `003-user-display-name` | **Date**: 2026-08-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-user-display-name/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Add a single persistent **display name** to each user account in Mini Issue
Tracker. The name is captured at signup, stored on the user record (nullable
column, never backfilled for legacy users), and returned in every safe user
representation. A deterministic email-local-part fallback is derived at
presentation time for legacy users and is never persisted. The display name
becomes a single reusable identity primitive (`{ id, name }`) surfaced as the
issue assignee, comment author, workspace member, header identity, and initials
avatar.

Technical approach: extend the existing SQLite/Drizzle users table with a
nullable `name` column via a new SQL migration (auto-applied by the existing
`runMigrations` runner, numeric prefix `0002_*`). Thread `name` through the
domain entity, auth service/validators, session middleware, and shared `User`
type. Enrich issue/comment/member API payloads with nested additive identity
fields (`assignee`, `author`) using LEFT JOINs into `users`, preserving
`assigneeId`/`authorId`. Compute the email-local-part fallback server-side at
serialization time through a single shared helper. On the frontend, add a
"Full name" field to signup and display names in the header, assignee picker,
issue list, issue detail, comment authors, and a new initials `Avatar`
component. No new runtime dependencies. Design decisions are resolved in
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Node.js 22 LTS, Express 5, Vite 5 (existing, unchanged)

**Primary Dependencies**: No new dependencies. Existing: Express 5 + Drizzle ORM 0.33 + better-sqlite3, zod (validation), argon2 (hashing); React 18 + Vite + React Router; plain CSS with design tokens from feature 002.

**Storage**: SQLite via better-sqlite3 + Drizzle ORM. Schema in
`backend/src/db/schema.ts`; migrations as SQL files in
`backend/src/db/migrations/` applied automatically at server open by
`runMigrations` (`backend/src/db/migrate.ts`, versioned by numeric prefix via
`PRAGMA user_version`). Feature adds `0002_user_display_name.sql`.

**Testing**: Vitest + supertest (backend integration/unit), React Testing
Library (frontend component), vitest-axe / axe-core (accessibility). All
existing suites must stay green; extended per spec.

**Target Platform**: Linux/macOS server; evergreen browsers at desktop/tablet/mobile widths (feature 002).

**Project Type**: web application (React SPA + Express REST API + shared TS types workspace).

**Performance Goals**: No regression (NFR-002). Feature 001 SC-004: project
search/filter < 2s for ~1,000 issues; lists remain paginated. Adding LEFT JOINs
into `users` (PK lookups) must not breach this budget.

**Constraints**: Additive schema/API changes only; `name` nullable and never
backfilled; fallback is presentation-time only, never persisted; backend
validation authoritative (`name` required at signup, max 100); WCAG AA +
keyboard on touched surfaces; no auth/session/business-rule changes; no new
dependencies (constitution).

**Scale/Scope**: ~25 members/workspace, ~1,000 issues/project, ~10
workspaces/user. Touched: 1 table (add 1 nullable column), shared `User`/`Issue`/`Comment` types + identity type, 3 services (auth, issue, comment), membership list, session middleware, auth validators, signup page, header, issue form, issue page, workspace page, new Avatar component, and ~15 test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Simplicity First | PASS | One nullable column + one shared identity helper + additive payload fields; no new tables, no backfill machinery, no new deps |
| II. Modular & Maintainable Design | PASS | Name threads through existing modules (domain → services → routes); one shared identity helper reused across issue/comment/member/auth surfaces |
| III. Type Safety & Consistency | PASS | Shared `User`, `Identity`, `Issue.assignee`, `Comment.author` types added once and used by backend + frontend; no conflicting shapes |
| IV. Security by Default | PASS | `passwordHash`/session secrets never exposed; nested identity built from safe projections; name validated as untrusted input |
| V. Test Critical Behavior | PASS | Backend asserts identity fields + no-passwordHash + fallback; frontend asserts name rendering, initials, keyboard a11y |
| VI. User Experience & Accessibility | PASS | Names replace raw UUIDs/emails; accessible name field + decorative-avatar semantics; axe + keyboard suites extended |
| VII. Requirements Before Implementation | PASS | Full spec approved with requirements; this plan precedes any code |
| VIII. No Silent Assumptions | PASS | Legacy fallback behavior, required-at-signup, max-100, member-shape asymmetry all documented as decided |
| IX. Explicit Decisions | PASS | Fallback location (server-side), identity shape, migration form, initials algorithm recorded in research.md with alternatives |
No gate violations. Complexity Tracking left empty (no unjustified
complexity).

**Post-Phase 1 re-check**: The design (research decisions, data model, identity
contract, API deltas, quickstart) was reviewed against every principle again
after Phase 1. No new violations surfaced:

- I. Simplicity First: one nullable column, one backend helper
  (`resolveDisplayName`), one frontend util (`initialsFromName`) + an `Avatar`
  component; zero new dependencies; no backfill machinery (research.md §1–§6).
- II. Modular & Maintainable Design: name threads existing modules
  (domain → services → routes → shared → frontend); the identity helper is a
  pure function reused across auth, session, issue, comment, and membership
  surfaces (research.md §1–§5).
- III. Type Safety & Consistency: shared `User`, `Identity`,
  `Issue.assignee`, `Comment.author`, `WorkspaceMember` added once and consumed
  by both ends; no conflicting shapes (data-model.md, contracts/api.md).
- IV. Security by Default: `passwordHash`/session secrets never in responses;
  nested identity built from safe projections (LEFT JOIN selects only
  id/name/email); name validated as untrusted input (contracts/api.md,
  contracts/identity.md).
- V. Test Critical Behavior: backend asserts identity fields, no-passwordHash,
  fallback; frontend asserts name rendering, initials, and keyboard a11y
  (research.md §10, quickstart scenarios 2/7/8/9).
- VI. User Experience & Accessibility: names replace raw UUIDs/emails; Full
  name field follows existing focus/alert patterns; decorative-vs-announced
  avatar semantics (contracts/identity.md, quickstart scenario 9).
- VII. Requirements Before Implementation: every contract/quickstart item
  traces to a spec FR/SC (spec.md FR-001…FR-014, SC-001…SC-008).
- VIII. No Silent Assumptions: fallback location, required-at-signup, max-100,
  member-shape asymmetry, and avatar a11y are all recorded as decided with
  rationale (research.md, contracts/identity.md, spec assumptions).
- IX. Explicit Decisions: all choices (server-side fallback, LEFT JOIN
  enrichment, SQL migration form, initials algorithm) recorded with alternatives
  in research.md.

## Project Structure

### Documentation (this feature)

```text
specs/003-user-display-name/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── api.md           # API contract deltas (identity fields)
│   └── identity.md      # reusable identity primitive contract
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── schema.ts              # ADD nullable `name` to users table
│   │   └── migrations/
│   │       └── 0002_user_display_name.sql   # NEW: ALTER TABLE users ADD COLUMN name TEXT
│   ├── domain/
│   │   └── user.ts                # UserEntity.name: string | null; createUserRecord gains name
│   ├── lib/
│   │   └── identity.ts            # NEW: resolveDisplayName(name, email) shared helper
│   ├── api/
│   │   ├── middleware/session.ts  # SessionUser gains name; select + resolve
│   │   └── validators/auth.ts     # signupSchema gains name (trim/min/max 100)
│   └── services/
│       ├── auth.ts                # signup(name,…); AuthResult.user.name; createSession selects name
│       ├── issue.ts               # assignee identity via LEFT JOIN users (get/list/create/update)
│       ├── comment.ts             # author identity via LEFT JOIN users (add/list)
│       └── membership.ts          # listMembers returns { userId, email, name }
└── tests/
    ├── helpers.ts                 # signupAs gains optional name param
    ├── api.test.ts                # signup payloads + assert user.name
    ├── integration/{issues,comments,workspaces}.test.ts  # assert assignee/author/member identity
    ├── integration/performance.test.ts                   # local signup includes name
    └── unit/security.test.ts      # raw signup payloads include name
    # NEW assertions: signup w/o name → 422; passwordHash never in responses

shared/
└── index.ts                       # User.name: string; Identity { id, name };
                                   # Issue.assignee: Identity | null; Comment.author: Identity;
                                   # WorkspaceMember { userId, email, name }; SignupRequest.name

frontend/
├── src/
│   ├── components/
│   │   ├── Avatar.tsx             # NEW: initials avatar (decorative/accessible)
│   │   ├── Layout.tsx             # header shows user.name (+ optional email secondary)
│   │   └── IssueForm.tsx          # assignee dropdown lists member names
│   ├── pages/
│   │   ├── SignupPage.tsx         # add "Full name" field (order: name, email, password, confirm)
│   │   ├── IssuePage.tsx          # assignee.name / author.name instead of raw UUIDs
│   │   └── WorkspacePage.tsx      # issue cards show assignee name
│   ├── context/auth.tsx           # signup(name, email, password)
│   └── lib/
│       └── initials.ts            # NEW: initialsFromName(name)
└── tests/
    ├── component/
    │   ├── auth.test.tsx          # fill Full name; signup mock payloads include name
    │   ├── issue-page.test.tsx    # mock issue/comment payloads gain identity; assert names
    │   └── workspace-page.test.tsx# mock payloads gain assignee identity
    └── accessibility/core.test.tsx# payloads gain identity; name fields a11y
    # NEW: header name, issue list assignee, initials derivation, fallback behavior
```

**Structure Decision**: Keep the existing workspace structure (backend/frontend/shared). The feature is a vertical slice threading `name` through every existing layer, so no new project/package is needed — only a small shared `identity` helper in the backend, a frontend `initials` util, and a new `Avatar` component. This honors the constitution's deferral of technology choice to planning (no new deps chosen in research.md) and keeps modules cohesive.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Not applicable.