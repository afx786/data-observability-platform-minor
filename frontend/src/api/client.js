// Base URL is empty in development so requests go through the Vite proxy on /api.
const baseURL = import.meta.env.VITE_API_BASE_URL ?? "";

export async function apiGet(path, options = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
