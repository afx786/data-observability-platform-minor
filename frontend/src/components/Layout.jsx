import { NavLink, Outlet } from "react-router-dom";

import { Role } from "../constants/enums.js";
import { useAuth } from "../context/AuthContext.jsx";

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
  { to: "/users", label: "Users & Roles", minimumRole: Role.ADMIN },
];

export default function Layout() {
  const { user, hasRole, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4">
        <div className="mb-6 px-2">
          <p className="text-sm font-semibold leading-tight">Data Observability</p>
          <p className="text-xs text-slate-500">Monitoring &amp; investigation</p>
        </div>

        <nav className="space-y-1">
          {navigation
            .filter((item) => !item.minimumRole || hasRole(item.minimumRole))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "block rounded-md px-3 py-2 text-sm transition-colors",
                    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="mt-auto border-t border-slate-100 pt-4">
          <p className="px-2 text-xs text-slate-500">{user?.email}</p>
          <p className="px-2 text-xs font-medium capitalize text-slate-700">{user?.role}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
