// Fetch JSON, throwing on a non-2xx response. Kept generic so any caller that
// only needs "parse the body or fail" can share it.
export async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error("Request failed");
  }
  return response.json();
}
