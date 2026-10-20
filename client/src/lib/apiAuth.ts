/**
 * Central place where every /api request gets its Firebase ID token attached.
 *
 * Installed once from main.tsx. It patches:
 *  - axios (default instance) via a request interceptor
 *  - window.fetch for URLs that target /api
 *  - window.EventSource (cannot send headers) by appending ?access_token=<cached id token>
 *
 * The legacy `x-user-id` header is still sent (when a user is logged in) so the
 * server works in both ENFORCE_AUTH modes while it is being rolled out.
 */
import axios from 'axios';
import { onIdTokenChanged } from 'firebase/auth';
import { firebaseAuth } from '../firebase';
import { useAuthStore } from '../store/useAuthStore';

let cachedToken: string | null = null;
let installed = false;

function isApiUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return u.pathname.startsWith('/api/') && (u.origin === window.location.origin || url.startsWith('/'));
  } catch {
    return false;
  }
}

export async function getIdToken(): Promise<string | null> {
  try {
    const u = firebaseAuth?.currentUser;
    if (!u) return null;
    return await u.getIdToken();
  } catch {
    return null;
  }
}

function legacyUserId(): string | null {
  try {
    const raw = localStorage.getItem('moduleforge_user');
    return raw ? (JSON.parse(raw)?.id ?? null) : null;
  } catch {
    return null;
  }
}

/** Central handling: a 403 {code:'EMAIL_NOT_VERIFIED'} switches the app to the Verify-your-email screen. */
function reportIfEmailUnverified(status: number, body: any) {
  if (status === 403 && body && body.code === 'EMAIL_NOT_VERIFIED') {
    useAuthStore.getState().markEmailUnverified();
  }
}

export function installApiAuth() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  if (firebaseAuth) {
    onIdTokenChanged(firebaseAuth, async (u) => {
      cachedToken = u ? await u.getIdToken().catch(() => null) : null;
    });
  }

  // axios
  axios.interceptors.request.use(async (config) => {
    const url = (config.baseURL || '') + (config.url || '');
    if (isApiUrl(url)) {
      const token = await getIdToken();
      if (token) config.headers.set('Authorization', `Bearer ${token}`);
      const uid = legacyUserId();
      if (uid && !config.headers.has('x-user-id')) config.headers.set('x-user-id', uid);
    }
    return config;
  });
  axios.interceptors.response.use(
    (res) => res,
    (err) => {
      reportIfEmailUnverified(err?.response?.status, err?.response?.data);
      return Promise.reject(err);
    }
  );

  // fetch
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!isApiUrl(url)) return origFetch(input, init);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    const token = await getIdToken();
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    const uid = legacyUserId();
    if (uid && !headers.has('x-user-id')) headers.set('x-user-id', uid);
    const res = await origFetch(input, { ...init, headers });
    if (res.status === 403) {
      res.clone().json().then((b) => reportIfEmailUnverified(res.status, b)).catch(() => {});
    }
    return res;
  };

  // EventSource (SSE) cannot set headers; server accepts access_token for /stream and /events only.
  const NativeEventSource = window.EventSource;
  if (NativeEventSource) {
    const Patched = function (this: any, url: string | URL, init?: EventSourceInit) {
      let target = typeof url === 'string' ? url : url.toString();
      if (isApiUrl(target) && cachedToken) {
        target += (target.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(cachedToken);
      }
      return new NativeEventSource(target, init);
    } as any;
    Patched.prototype = NativeEventSource.prototype;
    Patched.CONNECTING = NativeEventSource.CONNECTING;
    Patched.OPEN = NativeEventSource.OPEN;
    Patched.CLOSED = NativeEventSource.CLOSED;
    window.EventSource = Patched;
  }
}
