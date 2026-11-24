// Display helpers. Every timestamp shown in the UI is explicitly rendered in IST.

const IST = "Asia/Kolkata";

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toDate(value) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? `${dateTimeFormatter.format(date)} IST` : "—";
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "—";
}

export function formatTime(value) {
  const date = toDate(value);
  return date ? `${timeFormatter.format(date)} IST` : "—";
}

export function formatNumber(value, digits = 2) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

// Rates arrive from the API as fractions (0.12 = 12%). Accept an already-scaled
// percentage too so older data still renders sensibly.
export function ratePercent(value) {
  if (value == null || value === "") return 0;
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.abs(number) <= 1 ? number * 100 : number;
}

export function formatRate(value, digits = 1) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return `${ratePercent(number).toFixed(digits)}%`;
}

export function formatValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isInteger(value) ? formatNumber(value, 0) : formatNumber(value, 2);
  }
  if (typeof value === "object") return safeJson(value);
  return String(value);
}

export function formatMetric(key, value) {
  if (value == null || value === "") return "—";
  if (/rate/i.test(key)) return formatRate(value);
  if (/(_at|timestamp)$/i.test(key)) return formatDateTime(value);
  if (/hours$/i.test(key)) return `${formatNumber(value, 1)} h`;
  return formatValue(value);
}

export function humanize(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function safeJson(value) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}

export function csvEscape(value) {
  const text = value == null ? "" : typeof value === "object" ? safeJson(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function asArray(value) {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

export function parseRecipients(text) {
  return String(text ?? "")
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function formatUptime(seconds) {
  if (seconds == null || seconds === "") return "—";
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return [days ? `${days}d` : null, hours ? `${hours}h` : null, `${minutes}m`]
    .filter(Boolean)
    .join(" ");
}
