import { WINDOW_HOURS_MAX, WINDOW_HOURS_MIN } from "../constants/enums.js";

export default function WindowHoursPicker({ value, onChange, label = "Anomaly view window" }) {
  const hours = Array.from(
    { length: WINDOW_HOURS_MAX - WINDOW_HOURS_MIN + 1 },
    (_, index) => index + WINDOW_HOURS_MIN,
  );

  return (
    <label className="text-sm text-slate-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
      >
        {hours.map((hour) => (
          <option key={hour} value={hour}>
            past {hour} {hour === 1 ? "hour" : "hours"}
          </option>
        ))}
      </select>
    </label>
  );
}
