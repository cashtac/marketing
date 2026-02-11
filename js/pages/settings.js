/* ─── Settings Page ─── */
const SettingsPage = (() => {
  const ROLES = ['Admin', 'Marketing Director', 'Marketing Manager', 'Graphic Designer', 'Social Media Manager'];

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

          <div class="form-group">
            <label class="form-label">Active Role</label>
            <select class="form-select" id="settings-role">
              ${ROLES.map(r => `<option value="${r}" ${r === s.role ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
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
            <span class="settings-label">Reset All Data</span>
            <button class="btn btn-danger btn-sm" onclick="SettingsPage.clearData()">Clear Data</button>
          </div>` : ''}
        </div>` : ''}

        <div class="card" style="margin-top:16px">
          <div class="section-header"><span class="section-title">About</span></div>
          <div class="settings-item" style="border:none">
            <span class="settings-label">Internal Marketing System</span>
            <span class="settings-value">v1.1</span>
          </div>
        </div>
      </div>
    `;
  }

  function _permissionChips(role) {
    const perms = {
      'Admin': ['Full Access', 'Create Tasks', 'Edit Tasks', 'Approve', 'Upload', 'Manage Team', 'Export Data'],
      'Marketing Director': ['Approve / Reject', 'Comment', 'View Overview'],
      'Marketing Manager': ['Review Work', 'Edit Tasks', 'Submit Approvals', 'Upload Assets', 'Comment'],
      'Graphic Designer': ['View Assigned Tasks', 'Advance Status', 'Upload Files'],
      'Social Media Manager': ['View Content Tasks', 'Advance Status', 'Upload Media'],
    }[role] || [];
    return perms.map(p => `<span class="chip chip-role" style="font-size:0.65rem">${p}</span>`).join('');
  }

  function save() {
    Store.saveSettings({
      name: document.getElementById('settings-name').value.trim() || 'You',
      role: document.getElementById('settings-role').value,
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

  return { render, save, exportData, clearData };
})();
