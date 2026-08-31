import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client.js";
import type { Label } from "@mini-issue-tracker/shared";
import { PageHeader } from "../components/PageHeader.js";
import { LabelsSection } from "../components/LabelsSection.js";
import { SkeletonRows } from "../components/Skeleton.js";
import { Alert } from "../components/Alert.js";

/**
 * Dedicated labels management route (spec 012 §7): `/workspaces/:id/labels`.
 * Reuses LabelsSection unchanged on the workbench layout (no project rail).
 */
export function LabelsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [name, setName] = useState("Workspace");
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    api
      .get<{ workspace: { name: string } }>(`/workspaces/${workspaceId}`)
      .then((res) => setName(res.workspace.name))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load workspace"));
    loadLabels();
  }, [workspaceId]);

  async function loadLabels() {
    if (!workspaceId) return;
    try {
      const res = await api.get<{ items: Label[] }>(`/workspaces/${workspaceId}/labels`);
      setLabels(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load labels");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="labels-page">
      <PageHeader
        title={name}
        eyebrow="Workspace"
        backTo={{ to: `/workspaces/${workspaceId}`, label: "Back to issues" }}
      />
      {error && (
        <Alert role="alert" className="page-alert">
          {error}
        </Alert>
      )}
      {loading ? (
        <SkeletonRows rows={3} />
      ) : (
        <LabelsSection
          workspaceId={workspaceId!}
          labels={labels}
          loading={loading}
          onChange={loadLabels}
        />
      )}
    </section>
  );
}