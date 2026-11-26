import { useEffect, useState } from "react";

import { apiGet } from "../api/client.js";
import { apiPut } from "../api/extended.js";
import DataTable from "../components/DataTable.jsx";
import FormField from "../components/FormField.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SectionCard from "../components/SectionCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import {
  checkboxClass,
  infoBannerClass,
  inputClass,
  primaryButtonClass,
  selectClass,
  textareaClass,
} from "../components/styles.js";
import { AsyncContent } from "../components/StateViews.jsx";
import { Role, Severity } from "../constants/enums.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useResource } from "../hooks/useResource.js";
import { formatDateTime, parseRecipients } from "../utils/format.js";

const CARD =
  "stitch-card stitch-card-hover stitch-rise rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.03)] transition-all duration-200 hover:border-[#CBD5E1]";
const PRIMARY =
  "stitch-btn-primary stitch-shine inline-flex items-center gap-2 rounded bg-[#182430] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0F172A] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";
const TABLE =
  "stitch-table overflow-x-auto rounded-lg border border-[#E2E8F0] [&>div]:rounded-none [&>div]:border-0 [&_table]:w-full [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-[#EEF2F6] [&_th]:border-b [&_th]:border-[#D2D9E2] [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-[#64748B] [&_tbody_tr]:border-b [&_tbody_tr]:border-[#E2E8F0] [&_tbody_tr:nth-child(odd)]:bg-[#FBFBFD] [&_tbody_tr:hover]:bg-[#F4F6F8] [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-[13px] [&_td]:text-[#1E293B] [&_td]:transition-colors";
const FIELD =
  "mt-1 w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#1E293B] outline-none transition focus:border-[#182430] focus:ring-1 focus:ring-[#182430] disabled:cursor-not-allowed disabled:bg-slate-50";

const defaultForm = {
  recipients: "",
  severities: [Severity.HIGH, Severity.CRITICAL],
  cooldown: 60,
  enabled: true,
};

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

