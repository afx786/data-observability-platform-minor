import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiGet, apiPatch } from "../api/client.js";
import ChartPanel from "../components/ChartPanel.jsx";
import DataTable from "../components/DataTable.jsx";
import IncidentDetail from "../components/IncidentDetail.jsx";
import Modal from "../components/Modal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SectionCard from "../components/SectionCard.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { AsyncContent } from "../components/StateViews.jsx";
import { Role, Severity } from "../constants/enums.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useResource } from "../hooks/useResource.js";
import { formatDateTime, formatNumber, formatRate, ratePercent } from "../utils/format.js";

const SEVERITY_COLORS = {
  [Severity.LOW]: "#0ea5e9",
  [Severity.MEDIUM]: "#f59e0b",
  [Severity.HIGH]: "#f97316",
  [Severity.CRITICAL]: "#e11d48",
};

const quickLinks = [
  { to: "/incidents", label: "Investigate incidents", hint: "Evidence, explanations and lifecycle" },
  { to: "/monitoring", label: "View monitoring", hint: "Anomaly rate and batch trends" },
  { to: "/sources", label: "Manage sources", hint: "Connect, upload and poll" },
  { to: "/reports", label: "Quality report", hint: "Export a client-side CSV" },
];

export default function Dashboard() {
  const { hasRole } = useAuth();
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const sources = useResource(() => apiGet("/api/sources"), []);
  const summary = useResource(() => apiGet("/api/monitoring/summary?window_hours=24"), []);
  const incidents = useResource(() => apiGet("/api/incidents"), []);
  const detail = useResource(
    () =>
      selectedIncidentId == null
        ? Promise.resolve(null)
        : apiGet(`/api/incidents/${selectedIncidentId}`),
    [selectedIncidentId],
  );

  const metrics = summary.data ?? {};
  const trend = (Array.isArray(metrics.trend) ? metrics.trend : []).map((point, index) => ({
    ...point,
    label: point.label ?? `#${index + 1}`,
    anomaly_rate: ratePercent(point.anomaly_rate),
  }));

  const incidentList = Array.isArray(incidents.data) ? incidents.data : [];
  const severityData = Object.values(Severity)
    .map((severity) => ({
      name: severity,
      value: incidentList.filter((incident) => incident.severity === severity).length,
    }))
    .filter((entry) => entry.value > 0);
  const selectedIncident =
    detail.data ?? incidentList.find((incident) => incident.id === selectedIncidentId) ?? null;
  const selectedSource = sources.data?.find(
    (source) => source.id === selectedIncident?.source_id,
  );

  const columns = [
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
    {
      key: "source",
      header: "Source",
      render: (row) =>
        sources.data?.find((source) => source.id === row.source_id)?.name ??
        `#${row.source_id}`,
    },
    { key: "severity", header: "Severity", render: (row) => <StatusBadge value={row.severity} /> },
    { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
    {
      key: "created_at",
      header: "When (IST)",
      render: (row) => <span className="whitespace-nowrap">{formatDateTime(row.created_at)}</span>,
    },
  ];

  return (
    <section className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Data health across monitored sources. The view window changes what you see here; it never changes a baseline or model."
      />

      <AsyncContent
        loading={summary.loading}
        error={summary.error}
        onRetry={summary.reload}
        emptyTitle="No health metrics available"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Sources monitored"
            value={formatNumber(metrics.sources ?? sources.data?.length ?? 0, 0)}
            hint="Configured sources in scope"
          />
          <StatCard
            label="Rows in view"
            value={formatNumber(metrics.total_rows ?? 0, 0)}
            hint="Past 24 hours"
          />
          <StatCard label="Batches ingested" value={formatNumber(metrics.batches ?? 0, 0)} />
          <StatCard
            label="Anomaly rate"
            value={formatRate(metrics.anomaly_rate)}
            tone="info"
            hint="Flagged share of rows"
          />
          <StatCard
            label="Open incidents"
            value={formatNumber(metrics.open_incidents ?? 0, 0)}
            tone="warning"
          />
          <StatCard
            label="Critical incidents"
            value={formatNumber(metrics.critical_incidents ?? 0, 0)}
            tone="danger"
          />
          <StatCard label="Avg null rate" value={formatRate(metrics.avg_null_rate)} />
          <StatCard
            label="Avg duplicate rate"
            value={formatRate(metrics.avg_duplicate_rate)}
            hint={`${formatNumber(metrics.flagged_rows ?? 0, 0)} flagged rows`}
          />
        </div>
      </AsyncContent>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartPanel
            title="Quality trend"
            description="Rows, flagged rows and anomaly percentage by batch"
            loading={summary.loading}
            error={summary.error}
            isEmpty={!trend.length}
            emptyTitle="No trend data yet"
            emptyDescription="Upload or poll a source to create the first batch."
            onRetry={summary.reload}
          >
            <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="rows" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="rate"
                orientation="right"
                tickFormatter={(value) => `${value}%`}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="rows"
                type="monotone"
                dataKey="rows"
                name="Rows"
                stroke="#0f172a"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="rows"
                type="monotone"
                dataKey="flagged_rows"
                name="Flagged rows"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="anomaly_rate"
                name="Anomaly %"
                stroke="#e11d48"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartPanel>
        </div>

        <ChartPanel
          title="Severity distribution"
          description="Incidents currently recorded across all sources"
          loading={incidents.loading}
          error={incidents.error}
          isEmpty={!severityData.length}
          emptyTitle="No incidents recorded"
          onRetry={incidents.reload}
        >
          <PieChart>
            <Pie
              data={severityData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={(entry) => `${entry.name}: ${entry.value}`}
            >
              {severityData.map((entry) => (
                <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? "#64748b"} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartPanel>
      </div>

      <SectionCard
        title="Recent incidents"
        description="Select an incident to inspect its evidence and explanation"
        actions={<Link to="/incidents" className="text-xs font-medium text-slate-700 underline">View all</Link>}
      >
        <AsyncContent
          loading={incidents.loading}
          error={incidents.error}
          isEmpty={!incidentList.length}
          emptyTitle="No incidents yet"
          emptyDescription="Incidents appear after a batch is analyzed."
          onRetry={incidents.reload}
        >
          <DataTable
            columns={columns}
            rows={incidentList.slice(0, 8)}
            onRowClick={(row) => setSelectedIncidentId(row.id)}
          />
        </AsyncContent>
      </SectionCard>

      <SectionCard title="Quick links">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-md border border-slate-200 p-4 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-900">{link.label}</p>
              <p className="mt-1 text-xs text-slate-500">{link.hint}</p>
            </Link>
          ))}
        </div>
      </SectionCard>

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
