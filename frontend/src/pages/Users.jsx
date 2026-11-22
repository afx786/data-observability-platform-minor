import { useEffect, useState } from "react";

import { apiGet, apiPatch, apiPost } from "../api/client.js";
import { Role } from "../constants/enums.js";

const emptyForm = { email: "", password: "", role: Role.VIEWER };

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

  return (
    <section>
      <h1 className="text-2xl font-semibold">Users &amp; roles</h1>
      <p className="mt-1 text-sm text-slate-500">
        Admin only. Roles inherit permissions: Admin &gt; Analyst &gt; Viewer.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-4 text-sm text-green-700">{message}</p>}

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{user.email}</td>
                <td className="px-4 py-2">
                  <select
                    value={user.role}
                    onChange={(event) => handleRole(user, event.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1"
                  >
                    {Object.values(Role).map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">{user.is_active ? "active" : "inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleCreate} className="mt-6 max-w-md rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold">Add user</h2>
        <label className="mt-4 block text-sm">
          Email
          <input
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="mt-3 block text-sm">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="mt-3 block text-sm">
          Role
          <select
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            {Object.values(Role).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Create user
        </button>
      </form>
    </section>
  );
}
