import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { setupApp, signupAs, createWorkspace, createProject, joinWorkspace } from "../helpers.js";

let app: Express;
let cookie: string;
let wsId: string;
let projectId: string;
let labelId: string;
let otherCookie: string;
let otherWsId: string;
let otherLabelId: string;
let otherIssueId: string;

async function createIssue(title: string) {
  const res = await request(app)
    .post(`/api/projects/${projectId}/issues`)
    .set("Cookie", cookie)
    .send({ title, status: "Open", priority: "Medium" })
    .expect(201);
  return res.body.issue.id as string;
}

async function getIssue(id: string) {
  const res = await request(app).get(`/api/issues/${id}`).set("Cookie", cookie).expect(200);
  return res.body.issue;
}

function bulk(body: Record<string, unknown>) {
  return request(app).post("/api/issues/bulk").set("Cookie", cookie).send(body);
}

beforeAll(async () => {
  app = setupApp();
  cookie = await signupAs("alice@example.com");
  wsId = await createWorkspace(cookie, "Team Alpha");
  projectId = await createProject(cookie, wsId, "Website");

  const label = await request(app)
    .post(`/api/workspaces/${wsId}/labels`)
    .set("Cookie", cookie)
    .send({ name: "bug", color: "violet" })
    .expect(201);
  labelId = label.body.label.id;

  // A second workspace with a foreign label and a foreign issue.
  otherCookie = await signupAs("other@example.com");
  otherWsId = await createWorkspace(otherCookie, "Other Team");
  const otherProjId = await createProject(otherCookie, otherWsId, "Other Project");
  const otherLabel = await request(app)
    .post(`/api/workspaces/${otherWsId}/labels`)
    .set("Cookie", otherCookie)
    .send({ name: "foreign", color: "olive" })
    .expect(201);
  otherLabelId = otherLabel.body.label.id;
  const foreignIssue = await request(app)
    .post(`/api/projects/${otherProjId}/issues`)
    .set("Cookie", otherCookie)
    .send({ title: "Foreign issue", status: "Open", priority: "Low" })
    .expect(201);
  otherIssueId = foreignIssue.body.issue.id as string;
});

