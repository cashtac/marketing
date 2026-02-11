/* ─── App — Router, Shell, Modal system ─── */
const App = (() => {
  let _currentPage = 'dashboard';
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

  function init() {
    Store.seed();
    _currentPage = _parseHash();
    if (!PAGES[_currentPage] || (_currentPage !== 'taskview' && _currentPage !== 'locationview' && _currentPage !== 'placementview' && _currentPage !== 'campaignview' && !Store.Permissions.canAccessPage(_currentPage))) {
      _currentPage = Store.Permissions.defaultPage();
    }
    _render();
    updateHeader();
    _updateNavVisibility();
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
    // task-{id} → taskview
    if (h.startsWith('task-')) {
      TaskViewPage.setTaskId(h.replace('task-', ''));
      return 'taskview';
    }
    // location-{id} → locationview
    if (h.startsWith('location-')) {
      LocationsPage.setLocationId(h.replace('location-', ''));
      return 'locationview';
    }
    // placement-{locId}-{zoneId}-{plId} → placementview
    if (h.startsWith('placement-')) {
      const parts = h.replace('placement-', '').split('_');
      LocationsPage.setPlacementPath(parts[0], parts[1], parts[2]);
      return 'placementview';
    }
    // campaign-{id} → campaignview
    if (h.startsWith('campaign-')) {
      CampaignsPage.setCampaignId(h.replace('campaign-', ''));
      return 'campaignview';
    }
    return h || 'dashboard';
  }

  function navigate(page) {
    // Allow task-{id} navigation
    if (page.startsWith('task-')) {
      TaskViewPage.setTaskId(page.replace('task-', ''));
      _currentPage = 'taskview';
      location.hash = page;
      _render();
      _updateNav();
      return;
    }
    // Allow location-{id} navigation
    if (page.startsWith('location-')) {
      LocationsPage.setLocationId(page.replace('location-', ''));
      _currentPage = 'locationview';
      location.hash = page;
      _render();
      _updateNav();
      return;
    }
    // Allow placement-{locId}_{zoneId}_{plId} navigation
    if (page.startsWith('placement-')) {
      const parts = page.replace('placement-', '').split('_');
      LocationsPage.setPlacementPath(parts[0], parts[1], parts[2]);
      _currentPage = 'placementview';
      location.hash = page;
      _render();
      _updateNav();
      return;
    }
    // Allow campaign-{id} navigation
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
    // Check for expired placements and auto-create removal tasks
    Store.checkExpiryAndCreateTasks();

    // Re-check page access in case role changed
    if (_currentPage !== 'taskview' && _currentPage !== 'locationview' && _currentPage !== 'placementview' && _currentPage !== 'campaignview' && !Store.Permissions.canAccessPage(_currentPage)) {
      _currentPage = Store.Permissions.defaultPage();
      location.hash = _currentPage;
    }
    _render();
    updateHeader();
    _updateNavVisibility();
  }

  function _render() {
    const container = document.getElementById('app-content');
    container.innerHTML = PAGES[_currentPage]();
    _updateNav();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function _updateNav() {
    const activePage = _currentPage === 'taskview' ? 'tasks' : (_currentPage === 'locationview' || _currentPage === 'placementview') ? 'locations' : _currentPage === 'campaignview' ? 'campaigns' : _currentPage;
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.page === activePage);
    });
  }

  function _updateNavVisibility() {
    const visible = Store.Permissions.visiblePages();
    document.querySelectorAll('.nav-item').forEach(n => {
      const page = n.dataset.page;
      n.style.display = visible.includes(page) ? '' : 'none';
    });
  }

  function updateHeader() {
    const s = Store.getSettings();
    const badge = document.getElementById('role-badge');
    if (badge) badge.textContent = s.role;
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

  return { init, navigate, refresh, updateHeader, showModal, closeModal };
})();

document.addEventListener('DOMContentLoaded', App.init);
