import { useEffect, useMemo, useState } from "react";

import { apiGet, apiPost } from "../api/client.js";
import { apiUpload } from "../api/extended.js";
import DataTable from "../components/DataTable.jsx";
import FormField from "../components/FormField.jsx";
import JsonPanel from "../components/JsonPanel.jsx";
import { AsyncContent, EmptyState } from "../components/StateViews.jsx";
import {
  checkboxClass,
  infoBannerClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  selectClass,
  textareaClass,
} from "../components/styles.js";
import { Role, SourceType, WINDOW_HOURS_MAX, WINDOW_HOURS_MIN } from "../constants/enums.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useResource } from "../hooks/useResource.js";
import { formatDateTime, formatNumber, formatRate, ratePercent } from "../utils/format.js";

const hours = Array.from(
  { length: WINDOW_HOURS_MAX - WINDOW_HOURS_MIN + 1 },
  (_, index) => index + WINDOW_HOURS_MIN,
);

const emptySource = {
  name: "",
  description: "",
  source_type: SourceType.CSV,
  window_hours: 1,
  timestamp_column: "",
  sheet_name: "",
  table: "",
  query: "",
  database_url: "",
  url: "",
  method: "GET",
  headers: "{}",
  auth_header: "",
  json_path: "",
  paginated: false,
  page_param: "page",
  max_pages: 10,
};

const emptyUpload = { file: null, name: "", window_hours: 1, timestamp_column: "", source_id: "" };

const TYPE_LABELS = {
  [SourceType.CSV]: "CSV",
  [SourceType.EXCEL]: "Excel",
  [SourceType.POSTGRESQL]: "PostgreSQL",
  [SourceType.REST_API]: "REST API",
};

const FILTERS = [
  { key: "all", label: "All", types: null },
  { key: "file", label: "File", types: [SourceType.CSV, SourceType.EXCEL] },
  { key: "postgresql", label: "PostgreSQL", types: [SourceType.POSTGRESQL] },
  { key: "rest", label: "REST", types: [SourceType.REST_API] },
];

function headingStyle() {
  return { fontFamily: '"Playfair Display", Georgia, serif', letterSpacing: "-0.02em" };
}

