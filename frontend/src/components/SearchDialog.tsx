import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import type { SearchIssue } from "@mini-issue-tracker/shared";
import { SEARCH_DEFAULT_LIMIT, SEARCH_MIN_LENGTH } from "@mini-issue-tracker/shared";
import { api } from "../api/client.js";
import { Avatar } from "./Avatar.js";
import { Badge } from "./Badge.js";
import type { BadgeTone } from "./Badge.js";
import { Dialog } from "./Dialog.js";
import { Field } from "./Field.js";
import { SkeletonRows } from "./Skeleton.js";
import { Alert } from "./Alert.js";
import { issueKey } from "../lib/issueKey.js";
import { isOverdue } from "../lib/isOverdue.js";
import { labelTone } from "../lib/labelTone.js";

const DEBOUNCE_MS = 250;

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "results"; total: number; items: SearchIssue[] };

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const navigate = useNavigate();

  // Reset the transient query whenever the overlay is closed.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setState({ kind: "idle" });
      setActiveIndex(-1);
    } else {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const runSearch = useCallback(async (trimmed: string) => {
    const requestId = ++requestIdRef.current;
    setState({ kind: "loading" });
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await api.search(trimmed, {
        limit: SEARCH_DEFAULT_LIMIT,
        signal: controller.signal,
      });
      if (requestId !== requestIdRef.current) return; // stale response — discard
      setState({ kind: "results", total: res.total, items: res.items });
      setActiveIndex(res.items.length ? 0 : -1);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (requestId !== requestIdRef.current) return;
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Search failed",
      });
    }
  }, []);

  // Debounced search effect.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      requestIdRef.current++; // invalidate any in-flight request
      abortRef.current?.abort();
      setState({ kind: "idle" });
      setActiveIndex(-1);
      return;
    }
    const timer = window.setTimeout(() => void runSearch(trimmed), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, open, runSearch]);

  const results = state.kind === "results" ? state.items : [];
  const truncated = state.kind === "results" && state.total > state.items.length;

  function activate(issue: SearchIssue) {
    onClose();
    navigate(`/workspaces/${issue.workspaceId}/issues/${issue.id}`);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent) {
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      activate(results[activeIndex]);
    }
  }

  function handleClear() {
    setQuery("");
    inputRef.current?.focus();
  }


  let body: ReactNode;
  if (state.kind === "idle") {
    body = (
      <div className="search-empty">
        <span className="search-eyebrow">SEARCH</span>
        <p className="search-hint">
          {query.trim().length > 0
            ? `Type at least ${SEARCH_MIN_LENGTH} characters.`
            : "Find issues across your workspaces."}
        </p>
      </div>
    );
  } else if (state.kind === "loading") {
    body = (
      <div className="search-results-region">
        <SkeletonRows rows={4} />
      </div>
    );
  } else if (state.kind === "error") {
    body = (
      <div className="search-results-region">
        <Alert role="status">{state.message}</Alert>
      </div>
    );
  } else if (state.items.length === 0) {
    body = (
      <div className="search-results-region">
        <p className="search-noresults">No issues match “{query.trim()}”.</p>
      </div>
    );
  } else {
    body = (
      <>
        <p className="search-count" role="status">
          {state.total} {state.total === 1 ? "result" : "results"}
          {truncated ? ` · showing first ${state.items.length}` : ""}
        </p>
        <ul className="ledger-list search-list">
          {state.items.map((issue, index) => (
            <li key={issue.id} className="ledger-item">
              <Link
                to={`/workspaces/${issue.workspaceId}/issues/${issue.id}`}
                className={`ledger-row ledger-row--search${index === activeIndex ? " ledger-row--active" : ""}`}
                data-priority={issue.priority.toLowerCase()}
                data-overdue={isOverdue(issue.dueDate, issue.status) ? "true" : undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={onClose}
              >
                <span className="ticket-key">{issueKey(issue.id)}</span>
                <span className="ledger-main">
                  <span className="ledger-title">{issue.title}</span>
                </span>
                <span className="ledger-meta">
                  <span className="ledger-context">
                    {issue.workspaceName} / {issue.projectName}
                  </span>
                  {isOverdue(issue.dueDate, issue.status) && <Badge tone="danger">Overdue</Badge>}
                  <Badge tone={`status-${issue.status.toLowerCase().replace(" ", "-")}` as BadgeTone}>
                    {issue.status}
                  </Badge>
                  <Badge tone={`priority-${issue.priority.toLowerCase()}` as BadgeTone}>
                    {issue.priority}
                  </Badge>
                  {issue.labels.slice(0, 2).map((label) => (
                    <Badge key={label.id} tone={labelTone(label.color)}>
                      {label.name}
                    </Badge>
                  ))}
                  {issue.assignee && (
                    <span className="card-assignee">
                      <Avatar name={issue.assignee.name} decorative small />
                      {issue.assignee.name}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Search issues"
      description="Find issues across your workspaces"
    >
      <div className="search-dialog" onKeyDown={handleInputKeyDown}>
        <Field label="Search issues" srOnlyLabel>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, key (#A1B2C3), or project…"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        {query && (
          <button type="button" className="search-clear" onClick={handleClear} aria-label="Clear search">
            ×
          </button>
        )}
        <div className="search-body">{body}</div>
      </div>
    </Dialog>
  );
}
