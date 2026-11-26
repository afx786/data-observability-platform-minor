import { useState } from "react";

import { apiGet, apiPatch } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import IncidentDetail from "../components/IncidentDetail.jsx";
import Modal from "../components/Modal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SectionCard from "../components/SectionCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { infoBannerClass, inputClass, selectClass } from "../components/styles.js";
import { AsyncContent, EmptyState } from "../components/StateViews.jsx";
import { IncidentStatus, Role, Severity } from "../constants/enums.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useResource } from "../hooks/useResource.js";
import { formatDateTime, formatNumber } from "../utils/format.js";

const CARD =
  "stitch-card stitch-card-hover stitch-rise rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.03)] transition-all duration-200 hover:border-[#CBD5E1]";
const SECONDARY =
  "stitch-btn-secondary inline-flex items-center gap-2 rounded border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#1E293B] transition-all hover:border-[#CBD5E1] hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-50";
const TABLE =
  "stitch-table overflow-x-auto rounded-lg border border-[#E2E8F0] [&>div]:rounded-none [&>div]:border-0 [&_table]:w-full [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-[#EEF2F6] [&_th]:border-b [&_th]:border-[#D2D9E2] [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-[#64748B] [&_tbody_tr]:cursor-pointer [&_tbody_tr]:border-b [&_tbody_tr]:border-[#E2E8F0] [&_tbody_tr:nth-child(odd)]:bg-[#FBFBFD] [&_tbody_tr:hover]:bg-[#F4F6F8] [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-[13px] [&_td]:text-[#1E293B] [&_td]:transition-colors";
const FIELD =
  "mt-1 w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#1E293B] outline-none transition focus:border-[#182430] focus:ring-1 focus:ring-[#182430]";

function numericValues(values) {
  return values.map(Number).filter((value) => Number.isFinite(value));
}

function MiniBars({ values, color = "#2563EB", height = "h-9" }) {
  const nums = numericValues(values);
  const max = nums.length ? Math.max(...nums) : 0;
  const pixels = { "h-6": 24, "h-8": 32, "h-9": 36, "h-10": 40 }[height] ?? 36;
  if (!nums.length) {
    return (
      <div
        className="stitch-sparkline items-end"
        style={{ display: "flex", height: pixels }}
        aria-hidden="true"
      >
        <span className="h-px w-full bg-[#E2E8F0]" />
      </div>
    );
  }
  return (
    <div
      className="stitch-sparkline items-end gap-1"
      style={{ display: "flex", height: pixels }}
      aria-hidden="true"
    >
      {nums.map((value, index) => (
        <span
          key={index}
          className="min-w-[6px] flex-1 rounded-t-[2px] transition-all duration-300"
          style={{
            height: `${max ? Math.max(6, (value / max) * 100) : 6}%`,
            backgroundColor: color,
            opacity: 0.35 + (value / (max || 1)) * 0.65,
          }}
        />
      ))}
    </div>
  );
}

function Kpi({ label, value, values, color = "#2563EB", footnote }) {
  return (
    <div className="stitch-kpi stitch-card-hover">
      <div className="flex items-center justify-between gap-3">
        <span className="stitch-label font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
          {label}
        </span>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <p className="mt-3 font-mono text-2xl font-medium tracking-[-0.03em] text-[#0F172A]">
        {value}
      </p>
      <div className="mt-3">
        <MiniBars values={values} color={color} />
      </div>
      {footnote && <p className="mt-2 font-mono text-[10px] text-[#64748B]">{footnote}</p>}
    </div>
  );
}

