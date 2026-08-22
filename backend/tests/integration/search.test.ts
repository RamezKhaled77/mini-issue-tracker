import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { getApp, setupApp, signupAs, createWorkspace, createProject } from "../helpers.js";

describe("GET /api/search", () => {
  let cookie: string;
  let otherCookie: string;

  async function createIssue(
    projectCookie: string,
    projectId: string,
    title: string,
    extra: Record<string, unknown> = {}
  ): Promise<string> {
    const res = await request(getApp())
      .post(`/api/projects/${projectId}/issues`)
      .set("Cookie", projectCookie)
      .send({ title, status: "Open", priority: "Medium", ...extra })
      .expect(201);
    return res.body.issue.id;
  }

  beforeEach(async () => {
    setupApp();
    cookie = await signupAs("owner@example.com");
    otherCookie = await signupAs("other@example.com");
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(getApp()).get("/api/search?q=abc").expect(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects invalid queries with 422", async () => {
    for (const q of ["", "a", "x".repeat(201)]) {
      const res = await request(getApp())
        .get(`/api/search?q=${encodeURIComponent(q)}`)
        .set("Cookie", cookie);
      expect(res.status).toBe(422);
    }
    const res = await request(getApp()).get("/api/search?q=abc&limit=51").set("Cookie", cookie);
    expect(res.status).toBe(422);
  });

  it("finds issues by title across the user's workspaces with context", async () => {
    const ws1 = await createWorkspace(cookie, "Alpha WS");
    const ws2 = await createWorkspace(cookie, "Beta WS");
    const p1 = await createProject(cookie, ws1, "Web");
    const p2 = await createProject(cookie, ws2, "API");
    await createIssue(cookie, p1, "Fix login flow");
    await createIssue(cookie, p2, "Login rate limiting");

    const res = await request(getApp()).get("/api/search?q=login").set("Cookie", cookie).expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.map((i: { workspaceName: string }) => i.workspaceName).sort()).toEqual([
      "Alpha WS",
      "Beta WS",
    ]);
    expect(res.body.items[0].projectName).toBeTruthy();
    expect(res.body.items[0].labels).toEqual([]);
  });

  it("never returns issues from workspaces the user cannot access", async () => {
    const myWs = await createWorkspace(cookie, "Mine");
    const theirWs = await createWorkspace(otherCookie, "Theirs");
    const myProject = await createProject(cookie, myWs, "P1");
    const secretProject = await createProject(otherCookie, theirWs, "P2");
    await createIssue(cookie, myProject, "Shared keyword alpha");
    await createIssue(otherCookie, secretProject, "Shared keyword beta");

    const res = await request(getApp())
      .get("/api/search?q=shared%20keyword")
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].workspaceName).toBe("Mine");
  });

  it("returns an empty result for a user with no workspaces", async () => {
    const nobody = await signupAs("nobody@example.com");
    const empty = await request(getApp()).get("/api/search?q=anything").set("Cookie", nobody).expect(200);
    expect(empty.body).toEqual({ total: 0, items: [] });
  });

  it("matches descriptions and project names", async () => {
    const ws = await createWorkspace(cookie, "WS");
    const p = await createProject(cookie, ws, "Aurora");
    await createIssue(cookie, p, "Unrelated title", { description: "mentions zephyr internally" });
    const byDesc = await request(getApp()).get("/api/search?q=zephyr").set("Cookie", cookie).expect(200);
    expect(byDesc.body.total).toBe(1);
    const byProject = await request(getApp()).get("/api/search?q=aurora").set("Cookie", cookie).expect(200);
    expect(byProject.body.total).toBe(1);
  });

  it("ranks key-prefix matches first and supports #key queries", async () => {
    const ws = await createWorkspace(cookie, "WS");
    const p = await createProject(cookie, ws, "P");
    const targetId = await createIssue(cookie, p, "Ordinary title about caching");
    await createIssue(cookie, p, "Caching considered harmful");

    const key = targetId.replace(/-/g, "").slice(0, 6).toUpperCase();

    const res = await request(getApp())
      .get(`/api/search?q=${encodeURIComponent(`#${key.toLowerCase()}`)}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.items[0].id).toBe(targetId);

    const bare = await request(getApp()).get(`/api/search?q=${key.toLowerCase()}`).set("Cookie", cookie).expect(200);
    expect(bare.body.items[0].id).toBe(targetId);
  });

  it("orders deterministically: exact title > prefix > contains > description", async () => {
    const ws = await createWorkspace(cookie, "WS");
    const p = await createProject(cookie, ws, "P");
    await createIssue(cookie, p, "Sync engine internals", { description: "about delta sync" });
    await createIssue(cookie, p, "Delta sync protocol"); // contains
    await createIssue(cookie, p, "Delta sync"); // exact
    await createIssue(cookie, p, "Delta sync handbook"); // prefix

    const res = await request(getApp()).get("/api/search?q=delta%20sync").set("Cookie", cookie).expect(200);
    const titles = res.body.items.map((i: { title: string }) => i.title);
    expect(titles[0]).toBe("Delta sync");
    expect(titles.indexOf("Delta sync handbook")).toBeLessThan(titles.indexOf("Delta sync protocol"));
    expect(titles.indexOf("Delta sync protocol")).toBeLessThan(titles.indexOf("Sync engine internals"));
  });

  it("treats LIKE wildcards literally instead of as patterns", async () => {
    const ws = await createWorkspace(cookie, "WS");
    const p = await createProject(cookie, ws, "P");
    await createIssue(cookie, p, "Percent sign test");
    await createIssue(cookie, p, "Anything at all");

    const res = await request(getApp())
      .get("/api/search?q=" + encodeURIComponent("%a%"))
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.total).toBe(0); // nothing contains a literal '%a%'

    const underscore = await request(getApp())
      .get("/api/search?q=" + encodeURIComponent("P_t"))
      .set("Cookie", cookie)
      .expect(200);
    // '_' is not a single-char wildcard here: only a literal "P_t" would match.
    expect(underscore.body.total).toBe(0);
  });

  it("caps items at limit while total reflects all authorized matches", async () => {
    const ws = await createWorkspace(cookie, "WS");
    const p = await createProject(cookie, ws, "Bulk");
    for (let i = 0; i < 7; i++) await createIssue(cookie, p, `Bulk item ${i}`);

    const res = await request(getApp())
      .get("/api/search?q=bulk%20item&limit=3")
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.total).toBe(7);
    expect(res.body.items).toHaveLength(3);
  });

  it("includes resolved labels in results", async () => {
    const ws = await createWorkspace(cookie, "WS");
    const p = await createProject(cookie, ws, "P");
    const labelRes = await request(getApp())
      .post(`/api/workspaces/${ws}/labels`)
      .set("Cookie", cookie)
      .send({ name: "infra", color: "olive" })
      .expect(201);
    const id = await createIssue(cookie, p, "Labelled issue", { labelIds: [labelRes.body.label.id] });

    const res = await request(getApp()).get("/api/search?q=labelled").set("Cookie", cookie).expect(200);
    expect(res.body.items[0].id).toBe(id);
    expect(res.body.items[0].labels[0].name).toBe("infra");
  });

  it("sees owned workspace issues without an explicit membership row", async () => {
    const ownedByOther = await createWorkspace(otherCookie, "Other Owned");
    const otherProject = await createProject(otherCookie, ownedByOther, "Q");
    await createIssue(otherCookie, otherProject, "Visible to other only");

    const res = await request(getApp())
      .get("/api/search?q=visible%20to%20other")
      .set("Cookie", otherCookie)
      .expect(200);
    expect(res.body.total).toBe(1);
  });
});
