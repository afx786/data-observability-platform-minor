import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { apiGet } from "../api/client.js";
import { EmptyState } from "../components/StateViews.jsx";
import WindowHoursPicker from "../components/WindowHoursPicker.jsx";
import {
  infoBannerClass,
  primaryButtonClass,
  secondaryButtonClass,
  selectClass,
} from "../components/styles.js";
import { useResource } from "../hooks/useResource.js";
import { csvEscape, formatDate, formatDateTime, formatNumber, formatRate, ratePercent } from "../utils/format.js";

const TYPE_GROUPS = ["ALL", "NUMERIC", "STRING", "DATETIME", "UUID", "JSON", "BOOLEAN", "OTHER"];

const COMPOSITION_COLORS = ["#0F172A", "#3B82F6", "#60A5FA", "#93C5FD", "#CBD5E1"];

function headingStyle() {
  return { fontFamily: '"Playfair Display", Georgia, serif', letterSpacing: "-0.02em" };
}

function columnRows(profile) {
  const columns = profile?.metrics?.columns ?? {};
  return Object.entries(columns).map(([name, stats]) => ({ name, ...(stats ?? {}) }));
}

function typeGroup(dtype) {
  const value = String(dtype ?? "").toLowerCase();
  if (/uuid|guid/.test(value)) return "UUID";
  if (/json|array|dict|object|list/.test(value)) return "JSON";
  if (/date|time/.test(value)) return "DATETIME";
  if (/bool/.test(value)) return "BOOLEAN";
  if (/int|float|decimal|double|number|numeric/.test(value)) return "NUMERIC";
  if (/object|string|text|category|str/.test(value)) return "STRING";
  return "OTHER";
}

function rateFraction(value) {
  return Math.min(1, Math.max(0, ratePercent(value) / 100));
}

function columnBadges(row, rowCount) {
  const badges = [];
  const completeness = row.name ? 1 - rateFraction(row.null_rate) : 0;
  const uniqueness = rowCount > 0 ? (Number(row.distinct) || 0) / rowCount : 0;
  if (uniqueness >= 0.99 && completeness === 1) badges.push("PK candidate");
  else if (uniqueness >= 0.9) badges.push("High cardinality");
  if ((Number(row.distinct) || 0) <= 1) badges.push("Constant");
  if (rateFraction(row.null_rate) > 0) badges.push("Nullable");
  return badges;
}

function ColumnIcon({ group }) {
  const paths = {
    NUMERIC: <path d="M5 19V9m5 10V5m5 14v-7m4 7V8" />,
    STRING: <path d="M4 7h16M4 12h11M4 17h7" />,
    DATETIME: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
    UUID: <><path d="M4 8h16v8H4z" /><path d="M8 8v8m4-8v8m4-8v8" /></>,
    JSON: <path d="M9 5H7a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h2m6-14h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-2" />,
    BOOLEAN: <><circle cx="9" cy="12" r="4" /><path d="M15 8v8m4-8v8" /></>,
    OTHER: <path d="M5 12h14M12 5v14" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {paths[group] ?? paths.OTHER}
    </svg>
  );
}

function QuantileBars({ row, gradientId }) {
  const values = [row.min, row.q1, row.median, row.q3, row.max]
    .map(Number)
    .filter(Number.isFinite);
  const edges = [...new Set(values)].sort((a, b) => a - b);
  if (edges.length < 2) return null;
  const low = edges[0];
  const high = edges[edges.length - 1];
  const span = high - low || 1;
  const widths = edges.slice(1).map((edge, index) => (edge - edges[index]) / span);
  const densities = widths.map((width) => 1 / Math.max(width, 0.02));
  const maxDensity = Math.max(...densities);
  const bars = widths.map((width, index) => {
    const x = ((edges[index] - low) / span) * 240;
    const w = Math.min(Math.max(width * 240, 4), 240 - x);
    const h = 8 + (densities[index] / maxDensity) * 46;
    return { x, w, h, y: 60 - h, label: [edges[index], edges[index + 1]] };
  });

  return (
    <svg viewBox="0 0 240 60" preserveAspectRatio="none" className="h-20 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1E293B" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <line x1="0" y1="59" x2="240" y2="59" stroke="#E2E8F0" />
      {bars.map((bar, index) => (
        <rect
          key={`${bar.x}-${index}`}
          x={bar.x}
          y={bar.y}
          width={bar.w}
          height={bar.h}
          rx="1"
          fill={`url(#${gradientId})`}
        />
      ))}
    </svg>
  );
}

