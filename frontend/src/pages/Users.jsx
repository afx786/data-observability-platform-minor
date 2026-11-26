import { useEffect, useState } from "react";

import { apiGet, apiPatch, apiPost } from "../api/client.js";
import { Role } from "../constants/enums.js";

const CARD =
  "stitch-card stitch-card-hover stitch-rise rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.03)] transition-all duration-200 hover:border-[#CBD5E1]";
const PRIMARY =
  "stitch-btn-primary stitch-shine inline-flex items-center gap-2 rounded bg-[#182430] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0F172A] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";
const FIELD =
  "mt-1 w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#1E293B] outline-none transition focus:border-[#182430] focus:ring-1 focus:ring-[#182430]";

const ROLE_CARDS = [
  {
    role: Role.ADMIN,
    label: "Admin",
    summary: "Full platform control, user management and explicit approvals.",
    color: "#182430",
  },
  {
    role: Role.ANALYST,
    label: "Analyst",
    summary: "Ingest, configure rules, approve baselines and investigate incidents.",
    color: "#8C6D23",
  },
  {
    role: Role.VIEWER,
    label: "Viewer",
    summary: "Read-only observability across dashboards, sources and reports.",
    color: "#2563EB",
  },
];

const emptyForm = { email: "", password: "", role: Role.VIEWER };

function numericValues(values) {
  return values.map(Number).filter((value) => Number.isFinite(value));
}

function MiniBars({ values, color = "#2563EB", height = "h-9" }) {
  const nums = numericValues(values);
  const max = nums.length ? Math.max(...nums) : 0;
  const pixels = { "h-6": 24, "h-8": 32, "h-9": 36, "h-10": 40 }[height] ?? 36;
  if (!nums.length) {
    return (
      <div
        className="stitch-sparkline items-end"
        style={{ display: "flex", height: pixels }}
        aria-hidden="true"
      >
        <span className="h-px w-full bg-[#E2E8F0]" />
      </div>
    );
  }
  return (
    <div
      className="stitch-sparkline items-end gap-1"
      style={{ display: "flex", height: pixels }}
      aria-hidden="true"
    >
      {nums.map((value, index) => (
        <span
          key={index}
          className="min-w-[6px] flex-1 rounded-t-[2px] transition-all duration-300"
          style={{
            height: `${max ? Math.max(6, (value / max) * 100) : 6}%`,
            backgroundColor: color,
            opacity: 0.35 + (value / (max || 1)) * 0.65,
          }}
        />
      ))}
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function load() {
    try {
      setUsers(await apiGet("/api/auth/users"));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    try {
      await apiPost("/api/auth/users", form);
      setForm(emptyForm);
      setMessage("User created");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRole(user, role) {
    try {
      await apiPatch(`/api/auth/users/${user.id}`, { role });
      setMessage("Role updated");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const roleCounts = ROLE_CARDS.map(({ role }) => users.filter((user) => user.role === role).length);
  const activeCount = users.filter((user) => user.is_active).length;

  return (
    <section className="stitch-page-enter space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <span className="stitch-eyebrow mb-2 block font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
            Access control / Identity
          </span>
          <h1
            className="stitch-glow text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#0F172A] sm:text-[2.5rem]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Users &amp; roles
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#475569]">
            Admin only. Roles inherit permissions: Admin &gt; Analyst &gt; Viewer.
          </p>
        </div>
        <div className={`${CARD} flex items-center gap-2 px-4 py-2.5`}>
          <span className="h-2 w-2 rounded-full bg-[#16A34A] ring-4 ring-emerald-50" />
          <span className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
            {activeCount} active / {users.length} total
          </span>
        </div>
      </div>

      {(error || message) && (
        <div className="space-y-2 font-mono text-xs">
          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>
          )}
          {message && (
            <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
              {message}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {ROLE_CARDS.map((card, index) => {
          const count = roleCounts[index];
          return (
            <div key={card.role} className={`${CARD} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <span className="stitch-label font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                  0{index + 1} / Role tier
                </span>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: card.color }} />
              </div>
              <div className="mt-3 flex items-baseline gap-3">
                <h2 className="text-lg font-medium text-[#0F172A]">{card.label}</h2>
                <span className="font-mono text-2xl font-medium tracking-[-0.03em] text-[#0F172A]">
                  {count}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{card.summary}</p>
              <div className="stitch-divider my-4 border-t border-[#E2E8F0]" />
              <MiniBars values={roleCounts} color={card.color} height="h-8" />
            </div>
          );
        })}
      </div>

      <section className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-4">
          <div>
            <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
              User directory
            </span>
            <p className="mt-1 text-xs text-[#64748B]">
              Select a role inline to update permissions. Changes take effect immediately.
            </p>
          </div>
          <span className="stitch-badge rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 font-mono text-[10px] uppercase text-[#64748B]">
            {users.length} records
          </span>
        </div>
        <div className="stitch-divider mx-5 border-t border-[#E2E8F0]" />
        <div className="p-5 pt-4">
          <table className="w-full text-left">
            <thead className="bg-[#EEF2F6] font-mono text-[10px] uppercase tracking-[0.12em] text-[#64748B]">
              <tr>
                <th className="border-b border-[#D2D9E2] px-4 py-2.5 font-medium">Email</th>
                <th className="border-b border-[#D2D9E2] px-4 py-2.5 font-medium">Role</th>
                <th className="border-b border-[#D2D9E2] px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-[#E2E8F0] bg-white transition-colors even:bg-[#FBFBFD] hover:bg-[#F4F6F8]"
                >
                  <td className="stitch-mono px-4 py-2.5 font-mono text-xs text-[#1E293B]">
                    {user.email}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={user.role}
                      onChange={(event) => handleRole(user, event.target.value)}
                      className="stitch-mono rounded border border-[#E2E8F0] bg-white px-2 py-1 font-mono text-xs text-[#1E293B] outline-none transition focus:border-[#182430] focus:ring-1 focus:ring-[#182430]"
                    >
                      {Object.values(Role).map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#475569]">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          user.is_active ? "bg-[#16A34A] ring-4 ring-emerald-50" : "bg-[#CBD5E1]"
                        }`}
                      />
                      {user.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-[#64748B]">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${CARD} max-w-xl`}>
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-4">
          <div>
            <span className="stitch-label font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">
              Add user
            </span>
            <p className="mt-1 text-xs text-[#64748B]">
              Provision a new account with an inherited role tier.
            </p>
          </div>
        </div>
        <div className="stitch-divider mx-5 border-t border-[#E2E8F0]" />
        <form onSubmit={handleCreate} className="space-y-4 p-5 pt-4">
          <label className="block text-sm text-[#475569]">
            <span className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
              Email
            </span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className={FIELD}
            />
          </label>
          <label className="block text-sm text-[#475569]">
            <span className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
              Password
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className={FIELD}
            />
          </label>
          <label className="block text-sm text-[#475569]">
            <span className="stitch-label font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">
              Role
            </span>
            <select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
              className={FIELD}
            >
              {Object.values(Role).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={PRIMARY}>
            Create user
          </button>
        </form>
      </section>
    </section>
  );
}
