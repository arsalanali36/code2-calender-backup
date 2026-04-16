/**
 * @fileoverview apiClient.js
 * @description Central HTTP fetch wrapper for all API calls.
 *   - All service files call apiClient instead of fetch() directly.
 *   - One place to add auth headers, base URL, or global error handling.
 */

const apiClient = (() => {
  const BASE = '';   // empty = same origin; change to 'https://...' if hosted elsewhere

  /**
   * GET request. Returns parsed JSON.
   * @param {string} path - e.g. '/api/trades'
   */
  async function get(path) {
    const res = await fetch(BASE + path);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json();
  }

  /**
   * POST JSON body. Returns parsed JSON.
   * @param {string} path
   * @param {object} body
   */
  async function post(path, body) {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
    return res.json();
  }

  /**
   * POST multipart FormData (for file uploads). Returns parsed JSON.
   */
  async function upload(path, formData) {
    const res = await fetch(BASE + path, { method: 'POST', body: formData });
    if (!res.ok) {
        let errJson = null;
        try { errJson = await res.json(); } catch(e) {}
        if (errJson && errJson.error) throw new Error(errJson.error);
        throw new Error(`UPLOAD ${path} → ${res.status}`);
    }
    return res.json();
  }

  /**
   * POST and receive a binary Blob (for file downloads).
   * @param {string} path
   * @param {object} body
   * @returns {Promise<Blob>}
   */
  async function download(path, body) {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`DOWNLOAD ${path} → ${res.status}`);
    return res.blob();
  }

  /**
   * GET and receive a binary Blob.
   * @param {string} path - may include query string
   * @returns {Promise<Blob>}
   */
  async function downloadGet(path) {
    const res = await fetch(BASE + path);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.blob();
  }

  return { get, post, upload, download, downloadGet };
})();
