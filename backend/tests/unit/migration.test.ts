import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../../src/db/migrations");

function migrationSql(version: number): string {
  const prefix = String(version).padStart(4, "0");
  const file = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.startsWith(`${prefix}_`))
    .sort()[0];
  return fs.readFileSync(path.join(migrationsDir, file), "utf8");
}

describe("migration 0002_user_display_name (SC-006)", () => {
  it("applies cleanly to a 0001-schema database and preserves existing rows with a null name", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");

    sqlite.exec(migrationSql(1));
    sqlite.pragma("user_version = 1");

    sqlite
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run("u-legacy", "legacy@example.com", "hash", Date.now(), Date.now());
    sqlite
      .prepare(
        `INSERT INTO workspaces (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run("ws-1", "Legacy Workspace", "u-legacy", Date.now(), Date.now());

    runMigrations(sqlite);

    expect(sqlite.pragma("user_version", { simple: true })).toBe(4);

    const user = sqlite
      .prepare(`SELECT id, email, name FROM users WHERE id = ?`)
      .get("u-legacy") as { id: string; email: string; name: string | null };
    expect(user.id).toBe("u-legacy");
    expect(user.email).toBe("legacy@example.com");
    expect(user.name).toBeNull();

    const workspace = sqlite
      .prepare(`SELECT id, name, owner_id FROM workspaces WHERE id = ?`)
      .get("ws-1") as { id: string; name: string; owner_id: string };
    expect(workspace.name).toBe("Legacy Workspace");
    expect(workspace.owner_id).toBe("u-legacy");

    sqlite.close();
  });

  it("adds a nullable name column without touching other tables (non-destructive)", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");

    sqlite.exec(migrationSql(1));
    sqlite.pragma("user_version = 1");
    runMigrations(sqlite);

    const columns = sqlite.prepare(`PRAGMA table_info(users)`).all() as { name: string; notnull: number }[];
    const nameCol = columns.find((c) => c.name === "name");
    expect(nameCol).toBeDefined();
    expect(nameCol!.notnull).toBe(0);

    const tables = (sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      .all() as { name: string }[]).map((t) => t.name);
    expect(tables).toContain("users");
    expect(tables).toContain("issues");
    expect(tables).toContain("comments");

    const userColumns = columns.map((c) => c.name);
    expect(userColumns).toContain("name");
    expect(userColumns).toEqual(
      expect.arrayContaining(["id", "email", "password_hash", "created_at", "updated_at"])
    );

    sqlite.close();
  });

  describe("migration 0003_label_color (SC-007)", () => {
    it("applies cleanly to a 0001+0002 database and gives legacy labels the default color", () => {
      const sqlite = new Database(":memory:");
      sqlite.pragma("foreign_keys = ON");

      sqlite.exec(migrationSql(1));
      sqlite.exec(migrationSql(2));
      sqlite.pragma("user_version = 2");

      sqlite
        .prepare(
          `INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        )
        .run("u-legacy", "legacy@example.com", "hash", Date.now(), Date.now());
      sqlite
        .prepare(
          `INSERT INTO workspaces (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        )
        .run("ws-1", "Legacy Workspace", "u-legacy", Date.now(), Date.now());
      sqlite
        .prepare(`INSERT INTO labels (id, workspace_id, name) VALUES (?, ?, ?)`)
        .run("l-1", "ws-1", "bug");

      runMigrations(sqlite);

      expect(sqlite.pragma("user_version", { simple: true })).toBe(4);

      const label = sqlite
        .prepare(`SELECT id, workspace_id, name, color FROM labels WHERE id = ?`)
        .get("l-1") as { id: string; workspace_id: string; name: string; color: string };
      expect(label.id).toBe("l-1");
      expect(label.workspace_id).toBe("ws-1");
      expect(label.name).toBe("bug");
      expect(label.color).toBe("violet");

      const tables = (sqlite
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
        )
        .all() as { name: string }[]).map((t) => t.name);
      expect(tables).toContain("labels");
      expect(tables).toContain("issue_labels");
      expect(tables).toContain("issues");

      sqlite.close();
    });

    it("adds a not-null color column without touching other tables (non-destructive)", () => {
      const sqlite = new Database(":memory:");
      sqlite.pragma("foreign_keys = ON");

      sqlite.exec(migrationSql(1));
      sqlite.exec(migrationSql(2));
      sqlite.pragma("user_version = 2");
      runMigrations(sqlite);

      const columns = sqlite.prepare(`PRAGMA table_info(labels)`).all() as {
        name: string;
        notnull: number;
        dflt_value: string | null;
      }[];
      const colorCol = columns.find((c) => c.name === "color");
      expect(colorCol).toBeDefined();
      expect(colorCol!.notnull).toBe(1);
      expect(colorCol!.dflt_value).toBe("'violet'");

      const labelColumns = columns.map((c) => c.name);
      expect(labelColumns).toEqual(expect.arrayContaining(["id", "workspace_id", "name", "color"]));

      sqlite.close();
    });
  });
});