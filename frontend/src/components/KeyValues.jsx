import { formatMetric, formatValue, humanize } from "../utils/format.js";
import { EmptyState } from "./StateViews.jsx";

export default function KeyValues({ value }) {
  if (value == null) return <EmptyState title="No measurements available" />;
  if (typeof value !== "object" || Array.isArray(value)) {
    return <p className="text-sm text-slate-700">{formatValue(value)}</p>;
  }

  const entries = Object.entries(value);
  if (!entries.length) return <EmptyState title="No measurements available" />;

  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {entries.map(([key, item]) => (
        <div key={key} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {humanize(key)}
          </dt>
          <dd className="mt-1 break-words text-sm text-slate-800">{formatMetric(key, item)}</dd>
        </div>
      ))}
    </dl>
  );
}
