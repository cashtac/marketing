/* ─── AuthManager — Server-backed secure auth ───
 *
 * Two modes:
 *   1. ADMIN mode   — JWT (memory only) + httpOnly refresh cookie + 2FA
 *   2. SHARE mode   — Delegated link token validated server-side
 *
 * NO tokens in localStorage. JWT lives in JS memory only.
 * Refresh token lives in httpOnly cookie (set by server).
 * ─── */
const AuthManager = (() => {
  const SESSION_KEY = 'ims_auth_session'; // kept for backward compat during transition
  const USERS_KEY  = 'ims_auth_users';

  /* ═══ State — memory only (never persisted) ═══ */
  let _jwt = null;          // Short-lived access token (15 min)
  let _jwtExpiry = 0;       // Unix timestamp when JWT expires
  let _user = null;         // { id, email, name, role }
  let _refreshTimer = null; // Silent refresh interval
  let _shareContext = null;  // Delegated link context (if share mode)
  let _authMode = null;     // 'admin' | 'share' | 'legacy'

  /* ═══ API Base ═══ */
  const API = '/api';

  /* ═══ Debug Logger ═══ */
  const _log = (...args) => console.log('%c[AUTH]', 'color:#00b894;font-weight:bold', ...args);
  const _warn = (...args) => console.warn('%c[AUTH]', 'color:#fdcb6e;font-weight:bold', ...args);
  const _err = (...args) => console.error('%c[AUTH]', 'color:#d63031;font-weight:bold', ...args);

  /* ═══ Device Fingerprint (optional) ═══ */
  function _getDeviceFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fp', 2, 2);
    const d = canvas.toDataURL();
    const nav = [
      navigator.userAgent, navigator.language,
      screen.width, screen.height, screen.colorDepth,
      new Date().getTimezoneOffset(),
    ].join('|');
    // Simple hash
    let hash = 0;
    const combined = d + nav;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash) + combined.charCodeAt(i);
      hash |= 0;
    }
    return 'fp_' + Math.abs(hash).toString(36);
  }

  /* ═══ API helpers ═══ */
  async function _apiPost(endpoint, body = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (_jwt) headers['Authorization'] = `Bearer ${_jwt}`;
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST', headers,
      credentials: 'include', // send httpOnly cookies
      body: JSON.stringify(body),
    });
    return res;
  }

  async function _apiGet(endpoint) {
    const headers = {};
    if (_jwt) headers['Authorization'] = `Bearer ${_jwt}`;
    const res = await fetch(`${API}${endpoint}`, {
      method: 'GET', headers,
      credentials: 'include',
    });
    return res;
  }

  /* ═══ Admin Login Flow ═══ */

  /** Step 1: Email + password → 2FA challenge */
  async function login(email, password) {
    _log('Attempting login...');
    const res = await _apiPost('/auth/login', { email, password });
    const data = await res.json();
    if (!res.ok) {
      _err('Login failed:', data.error);
      return { success: false, error: data.error };
    }
    _log('2FA challenge issued');
    return { success: true, challengeId: data.challengeId, message: data.message };
  }

  /** Step 2: TOTP code → JWT + refresh cookie */
  async function verify2FA(challengeId, code) {
    _log('Verifying 2FA...');
    const res = await _apiPost('/auth/verify-2fa', {
      challengeId, code,
      deviceFingerprint: _getDeviceFingerprint(),
    });
    const data = await res.json();
    if (!res.ok) {
      _err('2FA failed:', data.error);
      return { success: false, error: data.error };
    }
    // Store JWT in memory only
    _jwt = data.token;
    _jwtExpiry = Date.now() + data.expiresIn * 1000;
    _user = data.user;
    _authMode = 'admin';
    _startSilentRefresh();
    _log(`Authenticated as ${_user.name} (admin)`);

    if (data.ipAnomaly) {
      _warn('IP anomaly detected — login from new location');
    }

    return { success: true, user: _user, ipAnomaly: data.ipAnomaly };
  }

  /** Silent refresh — runs every 14 minutes */
  function _startSilentRefresh() {
    if (_refreshTimer) clearInterval(_refreshTimer);
    _refreshTimer = setInterval(async () => {
      _log('Silent refresh...');
      try {
        const res = await _apiPost('/auth/refresh');
        const data = await res.json();
        if (res.ok) {
          _jwt = data.token;
          _jwtExpiry = Date.now() + data.expiresIn * 1000;
          _log('Token refreshed');
        } else {
          _warn('Refresh failed — logging out');
          logout();
        }
      } catch (e) {
        _err('Refresh error:', e);
      }
    }, 14 * 60 * 1000); // 14 minutes
  }

  /** Logout */
  async function logout() {
    _log('Logging out...');
    try {
      await _apiPost('/auth/logout');
    } catch (e) { /* ignore */ }
    _jwt = null;
    _jwtExpiry = 0;
    _user = null;
    _authMode = null;
    _shareContext = null;
    if (_refreshTimer) clearInterval(_refreshTimer);
    _refreshTimer = null;
    // Clear any legacy localStorage
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
  }

  /* ═══ Share Link Flow ═══ */

  /** Validate a share link token */
  async function validateShareLink(token) {
    _log('Validating share link...');
    const fp = _getDeviceFingerprint();
    const res = await _apiGet(`/links/validate?token=${encodeURIComponent(token)}&device=${fp}`);
    const data = await res.json();

    if (!res.ok || !data.valid) {
      _err('Share link invalid:', data.error);
      return { valid: false, error: data.error, deviceMismatch: data.deviceMismatch };
    }

    _shareContext = {
      role: data.role,
      allowedTabs: data.allowedTabs,
      allowedModules: data.allowedModules,
      dataScope: data.dataScope,
      readOnly: data.readOnly,
      label: data.label,
      expiresAt: data.expiresAt,
    };
    _authMode = 'share';
    _user = { name: data.label || 'Shared Access', role: data.role };
    _log(`Share link valid: ${data.role} access`);
    return { valid: true, context: _shareContext };
  }

  /* ═══ Legacy Mode (backward compat — localStorage tokens) ═══ */

  function _checkLegacyAuth() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('auth');

    if (token) {
      // Legacy token login
      const users = _getLegacyUsers();
      const user = users.find(u => u.access_token === token);
      if (user && new Date(user.token_expiry) > new Date()) {
        _authMode = 'legacy';
        _user = { id: user.user_id, name: user.name, role: user.role, email: user.email };
        localStorage.setItem(SESSION_KEY, JSON.stringify(_user));
        // Clean URL
        const url = new URL(window.location);
        url.searchParams.delete('auth');
        window.history.replaceState({}, '', url.pathname + url.hash);
        _log(`Legacy auth: ${user.name} (${user.role})`);
        return { authenticated: true, user: _user };
      }
    }

    // Check existing session
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (session) {
        _authMode = 'legacy';
        _user = session;
        return { authenticated: true, user: session };
      }
    } catch {}

    return { authenticated: false };
  }

  function _getLegacyUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch { return []; }
  }

  /* ═══ Main Auth Check (called on page load) ═══ */

  async function checkAuth() {
    // 1. Check for share link (/s/:token)
    const path = window.location.pathname;
    const shareMatch = path.match(/^\/s\/([a-f0-9]{64})$/);
    if (shareMatch) {
      const result = await validateShareLink(shareMatch[1]);
      if (result.valid) {
        return { authenticated: true, user: _user, mode: 'share' };
      }
      return { authenticated: false, reason: result.error, mode: 'share' };
    }

    // 2. Try silent refresh (httpOnly cookie)
    try {
      const res = await _apiPost('/auth/refresh');
      if (res.ok) {
        const data = await res.json();
        _jwt = data.token;
        _jwtExpiry = Date.now() + data.expiresIn * 1000;
        // Get user info
        const meRes = await _apiGet('/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          _user = meData.user;
          _authMode = 'admin';
          _startSilentRefresh();
          _log(`Session restored: ${_user.name} (admin)`);
          return { authenticated: true, user: _user, mode: 'admin' };
        }
      }
    } catch (e) {
      // API not available — fall through to legacy
      _log('API not available, falling back to legacy auth');
    }

    // 3. Fall back to legacy localStorage auth
    return _checkLegacyAuth();
  }

  /* ═══ Access Control ═══ */

  function isAdmin() {
    return _authMode === 'admin';
  }

  function isShareMode() {
    return _authMode === 'share';
  }

  function isLegacyMode() {
    return _authMode === 'legacy';
  }

  function getShareContext() {
    return _shareContext;
  }

  function getJWT() {
    return _jwt;
  }

  function getUser() {
    return _user;
  }

  function getAuthMode() {
    return _authMode;
  }

  /** Check if current session can access a specific page */
  function canAccessPage(page) {
    if (_authMode === 'admin' || _authMode === 'legacy') return true; // Admin sees all
    if (_authMode === 'share' && _shareContext) {
      return _shareContext.allowedTabs.includes(page) ||
             _shareContext.allowedModules.includes(page);
    }
    return false;
  }

  /** Check if current session is read-only */
  function isReadOnly() {
    return _authMode === 'share' && _shareContext && _shareContext.readOnly;
  }

  /* ═══ Admin Link Management (delegates to API) ═══ */

  async function createShareLink(options) {
    if (_authMode !== 'admin') return { error: 'Admin access required' };
    const res = await _apiPost('/links/create', options);
    return await res.json();
  }

  async function listShareLinks() {
    if (_authMode !== 'admin') return { error: 'Admin access required' };
    const res = await _apiGet('/links/list');
    return await res.json();
  }

  async function revokeShareLink(linkId) {
    if (_authMode !== 'admin') return { error: 'Admin access required' };
    const res = await _apiPost(`/links/revoke/${linkId}`);
    return await res.json();
  }

  /* ═══ Legacy seeds (kept for backward compat) ═══ */
  const SEED_VERSION = 2; // Bump to force re-seed on existing devices

  function seedUsers() {
    const storedVersion = parseInt(localStorage.getItem('ims_seed_version') || '0');
    if (_getLegacyUsers().length > 0 && storedVersion >= SEED_VERSION) return;
    if (storedVersion < SEED_VERSION) {
      _log(`Seed version changed (${storedVersion} → ${SEED_VERSION}), re-seeding...`);
      localStorage.removeItem(USERS_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
    _log('Seeding legacy user registry...');
    const _generateToken = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let token = '';
      for (let i = 0; i < 48; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
      return token;
    };
    const _expiryFromNow = (days = 30) => {
      const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString();
    };

    /* ── Fixed shareable tokens (universal across devices) ── */
    const ADMIN_TOKEN    = 'CashTacAdmin2026SecureAccessLinkDoNotSharePubl';
    const MKTDIR_TOKEN   = 'CashTacMktDir2026SecureAccessViewOnlyLinkDemo';

    const users = [
      { user_id: 'usr_daniil_osipov',  name: 'Daniil Osipov',   role: 'Admin',                email: 'dosipov@gmu.edu',       access_token: ADMIN_TOKEN,    token_expiry: '2026-02-13T15:22:00.000Z' },
      { user_id: 'usr_ops_manager',     name: 'Jordan Lee',      role: 'Operations',           email: 'jlee@gmu.edu',          access_token: _generateToken(), token_expiry: _expiryFromNow(60) },
      { user_id: 'usr_controller',      name: 'Taylor Kim',      role: 'Controller',           email: 'tkim@gmu.edu',          access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
      { user_id: 'usr_sofya_vetrova',   name: 'Sofya Vetrova',   role: 'Marketing Director',   email: 'svetrova@gmu.edu',      access_token: MKTDIR_TOKEN,   token_expiry: '2026-02-13T15:22:00.000Z' },
      { user_id: 'usr_katie_kennedy',   name: 'Katie Kennedy',   role: 'Marketing Manager',    email: 'kkennedy@gmu.edu',      access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
      { user_id: 'usr_anna_simakova',   name: 'Anna Simakova',   role: 'Graphic Designer',     email: 'asimakova@gmu.edu',     access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
      { user_id: 'usr_dc',              name: 'DC',              role: 'Graphic Designer',     email: 'dc@gmu.edu',            access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
      { user_id: 'usr_masha_alieva',    name: 'Masha Alieva',    role: 'Social Media Intern',  email: 'malieva@gmu.edu',       access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
      { user_id: 'usr_photographer',    name: 'Alex Photo',      role: 'Photographer',         email: 'aphoto@gmu.edu',        access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
      { user_id: 'usr_sustainability',  name: 'Gabby Green',     role: 'Sustainability',       email: 'ggreen@gmu.edu',        access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
      { user_id: 'usr_dietitian',       name: 'Dr. Nutrition',   role: 'Dietitian',            email: 'nutrition@gmu.edu',     access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    localStorage.setItem('ims_seed_version', String(SEED_VERSION));
    _log('Legacy users seeded');
    console.groupCollapsed('%c[AUTH] Access tokens for sharing', 'color:#00b894;font-weight:bold');
    users.forEach(u => {
      console.log(`${u.name} (${u.role}): ${window.location.origin}/?auth=${u.access_token}`);
    });
    console.groupEnd();
  }

  /* ═══ Legacy compat ═══ */
  function getSession() {
    if (_user) return _user;
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
  }

  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function revokeToken(user_id) {
    const users = _getLegacyUsers();
    const user = users.find(u => u.user_id === user_id);
    if (!user) return false;
    user.token_expiry = new Date(0).toISOString();
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return true;
  }

  function regenerateToken(user_id, expiryDays = 30) {
    const users = _getLegacyUsers();
    const user = users.find(u => u.user_id === user_id);
    if (!user) return null;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 48; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    user.access_token = token;
    const d = new Date(); d.setDate(d.getDate() + expiryDays);
    user.token_expiry = d.toISOString();
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return { user_id, name: user.name, new_token: token, new_link: `${window.location.origin}/?auth=${token}` };
  }

  function listUsers() {
    const users = _getLegacyUsers();
    return users;
  }

  function getShareLink(user_id) {
    const users = _getLegacyUsers();
    const user = users.find(u => u.user_id === user_id);
    if (!user) return null;
    return `${window.location.origin}/?auth=${user.access_token}`;
  }

  function clearRegistry() { localStorage.removeItem(USERS_KEY); }

  return {
    // New secure API
    login, verify2FA, logout, checkAuth,
    getUser, getJWT, getAuthMode, isAdmin, isShareMode, isLegacyMode,
    getShareContext, canAccessPage, isReadOnly,
    createShareLink, listShareLinks, revokeShareLink,
    // Legacy compat
    seedUsers, getSession, clearSession,
    revokeToken, regenerateToken, listUsers, getShareLink, clearRegistry,
    SESSION_KEY, USERS_KEY,
  };
})();

/* Expose admin functions to console */
window.AuthAdmin = {
  login: AuthManager.login,
  verify2FA: AuthManager.verify2FA,
  listUsers: AuthManager.listUsers,
  revokeToken: AuthManager.revokeToken,
  regenerateToken: AuthManager.regenerateToken,
  getShareLink: AuthManager.getShareLink,
  logout: AuthManager.logout,
  createShareLink: AuthManager.createShareLink,
  listShareLinks: AuthManager.listShareLinks,
  revokeShareLink: AuthManager.revokeShareLink,
};
