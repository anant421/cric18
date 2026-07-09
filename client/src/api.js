const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4001`;

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

async function upload(path, formData) {
  const res = await fetch(`${API_BASE}/api${path}`, { method: 'POST', body: formData });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
  return data;
}

export const api = {
  get: (path, token) => request(path, { token }),
  post: (path, body, token) => request(path, { method: 'POST', body, token }),
  patch: (path, body, token) => request(path, { method: 'PATCH', body, token }),
  del: (path, token) => request(path, { method: 'DELETE', token }),
  upload,
};

export const API_BASE_URL = API_BASE;
// Cloudinary returns an absolute URL already; older local-dev uploads were
// stored as a relative "/uploads/..." path against the API host.
export const resolveUploadUrl = (photoUrl) => {
  if (!photoUrl) return null;
  return /^https?:\/\//.test(photoUrl) ? photoUrl : `${API_BASE}${photoUrl}`;
};
