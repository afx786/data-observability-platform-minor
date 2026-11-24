import { apiGet } from "./client.js";

// The shared request wrapper already handles auth and error details. These
// helpers reuse it for the HTTP verbs/multipart bodies the base client omits.
export const apiPut = (path, body) => apiGet(path, { method: "PUT", body: JSON.stringify(body) });

export const apiDelete = (path) => apiGet(path, { method: "DELETE" });

export const apiUpload = (path, formData) => apiGet(path, { method: "POST", body: formData });
