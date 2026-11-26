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

const CARD =
  "stitch-card stitch-card-hover stitch-rise rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.03)] transition-all duration-200 hover:border-[#CBD5E1]";
const PRIMARY =
  "stitch-btn-primary stitch-shine inline-flex items-center gap-2 rounded bg-[#182430] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0F172A] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY =
  "stitch-btn-secondary inline-flex items-center gap-2 rounded border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#1E293B] transition-all hover:border-[#CBD5E1] hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-50";
const TABLE =
  "stitch-table overflow-x-auto rounded-lg border border-[#E2E8F0] [&>div]:rounded-none [&>div]:border-0 [&_table]:w-full [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-[#EEF2F6] [&_th]:border-b [&_th]:border-[#D2D9E2] [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-[#64748B] [&_tbody_tr]:border-b [&_tbody_tr]:border-[#E2E8F0] [&_tbody_tr:nth-child(odd)]:bg-[#FBFBFD] [&_tbody_tr:hover]:bg-[#F4F6F8] [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-[13px] [&_td]:text-[#1E293B] [&_td]:transition-colors";
const FIELD =
  "mt-1 w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#1E293B] outline-none transition focus:border-[#182430] focus:ring-1 focus:ring-[#182430] disabled:cursor-not-allowed disabled:bg-slate-50";
const SELECT = `${FIELD} mt-0 w-56`;

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

