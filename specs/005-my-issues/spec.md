# Feature Specification: My Issues — Mini Issue Tracker

**Feature Branch**: `005-my-issues`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "My Issues feature — a page that includes all issues assigned to the user with all info (issue info, project info, workspace info, and so on). It also has a tab in the sidebar to navigate to it. My Issues = cross-workspace personal workload. Example layout: a 'MY ISSUES' heading with '12 assigned to you', stat rows for OPEN / IN PROGRESS / OVERDUE, and below these the same ticket ledger."

**Relationship to prior features**: Features 001–004 built the MVP, redesigned the UI, added user display names, and completed the label system. Issues already carry `assigneeId`/`assignee` identity and a `dueDate`, but every issue list today is scoped to a single workspace and project — there is no cross-workspace, assignee-focused view of a user's own workload. This feature adds that personal, cross-workspace surface. It is not presentation-only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Your Personal Workload at a Glance (Priority: P1)

A signed-in user opens **My Issues** from the sidebar and immediately sees how much work is assigned to them across every workspace they belong to: a heading "My Issues", the total count of issues assigned to them ("N assigned to you"), and a compact stat strip breaking the total into **Open**, **In Progress**, and **Overdue** buckets, using the same status-count presentation as the workspace stat strip.

**Why this priority**: The summary is the core value of a personal workload page — it answers "what is on my plate right now?" before the user reads any single ticket. Without it the page is just another issue list.

**Independent Test**: Can be fully tested by signing in as a user who is a member of one or more workspaces with issues assigned to them and confirming the heading, total count, and the three stat values render correctly from real data. Delivers the personal workload summary even if ledger navigation is not yet implemented.

**Acceptance Scenarios**:

1. **Given** a signed-in user who has issues assigned to them across one or more workspaces, **When** they open My Issues, **Then** the page shows the title "My Issues", the exact count of all issues assigned to them, and separate counts for Open, In Progress, and Overdue issues assigned to them.
2. **Given** a signed-in user with no issues assigned to them, **When** they open My Issues, **Then** the page shows "0 assigned to you", zeroed stat values, and an empty-state message rather than errors or missing data.
3. **Given** a signed-in user who is a member of multiple workspaces, **When** they open My Issues, **Then** the counts include issues from every workspace they are a member of and never include issues from workspaces they do not belong to.

### User Story 2 - Browse All Issues Assigned to Me (Priority: P1)

Below the summary, the user sees the **same ticket ledger** used on the workspace page: ruled rows with a monospace ticket key, priority edge bar, issue title, status, priority, labels, and assignee. Because this view is cross-workspace, each row also carries the **project** and **workspace** context for the issue. Clicking any row opens that issue's detail page.

**Why this priority**: The ledger is the actionable part of the workload view. The user must be able to scan their assigned issues and reach any of them; without it the summary counts have no follow-through.

**Independent Test**: Can be fully tested by confirming that every issue assigned to the current user across all their workspaces appears in the ledger once the Closed-inclusion control is on, that each row identifies the project and workspace, and that clicking a row opens the correct issue detail page. Delivers the browse-and-navigate value independently.

**Acceptance Scenarios**:

1. **Given** a signed-in user with issues assigned to them across multiple workspaces, **When** they open My Issues with the Closed-inclusion control on, **Then** the ledger lists exactly the issues assigned to them, each row showing the ticket key, title, status, priority, labels, assignee, project name, and workspace name.
2. **Given** a signed-in user with active and Closed issues assigned to them, **When** they open My Issues with the Closed-inclusion control off, **Then** the ledger lists only the user's Open and In Progress issues.
3. **Given** a ledger row, **When** the user activates it, **Then** they are taken to that issue's detail page in its workspace.

### User Story 3 - Reach My Issues From the Sidebar (Priority: P1)

The sidebar gains a **My Issues** navigation item (the "tab" the user described) alongside the existing Workspaces item. It is reachable by mouse and keyboard, shows an active state when the user is on the page, and works on every breakpoint where the sidebar is available.

**Why this priority**: Navigation is the entry point — the page is useless if it cannot be reached. It is small, independent work that makes the whole feature discoverable.

