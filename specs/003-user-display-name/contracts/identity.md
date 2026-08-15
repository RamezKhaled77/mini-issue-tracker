# Identity Contract: User Display Name — Mini Issue Tracker

**Branch**: `003-user-display-name` | **Date**: 2026-08-15

Phase 1 output for [plan.md](plan.md). Defines the **single reusable user
identity primitive** introduced by this feature (FR-013), used everywhere a
person is referenced: application header, issue assignee picker, issue list,
issue detail, comment authors, workspace/member UI, and avatar initials.

## Shape

```ts
interface Identity {
  id: string;   // the user id (equals assigneeId / authorId)
  name: string; // resolved display name — always non-empty
}
```

Members additionally surface email (existing flat contract preserved):

```ts
interface WorkspaceMember {
  userId: string;
  email: string;
  name: string;
}
```

## Display-name resolution

The **resolved display name** is computed at serialization time by a single
backend helper `resolveDisplayName(name, email)`:

1. If the stored `name` is a non-null, non-empty string → return it.
2. Otherwise (legacy user) → return the deterministic **email local-part**
   (the characters before the first `@`).

Rules:

- The fallback is a **presentation-time value only**: it is never written to the
  database and never treated as the user's stored display name (FR-012,
  NFR-005, SC-008). The DB `name` column stays `null` for legacy users.
- The API never returns a null/empty `name` in any safe user representation.
- The stored name is trimmed at signup; the email local-part is used as-is
  (deterministic; no further transformation).

## Initials avatar derivation

```ts
initialsFromName(name: string): string
```

1. Split the trimmed name on whitespace and drop empty tokens.
2. Take the first character of the first token; if more than one token, also
   the first character of the last token.
3. Uppercase both and join (max 2 characters).
4. If no tokens remain, return `"?"`.

Rules:

- Must not crash on empty or single-word names.
- The avatar is a pure derivation from the resolved display name; no image
  upload, storage, or external service is involved (FR-011).

## Accessibility contract for avatars

- Beside visible name text (issue detail assignee, comment author, assignee
  picker): the initials are **decorative** — rendered `aria-hidden`, with the
  adjacent text carrying the accessible name.
- As a standalone identity marker (header): the avatar renders with
  `role="img"` and `aria-label={name}` so screen readers announce the person's
  name, not the letters.

## API guarantee

Every endpoint that returns a user, issue, comment, or member returns identity
fields consistent with this contract (see
[api.md](api.md)): auth `user.name`, issue `assignee: Identity | null`,
comment `author: Identity`, and member `name` — always non-empty and never
containing `passwordHash` or session secrets.