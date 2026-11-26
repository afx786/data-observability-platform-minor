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
  slate: { background: "#F1F5F9", color: "#475569", ring: "#CBD5E1" },
  sky: { background: "#EFF6FF", color: "#2563EB", ring: "rgba(37,99,235,0.22)" },
  amber: { background: "#FEFCE8", color: "#8C6D23", ring: "rgba(140,109,35,0.28)" },
  orange: { background: "#FFF7ED", color: "#C2410C", ring: "rgba(194,65,12,0.22)" },
  red: { background: "#FEF2F2", color: "#DC2626", ring: "rgba(220,38,38,0.22)" },
  emerald: { background: "#F0FDF4", color: "#16A34A", ring: "rgba(22,163,74,0.22)" },
};

export default function StatusBadge({ value, tone }) {
  if (value == null || value === "") {
    return <span className="stitch-mono text-[#94A3B8]">—</span>;
  }

  const key = String(value).toLowerCase();
  const selected = tone ?? TONES[key] ?? "slate";
  const style = CLASSES[selected] ?? CLASSES.slate;

  return (
    <span
      className="stitch-badge"
      style={{
        backgroundColor: style.background,
        color: style.color,
        "--badge-ring": style.ring,
      }}
    >
      <span className="stitch-badge-dot" aria-hidden="true" />
      {key.replace(/_/g, " ")}
    </span>
  );
}
