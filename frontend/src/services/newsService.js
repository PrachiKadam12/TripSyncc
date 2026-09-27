/**
 * newsService.js — TripSync Frontend News Intelligence Service
 *
 * Consumes ONLY TripSync's standardized news format from the backend.
 * Never calls external news providers directly.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Get trip-aware travel news from the TripSync backend.
 *
 * @param {string} tripId - Trip identifier
 * @param {object} options - Query options
 * @param {number} [options.hours=24] - Search window in hours
 * @param {number} [options.limit=20] - Maximum articles
 * @param {string} [options.type] - Filter by disruption type
 * @param {string} [options.severity] - Filter by severity
 * @param {string} [options.location] - Filter by location
 * @returns {Promise<{tripId, fetchedAt, sourceStatus, provider, articles, summary}>}
 */
export async function getTripNews(tripId, options = {}) {
  const { hours = 24, limit = 20, type, severity, location } = options;

  const params = new URLSearchParams();
  params.set('hours', String(hours));
  params.set('limit', String(limit));
  if (type) params.set('type', type);
  if (severity) params.set('severity', severity);
  if (location) params.set('location', location);

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/news?${params}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      console.warn(`[newsService] Backend returned ${res.status}`);
      return {
        tripId,
        fetchedAt: new Date().toISOString(),
        sourceStatus: 'UNAVAILABLE',
        provider: { name: 'none', status: 'UNAVAILABLE' },
        articles: [],
        summary: { total: 0, disruptions: 0, highRisk: 0, locationsAffected: 0 },
        error: 'Travel news is temporarily unavailable',
      };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('[newsService] Fetch error:', err.message);
    return {
      tripId,
      fetchedAt: new Date().toISOString(),
      sourceStatus: 'UNAVAILABLE',
      provider: { name: 'none', status: 'UNAVAILABLE' },
      articles: [],
      summary: { total: 0, disruptions: 0, highRisk: 0, locationsAffected: 0 },
      error: 'Travel news is temporarily unavailable',
    };
  }
}

/**
 * Get news provider status.
 *
 * @returns {Promise<{providers: Array, total: number, available: number}>}
 */
export async function getNewsProviderStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/news/status`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return { providers: [], total: 0, available: 0 };
    return await res.json();
  } catch {
    return { providers: [], total: 0, available: 0 };
  }
}

/**
 * Format relative time from ISO timestamp.
 *
 * @param {string} isoString - ISO 8601 timestamp
 * @returns {string} Human-readable relative time
 */
export function formatNewsTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } catch {
    return '';
  }
}
