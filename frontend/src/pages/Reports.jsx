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
  [Severity.MEDIUM]: "#f59e0b",
  [Severity.HIGH]: "#f97316",
  [Severity.CRITICAL]: "#e11d48",
};

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

  return (
    <section className="space-y-6">
      <PageHeader
        title="Reports"
        description="Quality summary, detector and severity breakdowns, top incidents and system health."
        actions={
          <>
            <WindowHoursPicker value={windowHours} onChange={setWindowHours} label="Report window" />
            <button
              type="button"
              onClick={downloadCsv}
              disabled={quality.loading || Boolean(quality.error)}
              className={primaryButtonClass}
            >
              Download CSV
            </button>
          </>
        }
      />

      <SectionCard
        title="Quality summary"
        description={`Generated ${formatDateTime(report.generated_at)} · past ${windowHours} hours`}
      >
        <AsyncContent
          loading={quality.loading}
          error={quality.error}
          onRetry={quality.reload}
          emptyTitle="No quality report"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Sources" value={formatNumber(report.sources ?? 0, 0)} />
            {Object.entries(summary)
              .slice(0, 7)
              .map(([key, value]) => (
                <StatCard
                  key={key}
                  label={humanize(key)}
                  value={/rate/i.test(key) ? formatRate(value) : formatMetric(key, value)}
                />
              ))}
          </div>
        </AsyncContent>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel
          title="Findings by detector"
          description="Which detectors produced the most findings"
          loading={quality.loading}
          error={quality.error}
          isEmpty={!detectorData.length}
          emptyTitle="No detector data"
          onRetry={quality.reload}
        >
          <BarChart data={detectorData} margin={{ top: 8, right: 12, bottom: 40, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" name="Count" fill="#334155" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartPanel>

        <ChartPanel
          title="Findings by severity"
          description="Distribution across severity levels"
          loading={quality.loading}
          error={quality.error}
          isEmpty={!severityData.length}
          emptyTitle="No severity data"
          onRetry={quality.reload}
        >
          <PieChart>
            <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {severityData.map((entry) => (
                <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? "#64748b"} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartPanel>
      </div>

      <SectionCard title="Top incidents" description="Highest-priority incidents in the report window">
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
                    <p className="font-medium text-slate-900">{row.field || "Dataset-level"}</p>
                    <p className="text-xs text-slate-500">{row.detector || "—"}</p>
                  </div>
                ),
              },
              { key: "severity", header: "Severity", render: (row) => <StatusBadge value={row.severity} /> },
              { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
              { key: "occurrences", header: "Occurrences", render: (row) => formatNumber(row.occurrences, 0) },
              { key: "created_at", header: "When (IST)", render: (row) => formatDateTime(row.created_at) },
            ]}
            rows={topIncidents}
            rowKey={(row, index) => row.id ?? index}
          />
        </AsyncContent>
      </SectionCard>

      <SectionCard title="System status" description="Service health and stored object counts">
        <AsyncContent loading={system.loading} error={system.error} onRetry={system.reload}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Database" value={<StatusBadge value={status.database ?? "unknown"} />} />
            <StatCard label="SMTP" value={<StatusBadge value={status.smtp ?? "unknown"} />} />
            <StatCard label="Cron" value={<StatusBadge value={status.cron ?? "unknown"} />} />
            <StatCard label="Version" value={status.version ?? "—"} />
            <StatCard label="Uptime" value={formatUptime(status.uptime_seconds)} />
          </div>
          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Stored counts</p>
            <KeyValues value={status.counts ?? {}} />
          </div>
        </AsyncContent>
      </SectionCard>
    </section>
  );
}
