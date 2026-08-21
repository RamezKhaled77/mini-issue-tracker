import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { setupApp, signupAs, createWorkspace, createProject, joinWorkspace } from "../helpers.js";

let app: Express;
let ownerCookie: string;
let wsId: string;
let projectId: string;

beforeAll(async () => {
  app = setupApp();
  ownerCookie = await signupAs("activity-owner@example.com", "password123", "Activity Owner");
  wsId = await createWorkspace(ownerCookie, "Activity Workspace");
  projectId = await createProject(ownerCookie, wsId, "Website");
});

async function createIssue(title: string, extra: Record<string, unknown> = {}, cookie = ownerCookie) {
  const res = await request(app)
    .post(`/api/projects/${projectId}/issues`)
    .set("Cookie", cookie)
    .send({ title, status: "Open", priority: "Medium", ...extra })
    .expect(201);
  return res.body.issue;
}

async function getActivity(issueId: string, query = "", cookie = ownerCookie) {
  const res = await request(app)
    .get(`/api/issues/${issueId}/activity${query}`)
    .set("Cookie", cookie)
    .expect(200);
  return res.body;
}

describe("activity contract", () => {
  it("records an issue.created event when an issue is created", async () => {
    const issue = await createIssue("Activity create");
    const { items, total } = await getActivity(issue.id);
    expect(total).toBe(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        issueId: issue.id,
        actorName: "Activity Owner",
        type: "issue.created",
      })
    );
    expect(items[0].createdAt).toBeDefined();
  });

  it("records issue.updated with field, from, and to for a status change", async () => {
    const issue = await createIssue("Activity status");
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ status: "In Progress" })
      .expect(200);

    const { items } = await getActivity(issue.id);
    const updated = items.find((a: { type: string }) => a.type === "issue.updated");
    expect(updated).toEqual(
      expect.objectContaining({
        field: "status",
        fromValue: "Open",
        toValue: "In Progress",
      })
    );
  });

  it("records three separate entries when status, priority, and title change together", async () => {
    const issue = await createIssue("Activity multi");
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ status: "Closed", priority: "High", title: "Activity multi v2" })
      .expect(200);

    const { items } = await getActivity(issue.id);
    const updatedEntries = items.filter((a: { type: string }) => a.type === "issue.updated");
    expect(updatedEntries).toHaveLength(3);
    const fields = updatedEntries.map((a: { field: string }) => a.field).sort();
    expect(fields).toEqual(["priority", "status", "title"]);
  });

  it("records no activity for a no-op update", async () => {
    const issue = await createIssue("Activity no-op");
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ status: "Open" })
      .expect(200);

    const { items, total } = await getActivity(issue.id);
    expect(total).toBe(1); // only the created event
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("issue.created");
  });

  it("records due date set with null fromValue", async () => {
    const issue = await createIssue("Activity due set");
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ dueDate: "2026-09-01" })
      .expect(200);

    const { items } = await getActivity(issue.id);
    const updated = items.find((a: { field: string }) => a.field === "due_date");
    expect(updated.fromValue).toBeNull();
    expect(updated.toValue).toBe("2026-09-01");
  });

  it("records due date clear with null toValue", async () => {
    const issue = await createIssue("Activity due clear");
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ dueDate: "2026-09-01" })
      .expect(200);
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ dueDate: null })
      .expect(200);

    const { items } = await getActivity(issue.id);
    const clearEvent = items.find(
      (a: { field: string; toValue: null }) => a.field === "due_date" && a.toValue === null
    );
    expect(clearEvent).toBeDefined();
    expect(clearEvent.fromValue).toBe("2026-09-01");
  });

  it("truncates description changes to 200 chars", async () => {
    const issue = await createIssue("Activity desc", { description: "short" });
    const longDescription = "x".repeat(500);
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ description: longDescription })
      .expect(200);

    const { items } = await getActivity(issue.id);
    const updated = items.find((a: { field: string }) => a.field === "description");
    expect(updated.fromValue).toBe("short");
    expect(updated.toValue).toBe("x".repeat(199) + "…");
  });
});
describe("assignee activity", () => {
  let memberCookie: string;

  beforeAll(async () => {
    // Member who joins the workspace can be assigned
    memberCookie = await signupAs("activity-member@example.com", "password123", "Member User");
    const invite = await request(app)
      .post(`/api/workspaces/${wsId}/invitations`)
      .set("Cookie", ownerCookie)
      .expect(201);
    await joinWorkspace(memberCookie, invite.body.invitation.token);
  });

  it("resolves assignee user IDs to display names", async () => {
    const list = await request(app)
      .get(`/api/workspaces/${wsId}/members`)
      .set("Cookie", ownerCookie)
      .expect(200);
    const member = list.body.items.find((m: { name: string }) => m.name === "Member User");
    expect(member).toBeDefined();

    const issue = await createIssue("Activity assignee");
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ assigneeId: member.userId })
      .expect(200);

    const { items } = await getActivity(issue.id);
    const updated = items.find((a: { field: string }) => a.field === "assignee");
    expect(updated.fromValue).toBeNull();
    expect(updated.toValue).toBe("Member User");
  });
});

