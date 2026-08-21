import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { runMigrations } from "../../src/db/migrate.js";
import * as schema from "../../src/db/schema.js";
import { createMembershipService } from "../../src/services/membership.js";
import { createProjectService } from "../../src/services/project.js";
import { createActivityService } from "../../src/services/activity.js";
import { createActivityRecord, truncateDescription } from "../../src/domain/activity.js";
import { createUserRecord } from "../../src/domain/user.js";
import { createIssueRecord } from "../../src/domain/issue.js";
import { ApiError } from "../../src/api/middleware/error-handler.js";

function setupDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  runMigrations(sqlite);
  return drizzle(sqlite, { schema });
}

describe("ActivityService", () => {
  let db: ReturnType<typeof setupDb>;
  let ownerId: string;
  let memberId: string;
  let outsiderId: string;
  let workspaceId: string;
  let projectId: string;
  let issueId: string;
  let labelId: string;

  function createDeps() {
    const membershipService = createMembershipService({ db });
    const projectService = createProjectService({ db, membershipService });
    const activityService = createActivityService({ db, membershipService, projectService });
    return { membershipService, projectService, activityService };
  }

  beforeEach(() => {
    db = setupDb();

    const owner = createUserRecord("owner@example.com", "hash");
    const member = createUserRecord("member@example.com", "hash", "Member User");
    const outsider = createUserRecord("outsider@example.com", "hash", "Outsider");
    ownerId = owner.id;
    memberId = member.id;
    outsiderId = outsider.id;
    workspaceId = "ws-activity-test";
    projectId = "proj-activity-test";
    issueId = "issue-activity-test";
    labelId = "label-activity-test";

    db.insert(schema.users).values([owner, member, outsider]).run();
    db.insert(schema.workspaces).values({
      id: workspaceId,
      name: "Activity Workspace",
      ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();
    db.insert(schema.memberships).values([
      { userId: ownerId, workspaceId, joinedAt: new Date() },
      { userId: memberId, workspaceId, joinedAt: new Date() },
    ]).run();
    db.insert(schema.projects).values({
      id: projectId,
      workspaceId,
      name: "Activity Project",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();
    const issue = createIssueRecord(projectId, {
      title: "Test Issue",
      status: "Open",
      priority: "Medium",
    });
    db.insert(schema.issues).values({ ...issue, id: issueId }).run();
    db.insert(schema.labels).values({ id: labelId, workspaceId, name: "bug", color: "violet" }).run();
  });

  describe("recordActivity", () => {
    it("inserts an activity row for issue.created", () => {
      const { activityService } = createDeps();
      const activity = createActivityRecord(issueId, ownerId, "issue.created");
      activityService.recordActivity(activity);

      const rows = db.select().from(schema.activities).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.type).toBe("issue.created");
      expect(rows[0]!.issueId).toBe(issueId);
      expect(rows[0]!.actorId).toBe(ownerId);
      expect(rows[0]!.field).toBeNull();
      expect(rows[0]!.fromValue).toBeNull();
      expect(rows[0]!.toValue).toBeNull();
    });

    it("stores labelIds and labelNames as JSON strings", () => {
      const { activityService } = createDeps();
      const activity = createActivityRecord(issueId, ownerId, "issue.labels_added", {
        labelIds: [labelId],
        labelNames: ["bug"],
      });
      activityService.recordActivity(activity);

      const row = db
        .select()
        .from(schema.activities)
        .where(eq(schema.activities.id, activity.id))
        .get();
      expect(row!.labelIds).toBe(JSON.stringify([labelId]));
      expect(row!.labelNames).toBe(JSON.stringify(["bug"]));
    });

    it("stores field changes for issue.updated", () => {
      const { activityService } = createDeps();
      const activity = createActivityRecord(issueId, ownerId, "issue.updated", {
        field: "status",
        fromValue: "Open",
        toValue: "In Progress",
      });
      activityService.recordActivity(activity);

      const row = db
        .select()
        .from(schema.activities)
        .where(eq(schema.activities.id, activity.id))
        .get();
      expect(row!.field).toBe("status");
      expect(row!.fromValue).toBe("Open");
      expect(row!.toValue).toBe("In Progress");
    });
  });

  describe("listActivities", () => {
    it("returns activities reverse-chronological with actorName", () => {
      const { activityService } = createDeps();
      const older = createActivityRecord(issueId, ownerId, "issue.created");
      older.createdAt = new Date(Date.now() - 10000).toISOString();
      const newer = createActivityRecord(issueId, ownerId, "issue.updated", {
        field: "status",
        fromValue: "Open",
        toValue: "Closed",
      });
      newer.createdAt = new Date().toISOString();
      activityService.recordActivity(older);
      activityService.recordActivity(newer);

      const result = activityService.listActivities(issueId, ownerId, { page: 1, pageSize: 50 });
      expect(result.items).toHaveLength(2);
      expect(result.items[0].type).toBe("issue.updated");
      expect(result.items[1].type).toBe("issue.created");
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
      expect(result.items[0].actorName).toBe("owner");
    });

    it("resolves assignee user IDs to display names", () => {
      const { activityService } = createDeps();
      const activity = createActivityRecord(issueId, ownerId, "issue.updated", {
        field: "assignee",
        fromValue: null,
        toValue: memberId,
      });
      activityService.recordActivity(activity);

      const result = activityService.listActivities(issueId, ownerId, { page: 1, pageSize: 50 });
      expect(result.items[0].field).toBe("assignee");
      expect(result.items[0].fromValue).toBeNull();
      expect(result.items[0].toValue).toBe("Member User");
    });

    it("paginates results", () => {
      const { activityService } = createDeps();
      for (let i = 0; i < 5; i++) {
        const activity = createActivityRecord(issueId, ownerId, "issue.updated", {
          field: "status",
          fromValue: `state-${i}`,
          toValue: `state-${i + 1}`,
        });
        activity.createdAt = new Date(Date.now() + i * 1000).toISOString();
        activityService.recordActivity(activity);
      }

      const page1 = activityService.listActivities(issueId, ownerId, { page: 1, pageSize: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(5);

      const page3 = activityService.listActivities(issueId, ownerId, { page: 3, pageSize: 2 });
      expect(page3.items).toHaveLength(1);
      expect(page3.total).toBe(5);
    });

    it("only returns activities for the requested issue", () => {
      const { activityService } = createDeps();
      activityService.recordActivity(createActivityRecord(issueId, ownerId, "issue.created"));
      activityService.recordActivity(
        createActivityRecord(issueId, ownerId, "issue.updated", {
          field: "title",
          fromValue: "A",
          toValue: "B",
        })
      );

      const result = activityService.listActivities(issueId, ownerId, { page: 1, pageSize: 50 });
      expect(result.items).toHaveLength(2);
    });
  });

  describe("authorization", () => {
    it("throws 403 FORBIDDEN for non-members", () => {
      const { activityService } = createDeps();
      try {
        activityService.listActivities(issueId, outsiderId, { page: 1, pageSize: 50 });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(403);
        expect((err as ApiError).code).toBe("FORBIDDEN");
      }
    });

    it("allows workspace members", () => {
      const { activityService } = createDeps();
      activityService.recordActivity(createActivityRecord(issueId, ownerId, "issue.created"));
      const result = activityService.listActivities(issueId, memberId, { page: 1, pageSize: 50 });
      expect(result.total).toBe(1);
    });

    it("allows workspace owner", () => {
      const { activityService } = createDeps();
      activityService.recordActivity(createActivityRecord(issueId, ownerId, "issue.created"));
      const result = activityService.listActivities(issueId, ownerId, { page: 1, pageSize: 50 });
      expect(result.total).toBe(1);
    });

    it("throws 404 NOT_FOUND for a nonexistent issue", () => {
      const { activityService } = createDeps();
      try {
        activityService.listActivities("nonexistent-issue", ownerId, { page: 1, pageSize: 50 });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(404);
        expect((err as ApiError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("cascade delete", () => {
    it("deletes activities when the issue is deleted (ON DELETE CASCADE)", () => {
      const { activityService } = createDeps();
      activityService.recordActivity(createActivityRecord(issueId, ownerId, "issue.created"));
      activityService.recordActivity(
        createActivityRecord(issueId, ownerId, "issue.updated", {
          field: "title",
          fromValue: "Old",
          toValue: "New",
        })
      );

      let rows = db
        .select()
        .from(schema.activities)
        .where(eq(schema.activities.issueId, issueId))
        .all();
      expect(rows).toHaveLength(2);

      db.delete(schema.issues).where(eq(schema.issues.id, issueId)).run();

      rows = db
        .select()
        .from(schema.activities)
        .where(eq(schema.activities.issueId, issueId))
        .all();
      expect(rows).toHaveLength(0);
    });
  });

  describe("domain helpers", () => {
    describe("createActivityRecord", () => {
      it("generates a unique ID per record", () => {
        const a1 = createActivityRecord(issueId, ownerId, "issue.created");
        const a2 = createActivityRecord(issueId, ownerId, "issue.created");
        expect(a1.id).not.toBe(a2.id);
      });

      it("sets createdAt to a valid ISO date string", () => {
        const activity = createActivityRecord(issueId, ownerId, "issue.created");
        expect(Number.isNaN(new Date(activity.createdAt).getTime())).toBe(false);
      });

      it("defaults optional fields to null", () => {
        const activity = createActivityRecord(issueId, ownerId, "issue.created");
        expect(activity.field).toBeUndefined();
        expect(activity.fromValue).toBeNull();
        expect(activity.toValue).toBeNull();
        expect(activity.labelIds).toBeNull();
        expect(activity.labelNames).toBeNull();
      });

      it("passes through field and label metadata", () => {
        const activity = createActivityRecord(issueId, ownerId, "issue.labels_added", {
          labelIds: [labelId],
          labelNames: ["bug"],
        });
        expect(activity.labelIds).toEqual([labelId]);
        expect(activity.labelNames).toEqual(["bug"]);
        expect(activity.fromValue).toBeNull();
        expect(activity.toValue).toBeNull();
      });
    });

    describe("truncateDescription", () => {
      it("returns null for null input", () => {
        expect(truncateDescription(null)).toBeNull();
      });

      it("returns the text unchanged when within the limit", () => {
        const text = "short description";
        expect(truncateDescription(text)).toBe(text);
      });

      it("truncates long text at 200 chars with an ellipsis", () => {
        const long = "x".repeat(500);
        const result = truncateDescription(long);
        expect(result!.length).toBe(200);
        expect(result!.endsWith("…")).toBe(true);
      });
    });
  });
});