function Kpi({ label, value, footnote, values, color = "#2563EB" }) {
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

  const ruleCounts = RULE_TYPES.reduce((counts, type) => {
    counts[type] = ruleList.filter((rule) => rule.rule_type === type).length;
    return counts;
  }, {});
  const enabledCount = ruleList.filter((rule) => rule.enabled).length;
  const severeCount = ruleList.filter((rule) =>
    [Severity.HIGH, Severity.CRITICAL].includes(rule.severity),
  ).length;
  const definition = activeSchema?.definition;
  const schemaColumns = Array.isArray(definition)
    ? definition.length
    : definition && typeof definition === "object"
      ? Object.keys(definition).length
      : 0;

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
    <section className="stitch-page-enter space-y-6">
      <PageHeader
        title={
          <span className="block">
            <span className="stitch-eyebrow mb-2 block font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
              Governance / Schema registry
            </span>
            <span
              className="stitch-glow block text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#0F172A] sm:text-[2.5rem]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Schema &amp; Rules
            </span>
          </span>
        }
        description={
          <span className="mt-2 block max-w-3xl text-sm leading-relaxed text-[#475569]">
            Inspect the active schema and manage deterministic quality rules that run on every
            analyzed batch.
          </span>
        }
        actions={
          <label className="block">
            <span className="stitch-label mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
              Data source
            </span>
            <select
              aria-label="Source"
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              className={`${selectClass} ${SELECT}`}
            >
              <option value="">Select a source…</option>
              {(sources.data ?? []).map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {!canMutate && (
        <div
          className={`${infoBannerClass} stitch-card flex items-start gap-3 rounded-lg border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs leading-relaxed text-[#475569] shadow-none`}
        >
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#8C6D23]" />
          <span>
            Viewers can inspect schemas and rules. Creating, toggling and deleting rules requires an
            analyst or admin role.
          </span>
        </div>
      )}
      {(error || message) && (
        <div className="space-y-2 font-mono text-xs">
          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>
          )}
          {message && (
            <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
              {message}
            </p>
          )}
        </div>
      )}

      {!sourceId ? (
        <div className={CARD}>
          <div className="stitch-empty [&>div]:rounded-lg [&>div]:border-[#CBD5E1] [&>div]:bg-[#F8FAFC]">
            <EmptyState
              title="Choose a source"
              description="Select a source to inspect its schema and rules."
            />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Rules configured"
              value={ruleList.length}
              values={RULE_TYPES.map((type) => ruleCounts[type])}
              footnote="By rule type"
            />
            <Kpi
              label="Enabled"
              value={enabledCount}
              values={[enabledCount, ruleList.length - enabledCount]}
              color="#16A34A"
              footnote={`${ruleList.length - enabledCount} paused`}
            />
            <Kpi
              label="Schema columns"
              value={schemaColumns}
              values={[schemaColumns]}
              color="#8C6D23"
              footnote={activeSchema ? `v${activeSchema.version}` : "Not inferred"}
            />
            <Kpi
              label="High + critical"
              value={severeCount}
              values={[severeCount, ruleList.length - severeCount]}
              color="#DC2626"
              footnote="Elevated severity"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-12">
            <SectionCard
              className={`${CARD} xl:col-span-5`}
              title={
                <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
                  01 / Schema registry
                </span>
              }
              description={
                <span className="mt-1 block text-xs leading-relaxed text-[#64748B]">
                  {activeSchema
                    ? `Version ${activeSchema.version} · created ${formatDateTime(activeSchema.created_at)}`
                    : "No schema has been inferred yet"}
                </span>
              }
              actions={activeSchema && <StatusBadge value={activeSchema.status} />}
            >
              <AsyncContent loading={schemas.loading} error={schemas.error} onRetry={schemas.reload}>
                {activeSchema ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 font-mono text-[11px] text-[#64748B]">
                      <span className="uppercase tracking-[0.12em]">Expected columns &amp; types</span>
                      <span className="stitch-badge">{schemaColumns} fields</span>
                    </div>
                    <JsonPanel value={activeSchema.definition ?? {}} title="Definition snapshot" />
                  </div>
                ) : (
                  <div className="stitch-empty [&>div]:rounded-lg [&>div]:border-[#CBD5E1] [&>div]:bg-[#F8FAFC]">
                    <EmptyState
                      title="No schema available"
                      description="The first analyzed batch creates an active schema automatically."
                    />
                  </div>
                )}
              </AsyncContent>
            </SectionCard>

            <SectionCard
              className={`${CARD} xl:col-span-7`}
              title={
                <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
                  02 / Quality rules
                </span>
              }
              description={
                <span className="mt-1 block text-xs text-[#64748B]">
                  {ruleList.length} rule(s) for this source · evaluated on every batch
                </span>
              }
            >
              <div className="space-y-4">
                <div className={TABLE}>
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
                        {
                          key: "rule_type",
                          header: "Type",
                          render: (row) => (
                            <span className="stitch-chip inline-flex rounded border border-[#D2D9E2] bg-[#F8FAFC] px-2 py-0.5 font-mono text-[11px] text-[#1E293B]">
                              {row.rule_type}
                            </span>
                          ),
                        },
                        {
                          key: "column_name",
                          header: "Column",
                          render: (row) => (
                            <span className="stitch-mono font-mono text-xs text-[#1E293B]">
                              {row.column_name || "all columns"}
                            </span>
                          ),
                        },
                        {
                          key: "severity",
                          header: "Severity",
                          render: (row) => <StatusBadge value={row.severity} />,
                        },
                        {
                          key: "params",
                          header: "Parameters",
                          render: (row) => (
                            <span
                              className="stitch-mono block max-w-xs truncate font-mono text-xs text-[#475569]"
                              title={safeJson(row.params)}
                            >
                              {safeJson(row.params)}
                            </span>
                          ),
                        },
                        {
                          key: "enabled",
                          header: "State",
                          render: (row) => (
                            <label className="flex cursor-pointer items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[#64748B]">
                              <input
                                type="checkbox"
                                checked={Boolean(row.enabled)}
                                disabled={!canMutate}
                                onChange={() => handleToggle(row)}
                                className={checkboxClass}
                                aria-label={`Toggle rule ${row.id}`}
                              />
                              <span className={row.enabled ? "text-emerald-700" : "text-[#64748B]"}>
                                {row.enabled ? "enabled" : "paused"}
                              </span>
                            </label>
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
                                className={`${dangerButtonClass} ${SECONDARY} border-red-200 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50`}
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
                </div>
                {ruleList.length > 0 && (
                  <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#64748B]">
                    <span>Type distribution</span>
                    <MiniBars values={RULE_TYPES.map((type) => ruleCounts[type])} color="#2563EB" height="h-6" />
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          <SectionCard
            className={CARD}
            title={
              <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
                03 / Add a rule
              </span>
            }
            description={
              <span className="mt-1 block text-xs text-[#64748B]">
                New rules apply to future analyzed batches.
              </span>
            }
          >
            <div className="stitch-divider mb-5 border-t border-[#E2E8F0]" />
            {canMutate ? (
              <form onSubmit={handleCreate} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField label="Rule type" htmlFor="rule-type">
                    <select
                      id="rule-type"
                      value={form.rule_type}
                      onChange={(event) => update("rule_type", event.target.value)}
                      className={`${inputClass} ${FIELD}`}
                    >
                      {RULE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {form.rule_type !== "required_column" && (
                    <FormField
                      label="Column"
                      htmlFor="rule-column"
                      hint="Blank applies to every column"
                    >
                      <input
                        id="rule-column"
                        value={form.column_name}
                        onChange={(event) => update("column_name", event.target.value)}
                        className={`${inputClass} ${FIELD}`}
                        placeholder="amount"
                      />
                    </FormField>
                  )}
                  <FormField label="Severity" htmlFor="rule-severity">
                    <select
                      id="rule-severity"
                      value={form.severity}
                      onChange={(event) => update("severity", event.target.value)}
                      className={`${inputClass} ${FIELD}`}
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
                        className={`${inputClass} ${FIELD}`}
                      />
                    </FormField>
                  )}
                  {(form.rule_type === "required_column" || form.rule_type === "null_rate") && (
                    <FormField
                      label={
                        form.rule_type === "required_column" ? "Required columns" : "Restrict to columns"
                      }
                      htmlFor="rule-columns"
                      hint="Comma-separated; blank means every detected column"
                    >
                      <input
                        id="rule-columns"
                        value={form.columns}
                        onChange={(event) => update("columns", event.target.value)}
                        className={`${inputClass} ${FIELD}`}
                        placeholder="order_id, amount"
                      />
                    </FormField>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm text-[#475569]">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) => update("enabled", event.target.checked)}
                    className={checkboxClass}
                  />
                  <span className="stitch-mono font-mono text-xs uppercase tracking-[0.08em]">Enabled</span>
                </label>

                <button type="submit" disabled={busy} className={`${primaryButtonClass} ${PRIMARY}`}>
                  {busy ? "Saving…" : "Create rule"}
                </button>
              </form>
            ) : (
              <p className="text-sm text-[#64748B]">Rule editing is not available for your role.</p>
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
