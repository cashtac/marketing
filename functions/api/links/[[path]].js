/* ═══════════════════════════════════════════════════════
 * Links API — Cloudflare Pages Function
 * Route: /api/links/*
 *
 * Endpoints:
 *   POST   /api/links/create     — Admin creates share link
 *   GET    /api/links/list       — List all links
 *   POST   /api/links/revoke/:id — Revoke a link
 *   GET    /api/links/validate   — Validate share token (public)
 * ═══════════════════════════════════════════════════════ */

import { generateSecureToken, sha256 } from '../lib/crypto.js';
import {
  json, corsHeaders, corsResponse, requireAuth,
  getRequestMeta, auditLog, validateShareToken,
} from '../lib/middleware.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/links', '').replace(/\/$/, '') || '/';
  const method = request.method;
  const origin = request.headers.get('Origin');

  if (method === 'OPTIONS') return corsResponse(origin);

  try {
    if (method === 'POST' && path === '/create')   return await handleCreate(request, env);
    if (method === 'GET'  && path === '/list')      return await handleList(request, env);
    if (method === 'POST' && path.startsWith('/revoke/')) return await handleRevoke(request, env, path);
    if (method === 'GET'  && path === '/validate')  return await handleValidate(request, env, url);

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    console.error('Links error:', e);
    return json({ error: 'Internal server error' }, 500);
  }
}

/* ── POST /api/links/create ──
 * Admin-only. Creates a delegated share link.
 * Body: {
 *   label, role, allowedTabs, allowedModules, dataScope,
 *   readOnly, deviceBound, maxUses, expiresInDays
 * }
 * Response: { link: "https://...", id, token }
 */
