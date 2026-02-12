/* ─── AuthManager — Token-based access control ─── */
const AuthManager = (() => {
  const SESSION_KEY = 'ims_auth_session';
  const USERS_KEY  = 'ims_auth_users';

  /* ═══ Debug Logger ═══ */
  const _log = (...args) => console.log('%c[AUTH]', 'color:#00b894;font-weight:bold', ...args);
  const _warn = (...args) => console.warn('%c[AUTH]', 'color:#fdcb6e;font-weight:bold', ...args);
  const _err = (...args) => console.error('%c[AUTH]', 'color:#d63031;font-weight:bold', ...args);

  /* ═══ Token Helpers ═══ */
  function _generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 48; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    return token;
  }

  function _expiryFromNow(days = 30) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  /* ═══ User Registry ═══ */
  function _getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch { return []; }
  }

  function _saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  /** Seed default users with tokens — called once on first load or after clear */
  function seedUsers() {
    if (_getUsers().length > 0) {
      _log('User registry already exists, skipping seed');
      return;
    }
    _log('Seeding user registry with access tokens...');
    const users = [
      { user_id: 'usr_daniil_osipov',  name: 'Daniil Osipov',  role: 'Admin',                email: 'dosipov@gmu.edu',     access_token: _generateToken(), token_expiry: _expiryFromNow(90) },
      { user_id: 'usr_sofya_vetrova',   name: 'Sofya Vetrova',  role: 'Marketing Director',   email: 'svetrova@gmu.edu',    access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
      { user_id: 'usr_katie_kennedy',   name: 'Katie Kennedy',  role: 'Marketing Manager',    email: 'kkennedy@gmu.edu',    access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
      { user_id: 'usr_anna_simakova',   name: 'Anna Simakova',  role: 'Graphic Designer',     email: 'asimakova@gmu.edu',   access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
      { user_id: 'usr_dc',              name: 'DC',             role: 'Graphic Designer',     email: 'dc@gmu.edu',          access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
      { user_id: 'usr_masha_alieva',    name: 'Masha Alieva',   role: 'Social Media Intern',  email: 'malieva@gmu.edu',     access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
      { user_id: 'usr_photographer',    name: 'Alex Photo',     role: 'Photographer',         email: 'aphoto@gmu.edu',      access_token: _generateToken(), token_expiry: _expiryFromNow(30) },
    ];
    _saveUsers(users);
    _log('Seeded users:', users.map(u => `${u.name} (${u.role})`));
    // Log tokens for admin convenience
    console.groupCollapsed('%c[AUTH] Access tokens for sharing', 'color:#00b894;font-weight:bold');
    users.forEach(u => {
      console.log(`${u.name} (${u.role}): ${window.location.origin}/?auth=${u.access_token}`);
    });
    console.groupEnd();
  }

  /* ═══ Token Validation ═══ */
  function validateToken(token) {
    if (!token) { _warn('No token provided'); return null; }
    const users = _getUsers();
    const user = users.find(u => u.access_token === token);
    if (!user) { _err('Token not found in registry'); return null; }
    // Check expiry
    const now = new Date();
    const expiry = new Date(user.token_expiry);
    if (now > expiry) {
      _err(`Token expired for ${user.name} (expired ${user.token_expiry})`);
      return null;
    }
    _log(`Token valid for ${user.name} (${user.role}), expires ${user.token_expiry}`);
    return user;
  }

  /* ═══ Session Management ═══ */
  function createSession(user) {
    const session = {
      user_id: user.user_id,
      name: user.name,
      role: user.role,
      email: user.email,
      authenticated_at: new Date().toISOString(),
      token_expiry: user.token_expiry,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    _log('Session created:', session);
    return session;
  }

  function getSession() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (!session) return null;
      // Validate session is still tied to a valid, unexpired token
      const users = _getUsers();
      const user = users.find(u => u.user_id === session.user_id);
      if (!user) { _warn('Session user not found in registry, clearing'); clearSession(); return null; }
      const now = new Date();
      const expiry = new Date(user.token_expiry);
      if (now > expiry) { _warn('Session token expired, clearing'); clearSession(); return null; }
      return session;
    } catch { return null; }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    _log('Session cleared');
  }

  /* ═══ Auth Check — called on page load ═══ */
  function checkAuth() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('auth');

    // If ?auth= is present, try to authenticate
    if (token) {
      _log('Auth token detected in URL, validating...');
      const user = validateToken(token);
      if (user) {
        createSession(user);
        // Clean URL — remove ?auth= param
        const url = new URL(window.location);
        url.searchParams.delete('auth');
        window.history.replaceState({}, '', url.pathname + url.hash);
        _log(`Authenticated as ${user.name} (${user.role})`);
        return { authenticated: true, user };
      } else {
        _err('Authentication failed — invalid or expired token');
        return { authenticated: false, reason: 'invalid_token' };
      }
    }

    // No token in URL — check existing session
    const session = getSession();
    if (session) {
      _log(`Existing session found for ${session.name} (${session.role})`);
      return { authenticated: true, user: session };
    }

    // No session, no token
    _warn('No authentication — access denied');
    return { authenticated: false, reason: 'no_session' };
  }

  /* ═══ Admin Functions ═══ */

  /** Revoke a user's token — they will be denied access on next visit */
  function revokeToken(user_id) {
    const users = _getUsers();
    const user = users.find(u => u.user_id === user_id);
    if (!user) { _err(`revokeToken: user ${user_id} not found`); return false; }
    user.token_expiry = new Date(0).toISOString(); // Set expiry to epoch = expired
    _saveUsers(users);
    _log(`Token revoked for ${user.name}`);
    // If revoking own token, clear session too
    const session = getSession();
    if (session && session.user_id === user_id) clearSession();
    return true;
  }

  /** Regenerate a user's token — old links stop working */
  function regenerateToken(user_id, expiryDays = 30) {
    const users = _getUsers();
    const user = users.find(u => u.user_id === user_id);
    if (!user) { _err(`regenerateToken: user ${user_id} not found`); return null; }
    const oldToken = user.access_token;
    user.access_token = _generateToken();
    user.token_expiry = _expiryFromNow(expiryDays);
    _saveUsers(users);
    _log(`Token regenerated for ${user.name}`);
    _log(`Old: ${oldToken.slice(0, 8)}...`);
    _log(`New link: ${window.location.origin}/?auth=${user.access_token}`);
    return { user_id, name: user.name, new_token: user.access_token, new_link: `${window.location.origin}/?auth=${user.access_token}` };
  }

  /** List all users and their token status (for admin console) */
  function listUsers() {
    const users = _getUsers();
    const now = new Date();
    console.group('%c[AUTH] User Registry', 'color:#00b894;font-weight:bold');
    users.forEach(u => {
      const expired = now > new Date(u.token_expiry);
      const status = expired ? '❌ EXPIRED' : '✅ ACTIVE';
      console.log(`${status} ${u.name} (${u.role}) — ${u.email}`);
      console.log(`   Link: ${window.location.origin}/?auth=${u.access_token}`);
      console.log(`   Expires: ${u.token_expiry}`);
    });
    console.groupEnd();
    return users;
  }

  /** Get link for a specific user */
  function getShareLink(user_id) {
    const users = _getUsers();
    const user = users.find(u => u.user_id === user_id);
    if (!user) { _err(`getShareLink: user ${user_id} not found`); return null; }
    const link = `${window.location.origin}/?auth=${user.access_token}`;
    _log(`Share link for ${user.name}: ${link}`);
    return link;
  }

  /** Logout — clear session, redirect to denied screen */
  function logout() {
    clearSession();
    _log('Logged out');
    window.location.reload();
  }

  /** Clear user registry (for reseeding) */
  function clearRegistry() {
    localStorage.removeItem(USERS_KEY);
    _log('User registry cleared');
  }

  return {
    seedUsers,
    checkAuth,
    getSession,
    clearSession,
    revokeToken,
    regenerateToken,
    listUsers,
    getShareLink,
    logout,
    clearRegistry,
    SESSION_KEY,
    USERS_KEY,
  };
})();

/* Expose admin functions to console for convenience */
window.AuthAdmin = {
  listUsers: AuthManager.listUsers,
  revokeToken: AuthManager.revokeToken,
  regenerateToken: AuthManager.regenerateToken,
  getShareLink: AuthManager.getShareLink,
  logout: AuthManager.logout,
};
