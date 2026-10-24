/**
 * Centralized API & Asset Configuration
 * Supports local development (via Vite proxy or direct localhost)
 * and production deployment (Vercel frontend talking to Render/Railway backend).
 */

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();

// Strip trailing slashes
const normalizedBase = rawApiUrl.replace(/\/+$/, '');

/**
 * Backend Host / Origin (e.g., "https://my-backend.onrender.com" or "http://localhost:8000" or "")
 * If VITE_API_URL was supplied with or without /api/v1, this extracts the host root.
 */
export const BACKEND_URL = normalizedBase.endsWith('/api/v1')
  ? normalizedBase.slice(0, -7)
  : normalizedBase;

/**
 * API Root with /api/v1 path (e.g. "https://my-backend.onrender.com/api/v1" or "/api/v1")
 */
export const API_BASE_URL = normalizedBase
  ? (normalizedBase.endsWith('/api/v1') ? normalizedBase : `${normalizedBase}/api/v1`)
  : '/api/v1';

/**
 * Builds a fully qualified API endpoint URL without double slashes or duplicated /api/v1
 */
export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // If endpoint already starts with /api/v1, attach to BACKEND_URL directly
  if (cleanEndpoint.startsWith('/api/v1/')) {
    return BACKEND_URL ? `${BACKEND_URL}${cleanEndpoint}` : cleanEndpoint;
  }

  return `${API_BASE_URL}${cleanEndpoint}`;
}

/**
 * Resolves an image URL or file path into a loadable URL.
 * Handles:
 * 1. Absolute URLs (http://, https://, blob:, data:)
 * 2. Backend relative API URLs (/api/v1/inspections/images/...)
 * 3. Eval sample URLs (/api/v1/inspections/eval-samples/...)
 * 4. Raw filenames or relative paths
 */
export function resolveImageUrl(urlOrPath?: string | null): string {
  if (!urlOrPath) return '';

  // If already absolute or blob/data URI
  if (
    urlOrPath.startsWith('http://') ||
    urlOrPath.startsWith('https://') ||
    urlOrPath.startsWith('blob:') ||
    urlOrPath.startsWith('data:')
  ) {
    return urlOrPath;
  }

  const cleanPath = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;

  // If already prefixed with /api/v1/
  let resolved = cleanPath.startsWith('/api/v1/')
    ? (BACKEND_URL ? `${BACKEND_URL}${cleanPath}` : cleanPath)
    : apiUrl(`/inspections/images${cleanPath}`);

  // Attach authenticated token to proprietary inspection images for secure record-level image streaming
  if (resolved.includes('/inspections/images/') && !resolved.includes('token=')) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('forgesight_token') : null;
    if (token) {
      const sep = resolved.includes('?') ? '&' : '?';
      resolved = `${resolved}${sep}token=${encodeURIComponent(token)}`;
    }
  }

  return resolved;
}
