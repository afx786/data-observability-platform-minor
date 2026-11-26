const TONES = {
  default: { line: "#2563EB", text: "#0F172A", surface: "rgba(37,99,235,0.06)" },
  danger: { line: "#E11D48", text: "#BE123C", surface: "rgba(225,29,72,0.05)" },
  warning: { line: "#8C6D23", text: "#8C6D23", surface: "rgba(140,109,35,0.06)" },
  success: { line: "#059669", text: "#047857", surface: "rgba(5,150,105,0.06)" },
  info: { line: "#3B82F6", text: "#2563EB", surface: "rgba(59,130,246,0.06)" },
};

export default function StatCard({
  label,
  value,
  hint,
  tone = "default",
  sparkline,
  icon,
  children,
  className = "",
}) {
  const selected = TONES[tone] ?? TONES.default;
  const spark = sparkline ?? children;

  return (
    <div
      className={`stitch-kpi ${className}`}
      style={{ "--stitch-accent-line": selected.line }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="stitch-label">{label}</p>
        {icon && (
          <span className="material-symbols-outlined text-[18px] text-[#94A3B8]" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      <div className="py-3.5">
        <div
          className="font-stitch-kpi text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums"
          style={{ color: selected.text }}
        >
          {value ?? "—"}
        </div>
        {hint && <p className="mt-2 text-[11px] leading-relaxed text-[#64748B]">{hint}</p>}
      </div>

      {spark ? (
        <div className="stitch-sparkline" style={{ color: selected.line }}>
          {spark}
        </div>
      ) : (
        <div className="mt-1 flex items-center gap-2 border-t border-[#E2E8F0] pt-2.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: selected.line }}
          />
          <span className="stitch-mono text-[10px] uppercase tracking-[0.08em] text-[#94A3B8]">
            Live telemetry
          </span>
        </div>
      )}
    </div>
  );
}
