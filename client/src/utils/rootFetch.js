import { API_URL } from "../firebase";

// Talks to /api/root using the shared root password stored in localStorage —
// no Firebase login involved, so the owner can reach this from any device.
export async function rootFetch(path, options = {}) {
  const password = localStorage.getItem("rootAdminPassword");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-root-password": password || "",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}
