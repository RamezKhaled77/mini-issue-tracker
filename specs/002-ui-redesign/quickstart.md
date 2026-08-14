# Quickstart: UI Redesign Validation Guide

**Branch**: `002-ui-redesign` | **Date**: 2026-08-15

This guide validates the redesigned presentation layer end-to-end. It is a
run/validation guide only; implementation detail lives in tasks.md and the
codebase. The data model and API contract are unchanged from
[feature 001](../001-mini-issue-tracker/); the design contract is
[contracts/design-system.md](contracts/design-system.md).

## Prerequisites

- Existing repo state (feature 001 implemented) with Node.js 22 LTS and npm.
- No new dependencies are installed by this feature.

## Setup

```sh
npm install
cp .env.example .env   # set SESSION_SECRET
npm run db:migrate
```

## Start the application

```sh
npm run dev
# Backend API at http://localhost:3000/api
# Frontend SPA at http://localhost:5173
```

## Run the test suites

```sh
npm test            # backend + frontend (must stay green — no behavior change)
npm run test:ui     # component tests (React Testing Library)
npm run test:a11y   # accessibility assertions (axe-core) — extended to new surfaces
npm run lint
npm run typecheck
```

## Validation scenarios (end-to-end)

### 1. Functional non-regression (SC-001, SC-002)

Repeat every scenario in
[feature 001 quickstart](../001-mini-issue-tracker/quickstart.md) against the
redesigned UI:

1. Sign up / sign in / sign out → same behavior.
2. Create workspace, generate invitation, join as a second user → same behavior;
   non-owner cannot generate invitations (`403`).
3. Create / rename / delete project (with confirmation) → same behavior.
4. Create / edit / delete issue with all fields (status, priority, assignee,
   labels, due date) → same behavior and values persist.
5. Add and view comments → same behavior.
6. Search within project; filter by status and priority (combined) → same results.
7. Dashboard counts by status and priority → match current data.

### 2. Redesigned auth flow (FR-011, FR-012)

1. Visit `/login` → centered, clean card; fields labeled; sign-in works.
2. Wrong credentials → accessible error shown (field + alert) and no content
   exposed.
3. Visit `/signup`, mismatch confirm → validation error; valid sign-up signs in.

### 3. App shell & navigation (FR-008–FR-010)

1. On any authenticated page, header shows product identity, user email, sign-out.
2. Click product identity from a workspace → returns to dashboard.
3. From an issue page, back affordance returns to the workspace.
4. Tab from page start → a skip-to-content link is the first focusable element.

### 4. Dashboard & workspaces (FR-013–FR-016)

1. New user with no workspaces → helpful empty state guiding create/join.
2. Create workspace → appears with Owner tag; loading state is a skeleton, not
   "Loading...".
3. Join via invitation token → appears with Member tag.
4. Dashboard statistics render correctly and reflect issue changes.

### 5. Projects (FR-017–FR-019)

1. Empty workspace → "no projects" empty state with a create action.
2. Create project → appears and becomes selected; issue list shows its issues.
3. Select another project → selection visually distinct; issues switch.
4. Rename project → name updates everywhere.
5. Delete project → in-app confirmation dialog (no browser confirm); after
   confirming, project + issues removed; after cancelling, nothing changes.

### 6. Issue list, search & filters (FR-020–FR-026)

1. Issue rows show title + status badge + priority badge.
2. Search narrows within the project only.
3. Status + priority filters combine (AND).
4. Filter result count shown; active filters visually indicated.
5. No matches → "no issues match filters" empty state with a clear-filters action.
6. Project with zero issues → "no issues in this project" empty state.

### 7. Issue detail (FR-027–FR-030)

1. All fields visible: title, description, status, priority, assignee, labels,
   due date.
2. Changing status/priority saves immediately and the view reflects it.
3. Empty assignee/due date render as "Unassigned"/"No due date" (no raw id shown).
4. Comment thread readable; add comment persists; empty thread has an empty state.
5. Delete issue → confirmation dialog; confirming returns to the workspace list.

### 8. Forms & dialogs (FR-031–FR-035)

1. Issue form contains all current fields; create and edit both persist.
2. Required-field validation blocks submission with a clear, accessible message.
3. API field errors map to the correct fields.
4. Every dialog (project create/rename, issue form, delete confirm) traps focus,
   returns focus on close, closes on Escape, and announces its title.
5. Double-submit prevented: submit button disabled while saving.

### 9. Feedback states (FR-035–FR-041)

1. Load a data page → skeleton, no layout shift, then content.
2. Trigger a failing action → consistent, accessible error.
3. Successful create/update → clear, non-disruptive confirmation and updated UI.
4. Delete flows → in-app confirmation with consequences and safe cancel.

### 10. Responsive behavior (FR-042, FR-043, SC-005)

At 1280px, 768px, and 375px widths (browser devtools):

1. No horizontal scrolling on any page.
2. Workspace two-column layout collapses to single column on mobile.
3. Stat grids reflow (3→/4-col → 2-col on mobile).
4. Dialogs render as near-full-screen on mobile.
5. Touch targets are ≥44px on mobile.

### 11. Accessibility (SC-003, SC-004, FR-044–FR-047)

1. Run `npm run test:a11y` → no axe violations on login, signup, dashboard,
   workspace, issue detail, issue form, and dialogs.
2. Complete sign-up → create workspace → create project → create issue → change
   status → add comment → search/filter using keyboard only.
3. Open/close dialogs with keyboard → focus enters the dialog, is trapped, and
   returns to the trigger on close; Escape closes.
4. Enable OS "reduce motion" → skeleton/transitions static or removed.
5. Toggle the browser to viewport widths and high-contrast settings → text remains
   legible; status/priority still identifiable (text + color, SC-006).

### 12. Dark Mode readiness (FR-007, SC-009)

1. Review that components reference only semantic color roles (no raw hex in
   component files) — verified via code review, not runtime.
2. Confirm changing the token values in one place (the light palette) restyles all
   surfaces — a "smoke check" that no component hard-codes colors.

## Expected outcomes

- All feature-001 scenarios still pass (no behavior regression).
- All redesigned-surface scenarios pass; no unhandled errors.
- Test suites (unit, component, a11y), lint, and typecheck are green.
- All acceptance scenarios in [spec.md](spec.md) user stories pass.

## Troubleshooting

- **Port in use**: adjust `PORT` in `.env`.
- **Migrations not applied**: run `npm run db:migrate`; check `DB_PATH`.
- **Component test failures after redesign**: if a query relied on markup/class
  names, update the test to the new accessible structure — this is allowed, but a
  behavioral assertion change is NOT allowed (behavior must not change).