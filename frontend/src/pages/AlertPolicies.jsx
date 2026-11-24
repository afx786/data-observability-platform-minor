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

const defaultForm = {
  recipients: "",
  severities: [Severity.HIGH, Severity.CRITICAL],
  cooldown: 60,
  enabled: true,
};

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
    <section className="space-y-6">
      <PageHeader
        title="Alert policies"
        description="Per-source recipients, severity filters, cooldown and notification history."
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
          Viewers can inspect policies and alert history. Saving a policy requires an analyst or
          admin role.
        </div>
      )}
      {(error || message) && (
        <div className="space-y-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}
        </div>
      )}

      <SectionCard
        title="Policy editor"
        description={
          sourceId
            ? `Editing policy for ${sourceName(Number(sourceId))}`
            : "Select a source to edit its policy"
        }
      >
        {!sourceId ? (
          <p className="text-sm text-slate-500">No source selected.</p>
        ) : !canMutate ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Recipients</dt>
              <dd className="mt-1 text-sm text-slate-800">{form.recipients || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Severities</dt>
              <dd className="mt-1 text-sm text-slate-800">{form.severities.join(", ") || "None"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Cooldown</dt>
              <dd className="mt-1 text-sm text-slate-800">{form.cooldown} minutes</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Enabled</dt>
              <dd className="mt-1 text-sm text-slate-800">{form.enabled ? "Yes" : "No"}</dd>
            </div>
          </dl>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <FormField
              label="Recipients"
              htmlFor="policy-recipients"
              hint="Separate email addresses with commas or new lines"
            >
              <textarea
                id="policy-recipients"
                value={form.recipients}
                onChange={(event) => setForm({ ...form, recipients: event.target.value })}
                className={textareaClass}
                placeholder="oncall@example.com, analyst@example.com"
              />
            </FormField>

            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Severity filter</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {Object.values(Severity).map((severity) => (
                  <label key={severity} className="flex items-center gap-2 text-sm text-slate-700">
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
                  className={inputClass}
                />
              </FormField>
              <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
                  className={checkboxClass}
                />
                Policy enabled
              </label>
            </div>

            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? "Saving…" : "Save policy"}
            </button>
          </form>
        )}
      </SectionCard>

      <SectionCard title="Configured policies" description="Select a row to load it into the editor">
        <AsyncContent
          loading={policies.loading}
          error={policies.error}
          isEmpty={!policyList.length}
          emptyTitle="No policies configured"
          emptyDescription="Saving a policy for a source creates it."
          onRetry={policies.reload}
        >
          <DataTable
            columns={[
              { key: "source", header: "Source", render: (row) => sourceName(row.source_id) },
              {
                key: "recipients",
                header: "Recipients",
                render: (row) => (row.recipients ?? []).join(", ") || "—",
              },
              {
                key: "severity_filter",
                header: "Severities",
                render: (row) => (row.severity_filter ?? []).join(", ") || "—",
              },
              { key: "cooldown_minutes", header: "Cooldown", render: (row) => `${row.cooldown_minutes} min` },
              { key: "enabled", header: "Enabled", render: (row) => <StatusBadge value={row.enabled ? "active" : "inactive"} /> },
            ]}
            rows={policyList}
            rowKey={(row) => row.source_id}
            onRowClick={(row) => setSourceId(String(row.source_id))}
          />
        </AsyncContent>
      </SectionCard>

      <SectionCard title="Alert history" description="Most recent notification attempts">
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
              { key: "id", header: "ID", render: (row) => `#${row.id}` },
              { key: "incident_id", header: "Incident", render: (row) => `#${row.incident_id}` },
              { key: "recipient", header: "Recipient" },
              { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
              { key: "sent_at", header: "Sent (IST)", render: (row) => formatDateTime(row.sent_at) },
              { key: "message", header: "Detail", render: (row) => <span className="text-xs text-slate-500">{row.message || "—"}</span> },
            ]}
            rows={alertList.slice(0, 50)}
            rowKey={(row) => row.id}
          />
        </AsyncContent>
      </SectionCard>
    </section>
  );
}
