import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiGet, apiPatch } from "../api/client.js";
import IncidentDetail from "../components/IncidentDetail.jsx";
import Modal from "../components/Modal.jsx";
import { AsyncContent } from "../components/StateViews.jsx";
import { Role, Severity } from "../constants/enums.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useResource } from "../hooks/useResource.js";
import { formatDateTime, formatNumber, formatRate, formatTime, ratePercent } from "../utils/format.js";

const SEVERITY_TONES = {
  [Severity.LOW]: { stripe: "bg-sky-500", chip: "bg-sky-50 text-sky-700 border-sky-200" },
  [Severity.MEDIUM]: { stripe: "bg-amber-500", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  [Severity.HIGH]: { stripe: "bg-orange-500", chip: "bg-orange-50 text-orange-700 border-orange-200" },
  [Severity.CRITICAL]: { stripe: "bg-rose-500", chip: "bg-rose-50 text-rose-700 border-rose-200" },
};

const RANGES = [1, 6, 24];

function headingStyle() {
  return { fontFamily: '"Playfair Display", Georgia, serif', letterSpacing: "-0.02em" };
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
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function sparkPaths(values, width = 120, height = 28) {
  const numbers = (values ?? []).map(Number).filter(Number.isFinite);
  if (!numbers.length) return null;
  const series = numbers.length === 1 ? [numbers[0], numbers[0]] : numbers;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const step = width / (series.length - 1);
  const inset = 2;
  const points = series.map((value, index) => [
    index * step,
    height - inset - ((value - min) / span) * (height - inset * 2),
  ]);
  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  return { line, area: `${line} L${width},${height} L0,${height} Z` };
}

function Sparkline({ values, className = "" }) {
  const paths = sparkPaths(values);
  return (
    <svg
      className={`stitch-sparkline h-8 w-full ${className}`}
      viewBox="0 0 120 28"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      {paths ? (
        <>
          <path d={paths.area} fill="currentColor" fillOpacity="0.12" />
          <path d={paths.line} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <path d="M0 26 H120" stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />
      )}
    </svg>
  );
}

function MetricIcon({ name, className = "" }) {
  const paths = {
    sources: <path d="M12 3v6m0 0-6 5m6-5 6 5M6 14v7m12-7v7M6 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />,
    health: <path d="M12 3 4 6v6c0 4.4 3.1 7.7 8 9 4.9-1.3 8-4.6 8-9V6l-8-3Zm-3 9 2 2 4-4" />,
    incidents: <path d="M12 4 3 19h18L12 4Zm0 5v5m0 3h.01" />,
    anomaly: <path d="M4 18h16M6 15l4-5 4 3 4-7" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-5 w-5 ${className}`}
      aria-hidden="true"
    >
      {paths[name] ?? paths.sources}
    </svg>
  );
}

function KpiCard({ label, icon, children, footer, tone = "text-blue-600" }) {
  return (
    <article className="stitch-kpi stitch-card-hover relative flex min-h-[168px] flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="stitch-label text-slate-500">{label}</span>
        <span className={tone}>
          <MetricIcon name={icon} />
        </span>
      </div>
      <div className="my-3">{children}</div>
      {footer && <div className="space-y-2 text-xs text-slate-500">{footer}</div>}
    </article>
  );
}

export default function Dashboard() {
  const { hasRole } = useAuth();
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [windowHours, setWindowHours] = useState(24);

  const sources = useResource(() => apiGet("/api/sources"), []);
  const summary = useResource(
    () => apiGet(`/api/monitoring/summary?window_hours=${windowHours}`),
    [windowHours],
  );
  const incidents = useResource(() => apiGet("/api/incidents"), []);
  const detail = useResource(
    () =>
      selectedIncidentId == null
        ? Promise.resolve(null)
        : apiGet(`/api/incidents/${selectedIncidentId}`),
    [selectedIncidentId],
  );

  const metrics = summary.data ?? {};
  const rawTrend = Array.isArray(metrics.trend) ? metrics.trend : [];
  const trend = rawTrend.map((point, index) => ({
    ...point,
    tick: point.label ? formatTime(point.label).replace(" IST", "") : `#${index + 1}`,
    anomaly_rate: ratePercent(point.anomaly_rate),
  }));
  const rowValues = trend.map((point) => Number(point.rows) || 0);
  const peakRows = rowValues.length ? Math.max(...rowValues) : 0;
  const meanRows = rowValues.length
    ? rowValues.reduce((sum, value) => sum + value, 0) / rowValues.length
    : 0;
  const sigma = Math.sqrt(
    rowValues.reduce((sum, value) => sum + (value - meanRows) ** 2, 0) /
      Math.max(rowValues.length, 1),
  );
  const upperSigma = meanRows + 3 * sigma;
  const withinSigma = rowValues.length
    ? (rowValues.filter((value) => value <= upperSigma).length / rowValues.length) * 100
    : 0;
  const peakPoint = trend.reduce(
    (best, point) => (!best || point.anomaly_rate > best.anomaly_rate ? point : best),
    null,
  );
  const anomalyDelta = trend.length > 1
    ? trend[trend.length - 1].anomaly_rate - trend[0].anomaly_rate
    : 0;

  const incidentList = Array.isArray(incidents.data) ? incidents.data : [];
  const openIncidents = incidentList.filter((incident) => incident.status !== "resolved");
  const openCount = metrics.open_incidents ?? openIncidents.length;
  const criticalCount =
    metrics.critical_incidents ??
    openIncidents.filter((incident) => incident.severity === Severity.CRITICAL).length;
  const mediumCount = openIncidents.filter((incident) => incident.severity === Severity.MEDIUM).length;
  const anomalyPercent = ratePercent(metrics.anomaly_rate);
  const healthScore = Math.max(
    0,
    Math.min(100, 100 - anomalyPercent * 2 - Number(openCount || 0) * 0.8 - Number(criticalCount || 0) * 1.2),
  );
  const selectedIncident =
    detail.data ?? incidentList.find((incident) => incident.id === selectedIncidentId) ?? null;
  const selectedSource = sources.data?.find((source) => source.id === selectedIncident?.source_id);

  const sourceMatrix = new Map();
  rawTrend.forEach((point) => {
    const id = point.source_id;
    if (id == null) return;
    const current = sourceMatrix.get(id) ?? { rows: 0, flagged: 0, last: null };
    current.rows += Number(point.rows) || 0;
    current.flagged += Number(point.flagged_rows) || 0;
    if (!current.last || new Date(point.label) > new Date(current.last)) current.last = point.label;
    sourceMatrix.set(id, current);
  });
  const sourceList = Array.isArray(sources.data) ? sources.data : [];

  const sourceNameFor = (id) =>
    sourceList.find((source) => source.id === id)?.name ?? `#${id ?? "—"}`;

  return (
    <section className="stitch-page-enter stitch-glow relative space-y-8">

      {/* Editorial header */}
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="stitch-eyebrow text-blue-600">DATA_OBSERVABILITY // EXECUTIVE TELEMETRY</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl" style={headingStyle()}>
            Observability Overview
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
            Continuous statistical inference across monitored pipelines. Structural drift,
            anomalous volume shifts and schema mutability are evaluated in one calm view; the
            selected window changes what you see, never a baseline or a model.
          </p>
          <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
            <span className="font-medium">
              Telemetry engine active · {formatNumber(metrics.batches ?? 0, 0)} batches in view · evaluated{" "}
              {trend.length ? relativeAge(trend[trend.length - 1].label) : "awaiting first batch"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {RANGES.map((hours) => (
              <button
                key={hours}
                type="button"
                onClick={() => setWindowHours(hours)}
                className={`stitch-chip px-3 py-1 ${
                  windowHours === hours
                    ? "!border-slate-900 !bg-slate-900 !text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
                aria-pressed={windowHours === hours}
              >
                {hours}h
              </button>
            ))}
            <button
              type="button"
              disabled
              title="Supports up to 24h"
              className="stitch-chip cursor-not-allowed px-3 py-1 !text-slate-400"
            >
              7d
            </button>
          </div>
          <Link to="/monitoring" className="stitch-btn-secondary flex items-center gap-2">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M3 4h14M3 10h14M3 16h14M7 4v12M13 4v12" />
            </svg>
            Run Global Validation
          </Link>
          <Link to="/incidents" className="stitch-btn-primary flex items-center gap-2">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="m11 2-7 10h5l-1 6 7-10h-5l1-6Z" />
            </svg>
            Trigger Incident Drill
          </Link>
        </div>
      </header>

      {/* KPI quadrant */}
      <AsyncContent
        loading={summary.loading}
        error={summary.error}
        onRetry={summary.reload}
        emptyTitle="No health metrics available"
      >
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total Sources"
            icon="sources"
            footer={
              <>
                <div className="flex items-center justify-between">
                  <span>
                    {formatNumber(metrics.sources ?? sourceList.length, 0)} configured · {formatNumber(metrics.batches ?? 0, 0)} batches
                  </span>
                  <span className="stitch-mono font-semibold text-blue-700">
                    {formatNumber(metrics.total_rows ?? 0, 0)} rows
                  </span>
                </div>
                <Sparkline values={rowValues} className="text-blue-600" />
              </>
            }
          >
            <div className="flex items-baseline gap-2">
              <span className="stitch-mono text-4xl font-semibold tracking-tight text-slate-950">
                {formatNumber(metrics.sources ?? sourceList.length, 0)}
              </span>
              <span className="text-xs font-medium text-slate-500">pipelines</span>
            </div>
          </KpiCard>

          <KpiCard
            label="Health Score"
            icon="health"
            tone="text-emerald-600"
            footer={
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>
                  {healthScore >= 99
                    ? "Within baseline envelope"
                    : healthScore >= 95
                      ? "Watch threshold reached"
                      : "Intervention recommended"}
                </span>
              </div>
            }
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="stitch-mono text-4xl font-semibold leading-none tracking-tight text-slate-950">{healthScore.toFixed(1)}%</div>
                <span className="mt-1 inline-block text-[11px] font-medium text-slate-500">
                  SLA target &gt;99.0%
                </span>
              </div>
              <div className="relative h-14 w-14 shrink-0">
                <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90" aria-hidden="true">
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-slate-100" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={`${healthScore.toFixed(1)}, 100`}
                    className={healthScore >= 99 ? "text-emerald-600" : healthScore >= 95 ? "text-amber-500" : "text-rose-500"}
                  />
                </svg>
                <span className="stitch-mono absolute inset-0 flex items-center justify-center text-[11px] font-bold text-emerald-700">
                  {healthScore >= 99 ? "Opt" : healthScore >= 95 ? "Watch" : "Risk"}
                </span>
              </div>
            </div>
          </KpiCard>

          <KpiCard
            label="Active Incidents"
            icon="incidents"
            tone="text-rose-600"
            footer={
              <div className="flex flex-wrap gap-2">
                <span className="stitch-badge border-rose-200 bg-rose-50 text-rose-700">{criticalCount} critical</span>
                <span className="stitch-badge border-amber-200 bg-amber-50 text-amber-800">{mediumCount} medium</span>
              </div>
            }
          >
            <div className="flex items-baseline gap-2">
              <span className="stitch-mono text-4xl font-semibold tracking-tight text-slate-950">{formatNumber(openCount, 0)}</span>
              <span className="text-xs font-medium text-slate-500">open events</span>
            </div>
          </KpiCard>

          <KpiCard
            label="Anomaly Rate"
            icon="anomaly"
            footer={
              <div className="flex items-center justify-between">
                <span className={`stitch-mono flex items-center gap-1 font-semibold ${anomalyDelta <= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {anomalyDelta <= 0 ? "↓" : "↑"} {Math.abs(anomalyDelta).toFixed(3)} pts
                </span>
                <span className="stitch-mono text-slate-500">
                  peak {peakPoint ? formatRate(peakPoint.anomaly_rate / 100) : "—"}
                </span>
              </div>
            }
          >
            <div className="flex items-baseline gap-1">
              <span className="stitch-mono text-4xl font-semibold tracking-tight text-slate-950">{formatRate(metrics.anomaly_rate, 3)}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              {formatNumber(metrics.flagged_rows ?? 0, 0)} flagged of {formatNumber(metrics.total_rows ?? 0, 0)} rows
            </div>
          </KpiCard>
        </div>
      </AsyncContent>

      {/* Main observability core */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="stitch-card stitch-hover-lift lg:col-span-8">
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900" style={headingStyle()}>
                Global Ingestion Flux &amp; Anomaly Detection
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Rows and flagged rows per batch with the anomaly envelope for the past {windowHours}h
              </p>
            </div>
            <div className="stitch-mono flex shrink-0 flex-wrap items-center gap-4 text-[11px] font-medium text-slate-600">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-blue-600" /> Flux</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 border-b border-dashed border-amber-500" /> Flagged</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-600 ring-2 ring-white" /> Peak anomaly</span>
            </div>
          </div>

          <AsyncContent
            loading={summary.loading}
            error={summary.error}
            isEmpty={!trend.length}
            emptyTitle="No trend data yet"
            emptyDescription="Upload a file or poll a source to create the first batch."
            onRetry={summary.reload}
          >
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fluxFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.24} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="flagFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E11D48" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#E11D48" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="tick"
                    tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                    minTickGap={28}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="rows"
                    width={52}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => formatNumber(value, 0)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="rate"
                    orientation="right"
                    width={48}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value, name) =>
                      name === "Anomaly %" ? `${Number(value).toFixed(3)}%` : formatNumber(value, 0)
                    }
                    contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                  />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Area
                    yAxisId="rows"
                    type="monotone"
                    dataKey="rows"
                    name="Rows"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fill="url(#fluxFill)"
                    dot={false}
                  />
                  <Area
                    yAxisId="rows"
                    type="monotone"
                    dataKey="flagged_rows"
                    name="Flagged rows"
                    stroke="#D97706"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    fill="url(#flagFill)"
                    dot={false}
                  />
                  <Area
                    yAxisId="rate"
                    type="monotone"
                    dataKey="anomaly_rate"
                    name="Anomaly %"
                    stroke="#E11D48"
                    strokeWidth={1.5}
                    fill="url(#rateFill)"
                    dot={false}
                  />
                  {peakPoint && (
                    <ReferenceDot
                      yAxisId="rows"
                      x={peakPoint.tick}
                      y={peakPoint.rows}
                      r={5}
                      fill="#E11D48"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      isFront
                      label={{
                        value: `peak ${formatRate(peakPoint.anomaly_rate / 100)} flagged`,
                        position: "top",
                        fill: "#0F172A",
                        fontSize: 10,
                        fontFamily: "JetBrains Mono",
                      }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="stitch-mono mt-4 flex flex-wrap justify-between gap-2 text-[11px] text-slate-500">
              <span>-{windowHours}h</span>
              <span>{trend.length} observations</span>
              <span className="font-semibold text-blue-600">Latest batch · {relativeAge(trend[trend.length - 1]?.label)}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
              {[
                { label: "Peak throughput", value: `${formatNumber(peakRows, 0)} rows`, tone: "text-slate-950" },
                { label: `Rolling mean (${windowHours}h)`, value: `${formatNumber(meanRows, 0)} rows`, tone: "text-slate-800" },
                { label: "Upper 3σ bound", value: `${formatNumber(upperSigma, 0)} rows`, tone: "text-blue-700" },
                { label: "Within ±3σ", value: formatRate(withinSigma / 100), tone: "text-emerald-700" },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <span className="stitch-label text-slate-500">{item.label}</span>
                  <div className={`stitch-mono text-sm font-semibold ${item.tone}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </AsyncContent>
        </div>

        {/* Incident feed */}
        <div className="stitch-card stitch-hover-lift flex flex-col lg:col-span-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900" style={headingStyle()}>Incident Feed</h2>
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            </div>
            <Link to="/incidents" className="stitch-label !text-blue-600 hover:!text-blue-800">
              View all ({formatNumber(openCount, 0)})
            </Link>
          </div>

          <AsyncContent
            loading={incidents.loading}
            error={incidents.error}
            isEmpty={!incidentList.length}
            emptyTitle="No incidents recorded"
            emptyDescription="Incidents appear after a batch is analyzed."
            onRetry={incidents.reload}
          >
            <div className="flex flex-1 flex-col gap-3 py-4">
              {incidentList.slice(0, 5).map((incident) => {
                const tone = SEVERITY_TONES[incident.severity] ?? SEVERITY_TONES[Severity.LOW];
                return (
                  <div
                    key={incident.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedIncidentId(incident.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedIncidentId(incident.id);
                      }
                    }}
                    className="stitch-card-hover relative cursor-pointer rounded-lg border border-slate-200 bg-slate-50/70 p-4 pl-5 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <span className={`absolute bottom-0 left-0 top-0 w-1 ${tone.stripe}`} aria-hidden="true" />
                    <div className="flex items-center justify-between gap-2">
                      <span className={`stitch-badge ${tone.chip}`}>{incident.severity}</span>
                      <span className="stitch-mono text-[11px] text-slate-500">{relativeAge(incident.created_at)}</span>
                    </div>
                    <p className="stitch-mono mt-2 text-xs font-semibold text-blue-700">
                      {sourceNameFor(incident.source_id ?? incident.data_source_id)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      {incident.explanation ??
                        (incident.field
                          ? `Deviation detected in ${incident.field}`
                          : "Dataset-level anomaly detected")}
                    </p>
                    <div className="stitch-mono mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="truncate">{incident.detection_method ?? incident.detector ?? "detector"}</span>
                      <Link
                        to="/incidents"
                        className="shrink-0 font-semibold text-blue-600 underline hover:text-blue-800"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Triage →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </AsyncContent>

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <span>Evidence preserved · raw rows never displayed</span>
            <span className="stitch-mono">{formatDateTime(trend[trend.length - 1]?.label)}</span>
          </div>
        </div>
      </div>

      {/* Pipeline matrix */}
      <section className="stitch-card stitch-hover-lift">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900" style={headingStyle()}>Core Data Pipelines Matrix</h2>
            <p className="mt-1 text-xs text-slate-500">
              Configuration, observed rows and health across every connected source
            </p>
          </div>
          <span className="stitch-badge border-slate-200 bg-slate-50 text-slate-600">
            {formatNumber(sourceList.length, 0)} endpoints
          </span>
        </div>

        <AsyncContent
          loading={sources.loading}
          error={sources.error}
          isEmpty={!sourceList.length}
          emptyTitle="No sources configured"
          emptyDescription="Connect a source or upload a file to populate the matrix."
          onRetry={sources.reload}
        >
          <div className="mt-4 overflow-x-auto">
            <table className="stitch-table w-full min-w-[880px] text-left text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Source Type</th>
                  <th className="px-3 py-3">Health Status</th>
                  <th className="px-3 py-3">Rows / Window</th>
                  <th className="px-3 py-3">View Window</th>
                  <th className="px-3 py-3">Last observed</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sourceList.map((source) => {
                  const observed = sourceMatrix.get(source.id);
                  const status = String(source.status ?? "unknown").toLowerCase();
                  const isHealthy = status === "active" || status === "healthy";
                  return (
                    <tr key={source.id}>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-2 font-semibold text-slate-900">
                          <span className={`h-2 w-2 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-amber-500"}`} />
                          <span className="stitch-mono">{source.name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="stitch-chip !bg-slate-100 !text-slate-700">
                          {String(source.source_type ?? "—").replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`stitch-badge ${isHealthy ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                          {source.status ?? "unknown"}
                        </span>
                      </td>
                      <td className="stitch-mono px-3 py-3 text-slate-800">
                        {formatNumber(observed?.rows ?? 0, 0)}
                        <span className="ml-1 text-slate-400">/ {formatNumber(observed?.flagged ?? 0, 0)} flagged</span>
                      </td>
                      <td className="stitch-mono px-3 py-3 text-slate-600">
                        {source.config?.window_hours ?? 1}h
                      </td>
                      <td className="stitch-mono px-3 py-3 text-slate-500">
                        {observed?.last ? formatDateTime(observed.last) : "No batch yet"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link to="/incidents" className="stitch-label !text-blue-600 hover:!text-blue-800">Triage</Link>
                          <span className="text-slate-300">|</span>
                          <Link to="/sources" className="stitch-label !text-blue-600 hover:!text-blue-800">Configure</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AsyncContent>
      </section>

      <Modal
        open={selectedIncidentId != null}
        onClose={() => setSelectedIncidentId(null)}
        title={`Incident #${selectedIncidentId ?? ""}`}
        description="What changed, why it was flagged, and the supporting evidence"
      >
        <IncidentDetail
          incident={selectedIncident}
          loading={detail.loading && !detail.data}
          error={detail.error}
          sourceName={selectedSource?.name}
          canMutate={hasRole(Role.ANALYST)}
          onStatusChange={async (status) => {
            setActionError(null);
            try {
              await apiPatch(`/api/incidents/${selectedIncidentId}?status=${status}`, {});
              await Promise.all([detail.reload(), incidents.reload(), summary.reload()]);
            } catch (error) {
              setActionError(error.message);
            }
          }}
        />
        {actionError && <p className="mt-4 text-sm text-red-600">{actionError}</p>}
      </Modal>
    </section>
  );
}