function countOf(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  if (value == null || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 1;
}

function configSummary(config = {}) {
  const parts = [`${config.window_hours ?? 1}h window`];
  if (config.table) parts.push(`table: ${config.table}`);
  if (config.query) parts.push("custom query");
  if (config.url) parts.push(`url: ${config.url}`);
  if (config.sheet_name) parts.push(`sheet: ${config.sheet_name}`);
  if (config.timestamp_column) parts.push(`time: ${config.timestamp_column}`);
  return parts.join(" · ");
}

function buildConfig(form) {
  const config = {
    source_type: form.source_type,
    window_hours: Number(form.window_hours),
  };
  const timestamp = form.timestamp_column.trim();
  if (timestamp) config.timestamp_column = timestamp;

  if (form.source_type === SourceType.EXCEL && form.sheet_name.trim()) {
    config.sheet_name = form.sheet_name.trim();
  }

  if (form.source_type === SourceType.POSTGRESQL) {
    if (!form.table.trim() && !form.query.trim()) {
      throw new Error("Provide either a table name or a SQL query for PostgreSQL.");
    }
    if (form.table.trim()) config.table = form.table.trim();
    if (form.query.trim()) config.query = form.query.trim();
    if (form.database_url.trim()) config.database_url = form.database_url.trim();
  }

  if (form.source_type === SourceType.REST_API) {
    if (!form.url.trim()) throw new Error("Provide the REST endpoint URL.");
    config.url = form.url.trim();
    config.method = form.method;
    try {
      config.headers = JSON.parse(form.headers || "{}");
    } catch {
      throw new Error("Headers must be a valid JSON object.");
    }
    if (form.auth_header.trim()) config.auth_header = form.auth_header.trim();
    config.json_path = form.json_path.trim();
    config.paginated = form.paginated;
    config.page_param = form.page_param.trim() || "page";
    config.max_pages = Number(form.max_pages);
  }

  return config;
}

function relativeAge(value) {
  if (!value) return "—";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function sparkPaths(values, width = 100, height = 35) {
  const numbers = (values ?? []).map(Number).filter(Number.isFinite);
  if (!numbers.length) return null;
  const series = numbers.length === 1 ? [numbers[0], numbers[0]] : numbers;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const step = width / (series.length - 1);
  const inset = 3;
  const points = series.map((value, index) => [
    index * step,
    height - inset - ((value - min) / span) * (height - inset * 2),
  ]);
  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  return { line, area: `${line} L${width},${height} L0,${height} Z` };
}

function Sparkline({ values }) {
  const paths = sparkPaths(values);
  return (
    <svg className="stitch-sparkline h-10 w-28 text-blue-600" viewBox="0 0 100 35" preserveAspectRatio="none" fill="none" aria-hidden="true">
      {paths ? (
        <>
          <path d={paths.area} fill="currentColor" fillOpacity="0.12" />
          <path d={paths.line} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <path d="M0 32 H100" stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />
      )}
    </svg>
  );
}

function Drawer({ open, onClose, eyebrow, title, description, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="stitch-card flex h-full w-full max-w-xl flex-col overflow-hidden rounded-none border-l border-slate-200 shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div className="space-y-1">
            <p className="stitch-eyebrow text-blue-600">{eyebrow}</p>
            <h2 className="text-xl font-semibold text-slate-950" style={headingStyle()}>{title}</h2>
            {description && <p className="text-xs text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50/70 px-6 py-6">{children}</div>

        {footer && (
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4 shadow-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sources() {
  const { hasRole } = useAuth();
  const canMutate = hasRole(Role.ANALYST);
  const [selectedId, setSelectedId] = useState(null);
  const [sourceForm, setSourceForm] = useState(emptySource);
  const [uploadForm, setUploadForm] = useState(emptyUpload);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pollingId, setPollingId] = useState(null);
  const [pollResult, setPollResult] = useState(null);
  const [formError, setFormError] = useState(null);
  const [message, setMessage] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  const sources = useResource(() => apiGet("/api/sources"), []);
  const detail = useResource(
    () => (selectedId == null ? Promise.resolve(null) : apiGet(`/api/sources/${selectedId}`)),
    [selectedId],
  );
  const batches = useResource(() => apiGet("/api/ingestion/batches"), []);
  const profiles = useResource(() => apiGet("/api/profiles"), []);
  const rules = useResource(() => apiGet("/api/rules"), []);

  useEffect(() => {
    if (selectedId == null && Array.isArray(sources.data) && sources.data.length) {
      setSelectedId(sources.data[0].id);
    }
  }, [sources.data, selectedId]);

  const sourceList = Array.isArray(sources.data) ? sources.data : [];
  const batchList = Array.isArray(batches.data) ? batches.data : [];
  const fileSources = sourceList.filter((source) =>
    [SourceType.CSV, SourceType.EXCEL].includes(source.source_type),
  );
  const selectedSource = sourceList.find((source) => source.id === selectedId);
  const selectedBatches = batchList.filter(
    (batch) => (batch.source_id ?? batch.data_source_id) === selectedId,
  );

  const batchesBySource = useMemo(() => {
    const map = new Map();
    batchList.forEach((batch) => {
      const id = batch.source_id ?? batch.data_source_id;
      if (id == null) return;
      const list = map.get(id) ?? [];
      list.push(batch);
      map.set(id, list);
    });
    map.forEach((list) =>
      list.sort(
        (a, b) =>
          new Date(b.received_at ?? 0).getTime() - new Date(a.received_at ?? 0).getTime(),
      ),
    );
    return map;
  }, [batchList]);

  const operationalCount = sourceList.filter((source) => {
    const status = String(source.status ?? "").toLowerCase();
    return status === "active" || status === "healthy";
  }).length;
  const attentionCount = sourceList.length - operationalCount;
  const profileList = Array.isArray(profiles.data) ? profiles.data : [];
  const ruleList = Array.isArray(rules.data) ? rules.data : [];
  const enabledRules = ruleList.filter((rule) => rule.enabled).length;
  const hasSentinelData = Boolean(profileList.length || ruleList.length || batchList.length);

  function updateSourceForm(field, value) {
    setSourceForm((current) => ({ ...current, [field]: value }));
  }

  function updateUploadForm(field, value) {
    setUploadForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError(null);
    setMessage(null);
    setCreating(true);
    try {
      const config = buildConfig(sourceForm);
      const created = await apiPost("/api/sources", {
        name: sourceForm.name.trim(),
        description: sourceForm.description.trim() || null,
        config,
      });
      setSourceForm(emptySource);
      setMessage(`Source "${created.name}" created.`);
      await sources.reload();
      if (created.id != null) setSelectedId(created.id);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    setFormError(null);
    setMessage(null);
    if (!uploadForm.file) {
      setFormError("Choose a CSV or Excel file first.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append(
        "name",
        uploadForm.name.trim() || uploadForm.file.name.replace(/\.[^.]+$/, ""),
      );
      formData.append("window_hours", String(uploadForm.window_hours));
      if (uploadForm.timestamp_column.trim()) {
        formData.append("timestamp_column", uploadForm.timestamp_column.trim());
      }
      if (uploadForm.source_id !== "") formData.append("source_id", uploadForm.source_id);

      const results = await apiUpload("/api/ingestion/upload", formData);
      setMessage(
        `Ingested ${results.length} dataset${results.length === 1 ? "" : "s"}: ${results
          .map((result) => `${result.source_name} (${result.row_count} rows, ${result.incidents} incidents)`)
          .join("; ")}`,
      );
      setUploadForm(emptyUpload);
      await Promise.all([sources.reload(), batches.reload()]);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handlePoll(source) {
    setFormError(null);
    setPollingId(source.id);
    try {
      const result = await apiPost(`/api/sources/${source.id}/poll`, {});
      setPollResult(result);
      setMessage(`Polled "${source.name}".`);
      await batches.reload();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setPollingId(null);
    }
  }

  function openUpload(source) {
    setFormError(null);
    setMessage(null);
    if (source?.id != null) {
      setUploadForm((current) => ({ ...current, source_id: String(source.id) }));
    }
    setUploadOpen(true);
  }

  const filteredSources = sourceList.filter((source) => {
    const selected = FILTERS.find((entry) => entry.key === filter);
    return !selected?.types || selected.types.includes(source.source_type);
  });

  const createFooter = (
    <>
      <button
        type="button"
        className={secondaryButtonClass}
        onClick={() => {
          setCreateOpen(false);
          setFormError(null);
        }}
      >
        Cancel
      </button>
      <button type="submit" form="create-source-form" disabled={creating} className={primaryButtonClass}>
        {creating ? "Creating…" : "Create source"}
      </button>
    </>
  );

  return (
    <section className="stitch-page-enter stitch-glow relative space-y-8">

      {/* Editorial header */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="stitch-eyebrow text-blue-600">DATA_OBSERVABILITY // INFRASTRUCTURE</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl" style={headingStyle()}>
            Connected Data Sources
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Telemetry pipelines, database connectors and ingestion health contracts across{" "}
            {formatNumber(sourceList.length, 0)} configured sources. Only profiles and evidence are
            retained — raw rows are never shown.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setMessage("Source contracts synchronized.");
              Promise.all([sources.reload(), batches.reload(), profiles.reload(), rules.reload()]);
            }}
            className="stitch-btn-secondary flex items-center gap-2"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M16 7a6 6 0 0 0-10.5-2M4 13a6 6 0 0 0 10.5 2M4 3v3h3M16 17v-3h-3" />
            </svg>
            Sync Contracts
          </button>
          {canMutate && (
            <button type="button" onClick={() => setCreateOpen(true)} className="stitch-btn-primary flex items-center gap-2">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M3 8V4h4M17 12v4h-4M3 4l6 6m8 6-6-6" />
              </svg>
              Connect Pipeline
            </button>
          )}
        </div>
      </header>

      <div className={infoBannerClass}>
        window_hours selects the time window for a view or comparison. It never changes a baseline
        or a model.
      </div>

      {(formError || message) && (
        <div className="space-y-2" role="status">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}
        </div>
      )}

      {/* Filters and telemetry ribbon */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-sm">
          {FILTERS.map((entry) => {
            const count = entry.types
              ? sourceList.filter((source) => entry.types.includes(source.source_type)).length
              : sourceList.length;
            return (
              <button
                key={entry.key}
                type="button"
                aria-pressed={filter === entry.key}
                onClick={() => setFilter(entry.key)}
                className={`stitch-chip px-4 py-1.5 ${
                  filter === entry.key
                    ? "!border-slate-900 !bg-slate-900 !text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                {entry.label} <span className="stitch-mono ml-1 opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="stitch-mono flex flex-wrap items-center gap-4 self-start rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs shadow-sm md:self-auto">
          <span className="flex items-center gap-1.5 font-medium text-slate-900">
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
            {formatNumber(operationalCount, 0)} operational
          </span>
          <span className="h-3 w-px bg-slate-200" />
          <span className={`flex items-center gap-1.5 ${attentionCount ? "text-amber-700" : "text-slate-500"}`}>
            <span className={`h-2 w-2 rounded-full ${attentionCount ? "bg-amber-500" : "bg-slate-300"}`} />
            {formatNumber(attentionCount, 0)} need attention
          </span>
        </div>
      </div>

      {/* Source card grid */}
      <AsyncContent
        loading={sources.loading}
        error={sources.error}
        isEmpty={!filteredSources.length}
        emptyTitle={filter === "all" ? "No sources configured" : `No ${filter} sources`}
        emptyDescription="Create a source or upload a file to get started."
        onRetry={sources.reload}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSources.map((source) => {
            const sourceBatches = batchesBySource.get(source.id) ?? [];
            const latest = sourceBatches[0];
            const rows = latest?.row_count ?? 0;
            const flagged = latest?.flagged_rows ?? 0;
            const health = rows > 0 ? 100 - ratePercent(flagged / rows) : null;
            const status = String(source.status ?? "unknown").toLowerCase();
            const isHealthy = status === "active" || status === "healthy";
            const needsAttention = ["degraded", "down", "error"].includes(status);
            const isPollable = [SourceType.POSTGRESQL, SourceType.REST_API].includes(source.source_type);
            const isFile = [SourceType.CSV, SourceType.EXCEL].includes(source.source_type);

            return (
              <article
                key={source.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(source.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(source.id);
                  }
                }}
                className={`stitch-card stitch-card-hover stitch-rise flex min-h-[280px] flex-col justify-between p-6 focus:outline-none focus:ring-1 focus:ring-slate-900 ${
                  needsAttention ? "border-amber-200" : ""
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="stitch-chip !bg-slate-100 !text-slate-800">
                        {TYPE_LABELS[source.source_type] ?? String(source.source_type ?? "—").toUpperCase()}
                      </span>
                      <span className={`stitch-badge ${isHealthy ? "border-emerald-200 bg-emerald-50 text-emerald-700" : needsAttention ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                        <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${isHealthy ? "bg-emerald-500" : needsAttention ? "bg-amber-500 animate-pulse" : "bg-slate-400"}`} />
                        {source.status ?? "unknown"}
                      </span>
                    </div>
                    <span className="stitch-mono text-xs text-slate-400">#{source.id}</span>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-slate-900" style={headingStyle()}>
                      {source.name}
                    </h2>
                    <p className="stitch-mono mt-1 truncate text-xs text-slate-500" title={configSummary(source.config)}>
                      {configSummary(source.config)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <span className="stitch-label text-slate-500">Last batch rows</span>
                      <div className="flex items-baseline gap-1">
                        <span className="stitch-mono text-xl font-semibold tracking-tight text-slate-950">
                          {formatNumber(rows, 0)}
                        </span>
                        <span className="stitch-mono text-[11px] text-blue-600">
                          {sourceBatches.length} batch{sourceBatches.length === 1 ? "" : "es"}
                        </span>
                      </div>
                    </div>
                    <Sparkline values={sourceBatches.slice(0, 8).reverse().map((batch) => batch.row_count)} />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <span className="stitch-mono flex items-center gap-1.5 text-[11px] text-slate-500">
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" />
                    </svg>
                    Polling: {latest ? relativeAge(latest.received_at) : "no batches yet"}
                  </span>
                  <span className={`stitch-mono flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium ${health == null ? "border-slate-200 bg-slate-50 text-slate-500" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${health == null ? "bg-slate-400" : "bg-emerald-500"}`} />
                    {health == null ? "Awaiting telemetry" : `Health ${formatNumber(health, 1)}%`}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                  {isPollable &&
                    (canMutate ? (
                      <button
                        type="button"
                        disabled={pollingId === source.id}
                        onClick={() => handlePoll(source)}
                        className={`${secondaryButtonClass} px-2 py-1 text-xs`}
                      >
                        {pollingId === source.id ? "Polling…" : "Poll now"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Read-only</span>
                    ))}
                  {isFile &&
                    (canMutate ? (
                      <button
                        type="button"
                        onClick={() => openUpload(source)}
                        className="stitch-label !text-blue-600 hover:!text-blue-800"
                      >
                        Upload context →
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Read-only</span>
                    ))}
                </div>
              </article>
            );
          })}
        </div>
      </AsyncContent>

      {/* Selected source inspector — keeps configuration and batch history available */}
      {selectedSource && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="stitch-card">
            <div className="border-b border-slate-100 pb-4">
              <p className="stitch-eyebrow text-blue-600">SOURCE CONTRACT</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900" style={headingStyle()}>
                {selectedSource.name}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {detail.data?.description || "No description provided"}
              </p>
            </div>
            <AsyncContent loading={detail.loading} error={detail.error} onRetry={detail.reload}>
              <div className="pt-4">
                <JsonPanel value={detail.data?.config ?? selectedSource.config ?? {}} title="Configuration" />
              </div>
            </AsyncContent>
          </section>

          <section className="stitch-card">
            <div className="border-b border-slate-100 pb-4">
              <p className="stitch-eyebrow text-blue-600">BATCH HISTORY</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900" style={headingStyle()}>
                Recent ingestion batches
              </h2>
            </div>
            <AsyncContent
              loading={batches.loading}
              error={batches.error}
              isEmpty={!selectedBatches.length}
              emptyTitle="No batches yet"
              emptyDescription="Upload a file or poll an external source to create a batch."
              onRetry={batches.reload}
            >
              <div className="pt-4">
                <DataTable
                  columns={[
                    { key: "id", header: "Batch", render: (row) => <span className="stitch-mono">#{row.id}</span> },
                    { key: "status", header: "Status", render: (row) => <span className="stitch-badge bg-slate-50 text-slate-700">{row.status}</span> },
                    {
                      key: "received_at",
                      header: "Received (IST)",
                      render: (row) => <span className="stitch-mono text-xs">{formatDateTime(row.received_at)}</span>,
                    },
                    {
                      key: "window_start",
                      header: "Window start (IST)",
                      render: (row) => <span className="stitch-mono text-xs">{formatDateTime(row.window_start)}</span>,
                    },
                    { key: "row_count", header: "Rows", render: (row) => formatNumber(row.row_count, 0) },
                    { key: "flagged_rows", header: "Flagged", render: (row) => formatNumber(row.flagged_rows, 0) },
                  ]}
                  rows={selectedBatches.slice(0, 10)}
                  rowKey={(row) => row.id}
                />
              </div>
            </AsyncContent>
          </section>
        </div>
      )}

      {pollResult && (
        <section className="stitch-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="stitch-eyebrow text-blue-600">POLL RESULTS</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900" style={headingStyle()}>
                Source #{pollResult.source_id ?? "—"}
              </h2>
            </div>
            <button type="button" onClick={() => setPollResult(null)} className={secondaryButtonClass}>
              Dismiss
            </button>
          </div>
          <div className="pt-4">
            {Array.isArray(pollResult.results) && pollResult.results.length ? (
              <DataTable
                columns={[
                  { key: "source_name", header: "Source", render: (row) => row.source_name ?? `#${row.source_id}` },
                  { key: "batch_id", header: "Batch", render: (row) => (row.batch_id == null ? "—" : `#${row.batch_id}`) },
                  { key: "row_count", header: "Rows", render: (row) => formatNumber(row.row_count, 0) },
                  { key: "findings", header: "Findings", render: (row) => formatNumber(countOf(row.findings), 0) },
                  { key: "incidents", header: "Incidents", render: (row) => formatNumber(countOf(row.incidents), 0) },
                ]}
                rows={pollResult.results}
              />
            ) : (
              <EmptyState title="No new data returned" description="The poll completed without a new batch." />
            )}
          </div>
        </section>
      )}

      {/* Ingestion Contract Sentinel */}
      <section className="stitch-card stitch-hover-lift flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-xl space-y-2">
          <p className="stitch-eyebrow flex items-center gap-2 text-blue-600">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M10 2 4 5v5c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V5l-6-3Zm-3 8 2 2 4-4" />
            </svg>
            INGESTION CONTRACT SENTINEL
          </p>
          <h2 className="text-lg font-semibold text-slate-900" style={headingStyle()}>
            Automated Schema Evolution Engine
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Background sampling evaluates type coercion, nullability shifts and SLA variance against
            the profiles and rules recorded for these connectors.
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 xl:w-auto">
          {[
            {
              label: "Validated profiles",
              value: hasSentinelData ? formatNumber(profileList.length, 0) : "—",
              note: hasSentinelData ? "Stored measurements" : "Awaiting first profile",
            },
            {
              label: "Rules enforced",
              value: hasSentinelData ? `${formatNumber(enabledRules, 0)}/${formatNumber(ruleList.length, 0)}` : "—",
              note: hasSentinelData ? "Enabled / configured" : "Awaiting first rule",
            },
            {
              label: "Batches observed",
              value: hasSentinelData ? formatNumber(batchList.length, 0) : "—",
              note: hasSentinelData ? "Recent ingestion window" : "Awaiting first batch",
            },
          ].map((stat) => (
            <div key={stat.label} className="stitch-card stitch-rise min-w-[150px] !bg-slate-50 p-4">
              <span className="stitch-label text-slate-500">{stat.label}</span>
              <div className="stitch-mono mt-2 text-2xl font-semibold tracking-tight text-slate-950">{stat.value}</div>
              <span className="stitch-mono mt-1 block text-[11px] text-blue-700">{stat.note}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Connect pipeline drawer */}
      <Drawer
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setFormError(null);
        }}
        eyebrow="PIPELINE INTEGRATION"
        title="Configure New Data Source"
        description="Select a connector, describe its view window and save the contract."
        footer={createFooter}
      >
        <form id="create-source-form" onSubmit={handleCreate} className="space-y-6">
          <div className="space-y-2">
            <span className="stitch-label text-slate-800">Connector engine</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Source type">
              {Object.values(SourceType).map((type) => {
                const active = sourceForm.source_type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateSourceForm("source_type", type)}
                    className={`stitch-card stitch-card-hover p-3 text-left text-xs font-medium ${
                      active ? "!border-slate-900 !bg-slate-900 !text-white" : "text-slate-600"
                    }`}
                  >
                    {TYPE_LABELS[type] ?? type}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="source-name">
              <input
                id="source-name"
                required
                value={sourceForm.name}
                onChange={(event) => updateSourceForm("name", event.target.value)}
                className={inputClass}
                placeholder="Orders feed"
              />
            </FormField>
            <FormField label="Window hours" htmlFor="source-window" hint="1–24 hours">
              <select
                id="source-window"
                value={sourceForm.window_hours}
                onChange={(event) => updateSourceForm("window_hours", Number(event.target.value))}
                className={selectClass}
              >
                {hours.map((hour) => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Description" htmlFor="source-description">
            <input
              id="source-description"
              value={sourceForm.description}
              onChange={(event) => updateSourceForm("description", event.target.value)}
              className={inputClass}
              placeholder="Optional context for investigators"
            />
          </FormField>

          <FormField label="Timestamp column" htmlFor="source-timestamp" hint="Used for freshness and date coverage">
            <input
              id="source-timestamp"
              value={sourceForm.timestamp_column}
              onChange={(event) => updateSourceForm("timestamp_column", event.target.value)}
              className={inputClass}
              placeholder="event_time"
            />
          </FormField>

          {sourceForm.source_type === SourceType.EXCEL && (
            <FormField label="Sheet name" htmlFor="source-sheet">
              <input
                id="source-sheet"
                value={sourceForm.sheet_name}
                onChange={(event) => updateSourceForm("sheet_name", event.target.value)}
                className={inputClass}
                placeholder="Orders"
              />
            </FormField>
          )}

          {sourceForm.source_type === SourceType.POSTGRESQL && (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Provide a table or a query (query wins if both are set).</p>
              <FormField label="Table" htmlFor="source-table">
                <input
                  id="source-table"
                  value={sourceForm.table}
                  onChange={(event) => updateSourceForm("table", event.target.value)}
                  className={inputClass}
                  placeholder="public.orders"
                />
              </FormField>
              <FormField label="Query" htmlFor="source-query">
                <textarea
                  id="source-query"
                  value={sourceForm.query}
                  onChange={(event) => updateSourceForm("query", event.target.value)}
                  className={textareaClass}
                  placeholder="SELECT * FROM public.orders"
                />
              </FormField>
              <FormField label="Database URL" htmlFor="source-db-url" hint="Optional — defaults to the server configuration">
                <input
                  id="source-db-url"
                  value={sourceForm.database_url}
                  onChange={(event) => updateSourceForm("database_url", event.target.value)}
                  className={inputClass}
                  placeholder="postgresql://…"
                />
              </FormField>
            </div>
          )}

          {sourceForm.source_type === SourceType.REST_API && (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
              <FormField label="URL" htmlFor="source-url">
                <input
                  id="source-url"
                  required
                  value={sourceForm.url}
                  onChange={(event) => updateSourceForm("url", event.target.value)}
                  className={inputClass}
                  placeholder="https://api.example.com/orders"
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Method" htmlFor="source-method">
                  <select
                    id="source-method"
                    value={sourceForm.method}
                    onChange={(event) => updateSourceForm("method", event.target.value)}
                    className={selectClass}
                  >
                    {["GET", "POST"].map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="JSON path" htmlFor="source-json-path" hint="Dot path to the records array">
                  <input
                    id="source-json-path"
                    value={sourceForm.json_path}
                    onChange={(event) => updateSourceForm("json_path", event.target.value)}
                    className={inputClass}
                    placeholder="data.orders"
                  />
                </FormField>
              </div>
              <FormField label="Headers (JSON)" htmlFor="source-headers">
                <textarea
                  id="source-headers"
                  value={sourceForm.headers}
                  onChange={(event) => updateSourceForm("headers", event.target.value)}
                  className={textareaClass}
                  placeholder='{"Accept": "application/json"}'
                />
              </FormField>
              <FormField label="Auth header" htmlFor="source-auth" hint="Optional header name carrying a secret">
                <input
                  id="source-auth"
                  value={sourceForm.auth_header}
                  onChange={(event) => updateSourceForm("auth_header", event.target.value)}
                  className={inputClass}
                  placeholder="X-API-Key"
                />
              </FormField>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={sourceForm.paginated}
                  onChange={(event) => updateSourceForm("paginated", event.target.checked)}
                  className={checkboxClass}
                />
                Paginated responses
              </label>
              {sourceForm.paginated && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Page parameter" htmlFor="source-page-param">
                    <input
                      id="source-page-param"
                      value={sourceForm.page_param}
                      onChange={(event) => updateSourceForm("page_param", event.target.value)}
                      className={inputClass}
                    />
                  </FormField>
                  <FormField label="Max pages" htmlFor="source-max-pages">
                    <input
                      id="source-max-pages"
                      type="number"
                      min={1}
                      max={100}
                      value={sourceForm.max_pages}
                      onChange={(event) => updateSourceForm("max_pages", Number(event.target.value))}
                      className={inputClass}
                    />
                  </FormField>
                </div>
              )}
            </div>
          )}

          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </form>
      </Drawer>

      {/* Upload drawer */}
      <Drawer
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setFormError(null);
        }}
        eyebrow="INGESTION CONTEXT"
        title="Upload CSV / Excel"
        description="Uploaded data is profiled immediately; raw rows are never displayed."
        footer={
          <>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                setUploadOpen(false);
                setFormError(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" form="upload-source-form" disabled={uploading} className={primaryButtonClass}>
              {uploading ? "Uploading…" : "Upload and analyze"}
            </button>
          </>
        }
      >
        <form id="upload-source-form" onSubmit={handleUpload} className="space-y-4">
          <FormField label="File" htmlFor="upload-file">
            <input
              id="upload-file"
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              required
              onChange={(event) => updateUploadForm("file", event.target.files?.[0] ?? null)}
              className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs`}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Source name" htmlFor="upload-name" hint="Defaults to the file name">
              <input
                id="upload-name"
                value={uploadForm.name}
                onChange={(event) => updateUploadForm("name", event.target.value)}
                className={inputClass}
                placeholder="Orders export"
              />
            </FormField>
            <FormField label="Window hours" htmlFor="upload-window">
              <select
                id="upload-window"
                value={uploadForm.window_hours}
                onChange={(event) => updateUploadForm("window_hours", Number(event.target.value))}
                className={selectClass}
              >
                {hours.map((hour) => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Timestamp column" htmlFor="upload-timestamp">
            <input
              id="upload-timestamp"
              value={uploadForm.timestamp_column}
              onChange={(event) => updateUploadForm("timestamp_column", event.target.value)}
              className={inputClass}
              placeholder="event_time"
            />
          </FormField>
          <FormField
            label="Reuse an existing file source"
            htmlFor="upload-source"
            hint="Keeps the schema, baseline and incident history attached to that source"
          >
            <select
              id="upload-source"
              value={uploadForm.source_id}
              onChange={(event) => updateUploadForm("source_id", event.target.value)}
              className={selectClass}
            >
              <option value="">Create a new source</option>
              {fileSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} (#{source.id})
                </option>
              ))}
            </select>
          </FormField>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </form>
      </Drawer>

      {canMutate && !uploadOpen && !createOpen && (
        <div className="flex justify-end">
          <button type="button" onClick={() => openUpload()} className={secondaryButtonClass}>
            Upload CSV / Excel
          </button>
        </div>
      )}
    </section>
  );
}
