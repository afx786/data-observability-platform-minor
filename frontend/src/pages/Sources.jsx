import { useEffect, useState } from "react";

import { apiGet, apiPost } from "../api/client.js";
import { apiUpload } from "../api/extended.js";
import DataTable from "../components/DataTable.jsx";
import FormField from "../components/FormField.jsx";
import JsonPanel from "../components/JsonPanel.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SectionCard from "../components/SectionCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import {
  checkboxClass,
  infoBannerClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  selectClass,
  textareaClass,
} from "../components/styles.js";
import { AsyncContent, EmptyState } from "../components/StateViews.jsx";
import { SourceType, WINDOW_HOURS_MAX, WINDOW_HOURS_MIN } from "../constants/enums.js";
import { useResource } from "../hooks/useResource.js";
import { formatDateTime, formatNumber } from "../utils/format.js";

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

export default function Sources() {
  const [selectedId, setSelectedId] = useState(null);
  const [sourceForm, setSourceForm] = useState(emptySource);
  const [uploadForm, setUploadForm] = useState(emptyUpload);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pollingId, setPollingId] = useState(null);
  const [pollResult, setPollResult] = useState(null);
  const [formError, setFormError] = useState(null);
  const [message, setMessage] = useState(null);

  const sources = useResource(() => apiGet("/api/sources"), []);
  const detail = useResource(
    () => (selectedId == null ? Promise.resolve(null) : apiGet(`/api/sources/${selectedId}`)),
    [selectedId],
  );
  const batches = useResource(
    () =>
      selectedId == null
        ? apiGet("/api/ingestion/batches")
        : apiGet(`/api/ingestion/batches?source_id=${selectedId}`),
    [selectedId],
  );

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

  return (
    <section className="space-y-6">
      <PageHeader
        title="Sources"
        description="Connect file, PostgreSQL and REST sources, upload data, poll external sources and review ingestion batches. Only profiles and evidence are shown — no raw rows are stored in this workspace."
      />

      <div className={infoBannerClass}>
        window_hours selects the time window for a view or comparison. It never changes a baseline
        or a model.
      </div>

      {(formError || message) && (
        <div className="space-y-2">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}
        </div>
      )}

      <SectionCard title="Configured sources" description="Select a source to inspect its configuration and batches">
        <AsyncContent
          loading={sources.loading}
          error={sources.error}
          isEmpty={!sourceList.length}
          emptyTitle="No sources configured"
          emptyDescription="Create a source or upload a file below to get started."
          onRetry={sources.reload}
        >
          <DataTable
            columns={[
              { key: "name", header: "Name", render: (row) => <span className="font-medium">{row.name}</span> },
              {
                key: "source_type",
                header: "Type",
                render: (row) => <StatusBadge value={row.source_type} />,
              },
              { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
              {
                key: "config",
                header: "Configuration",
                render: (row) => <span className="text-xs text-slate-500">{configSummary(row.config)}</span>,
              },
              {
                key: "actions",
                header: "Actions",
                render: (row) =>
                  [SourceType.POSTGRESQL, SourceType.REST_API].includes(row.source_type) ? (
                    <button
                      type="button"
                      disabled={pollingId === row.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        handlePoll(row);
                      }}
                      className={`${secondaryButtonClass} px-2 py-1 text-xs`}
                    >
                      {pollingId === row.id ? "Polling…" : "Poll now"}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Upload to refresh</span>
                  ),
              },
            ]}
            rows={sourceList}
            rowKey={(row) => row.id}
            onRowClick={(row) => setSelectedId(row.id)}
          />
        </AsyncContent>
      </SectionCard>

      {selectedSource && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title={`Source detail: ${selectedSource.name}`}
            description={detail.data?.description || "No description provided"}
          >
            <AsyncContent loading={detail.loading} error={detail.error} onRetry={detail.reload}>
              <JsonPanel value={detail.data?.config ?? selectedSource.config ?? {}} title="Configuration" />
            </AsyncContent>
          </SectionCard>

          <SectionCard title="Batch history" description="Most recent ingestion batches for this source">
            <AsyncContent
              loading={batches.loading}
              error={batches.error}
              isEmpty={!batchList.length}
              emptyTitle="No batches yet"
              emptyDescription="Upload a file or poll an external source to create a batch."
              onRetry={batches.reload}
            >
              <DataTable
                columns={[
                  { key: "id", header: "Batch", render: (row) => `#${row.id}` },
                  { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
                  {
                    key: "received_at",
                    header: "Received (IST)",
                    render: (row) => formatDateTime(row.received_at),
                  },
                  {
                    key: "window_start",
                    header: "Window start (IST)",
                    render: (row) => formatDateTime(row.window_start),
                  },
                  { key: "row_count", header: "Rows", render: (row) => formatNumber(row.row_count, 0) },
                  { key: "flagged_rows", header: "Flagged", render: (row) => formatNumber(row.flagged_rows, 0) },
                ]}
                rows={batchList}
                rowKey={(row) => row.id}
              />
            </AsyncContent>
          </SectionCard>
        </div>
      )}

      {pollResult && (
        <SectionCard
          title="Poll results"
          description={`Source #${pollResult.source_id ?? "—"}`}
          actions={
            <button type="button" onClick={() => setPollResult(null)} className={`${secondaryButtonClass} text-xs`}>
              Dismiss
            </button>
          }
        >
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
        </SectionCard>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Add a source" description="All four source types are supported">
          <form onSubmit={handleCreate} className="space-y-4">
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
              <FormField label="Source type" htmlFor="source-type">
                <select
                  id="source-type"
                  value={sourceForm.source_type}
                  onChange={(event) => updateSourceForm("source_type", event.target.value)}
                  className={selectClass}
                >
                  {Object.values(SourceType).map((type) => (
                    <option key={type} value={type}>
                      {type.replace("_", " ")}
                    </option>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Window hours" htmlFor="source-window" hint="1–24 hours">
                <select
                  id="source-window"
                  value={sourceForm.window_hours}
                  onChange={(event) => updateSourceForm("window_hours", Number(event.target.value))}
                  className={selectClass}
                >
                  {hours.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
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
            </div>

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
              <div className="space-y-4 rounded-md border border-slate-200 p-4">
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
              <div className="space-y-4 rounded-md border border-slate-200 p-4">
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
                        <option key={method} value={method}>
                          {method}
                        </option>
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

            <button type="submit" disabled={creating} className={primaryButtonClass}>
              {creating ? "Creating…" : "Create source"}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Upload CSV / Excel" description="Uploaded data is profiled immediately; raw rows are never displayed">
          <form onSubmit={handleUpload} className="space-y-4">
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
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
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
            <button type="submit" disabled={uploading} className={primaryButtonClass}>
              {uploading ? "Uploading…" : "Upload and analyze"}
            </button>
          </form>
        </SectionCard>
      </div>
    </section>
  );
}
