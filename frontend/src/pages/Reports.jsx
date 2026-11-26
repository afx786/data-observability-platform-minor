import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";

import { apiGet } from "../api/client.js";
import ChartPanel from "../components/ChartPanel.jsx";
import DataTable from "../components/DataTable.jsx";
import KeyValues from "../components/KeyValues.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SectionCard from "../components/SectionCard.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { primaryButtonClass, selectClass } from "../components/styles.js";
import { AsyncContent } from "../components/StateViews.jsx";
import WindowHoursPicker from "../components/WindowHoursPicker.jsx";
import { Severity } from "../constants/enums.js";
import { useResource } from "../hooks/useResource.js";
import {
  csvEscape,
  formatDateTime,
  formatMetric,
  formatNumber,
  formatRate,
  formatUptime,
  humanize,
} from "../utils/format.js";

const SEVERITY_COLORS = {
  [Severity.LOW]: "#0ea5e9",
  [Severity.MEDIUM]: "#8C6D23",
  [Severity.HIGH]: "#f97316",
  [Severity.CRITICAL]: "#DC2626",
};

const CARD =
  "stitch-card stitch-card-hover stitch-rise rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.03)] transition-all duration-200 hover:border-[#CBD5E1]";
const PRIMARY =
  "stitch-btn-primary stitch-shine inline-flex items-center gap-2 rounded bg-[#182430] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0F172A] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY =
  "stitch-btn-secondary inline-flex items-center gap-2 rounded border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#1E293B] transition-all hover:border-[#CBD5E1] hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-50";
const TABLE =
  "stitch-table overflow-x-auto rounded-lg border border-[#E2E8F0] [&>div]:rounded-none [&>div]:border-0 [&_table]:w-full [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-[#EEF2F6] [&_th]:border-b [&_th]:border-[#D2D9E2] [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-[#64748B] [&_tbody_tr]:border-b [&_tbody_tr]:border-[#E2E8F0] [&_tbody_tr:nth-child(odd)]:bg-[#FBFBFD] [&_tbody_tr:hover]:bg-[#F4F6F8] [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-[13px] [&_td]:text-[#1E293B] [&_td]:transition-colors";

function buildCsv(report) {
  const rows = [["Section", "Key", "Value"]];
  rows.push(["Report", "Generated at (IST)", formatDateTime(report?.generated_at)]);
  rows.push(["Report", "Window hours", String(report?.window_hours ?? "")]);
  rows.push(["Report", "Sources", String(report?.sources ?? "")]);

  Object.entries(report?.summary ?? {}).forEach(([key, value]) => {
    rows.push(["Summary", humanize(key), formatMetric(key, value)]);
  });
  (report?.by_detector ?? []).forEach((entry) => {
    rows.push(["By detector", entry.detector ?? "—", String(entry.count ?? 0)]);
  });
  (report?.by_severity ?? []).forEach((entry) => {
    rows.push(["By severity", entry.severity ?? "—", String(entry.count ?? 0)]);
  });
  (report?.top_incidents ?? []).forEach((incident, index) => {
    rows.push([
      "Top incidents",
      `#${index + 1}`,
      [
        incident.field || "dataset-level",
        incident.detector,
        incident.severity,
        incident.status,
        formatDateTime(incident.created_at),
      ]
        .filter(Boolean)
        .join(" | "),
    ]);
  });

  return `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
}

function buildSystemCsv(status) {
  const rows = [["Section", "Key", "Value"]];
  rows.push(["System", "Version", String(status?.version ?? "")]);
  rows.push(["System", "Uptime", formatUptime(status?.uptime_seconds)]);
  rows.push(["System", "Database", String(status?.database ?? "")]);
  rows.push(["System", "SMTP", String(status?.smtp ?? "")]);
  rows.push(["System", "Cron", String(status?.cron ?? "")]);
  Object.entries(status?.counts ?? {}).forEach(([key, value]) => {
    rows.push(["Counts", humanize(key), formatMetric(key, value)]);
  });
  return `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
}

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

