const TONES = {
  default: "border-slate-200",
  danger: "border-red-200 bg-red-50/40",
  warning: "border-amber-200 bg-amber-50/40",
  success: "border-emerald-200 bg-emerald-50/40",
  info: "border-sky-200 bg-sky-50/40",
};

const VALUE_TONES = {
  default: "text-slate-900",
  danger: "text-red-700",
  warning: "text-amber-700",
  success: "text-emerald-700",
  info: "text-sky-700",
};

export default function StatCard({ label, value, hint, tone = "default" }) {
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${TONES[tone] ?? TONES.default}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${VALUE_TONES[tone] ?? VALUE_TONES.default}`}>
        {value ?? "—"}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