async function handleCreate(request, env) {
  // Admin auth required
  const { user, error } = await requireAuth(request, env);
  if (error) return error;
  if (user.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const body = await request.json().catch(() => null);
  if (!body || !body.role) {
    return json({ error: 'Role is required' }, 400);
  }

  // Generate 256-bit token
  const rawToken = generateSecureToken(32);
  const tokenHash = await sha256(rawToken);

  // Compute expiry
  const expiresInDays = body.expiresInDays || 7;
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

  // Valid roles
  const validRoles = [
    'Operations', 'Controller', 'Marketing Director', 'Marketing Manager',
    'Graphic Designer', 'Social Media Intern', 'Photographer',
    'Sustainability', 'Dietitian', 'Viewer',
  ];
  if (!validRoles.includes(body.role)) {
    return json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, 400);
  }

  await env.DB.prepare(
    `INSERT INTO share_links
      (token_hash, label, role, allowed_tabs, allowed_modules, data_scope,
       read_only, device_bound, max_uses, expires_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    tokenHash,
    body.label || `${body.role} link`,
    body.role,
    JSON.stringify(body.allowedTabs || ['dashboard', 'tasks', 'locations', 'more']),
    JSON.stringify(body.allowedModules || []),
    JSON.stringify(body.dataScope || {}),
    body.readOnly !== false ? 1 : 0,
    body.deviceBound ? 1 : 0,
    body.maxUses || null,
    expiresAt,
    user.sub,
  ).run();

  // Get created link ID
  const created = await env.DB.prepare(
    'SELECT id FROM share_links WHERE token_hash = ?'
  ).bind(tokenHash).first();

  const meta = getRequestMeta(request);
  const origin = new URL(request.url).origin;
  const shareUrl = `${origin}/s/${rawToken}`;

  await auditLog(env, 'link_created', user.sub, meta.ip, meta.country, {
    linkId: created.id,
    role: body.role,
    expiresAt,
    deviceBound: !!body.deviceBound,
  });

  return json({
    id: created.id,
    link: shareUrl,
    token: rawToken,
    role: body.role,
    expiresAt,
    deviceBound: !!body.deviceBound,
    readOnly: body.readOnly !== false,
  }, 201, corsHeaders(request.headers.get('Origin')));
}

/* ── GET /api/links/list ──
 * Admin-only. Lists all share links with status.
 */
async function handleList(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;
  if (user.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const results = await env.DB.prepare(
    `SELECT id, label, role, allowed_tabs, allowed_modules, data_scope,
            read_only, device_bound, device_fingerprint, max_uses, use_count,
            expires_at, revoked, created_at, last_used_at
     FROM share_links ORDER BY created_at DESC`
  ).all();

  const now = new Date();
  const links = (results.results || []).map(link => ({
    ...link,
    allowedTabs: JSON.parse(link.allowed_tabs || '[]'),
    allowedModules: JSON.parse(link.allowed_modules || '[]'),
    dataScope: JSON.parse(link.data_scope || '{}'),
    readOnly: !!link.read_only,
    deviceBound: !!link.device_bound,
    revoked: !!link.revoked,
    expired: new Date(link.expires_at) < now,
    status: link.revoked ? 'revoked' : new Date(link.expires_at) < now ? 'expired' : 'active',
  }));

  return json({ links }, 200, corsHeaders(request.headers.get('Origin')));
}

/* ── POST /api/links/revoke/:id ──
 * Admin-only. Instantly revokes a share link.
 */
async function handleRevoke(request, env, path) {
  const { user, error } = await requireAuth(request, env);
  if (error) return error;
  if (user.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const linkId = path.replace('/revoke/', '');

  const result = await env.DB.prepare(
    'UPDATE share_links SET revoked = 1 WHERE id = ?'
  ).bind(linkId).run();

  if (result.meta.changes === 0) {
    return json({ error: 'Link not found' }, 404);
  }

  const meta = getRequestMeta(request);
  await auditLog(env, 'link_revoked', user.sub, meta.ip, meta.country, { linkId });

  return json({ success: true, message: 'Link revoked' }, 200, corsHeaders(request.headers.get('Origin')));
}

/* ── GET /api/links/validate?token=xxx ──
 * Public. Validates a share link token.
 * If device-bound, binds on first use.
 * Response: { valid, role, permissions, ... }
 */
async function handleValidate(request, env, url) {
  const token = url.searchParams.get('token');
  if (!token) {
    return json({ error: 'Token required' }, 400);
  }

  const tokenHash = await sha256(token);
  const link = await env.DB.prepare(
    'SELECT * FROM share_links WHERE token_hash = ? AND revoked = 0'
  ).bind(tokenHash).first();

  if (!link) {
    return json({ valid: false, error: 'Invalid or revoked link' }, 403);
  }

  // Check expiry
  if (new Date(link.expires_at) < new Date()) {
    return json({ valid: false, error: 'Link expired' }, 403);
  }

  // Check max uses
  if (link.max_uses !== null && link.use_count >= link.max_uses) {
    return json({ valid: false, error: 'Link usage limit reached' }, 403);
  }

  // Device binding
  const meta = getRequestMeta(request);
  const deviceFp = url.searchParams.get('device') || null;

  if (link.device_bound) {
    if (!link.device_fingerprint && deviceFp) {
      // First use → bind device
      await env.DB.prepare(
        'UPDATE share_links SET device_fingerprint = ? WHERE id = ?'
      ).bind(deviceFp, link.id).run();
    } else if (link.device_fingerprint && link.device_fingerprint !== deviceFp) {
      // Wrong device
      await auditLog(env, 'device_mismatch', null, meta.ip, meta.country, {
        linkId: link.id,
        expected: link.device_fingerprint,
        received: deviceFp,
      });
      return json({
        valid: false,
        error: 'This link is bound to another device',
        deviceMismatch: true,
      }, 403);
    }
  }

  // Update usage
  await env.DB.prepare(
    'UPDATE share_links SET use_count = use_count + 1, last_used_at = datetime("now") WHERE id = ?'
  ).bind(link.id).run();

  await auditLog(env, 'link_used', null, meta.ip, meta.country, {
    linkId: link.id,
    role: link.role,
    deviceFp,
  });

  return json({
    valid: true,
    role: link.role,
    allowedTabs: JSON.parse(link.allowed_tabs || '[]'),
    allowedModules: JSON.parse(link.allowed_modules || '[]'),
    dataScope: JSON.parse(link.data_scope || '{}'),
    readOnly: !!link.read_only,
    label: link.label,
    expiresAt: link.expires_at,
  }, 200, corsHeaders(request.headers.get('Origin')));
}
