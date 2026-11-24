import { safeJson } from "../utils/format.js";

export default function JsonPanel({ value, title = "Evidence", className = "max-h-72" }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <pre
        className={`${className} overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-200`}
      >
        {safeJson(value)}
      </pre>
    </div>
  );
}
