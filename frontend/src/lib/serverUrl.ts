const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Points a configured backend URL at the host the app was opened from.
 *
 * `.env` says `http://localhost:5000`, which only works on this machine. When
 * the app is opened as e.g. `http://10.10.99.94:3000` from another device,
 * "localhost" would be that device, so swap in the page's hostname (keeping
 * the backend's protocol, port and path). Non-loopback URLs (a real domain in
 * production) are returned unchanged, as is everything during SSR.
 */
export const resolveServerUrl = (configured: string): string => {
  if (typeof window === 'undefined') {
    return configured;
  }
  try {
    const url = new URL(configured);
    const pageHost = window.location.hostname;
    if (LOOPBACK.has(url.hostname) && !LOOPBACK.has(pageHost)) {
      url.hostname = pageHost;
      return url.toString().replace(/\/$/, configured.endsWith('/') ? '/' : '');
    }
  } catch {
    // Not an absolute URL: leave it alone.
  }
  return configured;
};