**Independent Test**: Can be fully tested by confirming the new sidebar item renders, is keyboard-accessible, shows an active/selected state on the My Issues route, and navigates to the page. Delivers the navigation entry point even if the page content is still a stub.

**Acceptance Scenarios**:

1. **Given** the signed-in application shell, **When** the user tabs or clicks to the sidebar, **Then** a "My Issues" navigation item is present and reachable, and activating it navigates to the My Issues page.
2. **Given** the user is on the My Issues page, **When** they inspect the sidebar, **Then** the My Issues item is visually marked as the active destination, consistent with how the Workspaces item behaves today.

### User Story 4 - Include Closed Issues When Needed (Priority: P2)

The ledger defaults to the user's **active** issues (Open + In Progress) so the personal workload stays focused on work in flight. A control on the page lets the user include **Closed** issues as well; once included, the ledger shows every issue assigned to them, matching the "N assigned to you" total. The Open / In Progress / Overdue summary counts above the ledger are informational only and do not change the list.

**Why this priority**: Keeping Closed issues out of the default view preserves the "current load" focus, while still letting the user revisit completed work. It is valuable but secondary to the core summary and browse flows.

**Independent Test**: Can be fully tested by confirming the default ledger shows only active issues, and that turning on the Closed-inclusion control adds exactly the Closed issues so the list then equals the total count.

**Acceptance Scenarios**:

1. **Given** the user's assigned issues, **When** they open My Issues without changing anything, **Then** the ledger lists only Open and In Progress issues, and the summary counts above remain informational and unlinked.
2. **Given** the default active-only ledger, **When** the user enables the Closed-inclusion control, **Then** the ledger also lists Closed issues and now matches the total "N assigned to you" count.
3. **Given** the Closed-inclusion control enabled, **When** the user disables it, **Then** the ledger returns to showing only active issues.

### Edge Cases

