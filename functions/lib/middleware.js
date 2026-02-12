/* ═══════════════════════════════════════════════════════
 * Middleware — JWT verification, rate limiting, CORS
 * ═══════════════════════════════════════════════════════ */

import { verifyJWT, sha256 } from './crypto.js';

/* ── CORS headers ── */
export function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export function corsResponse(origin) {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

/* ── JSON response helper ── */
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

/* ── Extract JWT from Authorization header ── */
function extractBearerToken(request) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

/* ── Extract refresh token from httpOnly cookie ── */
export function extractRefreshToken(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/refresh_token=([^;]+)/);
  return match ? match[1] : null;
}

/* ── Verify JWT and attach user to context ── */
export async function requireAuth(request, env) {
  const token = extractBearerToken(request);
  if (!token) {
    return { error: json({ error: 'Missing authentication token' }, 401) };
  }
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return { error: json({ error: 'Invalid or expired token' }, 401) };
  }
  return { user: payload };
}

/* ── Verify share link token ── */
export async function validateShareToken(token, env) {
  const tokenHash = await sha256(token);
  const link = await env.DB.prepare(
    'SELECT * FROM share_links WHERE token_hash = ? AND revoked = 0'
  ).bind(tokenHash).first();

  if (!link) return null;

  // Check expiry
  if (new Date(link.expires_at) < new Date()) return null;

  // Check max uses
  if (link.max_uses !== null && link.use_count >= link.max_uses) return null;

  // Update usage
  await env.DB.prepare(
    'UPDATE share_links SET use_count = use_count + 1, last_used_at = datetime("now") WHERE id = ?'
  ).bind(link.id).run();

  return {
    id: link.id,
    role: link.role,
    allowedTabs: JSON.parse(link.allowed_tabs || '[]'),
    allowedModules: JSON.parse(link.allowed_modules || '[]'),
    dataScope: JSON.parse(link.data_scope || '{}'),
    readOnly: !!link.read_only,
    deviceBound: !!link.device_bound,
    deviceFingerprint: link.device_fingerprint,
  };
}

/* ── Rate Limiting (KV-based sliding window) ── */
export async function checkRateLimit(ip, endpoint, env) {
  const maxAttempts = parseInt(env.RATE_LIMIT_MAX || '10');
  const windowSeconds = parseInt(env.RATE_LIMIT_WINDOW_SECONDS || '300');
  const key = `rate:${ip}:${endpoint}`;

  const existing = await env.AUTH_KV.get(key, 'json');
  const now = Date.now();

  if (!existing) {
    await env.AUTH_KV.put(key, JSON.stringify({ count: 1, start: now }), {
      expirationTtl: windowSeconds,
    });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (now - existing.start > windowSeconds * 1000) {
    // Window expired — reset
    await env.AUTH_KV.put(key, JSON.stringify({ count: 1, start: now }), {
      expirationTtl: windowSeconds,
    });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (existing.count >= maxAttempts) {
    return { allowed: false, remaining: 0, retryAfter: windowSeconds - Math.floor((now - existing.start) / 1000) };
  }

  existing.count++;
  await env.AUTH_KV.put(key, JSON.stringify(existing), {
    expirationTtl: windowSeconds,
  });
  return { allowed: true, remaining: maxAttempts - existing.count };
}

/* ── IP & Geo extraction (Cloudflare headers) ── */
export function getRequestMeta(request) {
  return {
    ip: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '127.0.0.1',
    country: request.headers.get('CF-IPCountry') || 'XX',
    city: request.headers.get('CF-IPCity') || '',
    userAgent: request.headers.get('User-Agent') || '',
  };
}

/* ── Audit logging ── */
export async function auditLog(env, eventType, actorId, ip, country, details) {
  try {
    await env.DB.prepare(
      'INSERT INTO audit_log (event_type, actor_id, ip_address, geo_country, details) VALUES (?, ?, ?, ?, ?)'
    ).bind(eventType, actorId, ip, country, JSON.stringify(details)).run();
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}

/* ── Set refresh token cookie ── */
export function setRefreshCookie(token, maxAgeDays = 7) {
  const maxAge = maxAgeDays * 86400;
  return `refresh_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${maxAge}`;
}

export function clearRefreshCookie() {
  return 'refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0';
}
