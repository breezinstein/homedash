// Shared HTTP helper.
//
// Two responsibilities:
//   1. Stamp every state-changing request with the X-Requested-With header so
//      the server's csrfGuard accepts it. SameSite=Lax on the session cookie
//      blocks most cross-origin form posts, but this header makes the
//      CSRF protection explicit and resilient.
//   2. Convert 401 responses into a typed AuthRequiredError so UI layers can
//      pop the login modal uniformly.
//
// Cookies are sent automatically for same-origin requests, but we set
// credentials: 'include' explicitly so behind-a-proxy setups still work.

export class AuthRequiredError extends Error {
  status = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export class HttpError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

const STATE_CHANGING = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

export function apiHeaders(init?: RequestInit): HeadersInit {
  const headers = new Headers(init?.headers || {});
  const method = (init?.method || 'GET').toUpperCase();
  if (STATE_CHANGING.has(method) && !headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'HomeDash');
  }
  return headers;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = apiHeaders(init);
  const res = await fetch(input, { ...init, headers, credentials: 'include' });
  if (res.status === 401) {
    // Notify any subscribers (e.g. AuthContext) so the UI can react.
    notifyAuthRequired();
    throw new AuthRequiredError();
  }
  return res;
}

export async function apiFetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await apiFetch(input, init);
  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { /* ignore */ }
    const message =
      (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string')
        ? (body as { error: string }).error
        : `Request failed (${res.status})`;
    throw new HttpError(res.status, message, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// 401 broadcast
// ---------------------------------------------------------------------------

type AuthRequiredListener = () => void;
const authRequiredListeners = new Set<AuthRequiredListener>();

export function onAuthRequired(listener: AuthRequiredListener): () => void {
  authRequiredListeners.add(listener);
  return () => authRequiredListeners.delete(listener);
}

function notifyAuthRequired() {
  for (const fn of authRequiredListeners) {
    try { fn(); } catch { /* ignore */ }
  }
}
