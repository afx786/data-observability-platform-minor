import { useEffect, useState } from "react";

import { apiDelete } from "../api/extended.js";
import { apiGet, apiPatch, apiPost } from "../api/client.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import DataTable from "../components/DataTable.jsx";
import FormField from "../components/FormField.jsx";
import JsonPanel from "../components/JsonPanel.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SectionCard from "../components/SectionCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import {
  checkboxClass,
  dangerButtonClass,
  infoBannerClass,
  inputClass,
  primaryButtonClass,
  selectClass,
} from "../components/styles.js";
import { AsyncContent, EmptyState } from "../components/StateViews.jsx";
import { Role, Severity } from "../constants/enums.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useResource } from "../hooks/useResource.js";
import { formatDateTime, safeJson } from "../utils/format.js";

const RULE_TYPES = ["null_rate", "duplicate_rate", "required_column", "freshness"];

const emptyForm = {
  rule_type: "null_rate",
  column_name: "",
  threshold: "0.10",
  columns: "",
  severity: Severity.MEDIUM,
  enabled: true,
};

function splitList(text) {
  return String(text ?? "")
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildParams(form) {
  if (form.rule_type === "null_rate") {
    const params = { max_null_rate: Number(form.threshold) };
    const columns = splitList(form.columns);
    if (columns.length) params.columns = columns;
    return params;
  }
  if (form.rule_type === "duplicate_rate") {
    return { max_duplicate_rate: Number(form.threshold) };
  }
  if (form.rule_type === "freshness") {
    return { max_freshness_hours: Number(form.threshold) };
  }
  return { columns: splitList(form.columns) };
}

function thresholdLabel(ruleType) {
  if (ruleType === "freshness") return "Max age (hours)";
  if (ruleType === "null_rate") return "Max null rate (0–1)";
  if (ruleType === "duplicate_rate") return "Max duplicate rate (0–1)";
  return "";
}

export default function SchemaRules() {
  const { hasRole } = useAuth();
  const canMutate = hasRole(Role.ANALYST);
  const [sourceId, setSourceId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const sources = useResource(() => apiGet("/api/sources"), []);
  const rules = useResource(
    () => (sourceId ? apiGet(`/api/rules?source_id=${sourceId}`) : Promise.resolve([])),
    [sourceId],
  );
  const schemas = useResource(
    () => (sourceId ? apiGet(`/api/rules/schemas?source_id=${sourceId}`) : Promise.resolve([])),
    [sourceId],
  );

  useEffect(() => {
    if (!sourceId && Array.isArray(sources.data) && sources.data.length) {
      setSourceId(String(sources.data[0].id));
    }
  }, [sources.data, sourceId]);

  const ruleList = Array.isArray(rules.data) ? rules.data : [];
  const schemaList = Array.isArray(schemas.data) ? schemas.data : [];
  const activeSchema = schemaList.find((schema) => schema.status === "active") ?? schemaList[0];

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!sourceId) {
      setError("Select a source first.");
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/rules", {
        data_source_id: Number(sourceId),
        rule_type: form.rule_type,
        column_name: form.column_name.trim() || null,
        params: buildParams(form),
        severity: form.severity,
        enabled: form.enabled,
      });
      setMessage("Rule created.");
      await rules.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(rule) {
    setError(null);
    try {
      await apiPatch(`/api/rules/${rule.id}`, { enabled: !rule.enabled });
      await rules.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/api/rules/${pendingDelete.id}`);
      setPendingDelete(null);
      setMessage("Rule deleted.");
      await rules.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Schema & Rules"
        description="Inspect the active schema and manage deterministic quality rules that run on every analyzed batch."
        actions={
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
        }
      />

      {!canMutate && (
        <div className={infoBannerClass}>
          Viewers can inspect schemas and rules. Creating, toggling and deleting rules requires an
          analyst or admin role.
        </div>
      )}
      {(error || message) && (
        <div className="space-y-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}
        </div>
      )}

      {!sourceId ? (
        <SectionCard>
          <EmptyState title="Choose a source" description="Select a source to inspect its schema and rules." />
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="Active schema"
            description={
              activeSchema
                ? `Version ${activeSchema.version} · created ${formatDateTime(activeSchema.created_at)}`
                : "No schema has been inferred yet"
            }
            actions={activeSchema && <StatusBadge value={activeSchema.status} />}
          >
            <AsyncContent loading={schemas.loading} error={schemas.error} onRetry={schemas.reload}>
              {activeSchema ? (
                <JsonPanel value={activeSchema.definition ?? {}} title="Expected columns and types" />
              ) : (
                <EmptyState
                  title="No schema available"
                  description="The first analyzed batch creates an active schema automatically."
                />
              )}
            </AsyncContent>
          </SectionCard>

          <SectionCard title="Quality rules" description={`${ruleList.length} rule(s) for this source`}>
            <AsyncContent
              loading={rules.loading}
              error={rules.error}
              isEmpty={!ruleList.length}
              emptyTitle="No rules configured"
              emptyDescription="Default rules apply until a source-specific rule is created."
              onRetry={rules.reload}
            >
              <DataTable
                columns={[
                  { key: "rule_type", header: "Type", render: (row) => <span className="font-medium">{row.rule_type}</span> },
                  { key: "column_name", header: "Column", render: (row) => row.column_name || "All columns" },
                  { key: "severity", header: "Severity", render: (row) => <StatusBadge value={row.severity} /> },
                  {
                    key: "params",
                    header: "Parameters",
                    render: (row) => (
                      <span className="block max-w-xs truncate font-mono text-xs" title={safeJson(row.params)}>
                        {safeJson(row.params)}
                      </span>
                    ),
                  },
                  {
                    key: "enabled",
                    header: "Enabled",
                    render: (row) => (
                      <input
                        type="checkbox"
                        checked={Boolean(row.enabled)}
                        disabled={!canMutate}
                        onChange={() => handleToggle(row)}
                        className={checkboxClass}
                        aria-label={`Toggle rule ${row.id}`}
                      />
                    ),
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (row) =>
                      canMutate ? (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(row)}
                          className={`${dangerButtonClass} px-2 py-1 text-xs`}
                        >
                          Delete
                        </button>
                      ) : null,
                  },
                ]}
                rows={ruleList}
                rowKey={(row) => row.id}
              />
            </AsyncContent>
          </SectionCard>

          <SectionCard title="Add rule" description="New rules apply to future analyzed batches">
            {canMutate ? (
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField label="Rule type" htmlFor="rule-type">
                    <select
                      id="rule-type"
                      value={form.rule_type}
                      onChange={(event) => update("rule_type", event.target.value)}
                      className={selectClass}
                    >
                      {RULE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {form.rule_type !== "required_column" && (
                    <FormField label="Column" htmlFor="rule-column" hint="Blank applies to every column">
                      <input
                        id="rule-column"
                        value={form.column_name}
                        onChange={(event) => update("column_name", event.target.value)}
                        className={inputClass}
                        placeholder="amount"
                      />
                    </FormField>
                  )}
                  <FormField label="Severity" htmlFor="rule-severity">
                    <select
                      id="rule-severity"
                      value={form.severity}
                      onChange={(event) => update("severity", event.target.value)}
                      className={selectClass}
                    >
                      {Object.values(Severity).map((severity) => (
                        <option key={severity} value={severity}>
                          {severity}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {thresholdLabel(form.rule_type) && (
                    <FormField label={thresholdLabel(form.rule_type)} htmlFor="rule-threshold">
                      <input
                        id="rule-threshold"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={form.threshold}
                        onChange={(event) => update("threshold", event.target.value)}
                        className={inputClass}
                      />
                    </FormField>
                  )}
                  {(form.rule_type === "required_column" || form.rule_type === "null_rate") && (
                    <FormField
                      label={form.rule_type === "required_column" ? "Required columns" : "Restrict to columns"}
                      htmlFor="rule-columns"
                      hint="Comma-separated; blank means every detected column"
                    >
                      <input
                        id="rule-columns"
                        value={form.columns}
                        onChange={(event) => update("columns", event.target.value)}
                        className={inputClass}
                        placeholder="order_id, amount"
                      />
                    </FormField>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) => update("enabled", event.target.checked)}
                    className={checkboxClass}
                  />
                  Enabled
                </label>

                <button type="submit" disabled={busy} className={primaryButtonClass}>
                  {busy ? "Saving…" : "Create rule"}
                </button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">Rule editing is not available for your role.</p>
            )}
          </SectionCard>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete rule?"
        description={`Rule #${pendingDelete?.id ?? ""} will be removed. Future batches will no longer evaluate it.`}
        confirmLabel="Delete rule"
        busy={busy}
        onConfirm={handleDelete}
        onClose={() => setPendingDelete(null)}
      />
    </section>
  );
}