function CompositionBar({ row }) {
  const categories =
    row.categories && typeof row.categories === "object"
      ? Object.entries(row.categories)
          .filter(([, count]) => Number.isFinite(Number(count)) && Number(count) > 0)
          .sort((a, b) => Number(b[1]) - Number(a[1]))
          .slice(0, 5)
      : [];
  const total = categories.reduce((sum, [, count]) => sum + Number(count), 0);
  const segments = categories.length
    ? categories.map(([label, count], index) => ({
        label,
        percent: (Number(count) / total) * 100,
        color: COMPOSITION_COLORS[index % COMPOSITION_COLORS.length],
      }))
    : [
        { label: "Complete", percent: 100 - ratePercent(row.null_rate), color: "#0F172A" },
        { label: "Null", percent: ratePercent(row.null_rate), color: "#FB7185" },
      ];

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="h-full"
            style={{ width: `${Math.max(0, segment.percent)}%`, backgroundColor: segment.color }}
            title={`${segment.label}: ${formatNumber(segment.percent, 1)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((segment) => (
          <span key={segment.label} className="stitch-mono inline-flex items-center gap-1 text-[11px] text-slate-600">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="max-w-[100px] truncate">{segment.label}</span>
            <span className="font-semibold text-slate-900">{formatNumber(segment.percent, 1)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function exportProfile(profile) {
  if (!profile) return;
  const rows = columnRows(profile);
  const header = [
    "column",
    "dtype",
    "null_count",
    "null_rate",
    "distinct",
    "min",
    "q1",
    "median",
    "mean",
    "q3",
    "max",
    "categories",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.name,
        row.dtype,
        row.null_count,
        row.null_rate,
        row.distinct,
        row.min,
        row.q1,
        row.median,
        row.mean,
        row.q3,
        row.max,
        row.categories ? JSON.stringify(row.categories) : "",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `profile-${profile.id ?? "latest"}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Profiling() {
  const [sourceId, setSourceId] = useState("");
  const [windowHours, setWindowHours] = useState(24);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const sources = useResource(() => apiGet("/api/sources"), []);
  const profiles = useResource(
    () =>
      sourceId ? apiGet(`/api/profiles?source_id=${sourceId}`) : Promise.resolve([]),
    [sourceId],
  );
  const batches = useResource(
    () =>
      sourceId ? apiGet(`/api/ingestion/batches?source_id=${sourceId}`) : Promise.resolve([]),
    [sourceId],
  );

  useEffect(() => {
    if (!sourceId && Array.isArray(sources.data) && sources.data.length) {
      setSourceId(String(sources.data[0].id));
    }
  }, [sources.data, sourceId]);

  const profileList = Array.isArray(profiles.data) ? profiles.data : [];
  const batchTimes = useMemo(
    () =>
      new Map(
        (Array.isArray(batches.data) ? batches.data : []).map((batch) => [
          batch.id,
          batch.received_at,
        ]),
      ),
    [batches.data],
  );

  // The window only filters which batches this view shows; it never changes
  // stored profiles, schemas, baselines or models.
  const visibleProfiles = useMemo(() => {
    const threshold = Date.now() - windowHours * 60 * 60 * 1000;
    return profileList
      .filter((profile) => {
        const received = batchTimes.get(profile.batch_id);
        if (!received) return true;
        const time = new Date(received).getTime();
        return Number.isNaN(time) || time >= threshold;
      })
      .sort((a, b) => {
        const timeA = new Date(batchTimes.get(a.batch_id) ?? 0).getTime() || 0;
        const timeB = new Date(batchTimes.get(b.batch_id) ?? 0).getTime() || 0;
        return timeB - timeA || (b.id ?? 0) - (a.id ?? 0);
      });
  }, [profileList, batchTimes, windowHours]);

  const profile = visibleProfiles[0];
  const metrics = profile?.metrics ?? {};
  const sourceName = sources.data?.find((source) => String(source.id) === sourceId)?.name;
  const rows = useMemo(() => columnRows(profile), [profile]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesType = typeFilter === "ALL" || typeGroup(row.dtype) === typeFilter;
      const matchesQuery = !query || row.name.toLowerCase().includes(query);
      return matchesType && matchesQuery;
    });
  }, [rows, search, typeFilter]);

  const typeCounts = useMemo(() => {
    const counts = Object.fromEntries(TYPE_GROUPS.map((group) => [group, 0]));
    counts.ALL = rows.length;
    rows.forEach((row) => {
      const group = typeGroup(row.dtype);
      counts[group] = (counts[group] ?? 0) + 1;
    });
    return counts;
  }, [rows]);

  const rowCount = Number(metrics.row_count) || 0;
  const nullFraction = rows.length
    ? rows.reduce((sum, row) => sum + rateFraction(row.null_rate), 0) / rows.length
    : 0;
  const duplicateFraction = rateFraction(metrics.duplicate_rate);
  const nullPercent = nullFraction * 100;
  const duplicatePercent = duplicateFraction * 100;
  const cleanliness = Math.max(0, Math.min(100, 100 - nullPercent - duplicatePercent));
  const grade = cleanliness >= 98 ? "AAA" : cleanliness >= 95 ? "AA" : cleanliness >= 90 ? "A" : "B";
  const pristineColumns = rows.filter((row) => rateFraction(row.null_rate) === 0).length;
  const sparseCells = rows.length
    ? rows.reduce((sum, row) => sum + (Number(row.null_count) || 0), 0) ||
      Math.round(nullFraction * rowCount)
    : 0;
  const freshness =
    metrics.freshness_hours == null ? null : `${formatNumber(metrics.freshness_hours, 1)} h`;

  return (
    <section className="stitch-page-enter stitch-glow relative space-y-8">

      {/* Breadcrumb and editorial header */}
      <header className="space-y-4">
        <nav className="stitch-mono flex flex-wrap items-center gap-2 text-[11px] text-slate-500" aria-label="Breadcrumb">
          <Link to="/sources" className="hover:text-slate-900">Sources</Link>
          <span className="text-slate-300">/</span>
          <span>{sourceName ?? "Select a source"}</span>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900">Profiling Inspection</span>
        </nav>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <p className="stitch-eyebrow text-blue-600">DATA_OBSERVABILITY // COLUMN STATISTICS</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl" style={headingStyle()}>
              Statistical Column Profiling
            </h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Distribution, nullability and uniqueness measurements derived from aggregated batch
              profiles. Raw records are never exposed in this workspace.
            </p>
            {profile && (
              <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                <span className="stitch-mono">
                  {formatNumber(rowCount, 0)} records analyzed
                  <span className="mx-2 text-slate-300">|</span>
                  {formatNumber(metrics.column_count ?? rows.length, 0)} columns
                  {freshness && <><span className="mx-2 text-slate-300">|</span>Freshness {freshness}</>}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-500">
              Source
              <select
                aria-label="Source"
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                className={`${selectClass} mt-1 w-56`}
              >
                <option value="">Select a source…</option>
                {(sources.data ?? []).map((source) => (
                  <option key={source.id} value={source.id}>{source.name}</option>
                ))}
              </select>
            </label>
            <div className="stitch-card px-3 py-1.5">
              <WindowHoursPicker value={windowHours} onChange={setWindowHours} label="Profile window" />
            </div>
            <button
              type="button"
              disabled={!sourceId}
              onClick={() => Promise.all([profiles.reload(), batches.reload()])}
              className={secondaryButtonClass}
            >
              Re-profile Dataset
            </button>
            <button
              type="button"
              disabled={!profile}
              onClick={() => exportProfile(profile)}
              className={primaryButtonClass}
            >
              Export Profile Report
            </button>
          </div>
        </div>
      </header>

      <div className={infoBannerClass}>
        The profile window filters which batches appear in this view. It never changes stored
        profiles, schemas or baselines.
      </div>

      {!sourceId ? (
        <div className="stitch-card stitch-empty">
          <EmptyState title="Choose a source" description="Select a source to see its latest profile." />
        </div>
      ) : profiles.loading ? (
        <div className="stitch-card stitch-empty"><p className="text-sm text-slate-500">Loading profile…</p></div>
      ) : profiles.error ? (
        <div className="stitch-card stitch-empty"><p className="text-sm text-red-600">{profiles.error}</p></div>
      ) : !profile ? (
        <div className="stitch-card stitch-empty">
          <EmptyState
            title={profileList.length ? `No profiles in the past ${windowHours}h` : "No profile available yet"}
            description="Upload a file or poll a source to generate a profiling batch, or widen the view window."
          />
        </div>
      ) : (
        <>
          {/* Metric trio */}
          <div className="grid gap-5 md:grid-cols-3">
            <article className="stitch-kpi stitch-card-hover flex min-h-[200px] flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="stitch-label text-slate-500">Analyzed Surface</span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M4 5h16v14H4zM9 5v14M14 5v14" />
                </svg>
              </div>
              <div className="py-4">
                <div className="stitch-mono text-4xl font-semibold tracking-tight text-slate-950">{formatNumber(metrics.column_count ?? rows.length, 0)}</div>
                <p className="mt-1 text-xs text-slate-500">Profiled columns in this stream</p>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {Object.entries(typeCounts)
                  .filter(([group, count]) => group !== "ALL" && count > 0)
                  .map(([group, count]) => (
                    <span key={group} className="stitch-chip !bg-slate-100 !text-slate-700">
                      {formatNumber(count, 0)} {group.toLowerCase()}
                    </span>
                  ))}
                {!rows.length && <span className="stitch-mono text-xs text-slate-400">No column measurements</span>}
              </div>
            </article>

            <article className="stitch-kpi stitch-card-hover flex min-h-[200px] flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="stitch-label text-slate-500">Cleanliness Index</span>
                <span className="stitch-badge border-emerald-200 bg-emerald-50 text-emerald-700">Score {grade}</span>
              </div>
              <div className="flex items-baseline gap-2 py-4">
                <div className="stitch-mono text-4xl font-semibold tracking-tight text-slate-950">{cleanliness.toFixed(1)}%</div>
                <span className="text-[11px] font-semibold text-emerald-600">
                  {formatNumber(pristineColumns, 0)} pristine
                </span>
              </div>
              <div>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, 100 - nullPercent - duplicatePercent)}%` }} />
                  <div className="h-full bg-blue-500" style={{ width: `${nullPercent}%` }} />
                  <div className="h-full bg-rose-500" style={{ width: `${duplicatePercent}%` }} />
                </div>
                <div className="stitch-mono mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>clean {formatNumber(100 - nullPercent - duplicatePercent, 1)}%</span>
                  <span>null {formatRate(nullFraction)}</span>
                  <span>dup {formatRate(duplicateFraction)}</span>
                </div>
              </div>
            </article>

            <article className="stitch-kpi stitch-card-hover flex min-h-[200px] flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="stitch-label text-slate-500">Null Cardinality</span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <circle cx="12" cy="12" r="8" /><path d="M5 5l14 14" />
                </svg>
              </div>
              <div className="py-4">
                <div className="stitch-mono text-4xl font-semibold tracking-tight text-slate-950">{formatRate(nullFraction)}</div>
                <p className="mt-1 text-xs text-slate-500">
                  Aggregate across {formatNumber(rowCount, 0)} records
                </p>
              </div>
              <div className="stitch-mono flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                <span>{formatNumber(sparseCells, 0)} sparse cells</span>
                <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                  {nullPercent === 0 ? "Zero critical loss" : `${formatNumber(rows.filter((row) => rateFraction(row.null_rate) > 0).length, 0)} nullable columns`}
                </span>
              </div>
            </article>
          </div>

          {/* Filter and search bar */}
          <div className="stitch-card flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-80">
              <svg viewBox="0 0 20 20" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M3 5h14M5 10h10M7 15h6" />
              </svg>
              <input
                id="columnSearch"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter column name or tag…"
                className={`${selectClass} mt-0 w-full py-2 pl-9 text-xs`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {TYPE_GROUPS.filter((group) => group === "ALL" || typeCounts[group] > 0 || group === "JSON").map((group) => (
                <button
                  key={group}
                  type="button"
                  aria-pressed={typeFilter === group}
                  onClick={() => setTypeFilter(group)}
                  className={`stitch-chip px-3 py-1.5 text-xs ${
                    typeFilter === group
                      ? "!border-slate-900 !bg-slate-900 !text-white font-semibold shadow-sm"
                      : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  {group} ({formatNumber(typeCounts[group] ?? 0, 0)})
                </button>
              ))}
            </div>
          </div>

          {/* Column cards */}
          <div className="space-y-4">
            {filteredRows.map((row, index) => {
              const group = typeGroup(row.dtype);
              const numeric = group === "NUMERIC";
              const badges = columnBadges(row, rowCount);
              const skewness =
                numeric && Number.isFinite(Number(row.std)) && Number(row.std) > 0 &&
                Number.isFinite(Number(row.mean)) && Number.isFinite(Number(row.median))
                  ? (Number(row.mean) - Number(row.median)) / Number(row.std)
                  : null;
              const entropy = [row.entropy, row.shannon_entropy].find(
                (value) => value != null && value !== "" && Number.isFinite(Number(value)),
              );

              return (
                <article key={row.name} className="stitch-card stitch-card-hover stitch-rise p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch xl:justify-between">
                    <div className="flex shrink-0 items-start gap-4 xl:w-72">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-900">
                        <ColumnIcon group={group} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900" style={headingStyle()}>{row.name}</h3>
                          <span className="stitch-badge border-slate-200 bg-slate-100 text-slate-800">{row.dtype ?? "unknown"}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {badges.map((badge) => (
                            <span key={badge} className="stitch-chip !bg-blue-50 !text-blue-700">
                              {badge}
                            </span>
                          ))}
                        </div>
                        <p className="stitch-mono mt-2 truncate text-[11px] text-slate-500" title={`metrics.columns.${row.name}`}>
                          metrics.columns.{row.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div>
                          <span className="stitch-label text-slate-500">Uniqueness</span>
                          <div className="mt-1 text-base font-bold text-slate-900">
                            {rowCount ? formatRate((Number(row.distinct) || 0) / rowCount) : "—"}
                          </div>
                          <span className="stitch-mono text-[11px] text-slate-500">
                            {formatNumber(row.distinct, 0)} distinct
                          </span>
                        </div>
                        <div>
                          <span className="stitch-label text-slate-500">Nullability</span>
                          <div className={`mt-1 text-base font-bold ${rateFraction(row.null_rate) > 0 ? "text-amber-700" : "text-emerald-600"}`}>
                            {formatRate(row.null_rate)}
                          </div>
                          <span className="stitch-mono text-[11px] text-slate-500">
                            {formatNumber(row.null_count, 0)} null records
                          </span>
                        </div>
                        <div>
                          <span className="stitch-label text-slate-500">Distinct</span>
                          <div className="mt-1 text-base font-bold text-slate-900">{formatNumber(row.distinct, 0)}</div>
                          <span className="stitch-mono text-[11px] text-slate-500">
                            of {formatNumber(rowCount, 0)} rows
                          </span>
                        </div>
                        <div>
                          <span className="stitch-label text-slate-500">Entropy</span>
                          <div className="mt-1 text-base font-bold text-slate-900">
                            {entropy == null ? "—" : `${formatNumber(entropy, 2)} bits`}
                          </div>
                          <span className="stitch-mono text-[11px] text-slate-500">
                            {entropy == null ? "not measured" : "shannon estimate"}
                          </span>
                        </div>
                      </div>

                      {numeric && (
                        <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3 lg:grid-cols-6">
                          {[
                            { label: "Min", value: row.min },
                            { label: "P25", value: row.q1 },
                            { label: "Median", value: row.median },
                            { label: "Mean", value: row.mean },
                            { label: "P75", value: row.q3 },
                            { label: "Max", value: row.max },
                          ].map((metric) => (
                            <div key={metric.label}>
                              <span className="stitch-label text-slate-500">{metric.label}</span>
                              <div className="stitch-mono mt-1 text-sm font-semibold text-slate-900">
                                {formatNumber(metric.value, 2)}
                              </div>
                            </div>
                          ))}
                          {skewness != null && (
                            <p className="stitch-mono col-span-full text-[11px] text-slate-500">
                              Skewness {skewness >= 0 ? "+" : ""}{formatNumber(skewness, 2)}
                              {" "}({skewness > 0.5 ? "right tail" : skewness < -0.5 ? "left tail" : "balanced"})
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 xl:w-80">
                      {numeric ? (
                        <>
                          <div className="flex items-center justify-between text-slate-500">
                            <span className="stitch-label">Quantile density</span>
                            <span className="stitch-mono text-[11px]">min → max</span>
                          </div>
                          <QuantileBars row={row} gradientId={`profile-bar-${index}`} />
                          <div className="stitch-mono flex justify-between text-[11px] text-slate-500">
                            <span>{formatNumber(row.min, 2)}</span>
                            <span>{formatNumber(row.median, 2)} (P50)</span>
                            <span>{formatNumber(row.max, 2)}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-slate-500">
                            <span className="stitch-label">
                              {row.categories ? "Category composition" : "Null composition"}
                            </span>
                            <span className="stitch-mono text-[11px]">
                              {row.categories ? "top values" : "completeness"}
                            </span>
                          </div>
                          <CompositionBar row={row} />
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {!filteredRows.length && (
            <div className="stitch-card stitch-empty">
              <EmptyState
                title="No matching columns"
                description="Adjust the search text or choose another column type."
              />
            </div>
          )}

          {/* Compact context footer */}
          <section className="stitch-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="stitch-label text-slate-500">Profile context</p>
              <p className="stitch-mono text-xs text-slate-600">
                Profile #{profile.id} · Batch {profile.batch_id == null ? "—" : `#${profile.batch_id}`} · Past {windowHours}h (view only)
              </p>
              <p className="text-xs text-slate-500">
                {metrics.date_coverage
                  ? `Coverage ${formatDate(metrics.date_coverage.start)} → ${formatDate(metrics.date_coverage.end)} · ${formatNumber(metrics.date_coverage.span_days, 1)} days`
                  : "No timestamp coverage configured for this source"}
              </p>
              {metrics.date_coverage?.end && (
                <p className="stitch-mono text-[11px] text-slate-400">
                  Latest observation {formatDateTime(metrics.date_coverage.end)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => Promise.all([profiles.reload(), batches.reload()])}
              className={secondaryButtonClass}
            >
              Refresh measurements
            </button>
          </section>
        </>
      )}
    </section>
  );
}
