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

const CARD =
  "stitch-card stitch-card-hover stitch-rise rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.03)] transition-all duration-200 hover:border-[#CBD5E1]";
const PRIMARY =
  "stitch-btn-primary stitch-shine inline-flex items-center gap-2 rounded bg-[#182430] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0F172A] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";
const TABLE =
  "stitch-table overflow-x-auto rounded-lg border border-[#E2E8F0] [&>div]:rounded-none [&>div]:border-0 [&_table]:w-full [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-[#EEF2F6] [&_th]:border-b [&_th]:border-[#D2D9E2] [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-[#64748B] [&_tbody_tr]:border-b [&_tbody_tr]:border-[#E2E8F0] [&_tbody_tr:nth-child(odd)]:bg-[#FBFBFD] [&_tbody_tr:hover]:bg-[#F4F6F8] [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-[13px] [&_td]:text-[#1E293B] [&_td]:transition-colors";
const FIELD =
  "mt-1 w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#1E293B] outline-none transition focus:border-[#182430] focus:ring-1 focus:ring-[#182430]";

function numericValues(values) {
  return values.map(Number).filter((value) => Number.isFinite(value));
}

function MiniBars({ values, color = "#8C6D23", height = "h-9" }) {
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

function Kpi({ label, value, values, footnote, color = "#8C6D23" }) {
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

  const sourceVersions = baselineList
    .filter((baseline) => Number(baseline.source_id) === Number(sourceId))
    .slice()
    .sort((a, b) => {
      const left = new Date(a.created_at ?? 0).getTime();
      const right = new Date(b.created_at ?? 0).getTime();
      return right - left || Number(b.version ?? 0) - Number(a.version ?? 0);
    });
  const coveredSources = new Set(baselineList.map((baseline) => baseline.source_id)).size;
  const latestApproval = baselineList
    .map((baseline) => baseline.created_at)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const versionSeries = baselineList.map((baseline) => Number(baseline.version));

  function isActiveVersion(baseline) {
    if (!activeBaseline) return false;
    if (baseline.id != null && activeBaseline.id != null) return baseline.id === activeBaseline.id;
    return (
      Number(baseline.source_id) === Number(activeBaseline.source_id) &&
      baseline.version === activeBaseline.version
    );
  }

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
    <section className="stitch-page-enter space-y-6">
      <PageHeader
        title={
          <span className="block">
            <span className="stitch-eyebrow mb-2 block font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
              Governance / Reference profiles
            </span>
            <span
              className="stitch-glow block text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#0F172A] sm:text-[2.5rem]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Baselines
            </span>
          </span>
        }
        description={
          <span className="mt-2 block max-w-3xl text-sm leading-relaxed text-[#475569]">
            Versioned reference profiles, their model versions and explicit approval history.
          </span>
        }
        actions={
          <>
            <label className="block">
              <span className="stitch-label mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                Data source
              </span>
              <select
                aria-label="Source"
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                className={`${selectClass} ${FIELD} mt-0 w-56`}
              >
                <option value="">Select a source…</option>
                {(sources.data ?? []).map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            {canMutate && (
              <button
                type="button"
                disabled={!sourceId}
                onClick={() => setConfirmOpen(true)}
                className={`${primaryButtonClass} ${PRIMARY}`}
              >
                Approve new baseline
              </button>
            )}
          </>
        }
      />

      <div
        className={`${infoBannerClass} stitch-card flex items-start gap-3 rounded-lg border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs leading-relaxed text-[#475569] shadow-none`}
      >
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#8C6D23]" />
        <span>
          Baselines change only when a user explicitly approves a new version. Viewing windows,
          filters and dashboard charts never modify a baseline or its model.
        </span>
      </div>

      {(error || message) && (
        <div className="space-y-2 font-mono text-xs">
          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>
          )}
          {message && (
            <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
              {message}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Approved versions"
          value={baselineList.length}
          values={versionSeries}
          footnote="Across all sources"
        />
        <Kpi
          label="Active version"
          value={activeBaseline?.version != null ? `v${activeBaseline.version}` : "—"}
          values={[activeBaseline?.version ?? 0]}
          footnote={selectedSource?.name ?? "No source selected"}
          color="#16A34A"
        />
        <Kpi
          label="Sources covered"
          value={coveredSources}
          values={[coveredSources]}
          footnote="With a reference profile"
          color="#2563EB"
        />
        <Kpi
          label="Latest approval"
          value={latestApproval ? formatDateTime(latestApproval) : "—"}
          values={versionSeries.slice(-8)}
          footnote="Most recently approved"
          color="#DC2626"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <SectionCard
            className={`${CARD} h-full`}
            title={
              <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
                Version timeline
              </span>
            }
            description={
              <span className="mt-1 block text-xs text-[#64748B]">
                Approval history for {selectedSource?.name ?? "the selected source"}
              </span>
            }
          >
            <div className="stitch-divider mb-5 border-t border-[#E2E8F0]" />
            <AsyncContent
              loading={baselines.loading}
              error={baselines.error}
              isEmpty={!sourceVersions.length}
              emptyTitle="No versions for this source"
              emptyDescription="Approve a baseline to start its reference history."
              onRetry={baselines.reload}
            >
              <ol className="relative space-y-4 border-l border-[#E2E8F0] pl-6">
                {sourceVersions.map((baseline) => {
                  const activeVersion = isActiveVersion(baseline);
                  return (
                    <li key={baseline.id ?? baseline.version} className="relative">
                      <span
                        className={`absolute -left-[29px] top-2 h-3 w-3 rounded-full border-2 border-white ${
                          activeVersion
                            ? "stitch-glow bg-[#16A34A] ring-4 ring-emerald-50"
                            : "bg-[#CBD5E1]"
                        }`}
                      />
                      <div
                        className={`rounded-lg border p-4 transition-all duration-200 hover:border-[#CBD5E1] ${
                          activeVersion
                            ? "border-emerald-200 bg-emerald-50/40 shadow-sm"
                            : "border-[#E2E8F0] bg-[#F8FAFC]"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-lg font-medium tracking-[-0.02em] text-[#0F172A]">
                            v{baseline.version}
                          </span>
                          {activeVersion ? (
                            <StatusBadge value="active" />
                          ) : (
                            <StatusBadge value={baseline.status ?? "superseded"} />
                          )}
                        </div>
                        <div className="mt-2 grid gap-1 font-mono text-[11px] text-[#64748B]">
                          <span>model: {baseline.model_version ?? "not set"}</span>
                          <span>window: {safeJson(baseline.reference_window)}</span>
                          <span>approved: {formatDateTime(baseline.created_at)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </AsyncContent>
          </SectionCard>
        </div>

        <div className="xl:col-span-7">
          <SectionCard
            className={`${CARD} h-full`}
            title={
              <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
                Active baseline
              </span>
            }
            description={
              <span className="mt-1 block text-xs text-[#64748B]">
                {selectedSource
                  ? `Reference profile for ${selectedSource.name}`
                  : "Select a source to inspect its active baseline"}
              </span>
            }
            actions={activeBaseline && <StatusBadge value="active" />}
          >
            <div className="stitch-divider mb-5 border-t border-[#E2E8F0]" />
            {!sourceId ? (
              <div className="stitch-empty [&>div]:rounded-lg [&>div]:border-[#CBD5E1] [&>div]:bg-[#F8FAFC]">
                <EmptyState title="No source selected" />
              </div>
            ) : (
              <AsyncContent loading={active.loading} error={active.error} onRetry={active.reload}>
                {activeBaseline ? (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A] ring-4 ring-emerald-100" />
                      <span className="font-mono text-lg font-medium text-[#0F172A]">
                        Version {activeBaseline.version}
                      </span>
                      <span className="font-mono text-[11px] text-[#64748B]">
                        model: {activeMetadata?.model_version ?? "not set"}
                      </span>
                      <span className="font-mono text-[11px] text-[#64748B]">
                        window:{" "}
                        {activeMetadata?.reference_window
                          ? safeJson(activeMetadata.reference_window)
                          : "—"}
                      </span>
                    </div>
                    <div className="border-t border-[#E2E8F0] pt-4">
                      <p className="stitch-label mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
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
                  <div className="stitch-empty [&>div]:rounded-lg [&>div]:border-[#CBD5E1] [&>div]:bg-[#F8FAFC]">
                    <EmptyState
                      title="No active baseline"
                      description="Approve a baseline after at least one profile exists for this source."
                    />
                  </div>
                )}
              </AsyncContent>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard
        className={CARD}
        title={
          <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
            All baseline versions
          </span>
        }
        description={
          <span className="mt-1 block text-xs text-[#64748B]">
            Approved versions across sources · newest first
          </span>
        }
      >
        <div className={TABLE}>
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
                { key: "id", header: "ID", render: (row) => <span className="stitch-mono font-mono text-xs">#{row.id}</span> },
                {
                  key: "source",
                  header: "Source",
                  render: (row) =>
                    sources.data?.find((source) => source.id === row.source_id)?.name ?? `#${row.source_id}`,
                },
                { key: "version", header: "Version", render: (row) => <span className="stitch-mono font-mono text-xs">v{row.version}</span> },
                {
                  key: "reference_window",
                  header: "Reference window",
                  render: (row) => (
                    <span
                      className="stitch-mono block max-w-xs truncate font-mono text-xs text-[#475569]"
                      title={safeJson(row.reference_window)}
                    >
                      {safeJson(row.reference_window)}
                    </span>
                  ),
                },
                {
                  key: "model_version",
                  header: "Model version",
                  render: (row) => <span className="stitch-mono font-mono text-xs">{row.model_version ?? "—"}</span>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <StatusBadge value={row.status} />,
                },
                {
                  key: "created_at",
                  header: "Approved (IST)",
                  render: (row) => (
                    <span className="stitch-mono whitespace-nowrap font-mono text-[11px]">
                      {formatDateTime(row.created_at)}
                    </span>
                  ),
                },
              ]}
              rows={baselineList}
              rowKey={(row) => row.id}
            />
          </AsyncContent>
        </div>
      </SectionCard>

      {!canMutate && (
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#64748B]">
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
