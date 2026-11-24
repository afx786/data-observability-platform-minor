import { IncidentStatus } from "../constants/enums.js";
import { formatDateTime, formatNumber, safeJson } from "../utils/format.js";
import JsonPanel from "./JsonPanel.jsx";
import StatusBadge from "./StatusBadge.jsx";
import { secondaryButtonClass } from "./styles.js";
import { EmptyState, ErrorState, LoadingState } from "./StateViews.jsx";

function renderValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return safeJson(value);
  const number = Number(value);
  return Number.isFinite(number) ? formatNumber(number, 4) : String(value);
}

export default function IncidentDetail({
  incident,
  loading = false,
  error = null,
  sourceName,
  canMutate = false,
  busy = false,
  onStatusChange,
  onRetry,
}) {
  if (loading && !incident) return <LoadingState label="Loading incident evidence…" />;
  if (error && !incident) return <ErrorState message={error} onRetry={onRetry} />;
  if (!incident) return <EmptyState title="Incident not found" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge value={incident.severity} />
        <StatusBadge value={incident.status} />
        <span className="text-xs text-slate-500">Incident #{incident.id}</span>
      </div>

      <dl className="grid gap-x-6 gap-y-4 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Where</dt>
          <dd className="mt-1 text-sm text-slate-800">{sourceName ?? `Source #${incident.source_id}`}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Field</dt>
          <dd className="mt-1 text-sm text-slate-800">{incident.field || "Dataset-level"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Detector</dt>
          <dd className="mt-1 text-sm text-slate-800">{incident.detector || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Occurrences</dt>
          <dd className="mt-1 text-sm text-slate-800">{formatNumber(incident.occurrences, 0)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">First seen</dt>
          <dd className="mt-1 text-sm text-slate-800">{formatDateTime(incident.created_at)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Last seen</dt>
          <dd className="mt-1 text-sm text-slate-800">{formatDateTime(incident.last_seen_at)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Batch</dt>
          <dd className="mt-1 text-sm text-slate-800">
            {incident.batch_id == null ? "—" : `#${incident.batch_id}`}
          </dd>
        </div>
      </dl>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Expected vs observed
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Expected</p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-800">
              {renderValue(incident.expected)}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Observed</p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-800">
              {renderValue(incident.observed)}
            </p>
          </div>
        </div>
      </div>

      <JsonPanel value={incident.evidence ?? {}} title="Supporting evidence" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Why it was flagged</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-800">
            {incident.explanation || "No explanation was recorded for this incident."}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Recommended action
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-800">
            {incident.recommended_action || "No recommendation was recorded."}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Lifecycle status
        </p>
        {canMutate ? (
          <div className="flex flex-wrap gap-2">
            {Object.values(IncidentStatus).map((status) => (
              <button
                key={status}
                type="button"
                disabled={busy || incident.status === status}
                onClick={() => onStatusChange?.(status)}
                className={
                  incident.status === status
                    ? "rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white opacity-70"
                    : secondaryButtonClass
                }
              >
                Mark {status}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Read-only access. Changing incident status requires an analyst or admin role.
          </p>
        )}
      </div>
    </div>
  );
}
