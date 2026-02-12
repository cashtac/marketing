/* ═══════════════════════════════════════════════════════
 * Auth API — Cloudflare Pages Function
 * Route: /api/auth/*
 *
 * Endpoints:
 *   POST /api/auth/login       — email + password → 2FA challenge
 *   POST /api/auth/verify-2fa  — TOTP code → JWT + refresh cookie
 *   POST /api/auth/refresh     — refresh cookie → new JWT
 *   POST /api/auth/logout      — clear session
 *   GET  /api/auth/me          — current user info
 * ═══════════════════════════════════════════════════════ */

import {
  verifyPassword, signJWT, verifyJWT, verifyTOTP,
  generateSecureToken, sha256, generateTOTPSecret, getTOTPUri,
} from '../lib/crypto.js';

import {
  json, corsHeaders, corsResponse, checkRateLimit,
  getRequestMeta, auditLog, setRefreshCookie, clearRefreshCookie,
  requireAuth, extractRefreshToken,
} from '../lib/middleware.js';

/* ── Cloudflare Pages Function handler ── */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/auth', '').replace(/\/$/, '') || '/';
  const method = request.method;
  const origin = request.headers.get('Origin');

  // CORS preflight
  if (method === 'OPTIONS') return corsResponse(origin);

  // Route
  try {
    if (method === 'POST' && path === '/login')      return await handleLogin(request, env);
    if (method === 'POST' && path === '/verify-2fa')  return await handleVerify2FA(request, env);
    if (method === 'POST' && path === '/refresh')     return await handleRefresh(request, env);
    if (method === 'POST' && path === '/logout')      return await handleLogout(request, env);
    if (method === 'GET'  && path === '/me')           return await handleMe(request, env);
    if (method === 'POST' && path === '/setup')        return await handleSetup(request, env);

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    console.error('Auth error:', e);
    return json({ error: 'Internal server error' }, 500);
  }
}

/* ── POST /api/auth/login ──
 * Body: { email, password }
 * Response: { challenge: true, message: "Enter 2FA code" }
 */
async function handleLogin(request, env) {
  const meta = getRequestMeta(request);

  // Rate limit
  const rl = await checkRateLimit(meta.ip, 'login', env);
  if (!rl.allowed) {
    await auditLog(env, 'rate_limited', null, meta.ip, meta.country, { endpoint: 'login' });
    return json({ error: 'Too many attempts. Try again later.', retryAfter: rl.retryAfter }, 429);
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.email || !body.password) {
    return json({ error: 'Email and password required' }, 400);
  }

  // Find admin user
  const user = await env.DB.prepare(
    'SELECT * FROM admin_users WHERE email = ?'
  ).bind(body.email.toLowerCase().trim()).first();

  if (!user) {
    await auditLog(env, 'auth_failed', null, meta.ip, meta.country, { reason: 'user_not_found', email: body.email });
    return json({ error: 'Invalid credentials' }, 401);
  }

  // Verify password
  const passwordValid = await verifyPassword(body.password, user.password_hash);
  if (!passwordValid) {
    await auditLog(env, 'auth_failed', user.user_id, meta.ip, meta.country, { reason: 'wrong_password' });
    return json({ error: 'Invalid credentials' }, 401);
  }

  // Store pending 2FA challenge in KV (5 min TTL)
  const challengeId = generateSecureToken(16);
  await env.AUTH_KV.put(`2fa:${challengeId}`, JSON.stringify({
    userId: user.user_id,
    email: user.email,
    name: user.name,
    ip: meta.ip,
    country: meta.country,
    userAgent: meta.userAgent,
  }), { expirationTtl: 300 });

  await auditLog(env, '2fa_challenge', user.user_id, meta.ip, meta.country, { challengeId });

  return json({
    challenge: true,
    challengeId,
    message: 'Enter your 2FA code from authenticator app',
  }, 200, corsHeaders(request.headers.get('Origin')));
}

/* ── POST /api/auth/verify-2fa ──
 * Body: { challengeId, code }
 * Response: { token: "jwt...", user: {...} } + Set-Cookie: refresh_token
 */
