// Thin wrapper over the Express API.
// Override at runtime by setting window.HASHLAB_API_BASE before the bundle
// loads; otherwise the API is expected on port 4000 of the same host.
const BASE =
  (typeof window !== 'undefined' && window.HASHLAB_API_BASE) ||
  (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : 'http://localhost:4000');

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (err) {
    throw new Error('Cannot reach the API on ' + BASE + '. Is the server running? (npm run dev:server)');
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    throw new Error('Bad response from server: ' + text.slice(0, 120));
  }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

export const api = {
  base: BASE,
  health: () => request('/api/health'),
  hash: (plaintext, algorithm) =>
    request('/api/hash', { method: 'POST', body: JSON.stringify({ plaintext, algorithm }) }),
  createJob: (payload) =>
    request('/api/jobs', { method: 'POST', body: JSON.stringify(payload) }),
  getJob: (id) => request(`/api/jobs/${id}`),
  history: () => request('/api/history'),
};

export default api;
