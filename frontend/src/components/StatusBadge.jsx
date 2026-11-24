const TONES = {
  open: "red",
  acknowledged: "amber",
  resolved: "emerald",
  active: "emerald",
  inactive: "slate",
  superseded: "slate",
  draft: "slate",
  low: "sky",
  medium: "amber",
  high: "orange",
  critical: "red",
  pending: "amber",
  sent: "emerald",
  failed: "red",
  suppressed: "slate",
  received: "sky",
  profiled: "sky",
  analyzed: "emerald",
  healthy: "emerald",
  ok: "emerald",
  degraded: "amber",
  down: "red",
  unknown: "slate",
};

const CLASSES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export default function StatusBadge({ value, tone }) {
  if (value == null || value === "") return <span className="text-slate-400">—</span>;
  const key = String(value).toLowerCase();
  const selected = tone ?? TONES[key] ?? "slate";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
        CLASSES[selected] ?? CLASSES.slate
      }`}
    >
      {key.replace(/_/g, " ")}
    </span>
  );
}