export default function AlertPolicies() {
  const { hasRole } = useAuth();
  const canMutate = hasRole(Role.ANALYST);
  const [sourceId, setSourceId] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const sources = useResource(() => apiGet("/api/sources"), []);
  const policies = useResource(() => apiGet("/api/alerts/policies"), []);
  const alerts = useResource(() => apiGet("/api/alerts"), []);

  useEffect(() => {
    if (!sourceId && Array.isArray(sources.data) && sources.data.length) {
      setSourceId(String(sources.data[0].id));
    }
  }, [sources.data, sourceId]);

  const policyList = Array.isArray(policies.data) ? policies.data : [];
  const policyMap = new Map(policyList.map((policy) => [Number(policy.source_id), policy]));

  useEffect(() => {
    const policy = policyMap.get(Number(sourceId));
    setForm({
      recipients: (policy?.recipients ?? []).join(", "),
      severities: Array.isArray(policy?.severity_filter)
        ? policy.severity_filter
        : [Severity.HIGH, Severity.CRITICAL],
      cooldown: policy?.cooldown_minutes ?? 60,
      enabled: policy?.enabled ?? true,
    });
    // Reloading policies intentionally resets the form to the saved values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, policies.data]);

  const alertList = Array.isArray(alerts.data) ? alerts.data : [];
  const sourceName = (id) => sources.data?.find((source) => source.id === id)?.name ?? `#${id}`;

  const enabledCount = policyList.filter((policy) => policy.enabled).length;
  const sentCount = alertList.filter((alert) => alert.status === "sent").length;
  const failedCount = alertList.filter((alert) => alert.status === "failed").length;
  const suppressedCount = alertList.filter((alert) => alert.status === "suppressed").length;
  const deliverySeries = [sentCount, failedCount, suppressedCount];
  const policyCooldowns = policyList.map((policy) => Number(policy.cooldown_minutes));

  function toggleSeverity(severity) {
    setForm((current) => ({
      ...current,
      severities: current.severities.includes(severity)
        ? current.severities.filter((value) => value !== severity)
        : [...current.severities, severity],
    }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!sourceId) {
      setError("Select a source first.");
      return;
    }
    setSaving(true);
    try {
      await apiPut(`/api/alerts/policies/${sourceId}`, {
        recipients: parseRecipients(form.recipients),
        severity_filter: form.severities,
        cooldown_minutes: Number(form.cooldown),
        enabled: form.enabled,
      });
      setMessage("Alert policy saved.");
      await policies.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="stitch-page-enter space-y-6">
      <PageHeader
        title={
          <span className="block">
            <span className="stitch-eyebrow mb-2 block font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
              Notifications / Delivery policies
            </span>
            <span
              className="stitch-glow block text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#0F172A] sm:text-[2.5rem]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Alert policies
            </span>
          </span>
        }
        description={
          <span className="mt-2 block max-w-3xl text-sm leading-relaxed text-[#475569]">
            Per-source recipients, severity filters, cooldown and notification history.
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
              className={`${selectClass} ${FIELD} mt-0 w-56`}
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
            Viewers can inspect policies and alert history. Saving a policy requires an analyst or
            admin role.
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Policies"
          value={policyList.length}
          values={policyCooldowns}
          footnote="Configured sources"
        />
        <Kpi
          label="Enabled"
          value={enabledCount}
          values={[enabledCount, policyList.length - enabledCount]}
          color="#16A34A"
          footnote="Active delivery rules"
        />
        <Kpi
          label="Sent"
          value={sentCount}
          values={deliverySeries}
          color="#2563EB"
          footnote="Successful notifications"
        />
        <Kpi
          label="Failed / suppressed"
          value={`${failedCount} / ${suppressedCount}`}
          values={[failedCount, suppressedCount, sentCount]}
          color="#DC2626"
          footnote="Delivery exceptions"
        />
      </div>

      <SectionCard
        className={CARD}
        title={
          <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
            Policy cards by source
          </span>
        }
        description={
          <span className="mt-1 block text-xs text-[#64748B]">
            Select a card to load its policy into the editor below.
          </span>
        }
      >
        <div className="stitch-divider mb-5 border-t border-[#E2E8F0]" />
        <AsyncContent
          loading={policies.loading}
          error={policies.error}
          isEmpty={!policyList.length}
          emptyTitle="No policies configured"
          emptyDescription="Saving a policy for a source creates it."
          onRetry={policies.reload}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {policyList.map((policy) => {
              const selected = String(policy.source_id) === String(sourceId);
              return (
                <button
                  key={policy.source_id}
                  type="button"
                  onClick={() => setSourceId(String(policy.source_id))}
                  className={`rounded-lg border p-4 text-left transition-all duration-200 hover:border-[#CBD5E1] hover:shadow-sm ${
                    selected
                      ? "stitch-glow border-[#182430] bg-[#F8FAFC]"
                      : "border-[#E2E8F0] bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                        Source #{policy.source_id}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">
                        {sourceName(policy.source_id)}
                      </p>
                    </div>
                    <span
                      className={`mt-1 h-2 w-2 rounded-full ${
                        policy.enabled ? "bg-[#16A34A] ring-4 ring-emerald-50" : "bg-[#CBD5E1]"
                      }`}
                    />
                  </div>
                  <div className="stitch-divider my-3 border-t border-[#E2E8F0]" />
                  <p className="stitch-mono min-h-[32px] break-all font-mono text-[11px] text-[#475569]">
                    {(policy.recipients ?? []).join(", ") || "No recipients"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(policy.severity_filter ?? []).map((severity) => (
                      <span
                        key={severity}
                        className="stitch-chip rounded border border-[#D2D9E2] bg-[#F8FAFC] px-2 py-0.5 font-mono text-[10px] uppercase text-[#475569]"
                      >
                        {severity}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-[#64748B]">
                    <span>Cooldown</span>
                    <span className="stitch-mono text-[#1E293B]">
                      {policy.cooldown_minutes} min
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </AsyncContent>
      </SectionCard>

      <SectionCard
        className={CARD}
        title={
          <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
            Policy editor
          </span>
        }
        description={
          <span className="mt-1 block text-xs text-[#64748B]">
            {sourceId
              ? `Editing policy for ${sourceName(Number(sourceId))}`
              : "Select a source to edit its policy"}
          </span>
        }
      >
        <div className="stitch-divider mb-5 border-t border-[#E2E8F0]" />
        {!sourceId ? (
          <p className="text-sm text-[#64748B]">No source selected.</p>
        ) : !canMutate ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                Recipients
              </dt>
              <dd className="stitch-mono mt-1 font-mono text-xs text-[#1E293B]">
                {form.recipients || "—"}
              </dd>
            </div>
            <div>
              <dt className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                Severities
              </dt>
              <dd className="stitch-mono mt-1 font-mono text-xs text-[#1E293B]">
                {form.severities.join(", ") || "None"}
              </dd>
            </div>
            <div>
              <dt className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                Cooldown
              </dt>
              <dd className="stitch-mono mt-1 font-mono text-xs text-[#1E293B]">
                {form.cooldown} minutes
              </dd>
            </div>
            <div>
              <dt className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                Enabled
              </dt>
              <dd className="stitch-mono mt-1 font-mono text-xs text-[#1E293B]">
                {form.enabled ? "Yes" : "No"}
              </dd>
            </div>
          </dl>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <FormField
              label="Recipients"
              htmlFor="policy-recipients"
              hint="Separate email addresses with commas or new lines"
            >
              <textarea
                id="policy-recipients"
                value={form.recipients}
                onChange={(event) => setForm({ ...form, recipients: event.target.value })}
                className={`${textareaClass} ${FIELD}`}
                placeholder="oncall@example.com, analyst@example.com"
              />
            </FormField>

            <fieldset>
              <legend className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
                Severity filter
              </legend>
              <div className="mt-3 flex flex-wrap gap-4">
                {Object.values(Severity).map((severity) => (
                  <label
                    key={severity}
                    className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.06em] text-[#475569]"
                  >
                    <input
                      type="checkbox"
                      checked={form.severities.includes(severity)}
                      onChange={() => toggleSeverity(severity)}
                      className={checkboxClass}
                    />
                    {severity}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Cooldown (minutes)" htmlFor="policy-cooldown">
                <input
                  id="policy-cooldown"
                  type="number"
                  min={0}
                  value={form.cooldown}
                  onChange={(event) => setForm({ ...form, cooldown: event.target.value })}
                  className={`${inputClass} ${FIELD}`}
                />
              </FormField>
              <label className="flex items-end gap-2 pb-2 font-mono text-xs uppercase tracking-[0.06em] text-[#475569]">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
                  className={checkboxClass}
                />
                Policy enabled
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`${primaryButtonClass} ${PRIMARY}`}
            >
              {saving ? "Saving…" : "Save policy"}
            </button>
          </form>
        )}
      </SectionCard>

      <SectionCard
        className={CARD}
        title={
          <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
            Alert history
          </span>
        }
        description={
          <span className="mt-1 block text-xs text-[#64748B]">
            Most recent notification attempts · sent, failed and suppressed states
          </span>
        }
      >
        <div className="stitch-divider mb-5 border-t border-[#E2E8F0]" />
        <div className={TABLE}>
          <AsyncContent
            loading={alerts.loading}
            error={alerts.error}
            isEmpty={!alertList.length}
            emptyTitle="No alerts recorded"
            emptyDescription="Alerts appear when incidents are evaluated against a policy."
            onRetry={alerts.reload}
          >
            <DataTable
              columns={[
                { key: "id", header: "ID", render: (row) => <span className="stitch-mono font-mono text-xs">#{row.id}</span> },
                { key: "incident_id", header: "Incident", render: (row) => <span className="stitch-mono font-mono text-xs">#{row.incident_id}</span> },
                { key: "recipient", header: "Recipient", render: (row) => <span className="stitch-mono font-mono text-xs">{row.recipient ?? "—"}</span> },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <StatusBadge value={row.status} />,
                },
                {
                  key: "sent_at",
                  header: "Sent (IST)",
                  render: (row) => (
                    <span className="stitch-mono whitespace-nowrap font-mono text-[11px]">
                      {formatDateTime(row.sent_at)}
                    </span>
                  ),
                },
                {
                  key: "message",
                  header: "Detail",
                  render: (row) => (
                    <span className="font-mono text-[11px] text-[#64748B]">{row.message || "—"}</span>
                  ),
                },
              ]}
              rows={alertList.slice(0, 50)}
              rowKey={(row) => row.id}
            />
          </AsyncContent>
        </div>
        {alertList.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-[#E2E8F0] pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#64748B]">
            <span>Delivery breakdown</span>
            <MiniBars values={deliverySeries} color="#8C6D23" height="h-6" />
          </div>
        )}
      </SectionCard>
    </section>
  );
}
