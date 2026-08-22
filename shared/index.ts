export const ISSUE_STATUSES = ["Open", "In Progress", "Closed"] as const;
export const ISSUE_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export const LABEL_COLORS = ["violet", "magenta", "indigo", "olive", "sand", "plum"] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];
export type LabelColor = (typeof LABEL_COLORS)[number];

export interface Identity {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  name: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  isOwner: boolean;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
}

export interface Issue {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId: string | null;
  assignee: Identity | null;
  labelIds: string[];
  labels: Label[];
  dueDate: string | null;
}

export interface MyIssue extends Issue {
  workspaceId: string;
  projectName: string;
  workspaceName: string;
}

export interface MyIssuesOverview {
  total: number;
  byStatus: Record<IssueStatus, number>;
  overdue: number;
}

export interface MyIssuesResponse {
  overview: MyIssuesOverview;
  items: MyIssue[];
}

export interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  author: Identity;
  body: string;
  createdAt: string;
}

export type ActivityType =
  | "issue.created"
  | "issue.updated"
  | "issue.labels_added"
  | "issue.labels_removed"
  | "issue.deleted";

export type ActivityField =
  | "status"
  | "priority"
  | "assignee"
  | "due_date"
  | "title"
  | "description";

export interface Activity {
  id: string;
  issueId: string;
  actorId: string;
  actorName: string;
  type: ActivityType;
  field?: ActivityField;
  fromValue?: string | null;
  toValue?: string | null;
  labelIds?: string[] | null;
  labelNames?: string[] | null;
  createdAt: string;
}

export interface ActivityListResponse {
  items: Activity[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Label {
  id: string;
  workspaceId: string;
  name: string;
  color: LabelColor;
}

export interface Invitation {
  token: string;
  expiresAt: string;
}

export interface DashboardStats {
  byStatus: Record<IssueStatus, number>;
  byPriority: Record<IssuePriority, number>;
  total: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiErrorShape {
  error: {
    code: "VALIDATION" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT";
    message: string;
    fields?: Record<string, string>;
  };
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface SigninRequest {
  email: string;
  password: string;
}

export interface CreateWorkspaceRequest {
  name: string;
}

export interface JoinWorkspaceRequest {
  token: string;
}

export interface CreateProjectRequest {
  name: string;
}

export interface UpdateProjectRequest {
  name: string;
}

export interface CreateIssueRequest {
  title: string;
  description?: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId?: string | null;
  labelIds?: string[];
  dueDate?: string | null;
}

export type UpdateIssueRequest = Partial<CreateIssueRequest>;

export interface CreateCommentRequest {
  body: string;
}

export interface CreateLabelRequest {
  name: string;
  color: LabelColor;
}

export interface UpdateLabelRequest {
  name?: string;
  color?: LabelColor;
}

export interface IssueQueryParams {
  search?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: string;
  labelId?: string;
  page?: number;
  pageSize?: number;
}

/* Bulk actions (Spec 007). */
export const BULK_ISSUE_LIMIT = 20;

export type BulkIssueAction =
  | "setStatus"
  | "setPriority"
  | "assign"
  | "addLabels"
  | "removeLabels"
  | "delete";

export interface BulkIssueRequest {
  action: BulkIssueAction;
  issueIds: string[];
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: string | null;
  labelIds?: string[];
}

export interface BulkIssueResponse {
  issueIds: string[];
  count: number;
}
