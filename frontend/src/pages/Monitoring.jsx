import { useState } from "react";

import PagePlaceholder from "../components/PagePlaceholder.jsx";
import WindowHoursPicker from "../components/WindowHoursPicker.jsx";

export default function Monitoring() {
  const [windowHours, setWindowHours] = useState(1);

  return (
    <section>
      <h1 className="text-2xl font-semibold">Monitoring</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Current source health, historical quality metrics, baseline versus current values and
        drift indicators.
      </p>

      <div className="mt-6">
        <WindowHoursPicker value={windowHours} onChange={setWindowHours} />
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
        Anomaly percentage for the past {windowHours}h will appear here.
      </div>
    </section>
  );
}
