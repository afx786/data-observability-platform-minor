import { NavLink, Outlet } from "react-router-dom";

const navigation = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/sources", label: "Sources" },
  { to: "/profiling", label: "Profiling" },
  { to: "/schema-rules", label: "Schema & Rules" },
  { to: "/monitoring", label: "Monitoring" },
  { to: "/incidents", label: "Incidents" },
  { to: "/baselines", label: "Baselines" },
  { to: "/alert-policies", label: "Alert Policies" },
  { to: "/reports", label: "Reports" },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white p-4">
        <div className="mb-6 px-2">
          <p className="text-sm font-semibold leading-tight">Data Observability</p>
          <p className="text-xs text-slate-500">Monitoring &amp; investigation</p>
        </div>

        <nav className="space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "block rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