describe("bulk issue contract", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/issues/bulk").send({
      action: "setStatus",
      issueIds: [otherIssueId],
      status: "Closed",
    });
    expect(res.status).toBe(401);
  });

  it("setStatus updates all selected issues", async () => {
    const a = await createIssue("stat A");
    const b = await createIssue("stat B");
    const res = await bulk({
      action: "setStatus",
      issueIds: [a, b],
      status: "In Progress",
    }).expect(200);
    expect(res.body.count).toBe(2);
    expect((await getIssue(a)).status).toBe("In Progress");
    expect((await getIssue(b)).status).toBe("In Progress");
  });

  it("setPriority updates all selected issues", async () => {
    const a = await createIssue("pri A");
    const b = await createIssue("pri B");
    await bulk({ action: "setPriority", issueIds: [a, b], priority: "Urgent" }).expect(200);
    expect((await getIssue(a)).priority).toBe("Urgent");
    expect((await getIssue(b)).priority).toBe("Urgent");
  });

  it("assigns and unassigns the selected issues", async () => {
    const a = await createIssue("assign A");
    const b = await createIssue("assign B");
    const member = await signupAs("member@example.com");
    const invite = await request(app)
      .post(`/api/workspaces/${wsId}/invitations`)
      .set("Cookie", cookie)
      .expect(201);
    await joinWorkspace(member, invite.body.invitation.token);
    const memberId = (await request(app).get("/api/auth/me").set("Cookie", member).expect(200)).body
      .user.id as string;

    await bulk({ action: "assign", issueIds: [a, b], assigneeId: memberId }).expect(200);
    expect((await getIssue(a)).assigneeId).toBe(memberId);
    expect((await getIssue(b)).assigneeId).toBe(memberId);

    await bulk({ action: "assign", issueIds: [a, b], assigneeId: null }).expect(200);
    expect((await getIssue(a)).assigneeId).toBeNull();
    expect((await getIssue(b)).assigneeId).toBeNull();
  });

  it("rejects an assignee who is not a member of the workspace", async () => {
    const a = await createIssue("bad assign");
    const otherUserId = (await request(app).get("/api/auth/me").set("Cookie", otherCookie).expect(200))
      .body.user.id as string;
    const res = await bulk({ action: "assign", issueIds: [a], assigneeId: otherUserId });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.assigneeId).toBeDefined();
  });

  it("addLabels unions the label and is idempotent", async () => {
    const a = await createIssue("add idem");
    await bulk({ action: "addLabels", issueIds: [a], labelIds: [labelId] }).expect(200);
    await bulk({ action: "addLabels", issueIds: [a], labelIds: [labelId] }).expect(200);
    const issue = await getIssue(a);
    expect(issue.labelIds.filter((id: string) => id === labelId)).toHaveLength(1);
  });

  it("removeLabels subtracts the label", async () => {
    const a = await createIssue("remove A");
    await bulk({ action: "addLabels", issueIds: [a], labelIds: [labelId] }).expect(200);
    await bulk({ action: "removeLabels", issueIds: [a], labelIds: [labelId] }).expect(200);
    expect((await getIssue(a)).labelIds).toEqual([]);
  });

  it("rejects a label from another workspace", async () => {
    const a = await createIssue("foreign label");
    const res = await bulk({ action: "addLabels", issueIds: [a], labelIds: [otherLabelId] });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.labelIds).toBeDefined();
  });

  it("is all-or-nothing: a non-existent id rolls back the whole request", async () => {
    const a = await createIssue("atomic A");
    await bulk({ action: "setStatus", issueIds: [a], status: "In Progress" }).expect(200);

    const res = await bulk({
      action: "setStatus",
      issueIds: [a, "00000000-0000-4000-8000-000000000000"],
      status: "Closed",
    });
    expect(res.status).toBe(404);

    // Control issue is unchanged (still In Progress, not Closed).
    const after = await getIssue(a);
    expect(after.status).toBe("In Progress");
    expect(after.status).not.toBe("Closed");
  });

  it("rejects a mixed-workspace selection", async () => {
    const a = await createIssue("mixed ws");
    const res = await bulk({
      action: "setStatus",
      issueIds: [a, otherIssueId],
      status: "Closed",
    });
    expect(res.status).toBe(422);
  });

  it("rejects duplicate issue ids", async () => {
    const a = await createIssue("dup");
    const res = await bulk({ action: "setStatus", issueIds: [a, a], status: "Closed" });
    expect(res.status).toBe(422);
  });

  it("rejects more than the issue limit", async () => {
    const many = Array.from({ length: 21 }, (_, i) =>
      `123e4567-e89b-12d3-a456-42661417${String(i).padStart(4, "0")}`
    );
    const res = await bulk({ action: "setStatus", issueIds: many, status: "Closed" });
    expect(res.status).toBe(422);
  });

  it("deletes all selected issues", async () => {
    const a = await createIssue("delete A");
    const b = await createIssue("delete B");
    const res = await bulk({ action: "delete", issueIds: [a, b] }).expect(200);
    expect(res.body.count).toBe(2);
    await request(app).get(`/api/issues/${a}`).set("Cookie", cookie).expect(404);
    await request(app).get(`/api/issues/${b}`).set("Cookie", cookie).expect(404);
  });

  it("bulk delete is all-or-nothing: a bad id deletes nothing", async () => {
    const a = await createIssue("keep A");
    const res = await bulk({
      action: "delete",
      issueIds: [a, "00000000-0000-4000-8000-000000000001"],
    });
    expect(res.status).toBe(404);
    // Control issue survives untouched.
    const after = await getIssue(a);
    expect(after.title).toBe("keep A");
  });

  it("rejects a cross-workspace issue in a delete selection", async () => {
    const a = await createIssue("mixed delete");
    const res = await bulk({ action: "delete", issueIds: [a, otherIssueId] });
    expect(res.status).toBe(422);
    expect((await getIssue(a)).title).toBe("mixed delete");
  });
});