- **No assigned issues**: Page shows "0 assigned to you", zeroed stats, and an empty state; the ledger area shows an empty-state message instead of a blank list.
- **Only Closed issues assigned**: The default active-only ledger is empty, but the summary still reports the total and the Closed issue is revealed when the Closed-inclusion control is enabled (the empty state must not make the page look broken).
- **No workspaces / not a member anywhere**: Page still renders the empty state rather than erroring.
- **Issue assigned to the user in a workspace they later leave**: The issue must not appear in My Issues (cross-workspace view must respect current memberships).
- **Overdue with no due date**: An issue with no due date is never counted as Overdue; only issues with a due date before today's date and a non-Closed status count.
- **Overdue overlap**: An Overdue issue is also Open or In Progress — the buckets are not mutually exclusive, so the three stat values may sum to more than the total.
- **Data loading failure**: If the summary or ledger fails to load, the page shows a clear, recoverable error consistent with existing page error patterns (no partial or fabricated counts).
- **Unassigned issues**: Issues with no assignee are never part of My Issues for any user.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a personal, cross-workspace view of the signed-in user's assigned issues, spanning every workspace the user is currently a member of, and MUST NOT include issues from workspaces the user does not belong to.
- **FR-002**: The system MUST show a heading "My Issues" and the total count of issues assigned to the current user ("N assigned to you").
- **FR-003**: The system MUST show counts for issues assigned to the current user grouped as Open, In Progress, and Overdue.
- **FR-004**: Overdue MUST be a derived attribute: an issue assigned to the current user with a due date earlier than today's date and a status other than Closed. An issue with no due date MUST NOT be Overdue. The attribute MUST NOT require a stored value or a new status.
- **FR-005**: The ledger MUST list the current user's assigned issues using the existing ticket ledger row pattern (ticket key, title, status, priority, labels, assignee), and each row MUST additionally identify the issue's project and workspace.
- **FR-006**: Activating a ledger row MUST open that issue's existing detail page.
- **FR-007**: The sidebar MUST include a "My Issues" navigation item that navigates to the page, is keyboard-reachable, and shows an active state while the page is displayed.
- **FR-008**: The summary and ledger MUST be driven entirely by real application data; the system MUST NOT fabricate counts or issues.
- **FR-009**: The page MUST render a clear empty state when the user has no assigned issues and MUST render a recoverable error state when data cannot be loaded.
- **FR-010**: The stat counts MUST reflect the same scope as the ledger (the current user's assigned issues across all their workspaces) so the summary and list never disagree.
- **FR-011**: The ledger MUST default to the user's active issues (Open + In Progress). The system MUST provide a control that includes Closed issues, at which point the ledger shows every issue assigned to the user across all statuses.
- **FR-012**: The Open, In Progress, and Overdue summary counts MUST be informational only; they MUST NOT filter or alter the ledger.

### Key Entities *(include if feature involves data)*

- **Issue**: The work item being aggregated. Its `assigneeId`/`assignee` identity determines membership in My Issues; its `projectId`, `status`, `priority`, `dueDate`, `labels`, and title drive the summary, ledger rows, and Overdue derivation.
- **Project**: The container for an Issue. Provides the project context shown on each ledger row (its `workspaceId` connects the issue to its workspace).
- **Workspace**: The tenant containing Projects and Issues. The user's memberships define which issues may appear in My Issues.
- **Membership**: The link between a User and a Workspace. Only issues reachable through the user's current memberships are included.
- **User**: The signed-in person. My Issues is scoped to this single user's assignee relationships.
- **My Issues overview (derived)**: The summary concept combining total, Open, In Progress, and Overdue counts for the current user. It is computed from real Issue data, not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in user can reach My Issues from the sidebar in one interaction and see their total, Open, In Progress, and Overdue counts on first render.
- **SC-002**: The ledger and the summary agree in scope: with the Closed-inclusion control on, the ledger lists exactly the issues counted in the total "assigned to you"; with it off, the ledger lists exactly the Open and In Progress issues, and the summary buckets still sum to the same scope.
- **SC-003**: 100% of ledger rows let the user identify the issue's project and workspace without leaving the page or opening the issue.
- **SC-004**: Users can open any listed issue from the ledger in one interaction and land on the correct issue detail page.
- **SC-005**: The page loads and renders with real data in under 2 seconds on a typical connection, and the empty/error states render correctly for users with no assigned issues.
- **SC-006**: Keyboard users can navigate to My Issues, move through the ledger, toggle the Closed-inclusion control, and open an issue without a mouse; focus and active states remain visible.

## Assumptions

- **Overdue semantics**: Overdue is a derived, overlapping flag (due date before today, status not Closed), not a fourth status and not a stored value. As a result the three stat values may sum to more than the total.
- **Total includes all statuses; ledger defaults to active**: "N assigned to you" counts every issue assigned to the user in all statuses (Open, In Progress, Closed). The ledger defaults to active issues (Open + In Progress) and includes Closed issues only when the user enables the Closed-inclusion control. This was confirmed via Q1 (option C).
- **Summary counts are informational**: Open, In Progress, and Overdue are breakdowns of the total and do not filter or change the ledger. Confirmed via Q2 (option A).
- **One unified ledger, not grouped**: My Issues is a single cross-workspace ledger; rows carry project and workspace context rather than the page grouping by workspace or project. Grouped/tree views are out of scope.
- **Sort order**: The ledger sorts with Overdue first, then by due date (earliest first, no-due-date last), then by priority (High→Low), then by title. This is a reasonable default and is listed under Risks / Open Questions for confirmation.
- **Minimal filter surface**: The only filter on the page is the Closed-inclusion control; there is no search box or additional filter dropdowns (the workspace ledger keeps those).
- **Real data only**: Counts and rows are computed from actual issues the user is assigned to; nothing is fabricated. Unassigned issues and issues in workspaces the user left are excluded.
- **Reuses existing surfaces**: The page reuses the existing ticket ledger row, stat strip, empty state, error, skeleton, and sidebar navigation patterns. No new visual language is introduced.
- **Existing identity and due-date data are sufficient**: Issue payloads already include assignee identity and due dates; project and workspace context can be resolved from existing project/workspace data.