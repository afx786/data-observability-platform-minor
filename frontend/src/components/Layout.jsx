import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { Role } from "../constants/enums.js";
import { useAuth } from "../context/AuthContext.jsx";
import SpatialBackground from "./SpatialBackground.jsx";
import StitchIcon from "./StitchIcon.jsx";

const navigation = [
  { to: "/", label: "Dashboard", end: true, icon: "space_dashboard" },
  { to: "/sources", label: "Sources", icon: "database" },
  { to: "/profiling", label: "Profiling", icon: "analytics" },
  { to: "/schema-rules", label: "Schema & Rules", icon: "account_tree" },
  { to: "/monitoring", label: "Monitoring", icon: "monitoring" },
  { to: "/incidents", label: "Incidents", icon: "warning" },
  { to: "/baselines", label: "Baselines", icon: "tune" },
  { to: "/alert-policies", label: "Alert Policies", icon: "notifications_active" },
  { to: "/reports", label: "Reports", icon: "description" },
  { to: "/users", label: "Users & Roles", icon: "manage_accounts", minimumRole: Role.ADMIN },
];

export default function Layout() {
  const { user, hasRole, logout } = useAuth();
  const location = useLocation();
  const searchRef = useRef(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <div className="relative min-h-screen bg-transparent text-[#0F172A]">
      <SpatialBackground />

      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-[#0F172A]/25 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[240px] flex-col border-r border-[#E2E8F0] bg-white shadow-[1px_0_2px_rgba(15,23,42,0.02)] transition-transform duration-300 ease-out lg:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-1 min-h-0 flex-col">
          <div className="flex items-center gap-3 border-b border-[#E2E8F0] px-4 py-4">
            <StitchIcon />
            <div className="min-w-0">
              <p className="truncate font-stitch-headline text-[15px] font-semibold leading-tight tracking-tight text-[#0F172A]">
                Data Observability
              </p>
              <p className="truncate text-[11px] font-medium text-[#475569]">
                Monitoring &amp; investigation
              </p>
            </div>
          </div>

          <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navigation
              .filter((item) => !item.minimumRole || hasRole(item.minimumRole))
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-300",
                      isActive
                        ? "bg-[#0F172A] font-semibold text-white shadow-sm"
                        : "font-medium text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]",
                    ].join(" ")
                  }
                >
                  <span
                    className="material-symbols-outlined text-[18px] transition-colors duration-300"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
          </nav>
        </div>

        <div className="m-3 rounded-lg border border-[#E2E8F0] bg-[#F8F9FB] p-3">
          <div className="flex items-center justify-between">
            <span className="stitch-label text-[10px]">Cluster health</span>
            <div className="flex items-center gap-1.5 text-emerald-700">
              <span className="stitch-live-dot" />
              <span className="stitch-mono text-[11px] font-semibold">99.94%</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between stitch-mono text-[11px] text-[#475569]">
            <span>Ingestion</span>
            <span className="font-semibold text-[#0F172A]">42.8k rec/s</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 border-t border-[#E2E8F0] pt-2 text-[#475569]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
            <span className="truncate text-[11px] font-medium">Telemetry Engine v2.4 Active</span>
          </div>
        </div>
      </aside>

      <div className="relative pl-0 lg:pl-[240px]">
        <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-[#E2E8F0] bg-white/95 px-4 backdrop-blur-md sm:px-6 lg:left-[240px] lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setNavOpen(true)}
              className="rounded-md p-2 text-[#475569] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] lg:hidden"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>

            <div className="relative w-full max-w-[320px]">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#475569]" aria-hidden="true">
                search
              </span>
              <input
                ref={searchRef}
                type="search"
                aria-label="Search workspace"
                placeholder="Search workspace..."
                className="h-9 w-full rounded-md border border-[#E2E8F0] bg-[#F8F9FB] pl-9 pr-12 text-xs text-[#0F172A] outline-none transition-all placeholder:text-slate-400 focus:border-[#0F172A] focus:bg-white focus:ring-2 focus:ring-[#0F172A]/10"
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[#E2E8F0] bg-white px-1.5 py-0.5 stitch-mono text-[10px] font-medium text-[#475569] shadow-sm">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-[#F1F5F9] px-3 py-1 text-[11px] font-medium text-[#475569] md:inline-flex">
              <span className="stitch-live-dot text-[#2563EB]" />
              <span className="hidden xl:inline">Production EU-Central-1</span>
              <span className="xl:hidden">Production</span>
            </span>

            <span className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 stitch-mono text-[11px] font-medium text-amber-800 sm:inline-flex">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">radar</span>
              <span>3 Anomalies</span>
            </span>

            <button
              type="button"
              aria-label="Notifications"
              className="relative rounded-full p-2 text-[#475569] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#2563EB] ring-2 ring-white" />
            </button>

            <div className="hidden items-center gap-3 border-l border-[#E2E8F0] pl-3 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#0F172A]/10 bg-[#F1F5F9] text-[11px] font-semibold uppercase text-[#475569]">
                {(user?.email ?? "DO").slice(0, 2)}
              </div>
              <div className="hidden flex-col text-left xl:flex">
                <span className="text-[11px] font-semibold capitalize leading-tight text-[#0F172A]">
                  {user?.role ?? "Viewer"}
                </span>
                <span className="stitch-mono text-[10px] text-[#475569]">{user?.email}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="stitch-btn-secondary !px-2.5 !py-1.5 !text-xs sm:!px-3"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="min-h-screen px-4 pb-12 pt-20 sm:px-6 lg:px-8">
          <div key={location.pathname} className="stitch-page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
