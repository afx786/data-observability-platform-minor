import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiGet } from "../api/client.js";
import AutoTable from "../components/AutoTable.jsx";
import ChartPanel from "../components/ChartPanel.jsx";
import DataTable from "../components/DataTable.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SectionCard from "../components/SectionCard.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { infoBannerClass, selectClass } from "../components/styles.js";
import { AsyncContent } from "../components/StateViews.jsx";
import WindowHoursPicker from "../components/WindowHoursPicker.jsx";
import { useResource } from "../hooks/useResource.js";
import {
  formatDateTime,
  formatNumber,
  formatRate,
  formatTime,
  ratePercent,
} from "../utils/format.js";

const CARD =
  "stitch-card stitch-card-hover stitch-rise rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.03)] transition-all duration-200 hover:border-[#CBD5E1]";
const TABLE =
  "stitch-table overflow-x-auto rounded-lg border border-[#E2E8F0] [&>div]:rounded-none [&>div]:border-0 [&_table]:w-full [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-[#EEF2F6] [&_th]:border-b [&_th]:border-[#D2D9E2] [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-[#64748B] [&_tbody_tr]:border-b [&_tbody_tr]:border-[#E2E8F0] [&_tbody_tr:nth-child(odd)]:bg-[#FBFBFD] [&_tbody_tr:hover]:bg-[#F4F6F8] [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-[13px] [&_td]:text-[#1E293B] [&_td]:transition-colors";
const FIELD =
  "mt-1 w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#1E293B] outline-none transition focus:border-[#182430] focus:ring-1 focus:ring-[#182430]";

function numericValues(values) {
  return values.map(Number).filter((value) => Number.isFinite(value));
}