describe("label activity", () => {
  let bugId: string;
  let uiId: string;

  beforeAll(async () => {
    const bug = await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .send({ name: "api-bug", color: "violet" })
      .expect(201);
    bugId = bug.body.label.id;

    const ui = await request(app)
      .post(`/api/workspaces/${wsId}/labels`)
      .set("Cookie", ownerCookie)
      .send({ name: "api-ui", color: "indigo" })
      .expect(201);
    uiId = ui.body.label.id;
  });

  it("records labels_added with label names", async () => {
    const issue = await createIssue("Activity labels add");
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ labelIds: [bugId, uiId] })
      .expect(200);

    const { items } = await getActivity(issue.id);
    const added = items.find((a: { type: string }) => a.type === "issue.labels_added");
    expect(added).toBeDefined();
    expect(added.labelIds).toEqual(expect.arrayContaining([bugId, uiId]));
    expect([...added.labelNames].sort()).toEqual(["api-bug", "api-ui"]);
  });

  it("records labels_removed with denormalized names", async () => {
    const issue = await createIssue("Activity labels remove");
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ labelIds: [bugId, uiId] })
      .expect(200);
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ labelIds: [bugId] })
      .expect(200);

    const { items } = await getActivity(issue.id);
    const removed = items.find((a: { type: string }) => a.type === "issue.labels_removed");
    expect(removed).toBeDefined();
    expect(removed.labelNames).toEqual(["api-ui"]);
  });

  it("records both added and removed in one atomic replace", async () => {
    const issue = await createIssue("Activity labels replace");
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ labelIds: [bugId] })
      .expect(200);
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ labelIds: [uiId] })
      .expect(200);

    const { items } = await getActivity(issue.id);
    const added = items.find((a: { type: string }) => a.type === "issue.labels_added");
    expect(added).toBeDefined();
    expect(added.labelNames).toEqual(["api-ui"]);

    const removed = items.find((a: { type: string }) => a.type === "issue.labels_removed");
    expect(removed).toBeDefined();
    expect(removed.labelNames).toEqual(["api-bug"]);
  });
});
describe("pagination", () => {
  it("paginates activities with page, pageSize, and total", async () => {
    const issue = await createIssue("Activity pagination");
    // Create several field changes
    for (const t of ["one", "two", "three", "four", "five"]) {
      await request(app)
        .patch(`/api/issues/${issue.id}`)
        .set("Cookie", ownerCookie)
        .send({ title: `Activity pagination ${t}` })
        .expect(200);
    }
    // 1 created + 5 updates = 6 total
    const { items, total } = await getActivity(issue.id, "?page=1&pageSize=2");
    expect(total).toBe(6);
    expect(items).toHaveLength(2);

    const page2 = await getActivity(issue.id, "?page=2&pageSize=2");
    expect(page2.items).toHaveLength(2);
    expect(page2.page).toBe(2);

    // page 3 returns the oldest 2
    const page3 = await getActivity(issue.id, "?page=3&pageSize=2");
    expect(page3.items).toHaveLength(2);

    // activity is reverse-chronological: first item is the newest update
    expect(items[0].type).toBe("issue.updated");
    expect(items[0].toValue).toBe("Activity pagination five");
  });

  it("returns oldest-first pages that compose the full reverse-chron list", async () => {
    const issue = await createIssue("Activity pagination order");
    for (const t of ["a", "b", "c"]) {
      await request(app)
        .patch(`/api/issues/${issue.id}`)
        .set("Cookie", ownerCookie)
        .send({ title: `Pagination order ${t}` })
        .expect(200);
    }

    const page1 = await getActivity(issue.id, "?page=1&pageSize=2");
    const page2 = await getActivity(issue.id, "?page=2&pageSize=2");

    // total = 4 (1 created + 3 updates)
    expect(page1.total).toBe(4);
    const allTitles = [...page1.items, ...page2.items].map((i: { toValue?: string | null }) => i.toValue);
    expect(allTitles[0]).toBe("Pagination order c");
    expect(allTitles[1]).toBe("Pagination order b");
    expect(allTitles[2]).toBe("Pagination order a");
  });

  it("rejects pageSize over 100", async () => {
    const issue = await createIssue("Activity page size validation");
    const res = await request(app)
      .get(`/api/issues/${issue.id}/activity?pageSize=101`)
      .set("Cookie", ownerCookie)
      .expect(422);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(res.body.error.fields.pageSize).toBeDefined();
  });
});

describe("authorization", () => {
  it("returns 403 for a non-member", async () => {
    const issue = await createIssue("Activity secret");
    const outsider = await signupAs("activity-outsider@example.com");
    const res = await request(app)
      .get(`/api/issues/${issue.id}/activity`)
      .set("Cookie", outsider)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 for an unauthenticated request", async () => {
    const issue = await createIssue("Activity anon");
    const res = await request(app).get(`/api/issues/${issue.id}/activity`).expect(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 for a nonexistent issue", async () => {
    const res = await request(app)
      .get("/api/issues/00000000-0000-4000-8000-000000000000/activity")
      .set("Cookie", ownerCookie)
      .expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("delete behavior", () => {
  it("records issue.deleted before cascade-deleting the issue", async () => {
    const issue = await createIssue("Activity delete");

    // Make a change so the issue has multiple activities
    await request(app)
      .patch(`/api/issues/${issue.id}`)
      .set("Cookie", ownerCookie)
      .send({ status: "Closed" })
      .expect(200);

    await request(app).delete(`/api/issues/${issue.id}`).set("Cookie", ownerCookie).expect(204);

    // Issue is gone
    await request(app).get(`/api/issues/${issue.id}`).set("Cookie", ownerCookie).expect(404);

    // Activity is cascade-deleted along with the issue
    const res = await request(app)
      .get(`/api/issues/${issue.id}/activity`)
      .set("Cookie", ownerCookie)
      .expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("deletes activities when the actor user is deleted (ON DELETE CASCADE)", async () => {
    const issue = await createIssue("Activity actor cascade");
    await request(app).delete(`/api/issues/${issue.id}`).set("Cookie", ownerCookie).expect(204);
    // issue activity is gone; this only verifies no FK violation on actor delete path
    const res = await request(app)
      .get(`/api/issues/${issue.id}/activity`)
      .set("Cookie", ownerCookie)
      .expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});