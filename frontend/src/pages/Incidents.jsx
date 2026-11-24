import { useState } from "react";

import { apiGet, apiPatch } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import IncidentDetail from "../components/IncidentDetail.jsx";
import Modal from "../components/Modal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SectionCard from "../components/SectionCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { infoBannerClass, inputClass, selectClass } from "../components/styles.js";
import { AsyncContent } from "../components/StateViews.jsx";
import { IncidentStatus, Role, Severity } from "../constants/enums.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useResource } from "../hooks/useResource.js";
import { formatDateTime, formatNumber } from "../utils/format.js";

export default function Incidents() {
  const { hasRole } = useAuth();
  const canMutate = hasRole(Role.ANALYST);
  const [sourceId, setSourceId] = useState("");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const sources = useResource(() => apiGet("/api/sources"), []);
  const incidents = useResource(
    () => {
      const params = [];
      if (sourceId) params.push(`source_id=${sourceId}`);
      if (status) params.push(`status=${status}`);
      return apiGet(`/api/incidents${params.length ? `?${params.join("&")}` : ""}`);
    },
    [sourceId, status],
  );
  const detail = useResource(
    () => (selectedId == null ? Promise.resolve(null) : apiGet(`/api/incidents/${selectedId}`)),
    [selectedId],
  );

  const incidentList = Array.isArray(incidents.data) ? incidents.data : [];
  const filtered = incidentList.filter((incident) => {
    if (severity && incident.severity !== severity) return false;
    if (!search.trim()) return true;
    const haystack = [
      incident.field,
      incident.detector,
      incident.explanation,
      incident.recommended_action,
      JSON.stringify(incident.evidence ?? {}),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const selectedIncident =
    detail.data ?? incidentList.find((incident) => incident.id === selectedId) ?? null;
  const sourceName = (id) => sources.data?.find((source) => source.id === id)?.name ?? `#${id}`;

  async function handleStatusChange(nextStatus) {
    setActionError(null);
    try {
      await apiPatch(`/api/incidents/${selectedId}?status=${nextStatus}`, {});
      await Promise.all([detail.reload(), incidents.reload()]);
    } catch (error) {
      setActionError(error.message);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Investigate what changed, where and when it happened, how abnormal it is, why it was flagged and what to do next."
      />

      {!canMutate && (
        <div className={infoBannerClass}>
          Your role has read-only access to incidents. Status changes require an analyst or admin
          role.
        </div>
      )}

      <SectionCard title="Filters">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="text-sm text-slate-600">
            Source
            <select
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              className={`${selectClass} w-full`}
            >
              <option value="">All sources</option>
              {(sources.data ?? []).map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={`${selectClass} w-full`}
            >
              <option value="">All statuses</option>
              {Object.values(IncidentStatus).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Severity
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
              className={`${selectClass} w-full`}
            >
              <option value="">All severities</option>
              {Object.values(Severity).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Field, detector, explanation…"
              className={`${inputClass} w-full`}
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Incident queue"
        description={`${filtered.length} incident(s) in view`}
        actions={
          <button type="button" onClick={incidents.reload} className="text-xs font-medium text-slate-700 underline">
            Refresh
          </button>
        }
      >
        <AsyncContent
          loading={incidents.loading}
          error={incidents.error}
          isEmpty={!filtered.length}
          emptyTitle="No incidents match these filters"
          emptyDescription="Adjust the filters or wait for the next analyzed batch."
          onRetry={incidents.reload}
        >
          <DataTable
            columns={[
              {
                key: "field",
                header: "What",
                render: (row) => (
                  <div>
                    <p className="font-medium text-slate-900">{row.field || "Dataset-level"}</p>
                    <p className="text-xs text-slate-500">{row.detector || "—"}</p>
                  </div>
                ),
              },
              { key: "source", header: "Where", render: (row) => sourceName(row.source_id) },
              {
                key: "created_at",
                header: "When (IST)",
                render: (row) => <span className="whitespace-nowrap">{formatDateTime(row.created_at)}</span>,
              },
              { key: "severity", header: "Severity", render: (row) => <StatusBadge value={row.severity} /> },
              { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
              {
                key: "occurrences",
                header: "Occurrences",
                render: (row) => formatNumber(row.occurrences, 0),
              },
            ]}
            rows={filtered}
            rowKey={(row) => row.id}
            onRowClick={(row) => {
              setActionError(null);
              setSelectedId(row.id);
            }}
          />
        </AsyncContent>
      </SectionCard>

      <Modal
        open={selectedId != null}
        onClose={() => setSelectedId(null)}
        title={`Incident #${selectedId ?? ""}`}
        description="Evidence and investigation notes"
        size="xl"
      >
        <IncidentDetail
          incident={selectedIncident}
          loading={detail.loading && !detail.data}
          error={detail.error}
          sourceName={selectedIncident ? sourceName(selectedIncident.source_id) : undefined}
          canMutate={canMutate}
          busy={false}
          onStatusChange={handleStatusChange}
          onRetry={detail.reload}
        />
        {actionError && <p className="mt-4 text-sm text-red-600">{actionError}</p>}
      </Modal>
    </section>
  );
}
