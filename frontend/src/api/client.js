// Base URL is empty in development so requests go through the Vite proxy on /api.
const configuredBaseURL = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const baseURL =
  configuredBaseURL &&
  !/^https?:\/\//i.test(configuredBaseURL) &&
  !configuredBaseURL.startsWith("/")
    ? `https://${configuredBaseURL}`
    : configuredBaseURL;
const TOKEN_KEY = "dop_access_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const isForm = options.body instanceof FormData || options.body instanceof URLSearchParams;

  const headers = {
    ...(isForm ? {} : { "Content-Type": "application/json" }),
    ...(options.headers ?? {}),
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseURL}${path}`, { ...options, headers });

  if (response.status === 401 && path !== "/api/auth/login") {
    clearToken();
  }

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch {
      // Response had no JSON body.
    }
    throw new Error(detail);
  }

  return response.status === 204 ? null : response.json();
}

export const apiGet = (path, options = {}) => request(path, options);

export const apiPost = (path, body, options = {}) =>
  request(path, { ...options, method: "POST", body: JSON.stringify(body) });

export const apiPatch = (path, body, options = {}) =>
  request(path, { ...options, method: "PATCH", body: JSON.stringify(body) });
