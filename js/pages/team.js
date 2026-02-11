/* ─── Team Page ─── */
const TeamPage = (() => {
  function render() {
    const canManage = Store.Permissions.can('manage_team');
    const team = Store.getTeam();
    const tasks = Store.getTasks();

    return `
      <div class="page active" id="page-team">
        <h1 class="page-title">Team</h1>
        <p class="page-subtitle">${team.length} team member${team.length !== 1 ? 's' : ''}</p>

        ${team.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">👥</div>
            <div class="empty-state-text">No team members yet</div>
            ${canManage ? `<button class="btn btn-primary" style="margin-top:16px" onclick="TeamPage.openAdd()">Add First Member</button>` : ''}
          </div>
        ` : ''}

        ${team.map(m => {
          const memberTasks = tasks.filter(t => t.assignee === m.name && t.status !== 'done');
          return `
            <div class="card team-card" ${canManage ? `onclick="TeamPage.openEdit('${m.id}')" style="cursor:pointer"` : ''}>
              <div class="avatar avatar-lg">${_initials(m.name)}</div>
              <div class="team-info">
                <div class="team-name">${_esc(m.name)}</div>
                <div class="team-role">${_roleLabel(m.role)}</div>
                <div class="team-tasks">${memberTasks.length} active task${memberTasks.length !== 1 ? 's' : ''}</div>
              </div>
              <span class="chip chip-role" style="font-size:0.65rem">${_roleLabel(m.role)}</span>
            </div>
          `;
        }).join('')}
      </div>

      ${canManage ? `<button class="fab" onclick="TeamPage.openAdd()" aria-label="Add team member">＋</button>` : ''}
    `;
  }

  function openAdd() {
    if (!Store.Permissions.can('manage_team')) return;
    const roles = _roleOptions();
    App.showModal('Add Team Member', `
      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-input" id="team-name" placeholder="Full name" />
      </div>
      <div class="form-group">
        <label class="form-label">Role</label>
        <select class="form-select" id="team-role">
          ${roles.map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary btn-block" onclick="TeamPage.saveAdd()">Add Member</button>
    `);
  }

  function saveAdd() {
    if (!Store.Permissions.can('manage_team')) return;
    const name = document.getElementById('team-name').value.trim();
    if (!name) return;
    Store.addTeamMember({
      name,
      role: document.getElementById('team-role').value,
    });
    Store.addActivity(`${name} added to the team`);
    App.closeModal();
    App.refresh();
  }

  function openEdit(id) {
    if (!Store.Permissions.can('manage_team')) return;
    const m = Store.getTeam().find(x => x.id === id);
    if (!m) return;
    const roles = _roleOptions();
    const tasks = Store.getTasks().filter(t => t.assignee === m.name);

    App.showModal(m.name, `
      <div style="text-align:center;margin-bottom:20px">
        <div class="avatar avatar-lg" style="margin:0 auto 10px;width:60px;height:60px;font-size:1.2rem">${_initials(m.name)}</div>
        <div class="chip chip-role">${_roleLabel(m.role)}</div>
      </div>

      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-input" id="edit-team-name" value="${_esc(m.name)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Role</label>
        <select class="form-select" id="edit-team-role">
          ${roles.map(r => `<option value="${r.value}" ${r.value === m.role ? 'selected' : ''}>${r.label}</option>`).join('')}
        </select>
      </div>

      ${tasks.length ? `
        <div class="section-header"><span class="section-title">Assigned Tasks</span><span class="section-count">${tasks.length}</span></div>
        ${tasks.slice(0, 5).map(t => `
          <div class="card" style="padding:12px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:0.85rem;font-weight:500">${_esc(t.title)}</span>
              <span class="chip chip-${t.status === 'todo' ? 'todo' : t.status === 'progress' ? 'progress' : t.status === 'review' ? 'review' : 'done'}" style="font-size:0.6rem">
                <span class="chip-dot"></span>
                ${_statusLabel(t.status)}
              </span>
            </div>
          </div>
        `).join('')}
      ` : ''}

      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-primary" style="flex:1" onclick="TeamPage.saveEdit('${m.id}')">Save</button>
        <button class="btn btn-danger" onclick="TeamPage.remove('${m.id}')">Remove</button>
      </div>
    `);
  }

  function saveEdit(id) {
    if (!Store.Permissions.can('manage_team')) return;
    Store.updateTeamMember(id, {
      name: document.getElementById('edit-team-name').value.trim(),
      role: document.getElementById('edit-team-role').value,
    });
    App.closeModal();
    App.refresh();
  }

  function remove(id) {
    if (!Store.Permissions.can('manage_team')) return;
    if (confirm('Remove this team member?')) {
      Store.deleteTeamMember(id);
      App.closeModal();
      App.refresh();
    }
  }

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _initials(n) { return (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
  function _statusLabel(s) { return { todo: 'To-Do', progress: 'In Progress', review: 'Review', done: 'Done' }[s] || s; }
  const ROLE_LABELS = { ADMIN:'Admin', DIRECTOR:'Director', MANAGER:'Manager', DESIGNER:'Designer', SOCIAL_MEDIA_INTERN:'Social Intern' };
  function _roleLabel(r) { return ROLE_LABELS[r] || r; }
  function _roleOptions() {
    return Object.entries(ROLE_LABELS).map(([k,v]) => ({ value: k, label: v }));
  }

  return { render, openAdd, saveAdd, openEdit, saveEdit, remove };
})();
