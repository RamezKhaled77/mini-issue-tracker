import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { issues, projects } from "../db/schema.js";
import { createProjectRecord } from "../domain/project.js";
import { ApiError } from "../api/middleware/error-handler.js";
import type { MembershipService } from "./membership.js";

export interface ProjectServiceDeps {
  db: Db;
  membershipService: MembershipService;
}

export function createProjectService(deps: ProjectServiceDeps) {
  function requireProjectAccess(userId: string, projectId: string) {
    const project = deps.db
      .select({ id: projects.id, workspaceId: projects.workspaceId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
    if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
    deps.membershipService.requireMember(userId, project.workspaceId);
    return project;
  }

  function createProject(workspaceId: string, name: string, userId: string) {
    deps.membershipService.requireMember(userId, workspaceId);
    const project = createProjectRecord(workspaceId, name);
    deps.db.insert(projects).values(project).run();
    return { id: project.id, workspaceId: project.workspaceId, name: project.name };
  }

  function listProjects(workspaceId: string, userId: string) {
    deps.membershipService.requireMember(userId, workspaceId);
    return deps.db
      .select({ id: projects.id, workspaceId: projects.workspaceId, name: projects.name })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .all();
  }

  function renameProject(projectId: string, name: string, userId: string) {
    const project = requireProjectAccess(userId, projectId);
    deps.db
      .update(projects)
      .set({ name, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .run();
    return { id: project.id, workspaceId: project.workspaceId, name };
  }

  function deleteProject(projectId: string, userId: string) {
    requireProjectAccess(userId, projectId);
    deps.db.delete(projects).where(eq(projects.id, projectId)).run();
  }

  function getWorkspaceIdForProject(projectId: string): string {
    const project = deps.db
      .select({ workspaceId: projects.workspaceId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
    if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
    return project.workspaceId;
  }

  function getWorkspaceIdForIssue(issueId: string): string {
    const row = deps.db
      .select({ workspaceId: projects.workspaceId })
      .from(issues)
      .innerJoin(projects, eq(issues.projectId, projects.id))
      .where(eq(issues.id, issueId))
      .get();
    if (!row) throw new ApiError(404, "NOT_FOUND", "Issue not found");
    return row.workspaceId;
  }

  return {
    createProject,
    listProjects,
    renameProject,
    deleteProject,
    requireProjectAccess,
    getWorkspaceIdForProject,
    getWorkspaceIdForIssue,
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;