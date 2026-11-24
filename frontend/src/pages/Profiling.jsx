import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { apiGet } from "../api/client.js";
import ChartPanel from "../components/ChartPanel.jsx";
import DataTable from "../components/DataTable.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SectionCard from "../components/SectionCard.jsx";
import StatCard from "../components/StatCard.jsx";
import { EmptyState } from "../components/StateViews.jsx";
import WindowHoursPicker from "../components/WindowHoursPicker.jsx";
import { useResource } from "../hooks/useResource.js";
import { formatDate, formatDateTime, formatNumber, formatRate, ratePercent } from "../utils/format.js";
import { infoBannerClass, selectClass } from "../components/styles.js";

function columnRows(profile) {
  const columns = profile?.metrics?.columns ?? {};
  return Object.entries(columns).map(([name, stats]) => ({ name, ...(stats ?? {}) }));
}

export default function Profiling() {
  const [sourceId, setSourceId] = useState("");
  const [windowHours, setWindowHours] = useState(24);

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
  const rows = columnRows(profile).slice(0, 30);
  const chartData = rows.map((row) => ({
    name: row.name,
    null_rate: ratePercent(row.null_rate),
  }));

  return (
    <section className="space-y-6">
      <PageHeader
        title="Profiling"
        description="Batch profiles and column statistics. Only aggregated measurements are shown — raw rows are never exposed."
        actions={
          <>
            <select
              aria-label="Source"
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              className={`${selectClass} mt-0 w-56`}
            >
              <option value="">Select a source…</option>
              {(sources.data ?? []).map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
            <WindowHoursPicker
              value={windowHours}
              onChange={setWindowHours}
              label="Profile window"
            />
          </>
        }
      />

      <div className={infoBannerClass}>
        The profile window filters which batches appear in this view. It never changes stored
        profiles, schemas or baselines.
      </div>

      {!sourceId ? (
        <SectionCard>
          <EmptyState title="Choose a source" description="Select a source to see its latest profile." />
        </SectionCard>
      ) : profiles.loading ? (
        <SectionCard title="Profile"><p className="text-sm text-slate-500">Loading profile…</p></SectionCard>
      ) : profiles.error ? (
        <SectionCard title="Profile"><p className="text-sm text-red-600">{profiles.error}</p></SectionCard>
      ) : !profile ? (
        <SectionCard>
          <EmptyState
            title={profileList.length ? `No profiles in the past ${windowHours}h` : "No profile available yet"}
            description="Upload a file or poll a source to generate a profiling batch, or widen the view window."
          />
        </SectionCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Rows" value={formatNumber(metrics.row_count, 0)} />
            <StatCard label="Columns" value={formatNumber(metrics.column_count, 0)} />
            <StatCard
              label="Duplicate rate"
              value={formatRate(metrics.duplicate_rate)}
              hint={`${formatNumber(metrics.duplicate_count, 0)} duplicate rows`}
            />
            <StatCard
              label="Freshness"
              value={
                metrics.freshness_hours == null
                  ? "—"
                  : `${formatNumber(metrics.freshness_hours, 1)} h`
              }
              hint={metrics.date_coverage?.end ? `Latest: ${formatDateTime(metrics.date_coverage.end)}` : "No timestamp coverage"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Date coverage" description="Coverage inferred from the configured timestamp column">
              {metrics.date_coverage ? (
                <dl className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Start</dt>
                    <dd className="mt-1 text-sm text-slate-800">{formatDate(metrics.date_coverage.start)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">End</dt>
                    <dd className="mt-1 text-sm text-slate-800">{formatDate(metrics.date_coverage.end)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Span</dt>
                    <dd className="mt-1 text-sm text-slate-800">
                      {formatNumber(metrics.date_coverage.span_days, 1)} days
                    </dd>
                  </div>
                </dl>
              ) : (
                <EmptyState title="No date coverage" description="Configure a timestamp column to measure coverage and freshness." />
              )}
            </SectionCard>

            <SectionCard title="Profile context" description="Latest batch measurement">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Profile ID</dt>
                  <dd className="mt-1 text-sm text-slate-800">#{profile.id}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Batch</dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {profile.batch_id == null ? "—" : `#${profile.batch_id}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">View window</dt>
                  <dd className="mt-1 text-sm text-slate-800">Past {windowHours}h (view only)</dd>
                </div>
              </dl>
            </SectionCard>
          </div>

          <ChartPanel
            title="Null rate by column"
            description="Percentage of missing values in the latest profile"
            isEmpty={!chartData.length}
            emptyTitle="No column measurements"
          >
            <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
              <Bar dataKey="null_rate" name="Null %" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartPanel>

          <SectionCard title="Column metrics" description="Aggregated statistics per column">
            <DataTable
              columns={[
                { key: "name", header: "Column", render: (row) => <span className="font-medium">{row.name}</span> },
                { key: "dtype", header: "Type" },
                { key: "null_rate", header: "Null rate", render: (row) => formatRate(row.null_rate) },
                { key: "distinct", header: "Distinct", render: (row) => formatNumber(row.distinct, 0) },
                { key: "min", header: "Min", render: (row) => formatNumber(row.min, 2) },
                { key: "max", header: "Max", render: (row) => formatNumber(row.max, 2) },
                { key: "mean", header: "Mean", render: (row) => formatNumber(row.mean, 2) },
                { key: "median", header: "Median", render: (row) => formatNumber(row.median, 2) },
              ]}
              rows={rows}
              emptyTitle="No column metrics"
            />
          </SectionCard>
        </>
      )}
    </section>
  );
}
