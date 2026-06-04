// Single-admin authentication for HomeDash.
//
// Auth is **opt-in**: when no admin password is configured the server runs in
// "open mode" (identical behaviour to pre-auth releases). When configured, an
// HttpOnly signed cookie marks an authenticated browser session; sessions live
// only in memory (they invalidate on process restart, which is fine for a
// homelab tool).
//
// No new dependencies — only Node built-ins (crypto, timing-safe compare,
// scrypt for the optional hashed-password env var).

import crypto from 'crypto';

const COOKIE_NAME = 'homedash_session';
const HASH_PREFIX = 'scrypt:'; // format: scrypt:<saltHex>:<derivedKeyHex>
const HEADER_USERNAME = 'x-glances-username'; // unused here, exported list below for reference

// ---------------------------------------------------------------------------
// Config (resolved once at import time from environment variables)
// ---------------------------------------------------------------------------

function resolveConfig() {
  const plainPassword = process.env.HOMEDASH_ADMIN_PASSWORD || '';
  const passwordHash = process.env.HOMEDASH_ADMIN_PASSWORD_HASH || '';
  const explicitDisable = /^(1|true|yes|on)$/i.test(process.env.HOMEDASH_AUTH_DISABLED || '');
  const isProd = process.env.NODE_ENV === 'production';

  // HOMEDASH_AUTH_DISABLED is only honoured outside of production (dev escape
  // hatch). In production, a deployer who wants auth off should simply unset
  // the password env vars.
  const disabledByFlag = explicitDisable && !isProd;

  const hasCredential = Boolean(plainPassword || passwordHash);
  const enabled = hasCredential && !disabledByFlag;

  let sessionSecret = process.env.HOMEDASH_SESSION_SECRET;
  if (!sessionSecret) {
    // Generate a per-process secret. Sessions will not survive restarts; this
    // is acceptable for the homelab use case and avoids leaving a secret on
    // disk when none was provided.
    sessionSecret = crypto.randomBytes(32).toString('hex');
  }

  const ttlHours = Number.parseInt(process.env.HOMEDASH_SESSION_TTL_HOURS || '720', 10);
  const sessionTtlMs = (Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 720) * 60 * 60 * 1000;

  return {
    enabled,
    plainPassword,
    passwordHash,
    sessionSecret,
    sessionTtlMs,
    disabledByFlag,
    explicitDisable,
    isProd,
  };
}

const config = resolveConfig();

// ---------------------------------------------------------------------------
// In-memory session store
// ---------------------------------------------------------------------------

// sessionId -> { createdAt, lastSeenAt }
const sessions = new Map();

function createSession() {
  const id = crypto.randomBytes(24).toString('base64url');
  const now = Date.now();
  sessions.set(id, { createdAt: now, lastSeenAt: now });
  return id;
}

function touchSession(id) {
  const s = sessions.get(id);
  if (!s) return false;
  if (Date.now() - s.createdAt > config.sessionTtlMs) {
    sessions.delete(id);
    return false;
  }
  s.lastSeenAt = Date.now();
  return true;
}

function destroySession(id) {
  sessions.delete(id);
}

// Periodic GC so expired sessions don't accumulate. Unref'd so it doesn't
// keep the process alive on its own.
const gcTimer = setInterval(() => {
  const cutoff = Date.now() - config.sessionTtlMs;
  for (const [id, s] of sessions) {
    if (s.createdAt < cutoff) sessions.delete(id);
  }
}, 60 * 60 * 1000);
if (typeof gcTimer.unref === 'function') gcTimer.unref();

// ---------------------------------------------------------------------------
// Cookie signing (HMAC-SHA256)
// ---------------------------------------------------------------------------

function signSessionId(id) {
  const mac = crypto.createHmac('sha256', config.sessionSecret).update(id).digest('base64url');
  return `${id}.${mac}`;
}

function verifyCookieValue(raw) {
  if (typeof raw !== 'string') return null;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const providedMac = raw.slice(dot + 1);
  const expectedMac = crypto.createHmac('sha256', config.sessionSecret).update(id).digest('base64url');
  // Length check + timing-safe compare.
  const a = Buffer.from(providedMac);
  const b = Buffer.from(expectedMac);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return id;
}

// ---------------------------------------------------------------------------
// Cookie parsing / writing
// ---------------------------------------------------------------------------

function parseCookies(header) {
  const out = {};
  if (!header || typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(value);
  }
  return out;
}

function isSecureRequest(req) {
  if (req.secure) return true;
  const xfp = req.headers['x-forwarded-proto'];
  if (typeof xfp === 'string' && xfp.split(',')[0].trim().toLowerCase() === 'https') return true;
  return false;
}