function Kpi({ label, value, values, footnote, color = "#2563EB" }) {
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

export default function Reports() {
  const [windowHours, setWindowHours] = useState(24);
  const quality = useResource(() => apiGet(`/api/reports/quality?window_hours=${windowHours}`), [
    windowHours,
  ]);
  const system = useResource(() => apiGet("/api/reports/system-status"), []);

  const report = quality.data ?? {};
  const summary = report.summary ?? {};
  const detectorData = Array.isArray(report.by_detector)
    ? report.by_detector.map((entry) => ({ name: entry.detector, value: Number(entry.count ?? 0) }))
    : [];
  const severityData = Array.isArray(report.by_severity)
    ? report.by_severity.map((entry) => ({
        name: entry.severity,
        value: Number(entry.count ?? 0),
      }))
    : [];
  const topIncidents = Array.isArray(report.top_incidents) ? report.top_incidents : [];
  const status = system.data ?? {};

  function downloadCsv() {
    const blob = new Blob([buildCsv(report)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quality-report-${windowHours}h.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadSystemCsv() {
    const blob = new Blob([buildSystemCsv(status)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "system-status-report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="stitch-page-enter space-y-6">
      <PageHeader
        title={
          <span className="block">
            <span className="stitch-eyebrow mb-2 block font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
              Reporting / Executive intelligence
            </span>
            <span
              className="stitch-glow block text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#0F172A] sm:text-[2.5rem]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Reports
            </span>
          </span>
        }
        description={
          <span className="mt-2 block max-w-3xl text-sm leading-relaxed text-[#475569]">
            Quality summary, detector and severity breakdowns, top incidents and system health.
          </span>
        }
        actions={
          <>
            <div
              className={`${CARD} px-4 py-2 [&_label]:flex [&_label]:items-center [&_label]:gap-2 [&_label]:font-mono [&_label]:text-[11px] [&_label]:uppercase [&_label]:tracking-[0.1em] [&_label]:text-[#64748B] [&_select]:rounded [&_select]:border-[#E2E8F0] [&_select]:bg-white [&_select]:px-2 [&_select]:py-1 [&_select]:font-mono [&_select]:text-xs [&_select]:text-[#182430]`}
            >
              <WindowHoursPicker value={windowHours} onChange={setWindowHours} label="Report window" />
            </div>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={quality.loading || Boolean(quality.error)}
              className={`${primaryButtonClass} ${PRIMARY}`}
            >
              Download CSV
            </button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${CARD} p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="stitch-label font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                Quality report
              </span>
              <p className="mt-2 text-sm font-medium text-[#0F172A]">
                Generated {formatDateTime(report.generated_at)}
              </p>
              <p className="stitch-mono mt-1 font-mono text-[11px] text-[#64748B]">
                window: {windowHours}h · sources: {formatNumber(report.sources ?? 0, 0)}
              </p>
            </div>
            <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
          </div>
          <div className="stitch-divider my-4 border-t border-[#E2E8F0]" />
          <div className="flex items-end justify-between gap-4">
            <MiniBars
              values={detectorData.map((entry) => entry.value)}
              color="#2563EB"
              height="h-10"
            />
            <button
              type="button"
              onClick={downloadCsv}
              disabled={quality.loading || Boolean(quality.error)}
              className={`${SECONDARY} shrink-0 font-mono text-[10px] uppercase tracking-[0.1em]`}
            >
              Export quality
            </button>
          </div>
        </div>
        <div className={`${CARD} p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="stitch-label font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                System report
              </span>
              <p className="mt-2 text-sm font-medium text-[#0F172A]">
                Version {status.version ?? "—"} · uptime {formatUptime(status.uptime_seconds)}
              </p>
              <p className="stitch-mono mt-1 font-mono text-[11px] text-[#64748B]">
                database / smtp / cron health snapshot
              </p>
            </div>
            <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
          </div>
          <div className="stitch-divider my-4 border-t border-[#E2E8F0]" />
          <div className="flex items-end justify-between gap-4">
            <MiniBars
              values={severityData.map((entry) => entry.value)}
              color="#8C6D23"
              height="h-10"
            />
            <button
              type="button"
              onClick={downloadSystemCsv}
              disabled={system.loading || Boolean(system.error)}
              className={`${SECONDARY} shrink-0 font-mono text-[10px] uppercase tracking-[0.1em]`}
            >
              Export system
            </button>
          </div>
        </div>
      </div>

      <SectionCard
        className={CARD}
        title={
          <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
            Quality summary
          </span>
        }
        description={
          <span className="mt-1 block text-xs text-[#64748B]">
            Generated {formatDateTime(report.generated_at)} · past {windowHours} hours
          </span>
        }
      >
        <div className="stitch-divider mb-5 border-t border-[#E2E8F0]" />
        <AsyncContent
          loading={quality.loading}
          error={quality.error}
          onRetry={quality.reload}
          emptyTitle="No quality report"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Sources"
              value={formatNumber(report.sources ?? 0, 0)}
              values={[report.sources ?? 0]}
              footnote="In report scope"
            />
            {Object.entries(summary)
              .slice(0, 7)
              .map(([key, value]) => (
                <Kpi
                  key={key}
                  label={humanize(key)}
                  value={/rate/i.test(key) ? formatRate(value) : formatMetric(key, value)}
                  values={[Number(value)]}
                  color={/rate/i.test(key) ? "#8C6D23" : "#2563EB"}
                  footnote="Summary metric"
                />
              ))}
          </div>
        </AsyncContent>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <div
          className={`${CARD} [&>section]:border-0 [&>section]:bg-transparent [&>section]:shadow-none`}
        >
          <ChartPanel
            title={
              <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
                Findings by detector
              </span>
            }
            description={
              <span className="mt-1 block text-xs text-[#64748B]">
                Which detectors produced the most findings
              </span>
            }
            loading={quality.loading}
            error={quality.error}
            isEmpty={!detectorData.length}
            emptyTitle="No detector data"
            onRetry={quality.reload}
          >
            <BarChart data={detectorData} margin={{ top: 8, right: 12, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#64748B" }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={60}
                axisLine={{ stroke: "#E2E8F0" }}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                }}
              />
              <Bar dataKey="value" name="Count" fill="#182430" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartPanel>
        </div>

        <div
          className={`${CARD} [&>section]:border-0 [&>section]:bg-transparent [&>section]:shadow-none`}
        >
          <ChartPanel
            title={
              <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
                Findings by severity
              </span>
            }
            description={
              <span className="mt-1 block text-xs text-[#64748B]">
                Distribution across severity levels
              </span>
            }
            loading={quality.loading}
            error={quality.error}
            isEmpty={!severityData.length}
            emptyTitle="No severity data"
            onRetry={quality.reload}
          >
            <PieChart>
              <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {severityData.map((entry) => (
                  <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? "#64748B"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                }}
              />
              <Legend wrapperStyle={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10 }} />
            </PieChart>
          </ChartPanel>
        </div>
      </div>

      <SectionCard
        className={CARD}
        title={
          <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
            Top incidents
          </span>
        }
        description={
          <span className="mt-1 block text-xs text-[#64748B]">
            Highest-priority incidents in the report window
          </span>
        }
      >
        <div className={TABLE}>
          <AsyncContent
            loading={quality.loading}
            error={quality.error}
            isEmpty={!topIncidents.length}
            emptyTitle="No incidents in this window"
            onRetry={quality.reload}
          >
            <DataTable
              columns={[
                {
                  key: "field",
                  header: "What",
                  render: (row) => (
                    <div>
                      <p className="stitch-mono font-medium text-[#0F172A]">
                        {row.field || "Dataset-level"}
                      </p>
                      <p className="font-mono text-[11px] text-[#64748B]">{row.detector || "—"}</p>
                    </div>
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
                {
                  key: "created_at",
                  header: "When (IST)",
                  render: (row) => (
                    <span className="stitch-mono whitespace-nowrap font-mono text-[11px]">
                      {formatDateTime(row.created_at)}
                    </span>
                  ),
                },
              ]}
              rows={topIncidents}
              rowKey={(row, index) => row.id ?? index}
            />
          </AsyncContent>
        </div>
      </SectionCard>

      <SectionCard
        className={CARD}
        title={
          <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
            System status
          </span>
        }
        description={
          <span className="mt-1 block text-xs text-[#64748B]">
            Service health and stored object counts
          </span>
        }
      >
        <div className="stitch-divider mb-5 border-t border-[#E2E8F0]" />
        <AsyncContent loading={system.loading} error={system.error} onRetry={system.reload}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                Database
              </p>
              <div className="mt-2">
                <StatusBadge value={status.database ?? "unknown"} />
              </div>
            </div>
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                SMTP
              </p>
              <div className="mt-2">
                <StatusBadge value={status.smtp ?? "unknown"} />
              </div>
            </div>
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                Cron
              </p>
              <div className="mt-2">
                <StatusBadge value={status.cron ?? "unknown"} />
              </div>
            </div>
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                Version
              </p>
              <p className="mt-2 font-mono text-sm text-[#0F172A]">
                {status.version ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                Uptime
              </p>
              <p className="mt-2 font-mono text-sm text-[#0F172A]">
                {formatUptime(status.uptime_seconds)}
              </p>
            </div>
          </div>
          <div className="mt-6 border-t border-[#E2E8F0] pt-5">
            <p className="stitch-label mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
              Stored counts
            </p>
            <KeyValues value={status.counts ?? {}} />
          </div>
        </AsyncContent>
      </SectionCard>
    </section>
  );
}
