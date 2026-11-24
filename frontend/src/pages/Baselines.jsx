import { useEffect, useState } from "react";

import { apiGet, apiPost } from "../api/client.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import DataTable from "../components/DataTable.jsx";
import JsonPanel from "../components/JsonPanel.jsx";
import KeyValues from "../components/KeyValues.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SectionCard from "../components/SectionCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { infoBannerClass, primaryButtonClass, selectClass } from "../components/styles.js";
import { AsyncContent, EmptyState } from "../components/StateViews.jsx";
import { Role } from "../constants/enums.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useResource } from "../hooks/useResource.js";
import { formatDateTime, safeJson } from "../utils/format.js";

export default function Baselines() {
  const { hasRole } = useAuth();
  const canMutate = hasRole(Role.ANALYST);
  const [sourceId, setSourceId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const sources = useResource(() => apiGet("/api/sources"), []);
  const baselines = useResource(() => apiGet("/api/baselines"), []);
  const active = useResource(
    () =>
      sourceId
        ? apiGet(`/api/baselines/active?source_id=${sourceId}`)
        : Promise.resolve(null),
    [sourceId],
  );

  useEffect(() => {
    if (!sourceId && Array.isArray(sources.data) && sources.data.length) {
      setSourceId(String(sources.data[0].id));
    }
  }, [sources.data, sourceId]);

  const baselineList = Array.isArray(baselines.data) ? baselines.data : [];
  const selectedSource = sources.data?.find((source) => String(source.id) === String(sourceId));
  const activeBaseline = active.data;
  const activeMetadata =
    baselineList.find((baseline) => baseline.id === activeBaseline?.id) ??
    baselineList.find(
      (baseline) =>
        Number(baseline.source_id) === Number(sourceId) &&
        baseline.version === activeBaseline?.version,
    );

  async function approve() {
    setApproving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiPost(`/api/baselines?source_id=${sourceId}`, {});
      setConfirmOpen(false);
      setMessage(`Baseline v${result.version} approved and active.`);
      await Promise.all([baselines.reload(), active.reload()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setApproving(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Baselines"
        description="Versioned reference profiles, their model versions and explicit approval history."
        actions={
          <>
            <select
              aria-label="Source"
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              className={`${selectClass} mt-0 w-56`}
            >
              <option value="">Select a source…</option>
              {(sources.data ?? []).map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
            {canMutate && (
              <button
                type="button"
                disabled={!sourceId}
                onClick={() => setConfirmOpen(true)}
                className={primaryButtonClass}
              >
                Approve new baseline
              </button>
            )}
          </>
        }
      />

      <div className={infoBannerClass}>
        Baselines change only when a user explicitly approves a new version. Viewing windows,
        filters and dashboard charts never modify a baseline or its model.
      </div>

      {(error || message) && (
        <div className="space-y-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}
        </div>
      )}

      <SectionCard
        title="Active baseline"
        description={
          selectedSource
            ? `Reference profile for ${selectedSource.name}`
            : "Select a source to inspect its active baseline"
        }
      >
        {!sourceId ? (
          <EmptyState title="No source selected" />
        ) : (
          <AsyncContent loading={active.loading} error={active.error} onRetry={active.reload}>
            {activeBaseline ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge value="active" />
                  <span className="text-sm font-medium text-slate-900">Version {activeBaseline.version}</span>
                  <span className="text-xs text-slate-500">
                    Model version: {activeMetadata?.model_version ?? "not set"}
                  </span>
                  <span className="text-xs text-slate-500">
                    Reference window:{" "}
                    {activeMetadata?.reference_window
                      ? safeJson(activeMetadata.reference_window)
                      : "—"}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Reference statistics
                  </p>
                  <KeyValues
                    value={{
                      row_count: activeBaseline.statistics?.row_count,
                      column_count: activeBaseline.statistics?.column_count,
                      duplicate_rate: activeBaseline.statistics?.duplicate_rate,
                      freshness_hours: activeBaseline.statistics?.freshness_hours,
                      date_coverage: activeBaseline.statistics?.date_coverage,
                    }}
                  />
                  <div className="mt-5">
                    <JsonPanel value={activeBaseline.statistics ?? {}} title="Full statistics" />
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No active baseline"
                description="Approve a baseline after at least one profile exists for this source."
              />
            )}
          </AsyncContent>
        )}
      </SectionCard>

      <SectionCard title="Baseline versions" description="All approved versions across sources">
        <AsyncContent
          loading={baselines.loading}
          error={baselines.error}
          isEmpty={!baselineList.length}
          emptyTitle="No baselines approved yet"
          emptyDescription="Approve a baseline to start comparing new profiles against a reference."
          onRetry={baselines.reload}
        >
          <DataTable
            columns={[
              { key: "id", header: "ID", render: (row) => `#${row.id}` },
              {
                key: "source",
                header: "Source",
                render: (row) => sources.data?.find((source) => source.id === row.source_id)?.name ?? `#${row.source_id}`,
              },
              { key: "version", header: "Version", render: (row) => `v${row.version}` },
              {
                key: "reference_window",
                header: "Reference window",
                render: (row) => (
                  <span className="block max-w-xs truncate font-mono text-xs" title={safeJson(row.reference_window)}>
                    {safeJson(row.reference_window)}
                  </span>
                ),
              },
              { key: "model_version", header: "Model version", render: (row) => row.model_version ?? "—" },
              { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
              { key: "created_at", header: "Approved (IST)", render: (row) => formatDateTime(row.created_at) },
            ]}
            rows={baselineList}
            rowKey={(row) => row.id}
          />
        </AsyncContent>
      </SectionCard>

      {!canMutate && (
        <p className="text-xs text-slate-500">
          Baseline approval requires an analyst or admin role.
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Approve a new baseline?"
        description={`This creates a new active reference from the latest profile for ${selectedSource?.name ?? "this source"}. The previous active version will be superseded. This is an explicit change — it never happens automatically.`}
        confirmLabel="Approve baseline"
        busy={approving}
        onConfirm={approve}
        onClose={() => setConfirmOpen(false)}
      />
    </section>
  );
}
