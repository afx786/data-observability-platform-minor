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

  return (
    <section className="space-y-6">
      <PageHeader
        title="Monitoring"
        description="Anomaly percentage, quality trends and recent ingestion batches for the selected view."
        actions={
          <>
            <select
              aria-label="Source filter"
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              className={`${selectClass} mt-0 w-56`}
            >
              <option value="">All sources</option>
              {(sources.data ?? []).map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
            <WindowHoursPicker value={windowHours} onChange={setWindowHours} />
          </>
        }
      />

      <div className={infoBannerClass}>
        This window affects only the data displayed here. It never recalculates a baseline, model,
        rule or stored incident.
      </div>

      <AsyncContent
        loading={summary.loading}
        error={summary.error}
        onRetry={summary.reload}
        emptyTitle="No monitoring summary"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Sources" value={formatNumber(metrics.sources ?? 0, 0)} />
          <StatCard label="Total rows" value={formatNumber(metrics.total_rows ?? 0, 0)} />
          <StatCard label="Batches" value={formatNumber(metrics.batches ?? 0, 0)} />
          <StatCard label="Flagged rows" value={formatNumber(metrics.flagged_rows ?? 0, 0)} tone="warning" />
          <StatCard label="Anomaly rate" value={formatRate(metrics.anomaly_rate)} tone="info" />
          <StatCard label="Avg null rate" value={formatRate(metrics.avg_null_rate)} />
          <StatCard label="Avg duplicate rate" value={formatRate(metrics.avg_duplicate_rate)} />
          <StatCard
            label="Incidents"
            value={`${formatNumber(metrics.open_incidents ?? 0, 0)} open / ${formatNumber(metrics.critical_incidents ?? 0, 0)} critical`}
            tone="danger"
          />
        </div>
      </AsyncContent>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel
          title="Anomaly percentage"
          description={`Batches received in the past ${windowHours} hours`}
          loading={anomaly.loading}
          error={anomaly.error}
          isEmpty={!anomalyData.length}
          emptyTitle="No anomaly measurements"
          emptyDescription="No batches were received in this window."
          onRetry={anomaly.reload}
        >
          <AreaChart data={anomalyData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="anomalyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e11d48" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#e11d48" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
            <Area
              type="monotone"
              dataKey="anomaly_rate"
              name="Anomaly %"
              stroke="#e11d48"
              strokeWidth={2}
              fill="url(#anomalyFill)"
            />
          </AreaChart>
        </ChartPanel>

        <ChartPanel
          title="Quality trend"
          description="Rows, flagged rows and anomaly percentage in the current view"
          loading={summary.loading}
          error={summary.error}
          isEmpty={!trend.length}
          emptyTitle="No trend data"
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
            <Line yAxisId="rows" type="monotone" dataKey="rows" name="Rows" stroke="#0f172a" dot={false} />
            <Line yAxisId="rows" type="monotone" dataKey="flagged_rows" name="Flagged" stroke="#f59e0b" dot={false} />
            <Line yAxisId="rate" type="monotone" dataKey="anomaly_rate" name="Anomaly %" stroke="#e11d48" dot={false} />
          </LineChart>
        </ChartPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Sources in view" description="Per-source measurements from the monitoring summary">
          <AsyncContent loading={summary.loading} error={summary.error} onRetry={summary.reload}>
            <AutoTable rows={Array.isArray(metrics.sources) ? metrics.sources : []} />
          </AsyncContent>
        </SectionCard>

        <SectionCard title="Recent batches" description="Latest ingestion activity for the selected scope">
          <AsyncContent
            loading={batches.loading}
            error={batches.error}
            isEmpty={!batchList.length}
            emptyTitle="No batches in this window"
            onRetry={batches.reload}
          >
            <DataTable
              columns={[
                { key: "id", header: "Batch", render: (row) => `#${row.id}` },
                { key: "source", header: "Source", render: (row) => sourceName(row.source_id) },
                { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
                { key: "received_at", header: "Received (IST)", render: (row) => formatDateTime(row.received_at) },
                { key: "row_count", header: "Rows", render: (row) => formatNumber(row.row_count, 0) },
                { key: "flagged_rows", header: "Flagged", render: (row) => formatNumber(row.flagged_rows, 0) },
              ]}
              rows={batchList.slice(0, 20)}
              rowKey={(row) => row.id}
            />
          </AsyncContent>
        </SectionCard>
      </div>
    </section>
  );
}