async function handleVerify2FA(request, env) {
  const meta = getRequestMeta(request);

  const rl = await checkRateLimit(meta.ip, '2fa', env);
  if (!rl.allowed) {
    return json({ error: 'Too many attempts. Try again later.', retryAfter: rl.retryAfter }, 429);
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.challengeId || !body.code) {
    return json({ error: 'Challenge ID and code required' }, 400);
  }

  // Retrieve challenge
  const challenge = await env.AUTH_KV.get(`2fa:${body.challengeId}`, 'json');
  if (!challenge) {
    return json({ error: '2FA challenge expired or invalid' }, 401);
  }

  // Get user's TOTP secret
  const user = await env.DB.prepare(
    'SELECT * FROM admin_users WHERE user_id = ?'
  ).bind(challenge.userId).first();

  if (!user) {
    return json({ error: 'User not found' }, 401);
  }

  // Verify TOTP
  const codeValid = await verifyTOTP(user.totp_secret, body.code.replace(/\s/g, ''));
  if (!codeValid) {
    await auditLog(env, 'auth_failed', user.user_id, meta.ip, meta.country, { reason: '2fa_invalid' });
    return json({ error: 'Invalid 2FA code' }, 401);
  }

  // Consume challenge
  await env.AUTH_KV.delete(`2fa:${body.challengeId}`);

  // Check for IP anomaly
  const lastSession = await env.DB.prepare(
    'SELECT geo_country FROM sessions WHERE user_id = ? AND revoked = 0 ORDER BY created_at DESC LIMIT 1'
  ).bind(user.user_id).first();

  const ipAnomaly = lastSession && lastSession.geo_country !== meta.country;

  // Issue JWT (short-lived)
  const expiryMinutes = parseInt(env.JWT_EXPIRY_MINUTES || '15');
  const jwtPayload = {
    sub: user.user_id,
    email: user.email,
    name: user.name,
    role: 'admin',
    type: 'admin_session',
  };
  const jwt = await signJWT(jwtPayload, env.JWT_SECRET, expiryMinutes);

  // Issue refresh token (long-lived, stored httpOnly)
  const refreshToken = generateSecureToken(32);
  const refreshHash = await sha256(refreshToken);
  const refreshDays = parseInt(env.REFRESH_EXPIRY_DAYS || '7');
  const refreshExpiry = new Date(Date.now() + refreshDays * 86400000).toISOString();

  await env.DB.prepare(
    `INSERT INTO sessions (user_id, refresh_token_hash, device_fingerprint, ip_address, geo_country, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    user.user_id, refreshHash, body.deviceFingerprint || null,
    meta.ip, meta.country, meta.userAgent, refreshExpiry
  ).run();

  await auditLog(env, 'admin_login', user.user_id, meta.ip, meta.country, {
    ipAnomaly,
    deviceFingerprint: body.deviceFingerprint || 'none',
  });

  const headers = {
    ...corsHeaders(request.headers.get('Origin')),
    'Set-Cookie': setRefreshCookie(refreshToken, refreshDays),
  };

  return json({
    token: jwt,
    expiresIn: expiryMinutes * 60,
    user: { id: user.user_id, email: user.email, name: user.name, role: 'admin' },
    ipAnomaly,
  }, 200, headers);
}

/* ── POST /api/auth/refresh ──
 * Uses refresh_token from httpOnly cookie
 * Response: { token: "new_jwt..." }
 */
async function handleRefresh(request, env) {
  const refreshToken = extractRefreshToken(request);
  if (!refreshToken) {
    return json({ error: 'No refresh token' }, 401);
  }

  const refreshHash = await sha256(refreshToken);
  const session = await env.DB.prepare(
    'SELECT * FROM sessions WHERE refresh_token_hash = ? AND revoked = 0'
  ).bind(refreshHash).first();

  if (!session) {
    return json({ error: 'Invalid refresh token' }, 401);
  }

  if (new Date(session.expires_at) < new Date()) {
    return json({ error: 'Refresh token expired' }, 401);
  }

  // Get user
  const user = await env.DB.prepare(
    'SELECT * FROM admin_users WHERE user_id = ?'
  ).bind(session.user_id).first();

  if (!user) {
    return json({ error: 'User not found' }, 401);
  }

  // Issue new JWT
  const expiryMinutes = parseInt(env.JWT_EXPIRY_MINUTES || '15');
  const jwt = await signJWT({
    sub: user.user_id,
    email: user.email,
    name: user.name,
    role: 'admin',
    type: 'admin_session',
  }, env.JWT_SECRET, expiryMinutes);

  return json({
    token: jwt,
    expiresIn: expiryMinutes * 60,
  }, 200, corsHeaders(request.headers.get('Origin')));
}

/* ── POST /api/auth/logout ──
 * Revokes refresh token session
 */
async function handleLogout(request, env) {
  const refreshToken = extractRefreshToken(request);
  if (refreshToken) {
    const refreshHash = await sha256(refreshToken);
    await env.DB.prepare(
      'UPDATE sessions SET revoked = 1 WHERE refresh_token_hash = ?'
    ).bind(refreshHash).run();
  }

  const meta = getRequestMeta(request);
  await auditLog(env, 'admin_logout', null, meta.ip, meta.country, {});

  return json({ success: true }, 200, {
    ...corsHeaders(request.headers.get('Origin')),
    'Set-Cookie': clearRefreshCookie(),
  });
}

/* ── GET /api/auth/me ──
 * Returns current user from JWT
 */
async function handleMe(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;

  return json({
    user: { id: user.sub, email: user.email, name: user.name, role: user.role },
  }, 200, corsHeaders(request.headers.get('Origin')));
}

/* ── POST /api/auth/setup ──
 * One-time admin account setup
 * Body: { email, password, setupKey }
 * Response: { totpSecret, totpUri, message }
 *
 * The setupKey must match env.SETUP_KEY (set once, then removed)
 */
async function handleSetup(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.email || !body.password || !body.setupKey) {
    return json({ error: 'Email, password, and setup key required' }, 400);
  }

  // Verify one-time setup key
  if (body.setupKey !== env.SETUP_KEY) {
    return json({ error: 'Invalid setup key' }, 403);
  }

  // Check if admin already exists
  const existing = await env.DB.prepare('SELECT COUNT(*) as count FROM admin_users').first();
  if (existing && existing.count > 0) {
    return json({ error: 'Admin account already exists' }, 409);
  }

  // Hash password
  const { hashPassword, generateTOTPSecret: genSecret, getTOTPUri: getUri } = await import('../lib/crypto.js');
  const passwordHash = await hashPassword(body.password);
  const totpSecret = genSecret();
  const userId = 'admin_' + generateSecureToken(8);

  await env.DB.prepare(
    'INSERT INTO admin_users (user_id, email, password_hash, totp_secret, name) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, body.email.toLowerCase().trim(), passwordHash, totpSecret, body.name || 'Admin').run();

  const meta = getRequestMeta(request);
  await auditLog(env, 'admin_setup', userId, meta.ip, meta.country, { email: body.email });

  return json({
    message: 'Admin account created. Scan QR code with authenticator app.',
    totpSecret,
    totpUri: getUri(totpSecret, body.email, env.TOTP_ISSUER || 'CashTac Marketing'),
  }, 201, corsHeaders(request.headers.get('Origin')));
}
