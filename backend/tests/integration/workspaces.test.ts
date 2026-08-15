import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import argon2 from "argon2";
import type { Express } from "express";
import { setupApp, signupAs, createWorkspace, createProject, joinWorkspace } from "../helpers.js";
import { createApp } from "../../src/app.js";
import { memberships, users, workspaces } from "../../src/db/schema.js";
import { createUserRecord } from "../../src/domain/user.js";

let app: Express;
let aliceCookie: string;
let bobCookie: string;
let wsId: string;

beforeAll(async () => {
  app = setupApp();
  aliceCookie = await signupAs("alice@example.com");
  bobCookie = await signupAs("bob@example.com");
  wsId = await createWorkspace(aliceCookie, "Team Alpha");
});

describe("workspace contract", () => {
  it("creates a workspace", async () => {
    const res = await request(app)
      .post("/api/workspaces")
      .set("Cookie", aliceCookie)
      .send({ name: "Beta" })
      .expect(201);
    expect(res.body.workspace.name).toBe("Beta");
    expect(res.body.workspace.isOwner).toBe(true);
  });

  it("lists workspaces the user owns or belongs to", async () => {
    const res = await request(app).get("/api/workspaces").set("Cookie", aliceCookie).expect(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
  });

  it("gets a workspace detail", async () => {
    const res = await request(app).get(`/api/workspaces/${wsId}`).set("Cookie", aliceCookie).expect(200);
    expect(res.body.workspace.name).toBe("Team Alpha");
  });

  it("rejects unauthenticated workspace access", async () => {
    const res = await request(app).get("/api/workspaces").expect(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a blank workspace name", async () => {
    const res = await request(app)
      .post("/api/workspaces")
      .set("Cookie", aliceCookie)
      .send({ name: " " })
      .expect(422);
    expect(res.body.error.code).toBe("VALIDATION");
  });
});

describe("invite → join → remove journey", () => {
  async function inviteAlice(_token: string) {
    return request(app)
      .post(`/api/workspaces/${wsId}/invitations`)
      .set("Cookie", aliceCookie)
      .expect(201);
  }

  it("owner generates an invitation token", async () => {
    const res = await inviteAlice("x");
    expect(res.body.invitation.token).toBeTruthy();
  });

  it("non-owner cannot generate an invitation", async () => {
    const memberCookie = await signupAs("carol@example.com");
    const res = await request(app)
      .post(`/api/workspaces/${wsId}/invitations`)
      .set("Cookie", memberCookie)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("bob joins via token and sees the workspace", async () => {
    const inviteRes = await inviteAlice("x");
    const token = inviteRes.body.invitation.token;

    const joinRes = await joinWorkspace(bobCookie, token);
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.workspace.id).toBe(wsId);

    const list = await request(app).get("/api/workspaces").set("Cookie", bobCookie).expect(200);
    expect(list.body.items.some((w: { id: string }) => w.id === wsId)).toBe(true);
  });

  it("rejects an invalid token", async () => {
    const res = await joinWorkspace(bobCookie, "not-a-real-token");
    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain("Invalid invitation");
  });

  it("rejects reusing a token", async () => {
    const inviteRes = await inviteAlice("x");
    const token = inviteRes.body.invitation.token;
    const memberCookie = await signupAs("dave@example.com");
    const first = await joinWorkspace(memberCookie, token);
    expect(first.status).toBe(200);
    const second = await joinWorkspace(bobCookie, token);
    expect(second.status).toBe(422);
  });

  it("owner can remove a member", async () => {
    const memberCookie = await signupAs("erin@example.com");
    const inviteRes = await inviteAlice("x");
    await joinWorkspace(memberCookie, inviteRes.body.invitation.token);

    const members = await request(app)
      .get(`/api/workspaces/${wsId}/members`)
      .set("Cookie", aliceCookie)
      .expect(200);
    const erin = members.body.items.find((m: { email: string }) => m.email === "erin@example.com");
    expect(erin).toBeTruthy();

    await request(app)
      .delete(`/api/workspaces/${wsId}/members/${erin.userId}`)
      .set("Cookie", aliceCookie)
      .expect(204);
  });

  it("outsider cannot remove members", async () => {
    const outsider = await signupAs("frank@example.com");
    const members = await request(app)
      .get(`/api/workspaces/${wsId}/members`)
      .set("Cookie", aliceCookie)
      .expect(200);
    const target = members.body.items.find((m: { email: string }) => m.email === "alice@example.com");
    const res = await request(app)
      .delete(`/api/workspaces/${wsId}/members/${target.userId}`)
      .set("Cookie", outsider)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("authorization", () => {
  it("member of workspace can create projects", async () => {
    const memberCookie = await signupAs("grace@example.com");
    const inviteRes = await request(app)
      .post(`/api/workspaces/${wsId}/invitations`)
      .set("Cookie", aliceCookie)
      .expect(201);
    await joinWorkspace(memberCookie, inviteRes.body.invitation.token);
    const projectId = await createProject(memberCookie, wsId, "Grace Project");
    expect(projectId).toBeTruthy();
  });

  it("outsider cannot access workspace projects", async () => {
    const outsider = await signupAs("harry@example.com");
    const res = await request(app)
      .get(`/api/workspaces/${wsId}/projects`)
      .set("Cookie", outsider)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("workspace members (US4)", () => {
  it("returns each member with a resolved name", async () => {
    const res = await request(app)
      .get(`/api/workspaces/${wsId}/members`)
      .set("Cookie", aliceCookie)
      .expect(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    for (const member of res.body.items) {
      expect(member).toHaveProperty("userId");
      expect(member).toHaveProperty("email");
      expect(typeof member.name).toBe("string");
      expect(member.name.length).toBeGreaterThan(0);
    }
    const alice = res.body.items.find((m: { email: string }) => m.email === "alice@example.com");
    expect(alice.name).toBe("Test User");
  });

  it("resolves the email local-part for a legacy member with null name", async () => {
    const { app: legacyApp, db } = createApp({
      dbPath: ":memory:",
      sessionSecret: "test-secret",
      production: false,
    });
    const passwordHash = await argon2.hash("password123");
    const legacyUser = createUserRecord("legacy-member@example.com", passwordHash);
    db.insert(users).values(legacyUser).run();
    db.insert(workspaces)
      .values({ id: "ws-legacy", name: "Legacy Workspace", ownerId: legacyUser.id, createdAt: new Date(), updatedAt: new Date() })
      .run();
    db.insert(memberships)
      .values({ userId: legacyUser.id, workspaceId: "ws-legacy", joinedAt: new Date() })
      .run();

    const signin = await request(legacyApp)
      .post("/api/auth/signin")
      .send({ email: "legacy-member@example.com", password: "password123" })
      .expect(200);
    const cookie = signin.headers["set-cookie"][0].split(";")[0];

    const res = await request(legacyApp)
      .get("/api/workspaces/ws-legacy/members")
      .set("Cookie", cookie)
      .expect(200);
    const member = res.body.items.find((m: { email: string }) => m.email === "legacy-member@example.com");
    expect(member.name).toBe("legacy-member");
  });
});