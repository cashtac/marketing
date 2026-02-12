/* ─── App — Router, Shell, Modal, Drawer, Role Switcher ─── */
const App = (() => {
  let _currentPage = 'dashboard';

  /* Role labels for display — roles are already human-readable */

  const PAGES = {
    dashboard:    () => DashboardPage.render(),
    tasks:        () => TasksPage.render(),
    approvals:    () => ApprovalsPage.render(),
    assets:       () => AssetsPage.render(),
    content:      () => ContentPage.render(),
    campaigns:    () => CampaignsPage.render(),
    locations:    () => LocationsPage.render(),
    team:         () => TeamPage.render(),
    controller:   () => ControllerPage.render(),
    feedback:     () => FeedbackPage.render(),
    notifications:() => NotificationsPage.render(),
    admin:        () => AdminPage.render(),
    ideas:        () => IdeasPage.render(),
    command:      () => CommandPage.render(),
    settings:     () => SettingsPage.render(),
    taskview:     () => TaskViewPage.render(),
    locationview: () => LocationsPage.render(),
    placementview: () => LocationsPage.render(),
    campaignview: () => CampaignsPage.render(),
  };

  /* Pages that live under the "More" drawer (not primary nav tabs) */
  const MORE_PAGES = ['approvals','assets','content','campaigns','team','controller','feedback','notifications','admin','ideas','command','settings'];

  function init() {
    Store.seed();

    /* ── Auth Gate ── */
    AuthManager.seedUsers();
    const auth = AuthManager.checkAuth();

    if (!auth.authenticated) {
      _showAccessDenied(auth.reason);
      return; // stop app boot
    }

    // Sync session role → Store settings
    Store.syncFromSession(auth.user);
    console.log('%c[APP]', 'color:#0984e3;font-weight:bold', `Booting as ${auth.user.name} (${auth.user.role})`);

    _currentPage = _parseHash();
    if (!PAGES[_currentPage] || (_currentPage !== 'taskview' && _currentPage !== 'locationview' && _currentPage !== 'placementview' && _currentPage !== 'campaignview' && !Store.Permissions.canAccessPage(_currentPage))) {
      _currentPage = Store.Permissions.defaultPage();
    }
    _render();
    updateHeader();
    window.addEventListener('hashchange', () => {
      _currentPage = _parseHash();
      if (!PAGES[_currentPage] || (_currentPage !== 'taskview' && _currentPage !== 'locationview' && _currentPage !== 'placementview' && _currentPage !== 'campaignview' && !Store.Permissions.canAccessPage(_currentPage))) {
        _currentPage = Store.Permissions.defaultPage();
        location.hash = _currentPage;
      }
      _render();
      _updateNav();
    });
  }

  /* ── Access Denied Screen ── */
  function _showAccessDenied(reason) {
    console.log('%c[APP]', 'color:#d63031;font-weight:bold', `Access denied: ${reason}`);
    document.getElementById('app-header').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'none';
    document.getElementById('app-content').innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;padding:2rem;text-align:center;">
        <div style="font-size:4rem;margin-bottom:1rem;">🔒</div>
        <h1 style="font-size:1.5rem;font-weight:700;color:var(--text-primary,#1a1a2e);margin-bottom:0.5rem;">Access Denied</h1>
        <p style="color:var(--text-secondary,#6b7280);max-width:320px;line-height:1.5;margin-bottom:1.5rem;">
          ${reason === 'invalid_token'
            ? 'Your access link is invalid or has expired. Please request a new one from your administrator.'
            : 'You need an access link to use this system. Contact your team administrator for access.'}
        </p>
        <div style="font-size:0.75rem;color:var(--text-tertiary,#9ca3af);font-family:monospace;">
          ${reason === 'invalid_token' ? 'ERR_TOKEN_INVALID' : 'ERR_NO_SESSION'}
        </div>
      </div>
    `;
  }

  function _parseHash() {
    const h = location.hash.replace('#', '');
    if (h.startsWith('task-')) {
      TaskViewPage.setTaskId(h.replace('task-', ''));
      return 'taskview';
    }
    if (h.startsWith('location-')) {
      LocationsPage.setLocationId(h.replace('location-', ''));
      return 'locationview';
    }
    if (h.startsWith('placement-')) {
      const parts = h.replace('placement-', '').split('_');
      LocationsPage.setPlacementPath(parts[0], parts[1], parts[2]);
      return 'placementview';
    }
    if (h.startsWith('campaign-')) {
      CampaignsPage.setCampaignId(h.replace('campaign-', ''));
      return 'campaignview';
    }
    return h || 'dashboard';
  }

  function navigate(page) {
    closeMoreDrawer();
    closeRoleSwitcher();

    if (page.startsWith('task-')) {
      TaskViewPage.setTaskId(page.replace('task-', ''));
      _currentPage = 'taskview';
      location.hash = page;
      _render();
      _updateNav();
      return;
    }
    if (page.startsWith('location-')) {
      LocationsPage.setLocationId(page.replace('location-', ''));
      _currentPage = 'locationview';
      location.hash = page;
      _render();
      _updateNav();
      return;
    }
    if (page.startsWith('placement-')) {
      const parts = page.replace('placement-', '').split('_');
      LocationsPage.setPlacementPath(parts[0], parts[1], parts[2]);
      _currentPage = 'placementview';
      location.hash = page;
      _render();
      _updateNav();
      return;
    }
    if (page.startsWith('campaign-')) {
      CampaignsPage.setCampaignId(page.replace('campaign-', ''));
      _currentPage = 'campaignview';
      location.hash = page;
      _render();
      _updateNav();
      return;
    }
    if (!Store.Permissions.canAccessPage(page)) return;
    _currentPage = page;
    location.hash = page;
    _render();
    _updateNav();
  }

  function refresh() {
    Store.checkExpiryAndCreateTasks();
    if (_currentPage !== 'taskview' && _currentPage !== 'locationview' && _currentPage !== 'placementview' && _currentPage !== 'campaignview' && !Store.Permissions.canAccessPage(_currentPage)) {
      _currentPage = Store.Permissions.defaultPage();
      location.hash = _currentPage;
    }
    _render();
    updateHeader();
  }

  function _render() {
    const container = document.getElementById('app-content');
    container.innerHTML = PAGES[_currentPage]();
    _updateNav();
    _updatePreviewBanner();
    _updateThemeScope();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Theme scope toggle (Admin blue + Operations gold) ── */
  function _updateThemeScope() {
    const role = Store.getActiveRole();
    const isAdmin = role === Store.ROLES.ADMIN;
    const isOps   = role === Store.ROLES.OPERATIONS;
    document.body.classList.toggle('admin-scope', isAdmin);
    document.body.classList.toggle('theme-operations', isOps);
  }

  function _updateNav() {
    const activePage = _currentPage === 'taskview' ? 'tasks'
      : (_currentPage === 'locationview' || _currentPage === 'placementview') ? 'locations'
      : _currentPage === 'campaignview' ? 'campaigns'
      : _currentPage;

    const isMorePage = MORE_PAGES.includes(activePage);

    document.querySelectorAll('.nav-item').forEach(n => {
      const pg = n.dataset.page;
      if (pg === 'more') {
        n.classList.toggle('active', isMorePage);
      } else {
        n.classList.toggle('active', pg === activePage && !isMorePage);
      }
    });
  }

  function updateHeader() {
    const badge = document.getElementById('role-badge');
    if (!badge) return;
    const activeRole = Store.getActiveRole();
    const session = AuthManager.getSession();
    badge.textContent = activeRole;
    /* Only Admin/Operations users can switch roles (preview mode) */
    const isRealAdmin = session && (session.role === Store.ROLES.ADMIN || session.role === Store.ROLES.OPERATIONS);
    if (isRealAdmin) {
      badge.onclick = () => App.openRoleSwitcher();
      badge.style.cursor = 'pointer';
    } else {
      badge.onclick = null;
      badge.style.cursor = 'default';
    }
    if (Store.isPreviewMode()) {
      badge.style.background = 'var(--warning, #E8A640)';
      badge.style.color = '#fff';
    } else {
      badge.style.background = '';
      badge.style.color = '';
    }
  }

  /* ── Preview Banner ── */
  function _updatePreviewBanner() {
    const banner = document.getElementById('preview-banner');
    const roleName = document.getElementById('preview-role-name');
    if (!banner) return;
    if (Store.isPreviewMode()) {
      const label = Store.getActiveRole();
      roleName.textContent = label;
      banner.style.display = 'flex';
      document.body.classList.add('has-preview-banner');
    } else {
      banner.style.display = 'none';
      document.body.classList.remove('has-preview-banner');
    }
  }

  /* ── More Drawer ── */
  function openMoreDrawer() {
    const overlay = document.getElementById('drawer-overlay');
    const body = document.getElementById('drawer-body');
    const items = Store.Permissions.drawerItems();
    body.innerHTML = items.map(item => `
      <button class="drawer-item" onclick="App.navigate('${item.page}')">
        <span class="drawer-item-icon">${item.icon}</span>
        <span class="drawer-item-label">${item.label}</span>
        <svg class="drawer-item-arrow" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    `).join('');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeMoreDrawer() {
    const overlay = document.getElementById('drawer-overlay');
    if (overlay) {
      overlay.classList.remove('show');
      document.body.style.overflow = '';
    }
  }

  /* ── Role Switcher (preview only — real user is always ADMIN) ── */
  function openRoleSwitcher() {
    const overlay = document.getElementById('role-switcher-overlay');
    const body = document.getElementById('role-switcher-body');
    const activeRole = Store.getActiveRole();
    const R = Store.ROLES;
    const roles = [
      { role: R.ADMIN,                icon: '🛡️', label: 'Admin',               desc: 'Full system access' },
      { role: R.OPERATIONS,           icon: '🏗️', label: 'Operations',           desc: 'Full visibility & management' },
      { role: R.CONTROLLER,           icon: '📊', label: 'Controller',           desc: 'Analytics & reports (preview)' },
      { role: R.DIRECTOR,             icon: '👔', label: 'Marketing Director',   desc: 'Approve & oversee (preview)' },
      { role: R.MANAGER,              icon: '📋', label: 'Marketing Manager',    desc: 'Manage tasks & assets (preview)' },
      { role: R.DESIGNER,             icon: '🎨', label: 'Graphic Designer',     desc: 'Design assignments (preview)' },
      { role: R.SOCIAL_MEDIA_INTERN,  icon: '📱', label: 'Social Media Intern',  desc: 'Content & social (preview)' },
      { role: R.PHOTOGRAPHER,         icon: '📷', label: 'Photographer',         desc: 'Upload assets only (preview)' },
      { role: R.SUSTAINABILITY,       icon: '🌿', label: 'Sustainability',       desc: 'Green initiatives (preview)' },
      { role: R.DIETITIAN,            icon: '🥗', label: 'Dietitian',            desc: 'Nutrition campaigns (preview)' },
    ];
    body.innerHTML = roles.map(r => `
      <button class="role-option ${r.role === activeRole ? 'active' : ''}" onclick="App.switchRole('${r.role}')">
        <span class="role-option-icon">${r.icon}</span>
        <div class="role-option-info">
          <span class="role-option-name">${r.label}${r.role !== R.ADMIN ? ' 👁️' : ''}</span>
          <span class="role-option-desc">${r.desc}</span>
        </div>
        ${r.role === activeRole ? '<span class="role-option-check">✓</span>' : ''}
      </button>
    `).join('');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeRoleSwitcher() {
    const overlay = document.getElementById('role-switcher-overlay');
    if (overlay) {
      overlay.classList.remove('show');
      document.body.style.overflow = '';
    }
  }

  function switchRole(role) {
    /* Admin = exit preview; anything else = enter preview */
    if (role === Store.ROLES.ADMIN) {
      Store.setPreviewRole(null);
    } else {
      Store.setPreviewRole(role);
    }
    closeRoleSwitcher();
    refresh();
  }

  function exitPreview() {
    Store.setPreviewRole(null);
    refresh();
  }

  /* ── Modal ── */
  function showModal(title, content) {
    const overlay = document.getElementById('modal-overlay');
    overlay.querySelector('.modal-title').textContent = title;
    overlay.querySelector('.modal-body').innerHTML = content;
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  return {
    init, navigate, refresh, updateHeader, showModal, closeModal,
    openMoreDrawer, closeMoreDrawer,
    openRoleSwitcher, closeRoleSwitcher, switchRole, exitPreview,
    logout: () => AuthManager.logout(),
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
