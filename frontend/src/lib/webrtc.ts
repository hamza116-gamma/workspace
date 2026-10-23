// WebRTC helpers (browser-native APIs only, no libraries).

const DEFAULT_STUN = 'stun:stun.l.google.com:19302';

const splitUrls = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

// STUN defaults to Google's public server; TURN is optional (needed behind
// strict NATs / corporate firewalls).
const buildIceServers = (): RTCIceServer[] => {
  const stun = splitUrls(process.env.NEXT_PUBLIC_STUN_URL);
  const servers: RTCIceServer[] = [{ urls: stun.length ? stun : [DEFAULT_STUN] }];
  const turn = splitUrls(process.env.NEXT_PUBLIC_TURN_URL);
  if (turn.length) {
    servers.push({
      urls: turn,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || undefined,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || undefined,
    });
  }
  return servers;
};

export const ICE_SERVERS = buildIceServers();

// Mesh rooms stay small; the server enforces the same limit.
export const MAX_HUDDLE_PARTICIPANTS = 8;

export const isWebrtcSupported = () =>
  typeof window !== 'undefined' &&
  typeof window.RTCPeerConnection === 'function' &&
  Boolean(navigator.mediaDevices?.getUserMedia);

export const getDisplayMediaSupported = () =>
  typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);

export const formatHuddleDuration = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

export const mediaErrorMessage = (error: unknown, what: string) => {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') return `Permission to use your ${what} was denied.`;
  if (name === 'NotFoundError') return `No ${what} was found.`;
  if (name === 'NotReadableError') return `Your ${what} is in use by another app.`;
  return `Could not start your ${what}.`;
};

export const stopStream = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((track) => track.stop());
};