function setSessionCookie(res, req, signedValue) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(signedValue)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${Math.floor(config.sessionTtlMs / 1000)}`,
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res, req) {
  const parts = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

// ---------------------------------------------------------------------------
// Password verification
// ---------------------------------------------------------------------------

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  // Pad the shorter to the longer length and still call timingSafeEqual so
  // the comparison time doesn't leak which input was shorter.
  const len = Math.max(bufA.length, bufB.length, 1);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  bufA.copy(padA);
  bufB.copy(padB);
  const equal = crypto.timingSafeEqual(padA, padB);
  return equal && bufA.length === bufB.length;
}

function verifyScryptHash(password, hash) {
  // Format: scrypt:<saltHex>:<derivedKeyHex>
  const parts = hash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  let salt, expected;
  try {
    salt = Buffer.from(parts[1], 'hex');
    expected = Buffer.from(parts[2], 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  let derived;
  try {
    derived = crypto.scryptSync(password, salt, expected.length);
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function verifyPassword(password) {
  if (typeof password !== 'string' || password.length === 0) return false;
  if (config.passwordHash) {
    return verifyScryptHash(password, config.passwordHash);
  }
  if (config.plainPassword) {
    return timingSafeStringEqual(password, config.plainPassword);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Login throttle (in-process; 5 failures per IP per 15 min => 429)
// ---------------------------------------------------------------------------

const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const THROTTLE_LIMIT = 5;
// ip -> { count, windowStart }
const failureBuckets = new Map();

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) {
    return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function getThrottleState(ip) {
  const bucket = failureBuckets.get(ip);
  if (!bucket) return { count: 0, retryAfterMs: 0 };
  const elapsed = Date.now() - bucket.windowStart;
  if (elapsed > THROTTLE_WINDOW_MS) {
    failureBuckets.delete(ip);
    return { count: 0, retryAfterMs: 0 };
  }
  return { count: bucket.count, retryAfterMs: Math.max(0, THROTTLE_WINDOW_MS - elapsed) };
}

function recordFailure(ip) {
  const bucket = failureBuckets.get(ip);
  if (!bucket || Date.now() - bucket.windowStart > THROTTLE_WINDOW_MS) {
    failureBuckets.set(ip, { count: 1, windowStart: Date.now() });
    return;
  }
  bucket.count += 1;
}

function clearFailures(ip) {
  failureBuckets.delete(ip);
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export const authEnabled = () => config.enabled;

export function startupLogLine() {
  if (!config.enabled) {
    if (config.disabledByFlag) {
      return '🔓 Auth disabled (HOMEDASH_AUTH_DISABLED set; non-production only)';
    }
    return '🔓 Auth disabled — no HOMEDASH_ADMIN_PASSWORD set, running in open mode';
  }
  const method = config.passwordHash ? 'scrypt hash' : 'plaintext env var';
  const ttlH = Math.round(config.sessionTtlMs / 3600000);
  return `🔐 Auth enabled (${method}, session TTL ${ttlH}h)`;
}

// Inspect the incoming request and decide whether it carries a valid session.
// Returns true (authenticated) when auth is disabled — that's the open-mode
// contract.
function isAuthenticated(req) {
  if (!config.enabled) return true;
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return false;
  const id = verifyCookieValue(raw);
  if (!id) return false;
  return touchSession(id);
}

export function optionalAuth(req, _res, next) {
  req.authenticated = isAuthenticated(req);
  next();
}

export function requireAuth(req, res, next) {
  if (isAuthenticated(req)) {
    req.authenticated = true;
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

// Reject state-changing requests on /api/* that don't carry the custom
// X-Requested-With header. Combined with SameSite=Lax this prevents
// drive-by CSRF from third-party origins. Excludes the login endpoint
// itself so a fresh browser can authenticate.
export function csrfGuard(req, res, next) {
  if (!config.enabled) return next();
  const method = req.method;
  if (method !== 'POST' && method !== 'PUT' && method !== 'DELETE' && method !== 'PATCH') {
    return next();
  }
  if (!req.path.startsWith('/api/')) return next();
  if (req.path === '/api/auth/login' || req.path === '/api/auth/logout') return next();
  const xrw = req.headers['x-requested-with'];
  if (typeof xrw === 'string' && xrw.trim() === 'HomeDash') return next();
  res.status(403).json({ error: 'CSRF check failed (missing X-Requested-With)' });
}

// Register /api/auth/{status,login,logout} on the given Express app.
export function registerAuthRoutes(app) {
  app.get('/api/auth/status', (req, res) => {
    res.json({
      authEnabled: config.enabled,
      authenticated: isAuthenticated(req),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    if (!config.enabled) {
      // Open mode: there is nothing to log in to. Reply success-ish so the
      // frontend can treat the response uniformly.
      return res.status(204).end();
    }

    const ip = clientIp(req);
    const state = getThrottleState(ip);
    if (state.count >= THROTTLE_LIMIT) {
      const retryAfter = Math.ceil(state.retryAfterMs / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
    }

    const password = req.body?.password;
    if (!verifyPassword(password)) {
      recordFailure(ip);
      return res.status(401).json({ error: 'Invalid password' });
    }

    clearFailures(ip);
    const id = createSession();
    setSessionCookie(res, req, signSessionId(id));
    res.status(204).end();
  });

  app.post('/api/auth/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const raw = cookies[COOKIE_NAME];
    if (raw) {
      const id = verifyCookieValue(raw);
      if (id) destroySession(id);
    }
    clearSessionCookie(res, req);
    res.status(204).end();
  });
}

// Test-only helpers (not exported in default surface) ------------------------
export const __testing = {
  resetSessions: () => sessions.clear(),
  resetThrottle: () => failureBuckets.clear(),
  signSessionId,
  parseCookies,
  COOKIE_NAME,
};
