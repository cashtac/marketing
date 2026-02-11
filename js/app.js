/* ─── App — Router, Shell, Modal, Drawer, Role Switcher ─── */
const App = (() => {
  let _currentPage = 'dashboard';
  let _previewMode = false;
  let _originalRole = null;

  const PAGES = {
    dashboard:    () => DashboardPage.render(),
    tasks:        () => TasksPage.render(),
    approvals:    () => ApprovalsPage.render(),
    assets:       () => AssetsPage.render(),
    content:      () => ContentPage.render(),
    campaigns:    () => CampaignsPage.render(),
    locations:    () => LocationsPage.render(),
    team:         () => TeamPage.render(),
    settings:     () => SettingsPage.render(),
    taskview:     () => TaskViewPage.render(),
    locationview: () => LocationsPage.render(),
    placementview: () => LocationsPage.render(),
    campaignview: () => CampaignsPage.render(),
  };

  /* Pages that live under the "More" drawer (not primary nav tabs) */
  const MORE_PAGES = ['approvals','assets','content','campaigns','team','settings'];

  function init() {
    Store.seed();
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const s = Store.getSettings();
    const badge = document.getElementById('role-badge');
    if (badge) badge.textContent = s.role;
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

  /* ── Role Switcher ── */
  function openRoleSwitcher() {
    const overlay = document.getElementById('role-switcher-overlay');
    const body = document.getElementById('role-switcher-body');
    const currentRole = Store.getSettings().role;
    const R = Store.ROLES;
    const roles = [
      { role: R.ADMIN,                icon: '🛡️', label: 'Admin',          desc: 'Full system access' },
      { role: R.DIRECTOR,             icon: '👔', label: 'Director',       desc: 'Approve & oversee' },
      { role: R.MANAGER,              icon: '📋', label: 'Manager',        desc: 'Manage tasks & assets' },
      { role: R.DESIGNER,             icon: '🎨', label: 'Designer',       desc: 'Design assignments' },
      { role: R.SOCIAL_MEDIA_INTERN,  icon: '📱', label: 'Social Intern',  desc: 'Content & social' },
    ];
    body.innerHTML = roles.map(r => `
      <button class="role-option ${r.role === currentRole ? 'active' : ''}" onclick="App.switchRole('${r.role}')">
        <span class="role-option-icon">${r.icon}</span>
        <div class="role-option-info">
          <span class="role-option-name">${r.label}</span>
          <span class="role-option-desc">${r.desc}</span>
        </div>
        ${r.role === currentRole ? '<span class="role-option-check">✓</span>' : ''}
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
    const current = Store.getSettings();
    if (!_previewMode) {
      _originalRole = current.role;
    }
    Store.saveSettings({ ...current, role });
    _previewMode = (role !== _originalRole && _originalRole !== null);

    const banner = document.getElementById('preview-banner');
    const roleName = document.getElementById('preview-role-name');
    if (_previewMode) {
      roleName.textContent = role;
      banner.style.display = 'flex';
      document.body.classList.add('has-preview-banner');
    } else {
      banner.style.display = 'none';
      document.body.classList.remove('has-preview-banner');
      _originalRole = null;
    }

    closeRoleSwitcher();
    refresh();
  }

  function exitPreview() {
    if (_originalRole) {
      const current = Store.getSettings();
      Store.saveSettings({ ...current, role: _originalRole });
    }
    _previewMode = false;
    _originalRole = null;
    document.getElementById('preview-banner').style.display = 'none';
    document.body.classList.remove('has-preview-banner');
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
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