export default function Incidents() {
  const { hasRole } = useAuth();
  const canMutate = hasRole(Role.ANALYST);
  const [sourceId, setSourceId] = useState("");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [focusOpen, setFocusOpen] = useState(false);
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

  const severityCounts = Object.values(Severity).map(
    (value) => filtered.filter((incident) => incident.severity === value).length,
  );
  const statusCounts = Object.values(IncidentStatus).map(
    (value) => filtered.filter((incident) => incident.status === value).length,
  );
  const occurrenceSeries = filtered.map((incident) => Number(incident.occurrences));

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
    <section className="stitch-page-enter space-y-6">
      <PageHeader
        title={
          <span className="block">
            <span className="stitch-eyebrow mb-2 block font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
              Investigation / Incident workspace
            </span>
            <span
              className="stitch-glow block text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#0F172A] sm:text-[2.5rem]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Incidents
            </span>
          </span>
        }
        description={
          <span className="mt-2 block max-w-3xl text-sm leading-relaxed text-[#475569]">
            Investigate what changed, where and when it happened, how abnormal it is, why it was
            flagged and what to do next.
          </span>
        }
        actions={
          <button
            type="button"
            onClick={incidents.reload}
            className={`${SECONDARY} font-mono text-xs uppercase tracking-[0.1em]`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
            Refresh queue
          </button>
        }
      />

      {!canMutate && (
        <div
          className={`${infoBannerClass} stitch-card flex items-start gap-3 rounded-lg border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs leading-relaxed text-[#475569] shadow-none`}
        >
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#8C6D23]" />
          <span>
            Your role has read-only access to incidents. Status changes require an analyst or admin
            role.
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="In view"
          value={filtered.length}
          values={[filtered.length]}
          color="#182430"
          footnote="After local filters"
        />
        <Kpi
          label="Open"
          value={statusCounts[0]}
          values={statusCounts}
          color="#DC2626"
          footnote="Lifecycle distribution"
        />
        <Kpi
          label="Critical"
          value={severityCounts[3]}
          values={severityCounts}
          color="#8C6D23"
          footnote="Severity distribution"
        />
        <Kpi
          label="Occurrences"
          value={formatNumber(
            occurrenceSeries.reduce((sum, value) => sum + (value || 0), 0),
            0,
          )}
          values={occurrenceSeries}
          color="#2563EB"
          footnote="Across incidents in view"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <SectionCard
            className={`${CARD} xl:sticky xl:top-4`}
            title={
              <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
                Filters
              </span>
            }
            description={
              <span className="mt-1 block text-xs text-[#64748B]">
                Source and status are server-side; severity and search refine the view.
              </span>
            }
          >
            <div className="stitch-divider mb-5 border-t border-[#E2E8F0]" />
            <div className="space-y-4">
              <label className="block">
                <span className="stitch-label mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                  Source
                </span>
                <select
                  value={sourceId}
                  onChange={(event) => setSourceId(event.target.value)}
                  className={`${selectClass} ${FIELD}`}
                >
                  <option value="">All sources</option>
                  {(sources.data ?? []).map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="stitch-label mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                  Status
                </span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className={`${selectClass} ${FIELD}`}
                >
                  <option value="">All statuses</option>
                  {Object.values(IncidentStatus).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="stitch-label mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                  Severity
                </span>
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value)}
                  className={`${selectClass} ${FIELD}`}
                >
                  <option value="">All severities</option>
                  {Object.values(Severity).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="stitch-label mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                  Search
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Field, detector, explanation…"
                  className={`${inputClass} ${FIELD}`}
                />
              </label>
            </div>
            <div className="stitch-divider my-5 border-t border-[#E2E8F0]" />
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-[#64748B]">
              <span>Severity mix</span>
              <MiniBars values={severityCounts} color="#8C6D23" height="h-6" />
            </div>
          </SectionCard>
        </div>

        <div className="xl:col-span-5">
          <SectionCard
            className={`${CARD} h-full`}
            title={
              <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
                Incident queue
              </span>
            }
            description={
              <span className="mt-1 block text-xs text-[#64748B]">
                {filtered.length} incident(s) in view · select a row to inspect evidence
              </span>
            }
          >
            <div className={TABLE}>
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
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                              selectedId === row.id ? "bg-[#2563EB] ring-4 ring-blue-50" : "bg-[#CBD5E1]"
                            }`}
                          />
                          <div>
                            <p className="stitch-mono font-medium text-[#0F172A]">
                              {row.field || "Dataset-level"}
                            </p>
                            <p className="font-mono text-[11px] text-[#64748B]">
                              {row.detector || "—"}
                            </p>
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "source",
                      header: "Where",
                      render: (row) => (
                        <span className="text-xs text-[#475569]">{sourceName(row.source_id)}</span>
                      ),
                    },
                    {
                      key: "created_at",
                      header: "When (IST)",
                      render: (row) => (
                        <span className="stitch-mono whitespace-nowrap font-mono text-[11px]">
                          {formatDateTime(row.created_at)}
                        </span>
                      ),
                    },
                    {
                      key: "severity",
                      header: "Severity",
                      render: (row) => <StatusBadge value={row.severity} />,
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (row) => <StatusBadge value={row.status} />,
                    },
                    {
                      key: "occurrences",
                      header: "Occurrences",
                      render: (row) => (
                        <span className="stitch-mono font-mono text-xs">
                          {formatNumber(row.occurrences, 0)}
                        </span>
                      ),
                    },
                  ]}
                  rows={filtered}
                  rowKey={(row) => row.id}
                  onRowClick={(row) => {
                    setActionError(null);
                    setFocusOpen(false);
                    setSelectedId(row.id);
                  }}
                />
              </AsyncContent>
            </div>
          </SectionCard>
        </div>

        <div className="xl:col-span-4">
          <SectionCard
            className={`${CARD} h-full`}
            title={
              <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
                Evidence panel
              </span>
            }
            description={
              <span className="mt-1 block text-xs text-[#64748B]">
                {selectedId != null
                  ? `Incident #${selectedId} · expected vs observed, evidence and next action`
                  : "Select an incident to begin the investigation"}
              </span>
            }
            actions={
              selectedId != null ? (
                <button
                  type="button"
                  onClick={() => setFocusOpen(true)}
                  className={`${SECONDARY} px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em]`}
                >
                  Focus view
                </button>
              ) : null
            }
          >
            <div className="stitch-divider mb-5 border-t border-[#E2E8F0]" />
            {selectedId == null ? (
              <div className="stitch-empty [&>div]:rounded-lg [&>div]:border-[#CBD5E1] [&>div]:bg-[#F8FAFC]">
                <EmptyState
                  title="No incident selected"
                  description="Choose a row from the queue to see its evidence, explanation and lifecycle controls."
                />
              </div>
            ) : (
              <div className="space-y-4">
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
                {actionError && (
                  <p className="rounded border border-red-200 bg-red-50 px-3 py-2 font-mono text-xs text-red-700">
                    {actionError}
                  </p>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <Modal
        open={focusOpen && selectedId != null}
        onClose={() => setFocusOpen(false)}
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
