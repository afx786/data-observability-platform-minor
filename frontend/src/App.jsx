import { Route, Routes } from "react-router-dom";

import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { Role } from "./constants/enums.js";
import AlertPolicies from "./pages/AlertPolicies.jsx";
import Baselines from "./pages/Baselines.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Incidents from "./pages/Incidents.jsx";
import Login from "./pages/Login.jsx";
import Monitoring from "./pages/Monitoring.jsx";
import Profiling from "./pages/Profiling.jsx";
import Reports from "./pages/Reports.jsx";
import SchemaRules from "./pages/SchemaRules.jsx";
import Sources from "./pages/Sources.jsx";
import Users from "./pages/Users.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="sources" element={<Sources />} />
          <Route path="profiling" element={<Profiling />} />
          <Route path="schema-rules" element={<SchemaRules />} />
          <Route path="monitoring" element={<Monitoring />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="baselines" element={<Baselines />} />
          <Route path="alert-policies" element={<AlertPolicies />} />
          <Route path="reports" element={<Reports />} />

          <Route element={<ProtectedRoute minimumRole={Role.ADMIN} />}>
            <Route path="users" element={<Users />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
