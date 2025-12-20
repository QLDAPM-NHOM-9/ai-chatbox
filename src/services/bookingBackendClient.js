import { BACKEND_BASE_URL } from "../config/ai-backend.js";

export async function fetchTourById(tourId, accessToken = null) {
  const url = `${BACKEND_BASE_URL}/tours/${tourId}`;

  const headers = { "Content-Type": "application/json" };
  // Nếu BE cần auth cho tour detail thì truyền token
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const resp = await fetch(url, { method: "GET", headers });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GET ${url} failed: ${resp.status} - ${text}`);
  }

  return resp.json();
}
