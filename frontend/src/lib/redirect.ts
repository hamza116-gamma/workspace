// Only same-site absolute paths are allowed as ?next= targets: "/x" yes,
// "//evil.com", "/\evil.com", "https://..." and "javascript:" no.
export const safeNextPath = (value: string | null | undefined, fallback = '/'): string => {
  if (!value || typeof value !== 'string') {
    return fallback;
  }
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  if (/[\u0000-\u001f]/.test(value)) {
    return fallback;
  }
  try {
    const url = new URL(value, 'http://same.site');
    if (url.origin !== 'http://same.site') {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
};

export const nextFromLocation = (fallback = '/'): string =>
  typeof window === 'undefined'
    ? fallback
    : safeNextPath(new URLSearchParams(window.location.search).get('next'), fallback);
