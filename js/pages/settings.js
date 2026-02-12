/* ─── Settings Page ─── */
const SettingsPage = (() => {
  const R = Store.ROLES;
  const ROLE_LIST = [
    { key: R.ADMIN,               label: 'Admin' },
    { key: R.OPERATIONS,          label: 'Operations' },
    { key: R.CONTROLLER,          label: 'Controller' },
    { key: R.DIRECTOR,            label: 'Marketing Director' },
    { key: R.MANAGER,             label: 'Marketing Manager' },
    { key: R.DESIGNER,            label: 'Graphic Designer' },
    { key: R.SOCIAL_MEDIA_INTERN, label: 'Social Media Intern' },
    { key: R.PHOTOGRAPHER,        label: 'Photographer' },
    { key: R.SUSTAINABILITY,      label: 'Sustainability' },
    { key: R.DIETITIAN,           label: 'Dietitian' },
  ];

  function render() {
    const s = Store.getSettings();
    const canExport = Store.Permissions.can('export_data');
    const canClear = Store.Permissions.can('clear_data');

    return `
      <div class="page active" id="page-settings">
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Manage your profile and preferences</p>

        <div class="card card-pink" style="text-align:center;padding:24px">
          <div class="avatar avatar-lg" style="margin:0 auto 12px;width:64px;height:64px;font-size:1.3rem">${_initials(s.name)}</div>
          <div style="font-size:1.05rem;font-weight:700;margin-bottom:4px">${_esc(s.name)}</div>
          <span class="chip chip-role">${_esc(s.role)}</span>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="section-header"><span class="section-title">Profile</span></div>

          <div class="form-group">
            <label class="form-label">Your Name</label>
            <input class="form-input" id="settings-name" value="${_esc(s.name)}" />
          </div>

          <button class="btn btn-primary btn-block" onclick="SettingsPage.save()">Save Profile</button>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="section-header"><span class="section-title">Your Permissions</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;padding-bottom:8px">
            ${_permissionChips(s.role)}
          </div>
        </div>

        ${canExport || canClear ? `
        <div class="card" style="margin-top:16px">
          <div class="section-header"><span class="section-title">Data Management</span></div>
          ${canExport ? `
          <div class="settings-item">
            <span class="settings-label">Export Data</span>
            <button class="btn btn-secondary btn-sm" onclick="SettingsPage.exportData()">Export JSON</button>
          </div>` : ''}
          ${canClear ? `
          <div class="settings-item">
            <span class="settings-label">Reset Demo Data</span>
            <button class="btn btn-secondary btn-sm" onclick="SettingsPage.resetDemo()">Reset Seed</button>
          </div>
          <div class="settings-item">
            <span class="settings-label">Clear All Data</span>
            <button class="btn btn-danger btn-sm" onclick="SettingsPage.clearData()">Clear Data</button>
          </div>` : ''}
        </div>` : ''}

        <div class="card" style="margin-top:16px">
          <div class="section-header"><span class="section-title">Session</span></div>
          <div class="settings-item" style="border:none">
            <span class="settings-label">Sign Out</span>
            <button class="btn btn-secondary btn-sm" onclick="App.logout()">Log Out</button>
          </div>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="section-header"><span class="section-title">About</span></div>
          <div class="settings-item" style="border:none">
            <span class="settings-label">Internal Marketing System</span>
            <span class="settings-value">v2.0</span>
          </div>
        </div>
      </div>
    `;
  }

  function _permissionChips(role) {
    const perms = {
      [R.ADMIN]: ['Full Access', 'Create Tasks', 'Edit Tasks', 'Approve', 'Upload', 'Manage Team', 'Export Data', 'Analytics'],
      [R.OPERATIONS]: ['Full Visibility', 'Create Tasks', 'Edit Tasks', 'Manage Team', 'Export Data', 'Analytics'],
      [R.CONTROLLER]: ['View Analytics', 'Comment on Campaigns', 'Escalate Issues'],
      [R.DIRECTOR]: ['Approve / Reject', 'Comment', 'View Overview'],
      [R.MANAGER]: ['Review Work', 'Edit Tasks', 'Submit Approvals', 'Upload Assets', 'Comment'],
      [R.DESIGNER]: ['View Assigned Tasks', 'Advance Status', 'Upload Files'],
      [R.SOCIAL_MEDIA_INTERN]: ['View Content Tasks', 'Advance Status', 'Upload Media'],
      [R.PHOTOGRAPHER]: ['Upload Assets Only'],
      [R.SUSTAINABILITY]: ['View Campaigns', 'View Locations'],
      [R.DIETITIAN]: ['View Campaigns'],
    }[role] || [];
    return perms.map(p => `<span class="chip chip-role" style="font-size:0.65rem">${p}</span>`).join('');
  }

  function save() {
    const s = Store.getSettings();
    Store.saveSettings({
      ...s,
      name: document.getElementById('settings-name').value.trim() || 'You',
    });
    App.refresh();
    App.updateHeader();
  }

  function exportData() {
    if (!Store.Permissions.can('export_data')) return;
    const data = {
      settings: Store.getSettings(),
      team: Store.getTeam(),
      tasks: Store.getTasks(),
      approvals: Store.getApprovals(),
      assets: Store.getAssets().map(a => ({ ...a, dataUrl: a.dataUrl ? '[base64 image]' : null })),
      activity: Store.getActivity(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ims-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearData() {
    if (!Store.Permissions.can('clear_data')) return;
    if (confirm('This will delete all data. Are you sure?')) {
      Store.clearAll();
      Store.seed();
      App.refresh();
      App.updateHeader();
    }
  }

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _initials(n) { return (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }

  function resetDemo() {
    if (!Store.Permissions.can('clear_data')) return;
    Store.clearAll();
    Store.seed();
    App.refresh();
    App.updateHeader();
  }

  return { render, save, exportData, clearData, resetDemo };
})();
