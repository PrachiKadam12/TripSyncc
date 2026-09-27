/**
 * socialSignalService.js — TripSync Weather Twin Social Signals
 *
 * Calls the TripSync backend which proxies Reddit — no direct browser CORS issues.
 * Backend caches results for 5 minutes to avoid repeated Reddit calls.
 * Falls back to deterministic signals when backend/Reddit is unavailable.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Fetch social signals for a location via the TripSync backend.
 * Backend calls Reddit — browser never touches reddit.com directly.
 */
export async function fetchSocialSignals(location, weatherCondition = '') {
  if (!location) return [];

  try {
    const params = new URLSearchParams({ location, limit: '8' });
    if (weatherCondition) params.set('weather', weatherCondition);

    const res = await fetch(`${API_BASE_URL}/api/v1/social-signals?${params}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      console.warn(`[socialSignalService] Backend returned ${res.status}`);
      return getFallbackSocialSignals(location);
    }

    const data = await res.json();
    const signals = data?.signals || [];
    return signals;
  } catch (err) {
    console.warn('[socialSignalService] Backend fetch failed, using fallback:', err.message);
    return getFallbackSocialSignals(location);
  }
}

/**
 * Generate deterministic fallback social signals when backend/Reddit is unreachable.
 * Clearly labeled as fallback — never presented as live data.
 */
export function getFallbackSocialSignals(location) {
  return [
    {
      id: 'fb-1',
      platform: 'twitter',
      author: '@HimachalWeather',
      title: `Heavy rain near Solang Valley. Roads moving slowly. #${location} #Rain`,
      text: '',
      timeLabel: '1h ago',
      severity: 'High',
      subreddit: '',
      isFallback: true,
    },
    {
      id: 'fb-2',
      platform: 'instagram',
      author: '@travel_with_neha',
      title: `Traffic jam on NH-3 due to landslide near Kullu. Avoid non-essential travel.`,
      text: '',
      timeLabel: '2h ago',
      severity: 'Moderate',
      subreddit: '',
      isFallback: true,
    },
    {
      id: 'fb-3',
      platform: 'reddit',
      author: 'r/india_travel',
      title: `Many activities in ${location} cancelled today due to heavy rain.`,
      text: '',
      timeLabel: '3h ago',
      severity: 'Moderate',
      subreddit: 'r/india_travel',
      isFallback: true,
    },
  ];
}
