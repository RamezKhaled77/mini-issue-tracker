<!--
Sync Impact Report
- Version change: 2.0.0 → 2.1.0 (MINOR)
- Modified principles: wording refined for precision (no conceptual changes)
  - I. Simplicity First, II. Modular & Maintainable Design,
    III. Type Safety & Consistency, IV. Security by Default,
    V. Test Critical Behavior, VI. User Experience & Accessibility,
    VII. Requirements Before Implementation, VIII. No Silent Assumptions,
    IX. Explicit Decisions
- Added sections: none
- Removed constraints: CLI-first interface; SQLite/plain-text storage mandate;
  all mandatory database/storage/architecture technology choices
- Added rule: technology decisions (language, frameworks, database, ORM, folder
  structure, API architecture, libraries, deployment platform) deferred to
  technical planning phase
- Removed sections: none
- Deferred TODOs: none
-->
# Mini Issue Tracker Constitution

## Core Principles

### I. Simplicity First
Choose the simplest solution that satisfies current, concrete requirements.
Speculative generality MUST be avoided; every feature MUST be justified by a
demonstrated user need. Complexity is the primary driver of defects and
maintenance cost.

### II. Modular & Maintainable Design
Structure the codebase into cohesive, loosely coupled modules. Each module MUST
have a single clear responsibility and a stable interface. The domain MUST
remain independent of storage and presentation details.

### III. Type Safety & Consistency
Represent domain concepts with explicit, consistent types across the codebase.
The same concept MUST NOT be modeled with conflicting types in different
layers. Compiler-enforced guarantees MUST be preferred over runtime checks
where feasible.

### IV. Security by Default
Security MUST be designed in from the start, not added later. Untrusted input
MUST be validated and sanitized; secrets MUST NEVER be committed or logged; the
principle of least privilege MUST apply to all access.

### V. Test Critical Behavior
Automated tests MUST cover behavior whose failure would be costly or hard to
detect, including persistence, contracts, and access control. Test investment
MUST scale with risk; critical paths MUST be tested before merge.

### VI. User Experience & Accessibility
The product MUST be usable by all users, including those with disabilities.
Interfaces MUST be keyboard-accessible and MUST provide clear, consistent
feedback for every user action.

### VII. Requirements Before Implementation
No implementation MAY begin before its requirements are documented and
approved. Every feature MUST be traceable to a requirement; ambiguity MUST be
resolved before code is written.

### VIII. No Silent Assumptions
Assumptions MUST be stated explicitly. Behavior that depends on an assumption
MUST validate or document it. The system MUST fail loudly rather than proceed
silently on unverified assumptions.

### IX. Explicit Decisions
Decisions that affect users or architecture MUST be made deliberately and
recorded with their rationale. No such decision MAY be left to implicit
defaults. Trade-offs MUST be documented.

## General Engineering Constraints

- Unnecessary dependencies MUST be avoided: add a dependency only when it is
  clearly justified and reviewed. Prefer fewer, well-understood dependencies.
- Unnecessary complexity MUST be avoided: prefer simple, proven solutions; do
  not add machinery before it is needed.
- This constitution MUST NOT prescribe implementation technology. Decisions on
  programming language, frontend/backend frameworks, database, ORM, folder
  structure, API architecture, libraries, and deployment platform are deferred
  to the technical planning phase.

## Development Workflow

- Requirements-driven: work starts only after a reviewed, approved spec or
  issue is available.
- Issue-driven: every change MUST reference an issue.
- Code review REQUIRED for all merges; reviewers MUST verify constitution
  compliance.
- Tests MUST run on every change; failing tests block merge.
- Documentation MUST be updated alongside code.
- Significant decisions MUST be recorded with rationale in the issue or spec.

## Governance

This constitution supersedes all other development practices.

- Amendments REQUIRE a documented proposal, review and approval, and a migration
  plan for affected practices.
- Versioning policy: MAJOR for principle removals or redefinitions, MINOR for
  added or materially expanded principles, PATCH for clarifications and
  non-semantic refinements.
- Compliance review: all contributions and reviews MUST verify adherence to
  these principles; reviewers MUST flag violations before merge.

**Version**: 2.1.0 | **Ratified**: 2026-08-14 | **Last Amended**: 2026-08-14