function Sparkline({ values, color = "#2563EB", height = 32, className = "" }) {
  const nums = numericValues(values);
  if (nums.length < 2) {
    const max = nums.length ? Math.max(...nums) : 0;
    return (
      <div
        className={`stitch-sparkline items-end gap-1 ${className}`}
        style={{ display: "flex", height: 32 }}
        aria-hidden="true"
      >
        {nums.length ? (
          nums.map((value, index) => (
            <span
              key={index}
              className="min-w-[6px] flex-1 rounded-t-[2px]"
              style={{
                height: `${max ? Math.max(8, (value / max) * 100) : 8}%`,
                backgroundColor: color,
                opacity: 0.75,
              }}
            />
          ))
        ) : (
          <span className="h-px w-full bg-[#E2E8F0]" />
        )}
      </div>
    );
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const width = 120;
  const pad = 2;
  const points = nums.map((value, index) => {
    const x = pad + (index * (width - 2 * pad)) / (nums.length - 1);
    const y = height - pad - ((value - min) / span) * (height - 2 * pad);
    return `${x},${y}`;
  });
  const line = `M${points.join(" L")}`;
  const area = `${line} L${width - pad},${height} L${pad},${height} Z`;

  return (
    <svg
      className={`stitch-sparkline w-full ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend sparkline"
    >
      <path d={area} fill={color} fillOpacity="0.10" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
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
      <div className="mt-3 h-8">
        <Sparkline values={values} color={color} />
      </div>
      {footnote && <p className="mt-2 font-mono text-[10px] text-[#64748B]">{footnote}</p>}
    </div>
  );
}

export default function Monitoring() {
  const [windowHours, setWindowHours] = useState(24);
  const [sourceId, setSourceId] = useState("");

  const query = (base) =>
    `${base}?window_hours=${windowHours}${sourceId ? `&source_id=${sourceId}` : ""}`;

  const sources = useResource(() => apiGet("/api/sources"), []);
  const summary = useResource(() => apiGet(query("/api/monitoring/summary")), [
    windowHours,
    sourceId,
  ]);
  const anomaly = useResource(() => apiGet(query("/api/monitoring/anomaly-rate")), [
    windowHours,
    sourceId,
  ]);
  const batches = useResource(
    () =>
      apiGet(
        `/api/ingestion/batches${sourceId ? `?source_id=${sourceId}` : ""}`,
      ),
    [sourceId],
  );

  const metrics = summary.data ?? {};
  const trend = (Array.isArray(metrics.trend) ? metrics.trend : []).map((point, index) => ({
    ...point,
    label: point.label ?? `#${index + 1}`,
    anomaly_rate: ratePercent(point.anomaly_rate),
  }));
  const anomalyData = (Array.isArray(anomaly.data) ? anomaly.data : []).map((point) => ({
    ...point,
    label: formatTime(point.received_at ?? point.window_start),
    anomaly_rate: ratePercent(point.anomaly_rate),
  }));
  const batchList = Array.isArray(batches.data) ? batches.data : [];
  const sourceName = (id) => sources.data?.find((source) => source.id === id)?.name ?? `#${id}`;

  const anomalyRates = anomalyData.map((point) => point.anomaly_rate);
  const rowSeries = trend.map((point) => Number(point.rows));
  const flaggedSeries = trend.map((point) => Number(point.flagged_rows));

  const detectorSignals = [
    {
      label: "Anomaly detector",
      value: formatRate(metrics.anomaly_rate),
      values: anomalyRates,
      color: "#8C6D23",
      note: `${anomalyData.length} measured point(s)`,
    },
    {
      label: "Null detector",
      value: formatRate(metrics.avg_null_rate),
      values: [ratePercent(metrics.avg_null_rate)],
      color: "#2563EB",
      note: "Average across view",
    },
    {
      label: "Duplicate detector",
      value: formatRate(metrics.avg_duplicate_rate),
      values: [ratePercent(metrics.avg_duplicate_rate)],
      color: "#2563EB",
      note: "Average across view",
    },
    {
      label: "Flagged volume",
      value: formatNumber(metrics.flagged_rows ?? 0, 0),
      values: flaggedSeries.length ? flaggedSeries : [metrics.flagged_rows ?? 0],
      color: "#DC2626",
      note: "Flagged rows over trend",
    },
  ];

  return (
    <section className="stitch-page-enter space-y-6">
      <PageHeader
        title={
          <span className="block">
            <span className="stitch-eyebrow mb-2 block font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
              Telemetry / Live monitoring
            </span>
            <span
              className="stitch-glow block text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#0F172A] sm:text-[2.5rem]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Monitoring
            </span>
          </span>
        }
        description={
          <span className="mt-2 block max-w-3xl text-sm leading-relaxed text-[#475569]">
            Anomaly percentage, quality trends and recent ingestion batches for the selected view.
          </span>
        }
        actions={
          <>
            <label className="block">
              <span className="stitch-label mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                Data source
              </span>
              <select
                aria-label="Source filter"
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                className={`${selectClass} ${FIELD} mt-0 w-56`}
              >
                <option value="">All sources</option>
                {(sources.data ?? []).map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <div
              className={`${CARD} px-4 py-2 [&_label]:flex [&_label]:items-center [&_label]:gap-2 [&_label]:font-mono [&_label]:text-[11px] [&_label]:uppercase [&_label]:tracking-[0.1em] [&_label]:text-[#64748B] [&_select]:rounded [&_select]:border-[#E2E8F0] [&_select]:bg-white [&_select]:px-2 [&_select]:py-1 [&_select]:font-mono [&_select]:text-xs [&_select]:text-[#182430]`}
            >
              <WindowHoursPicker value={windowHours} onChange={setWindowHours} />
            </div>
          </>
        }
      />

      <div
        className={`${infoBannerClass} stitch-card flex items-start gap-3 rounded-lg border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs leading-relaxed text-[#475569] shadow-none`}
      >
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />
        <span>
          This window affects only the data displayed here. It never recalculates a baseline, model,
          rule or stored incident.
        </span>
      </div>

      <AsyncContent
        loading={summary.loading}
        error={summary.error}
        onRetry={summary.reload}
        emptyTitle="No monitoring summary"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Sources"
            value={formatNumber(metrics.sources ?? 0, 0)}
            values={[metrics.sources ?? 0]}
            color="#2563EB"
            footnote="In selected scope"
          />
          <Kpi
            label="Total rows"
            value={formatNumber(metrics.total_rows ?? 0, 0)}
            values={rowSeries.length ? rowSeries : [metrics.total_rows ?? 0]}
            color="#182430"
            footnote="Analyzed volume"
          />
          <Kpi
            label="Batches"
            value={formatNumber(metrics.batches ?? 0, 0)}
            values={[metrics.batches ?? 0]}
            color="#3B82F6"
            footnote="Ingestion events"
          />
          <Kpi
            label="Flagged rows"
            value={formatNumber(metrics.flagged_rows ?? 0, 0)}
            values={flaggedSeries.length ? flaggedSeries : [metrics.flagged_rows ?? 0]}
            color="#DC2626"
            footnote="Across detectors"
          />
          <Kpi
            label="Anomaly rate"
            value={formatRate(metrics.anomaly_rate)}
            values={anomalyRates}
            color="#8C6D23"
            footnote={`${anomalyData.length} samples`}
          />
          <Kpi
            label="Avg null rate"
            value={formatRate(metrics.avg_null_rate)}
            values={[ratePercent(metrics.avg_null_rate)]}
            color="#2563EB"
            footnote="Schema signal"
          />
          <Kpi
            label="Avg duplicate rate"
            value={formatRate(metrics.avg_duplicate_rate)}
            values={[ratePercent(metrics.avg_duplicate_rate)]}
            color="#2563EB"
            footnote="Uniqueness signal"
          />
          <Kpi
            label="Incidents"
            value={`${formatNumber(metrics.open_incidents ?? 0, 0)} open / ${formatNumber(metrics.critical_incidents ?? 0, 0)} critical`}
            values={[metrics.open_incidents ?? 0, metrics.critical_incidents ?? 0]}
            color="#DC2626"
            footnote="Stored incidents"
          />
        </div>
      </AsyncContent>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className={`xl:col-span-8 ${CARD} [&>section]:border-0 [&>section]:bg-transparent [&>section]:shadow-none`}>
          <ChartPanel
            title={
              <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
                Anomaly percentage · {windowHours}h
              </span>
            }
            description={
              <span className="mt-1 block text-xs text-[#64748B]">
                Batches received in the past {windowHours} hours
              </span>
            }
            loading={anomaly.loading}
            error={anomaly.error}
            isEmpty={!anomalyData.length}
            emptyTitle="No anomaly measurements"
            emptyDescription="No batches were received in this window."
            onRetry={anomaly.reload}
            height={300}
          >
            <AreaChart data={anomalyData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="anomalyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8C6D23" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#8C6D23" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
              <YAxis
                tickFormatter={(value) => `${value}%`}
                tick={{ fontSize: 10, fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  boxShadow: "0 12px 24px -4px rgba(15,23,42,0.08)",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, "Anomaly %"]}
              />
              <Area
                type="monotone"
                dataKey="anomaly_rate"
                name="Anomaly %"
                stroke="#8C6D23"
                strokeWidth={2}
                fill="url(#anomalyFill)"
                dot={false}
                activeDot={{ r: 4, fill: "#8C6D23", stroke: "#FFFFFF", strokeWidth: 2 }}
              />
            </AreaChart>
          </ChartPanel>
        </div>

        <div className="xl:col-span-4">
          <SectionCard
            className={`${CARD} h-full`}
            title={
              <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
                Detector breakdown
              </span>
            }
            description={
              <span className="mt-1 block text-xs text-[#64748B]">
                Live signals derived from this view
              </span>
            }
          >
            <div className="stitch-divider mb-4 border-t border-[#E2E8F0]" />
            <div className="space-y-4">
              {detectorSignals.map((signal) => (
                <div
                  key={signal.label}
                  className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 transition-all duration-200 hover:border-[#CBD5E1] hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                      {signal.label}
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: signal.color }} />
                  </div>
                  <p className="mt-2 font-mono text-xl font-medium tracking-[-0.03em] text-[#0F172A]">
                    {signal.value}
                  </p>
                  <div className="mt-2 h-8">
                    <Sparkline values={signal.values} color={signal.color} />
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-[#64748B]">{signal.note}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <div className={`${CARD} [&>section]:border-0 [&>section]:bg-transparent [&>section]:shadow-none`}>
        <ChartPanel
        title={
          <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
            Quality trend
          </span>
        }
        description={
          <span className="mt-1 block text-xs text-[#64748B]">
            Rows, flagged rows and anomaly percentage in the current view
          </span>
        }
        loading={summary.loading}
        error={summary.error}
        isEmpty={!trend.length}
        emptyTitle="No trend data"
        onRetry={summary.reload}
      >
        <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
          <YAxis yAxisId="rows" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 10, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 11,
            }}
          />
          <Legend wrapperStyle={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10 }} />
          <Line yAxisId="rows" type="monotone" dataKey="rows" name="Rows" stroke="#0F172A" dot={false} strokeWidth={2} />
          <Line yAxisId="rows" type="monotone" dataKey="flagged_rows" name="Flagged" stroke="#8C6D23" dot={false} strokeWidth={2} />
          <Line yAxisId="rate" type="monotone" dataKey="anomaly_rate" name="Anomaly %" stroke="#DC2626" dot={false} strokeWidth={2} />
        </LineChart>
        </ChartPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          className={CARD}
          title={
            <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
              Sources in view
            </span>
          }
          description={
            <span className="mt-1 block text-xs text-[#64748B]">
              Per-source measurements from the monitoring summary
            </span>
          }
        >
          <div className={TABLE}>
            <AsyncContent loading={summary.loading} error={summary.error} onRetry={summary.reload}>
              <AutoTable rows={Array.isArray(metrics.sources) ? metrics.sources : []} />
            </AsyncContent>
          </div>
        </SectionCard>

        <SectionCard
          className={CARD}
          title={
            <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
              Recent batches
            </span>
          }
          description={
            <span className="mt-1 block text-xs text-[#64748B]">
              Latest ingestion activity for the selected scope
            </span>
          }
        >
          <div className={TABLE}>
            <AsyncContent
              loading={batches.loading}
              error={batches.error}
              isEmpty={!batchList.length}
              emptyTitle="No batches in this window"
              onRetry={batches.reload}
            >
              <DataTable
                columns={[
                  { key: "id", header: "Batch", render: (row) => <span className="stitch-mono font-mono text-xs">#{row.id}</span> },
                  { key: "source", header: "Source", render: (row) => sourceName(row.source_id) },
                  { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
                  { key: "received_at", header: "Received (IST)", render: (row) => <span className="stitch-mono whitespace-nowrap font-mono text-xs">{formatDateTime(row.received_at)}</span> },
                  { key: "row_count", header: "Rows", render: (row) => <span className="stitch-mono font-mono text-xs">{formatNumber(row.row_count, 0)}</span> },
                  { key: "flagged_rows", header: "Flagged", render: (row) => <span className="stitch-mono font-mono text-xs">{formatNumber(row.flagged_rows, 0)}</span> },
                ]}
                rows={batchList.slice(0, 20)}
                rowKey={(row) => row.id}
              />
            </AsyncContent>
          </div>
        </SectionCard>
      </div>
    </section>
  );
}
