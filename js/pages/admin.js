/* ─── Admin Panel — Dynamic Org Structure ─── */
const AdminPage = (() => {

  /* ─── Color palette ─── */
  const COLORS = {
    blue:  { bg: '#e8f4fd', fg: '#2980b9', dot: '#3498db' },
    green: { bg: '#eafaf1', fg: '#27ae60', dot: '#2ecc71' },
    gray:  { bg: '#f0f0f3', fg: '#636e72', dot: '#95a5a6' },
    red:   { bg: '#fdeaea', fg: '#c0392b', dot: '#e74c3c' },
    peach: { bg: '#fdf2f4', fg: '#C15D6C', dot: '#D4707F' },
  };
  const SCOPE_LABELS = {
    assets_only:    'Assets Only',
    content_social: 'Assets + Content',
    marketing:      'Marketing',
    admin:          'Full Access',
  };
  const COLOR_OPTIONS = Object.keys(COLORS);
  const SCOPE_OPTIONS = Object.keys(SCOPE_LABELS);

  /* ─── State ─── */
  let _editingPersonId = null;

  /* ─── Render ─── */
  function render() {
    const departments = Store.listDepartments();
    const roles       = Store.listOrgRoles();
    const people      = Store.listPeople();

    // Seed initial Marketing Admin if no people exist
    if (people.length === 0 && roles.length === 0 && departments.length === 0) {
      _seedInitial();
      return render();
    }

    return `
      <div class="page active" id="page-admin">
        <h1 class="page-title">Admin Panel</h1>
        <p class="page-subtitle">Manage departments, roles & people</p>

        <!-- Org Preview Button -->
        <button class="btn btn-primary" style="margin-bottom:16px;gap:8px" onclick="AdminPage.openOrgPreview()">
          🏢 Org Preview
        </button>

        <!-- ─── A) Departments ─── -->
        <div class="card" style="margin-bottom:16px">
          <div class="section-header"><span class="section-title">Departments</span><span class="section-count">${departments.length}</span></div>
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <input class="form-input" id="adm-dept-name" placeholder="New department name…" style="flex:1" />
            <button class="btn btn-primary btn-sm" onclick="AdminPage.addDept()">Add</button>
          </div>
          ${departments.length === 0 ? '<p style="color:var(--text-muted);font-size:0.82rem">No departments yet.</p>' :
            departments.map(d => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
                <span style="font-weight:600;font-size:0.88rem">${_esc(d.name)}</span>
                <button class="btn btn-danger btn-sm" onclick="AdminPage.deleteDept('${d.id}')">✕</button>
              </div>
            `).join('')}
        </div>

        <!-- ─── B) Roles ─── -->
        <div class="card" style="margin-bottom:16px">
          <div class="section-header"><span class="section-title">Roles</span><span class="section-count">${roles.length}</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
            <input class="form-input" id="adm-role-name" placeholder="Role name…" style="flex:1;min-width:120px" />
            <select class="form-select" id="adm-role-scope" style="width:auto;min-width:100px">
              ${SCOPE_OPTIONS.map(s => `<option value="${s}">${SCOPE_LABELS[s]}</option>`).join('')}
            </select>
            <select class="form-select" id="adm-role-color" style="width:auto;min-width:80px">
              ${COLOR_OPTIONS.map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
            </select>
            <button class="btn btn-primary btn-sm" onclick="AdminPage.addRole()">Add</button>
          </div>
          ${roles.length === 0 ? '<p style="color:var(--text-muted);font-size:0.82rem">No roles yet.</p>' :
            roles.map(r => {
              const c = COLORS[r.color] || COLORS.gray;
              return `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;align-items:center;gap:10px">
                  <span style="width:10px;height:10px;border-radius:50%;background:${c.dot};flex-shrink:0"></span>
                  <div>
                    <span style="font-weight:600;font-size:0.88rem">${_esc(r.name)}</span>
                    <span style="font-size:0.68rem;color:var(--text-muted);margin-left:6px">${SCOPE_LABELS[r.scope] || r.scope}</span>
                  </div>
                </div>
                <button class="btn btn-danger btn-sm" onclick="AdminPage.deleteRole('${r.id}')">✕</button>
              </div>`;
            }).join('')}
        </div>

        <!-- ─── C) People ─── -->
        <div class="card" style="margin-bottom:16px">
          <div class="section-header"><span class="section-title">People</span><span class="section-count">${people.length}</span></div>
          ${_renderPersonForm(departments, roles, people)}
          <div id="adm-people-list">
            ${people.length === 0 ? '<p style="color:var(--text-muted);font-size:0.82rem">No people yet.</p>' :
              people.map(p => _renderPersonRow(p, roles, departments)).join('')}
          </div>
        </div>

        <!-- ─── D) Role Settings ─── -->
        <div class="card" style="margin-bottom:16px">
          <div class="section-header"><span class="section-title">⚙️ Role Settings</span></div>
          ${_renderRoleSettings()}
        </div>

        <!-- ─── E) Delegated Access Links ─── -->
        <div class="card" style="margin-bottom:16px">
          <div class="section-header">
            <span class="section-title">🔗 Delegated Access Links</span>
          </div>
          <p style="font-size:0.78rem;color:var(--text-muted);margin:0 0 14px">Generate secure share links for role-based access. Links are 256-bit tokens, hashed server-side, and instantly revocable.</p>
          ${_renderLinkForm()}
          <div id="adm-links-list" style="margin-top:14px">${_renderLinksList()}</div>
        </div>
      </div>
    `;
  }

  /* ─── Person form (add/edit) ─── */
  function _renderPersonForm(departments, roles, people) {
    const editing = _editingPersonId ? people.find(p => p.id === _editingPersonId) : null;
    return `
      <div style="background:var(--gray-50);border-radius:var(--radius-sm);padding:14px;margin-bottom:14px">
        <div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">
          ${editing ? '✏️ Editing ' + _esc(editing.name) : '➕ Add Person'}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <input class="form-input" id="adm-pers-name" placeholder="Name" value="${editing ? _esc(editing.name) : ''}" style="grid-column:1/-1" />
          <select class="form-select" id="adm-pers-dept">
            <option value="">No Department</option>
            ${departments.map(d => `<option value="${d.id}" ${editing && editing.deptId === d.id ? 'selected' : ''}>${_esc(d.name)}</option>`).join('')}
          </select>
          <select class="form-select" id="adm-pers-role">
            <option value="">No Role</option>
            ${roles.map(r => `<option value="${r.id}" ${editing && editing.roleId === r.id ? 'selected' : ''}>${_esc(r.name)}</option>`).join('')}
          </select>
          <select class="form-select" id="adm-pers-manager">
            <option value="">No Manager</option>
            ${people.filter(p => !editing || p.id !== editing.id).map(p => `<option value="${p.id}" ${editing && editing.managerId === p.id ? 'selected' : ''}>${_esc(p.name)}</option>`).join('')}
          </select>
          <input class="form-input" id="adm-pers-photo" placeholder="Photo URL (optional)" value="${editing && editing.photoUrl ? _esc(editing.photoUrl) : ''}" />
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-primary btn-sm" onclick="AdminPage.savePerson()">${editing ? 'Update' : 'Add Person'}</button>
          ${editing ? `<button class="btn btn-secondary btn-sm" onclick="AdminPage.cancelEdit()">Cancel</button>` : ''}
        </div>
      </div>
    `;
  }

  /* ─── Person row ─── */
  function _renderPersonRow(p, roles, departments) {
    const role = roles.find(r => r.id === p.roleId);
    const dept = departments.find(d => d.id === p.deptId);
    const c = role ? (COLORS[role.color] || COLORS.gray) : COLORS.gray;

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
          ${p.photoUrl
            ? `<img src="${_esc(p.photoUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'" />`
            : `<div style="width:32px;height:32px;border-radius:50%;background:${c.bg};color:${c.fg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.7rem;flex-shrink:0">${_initials(p.name)}</div>`}
          <div style="min-width:0">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-weight:600;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(p.name)}</span>
              ${role ? `<span style="width:8px;height:8px;border-radius:50%;background:${c.dot};flex-shrink:0" title="${_esc(role.name)}"></span>` : ''}
            </div>
            <div style="font-size:0.68rem;color:var(--text-muted)">
              ${role ? _esc(role.name) : '<em>No role</em>'}${dept ? ' · ' + _esc(dept.name) : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn btn-secondary btn-sm" onclick="AdminPage.editPerson('${p.id}')" style="padding:4px 10px;font-size:0.7rem">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="AdminPage.removePerson('${p.id}')" style="padding:4px 10px;font-size:0.7rem">✕</button>
        </div>
      </div>
    `;
  }

  /* ─── Seed initial data ─── */
  function _seedInitial() {
    // Initial departments
    const depts = [
      'Operations', 'Controller', 'Finance', 'Marketing',
      'Sustainability', 'Dietitian', 'IT / Data', 'Chefs', 'Managers'
    ];
    depts.forEach(d => Store.addDepartment(d));

    // Initial roles
    const seedRoles = [
      { name: 'Marketing Admin',   scope: 'admin',          color: 'red'   },
      { name: 'VP Operations',     scope: 'admin',          color: 'blue'  },
      { name: 'Director',          scope: 'marketing',      color: 'blue'  },
      { name: 'Manager',           scope: 'marketing',      color: 'green' },
      { name: 'Designer',          scope: 'content_social', color: 'peach' },
      { name: 'Content Creator',   scope: 'content_social', color: 'peach' },
      { name: 'Photographer',      scope: 'assets_only',    color: 'gray'  },
      { name: 'Controller',        scope: 'marketing',      color: 'blue'  },
      { name: 'Intern',            scope: 'content_social', color: 'gray'  },
    ];
    const createdRoles = seedRoles.map(r => Store.addOrgRole(r.name, r.scope, r.color));

    // Seed one Marketing Admin
    const adminRole = createdRoles[0];
    const opsDept = Store.listDepartments().find(d => d.name === 'Operations');
    Store.addPerson({
      name: 'Daniil Osipov',
      roleId: adminRole.id,
      deptId: opsDept ? opsDept.id : null,
      managerId: null,
      photoUrl: '',
    });
  }

  /* ─── Actions ─── */
  function addDept() {
    const input = document.getElementById('adm-dept-name');
    if (!input || !input.value.trim()) return;
    Store.addDepartment(input.value.trim());
    App.refresh();
  }

  function deleteDept(id) {
    Store.deleteDepartment(id);
    App.refresh();
  }

  function addRole() {
    const name  = document.getElementById('adm-role-name');
    const scope = document.getElementById('adm-role-scope');
    const color = document.getElementById('adm-role-color');
    if (!name || !name.value.trim()) return;
    Store.addOrgRole(name.value.trim(), scope.value, color.value);
    App.refresh();
  }

  function deleteRole(id) {
    Store.deleteOrgRole(id);
    App.refresh();
  }

  function editPerson(id) {
    _editingPersonId = id;
    App.refresh();
  }

  function cancelEdit() {
    _editingPersonId = null;
    App.refresh();
  }

  function savePerson() {
    const name    = document.getElementById('adm-pers-name')?.value.trim();
    const deptId  = document.getElementById('adm-pers-dept')?.value || null;
    const roleId  = document.getElementById('adm-pers-role')?.value || null;
    const managerId = document.getElementById('adm-pers-manager')?.value || null;
    const photoUrl  = document.getElementById('adm-pers-photo')?.value.trim() || '';
    if (!name) return;

    if (_editingPersonId) {
      Store.updatePerson(_editingPersonId, { name, deptId, roleId, managerId, photoUrl });
      _editingPersonId = null;
    } else {
      Store.addPerson({ name, roleId, deptId, managerId, photoUrl });
    }
    App.refresh();
  }

  function removePerson(id) {
    Store.deletePerson(id);
    if (_editingPersonId === id) _editingPersonId = null;
    App.refresh();
  }

  /* ─── Org Preview (fullscreen grid view) ─── */
  function openOrgPreview() {
    const departments = Store.listDepartments();
    const roles       = Store.listOrgRoles();
    const people      = Store.listPeople();

    // Build hierarchy: top-level people (no manager), then children nested
    const _children = (parentId) => people.filter(p => p.managerId === parentId);
    const _roleOrder = (p) => {
      const r = roles.find(x => x.id === p.roleId);
      if (!r) return 99;
      const scopeOrder = { admin: 0, marketing: 1, content_social: 2, assets_only: 3 };
      return scopeOrder[r.scope] ?? 5;
    };

    // Group people by department
    const grouped = {};
    departments.forEach(d => { grouped[d.id] = []; });
    grouped['__none'] = [];
    people.forEach(p => {
      const key = p.deptId && grouped[p.deptId] ? p.deptId : '__none';
      grouped[key].push(p);
    });

    // Sort each group by role hierarchy
    Object.values(grouped).forEach(arr => arr.sort((a, b) => _roleOrder(a) - _roleOrder(b)));

    // Find top-level (no manager or manager not in same dept)
    const renderNode = (person, depth = 0) => {
      const role = roles.find(r => r.id === person.roleId);
      const c = role ? (COLORS[role.color] || COLORS.gray) : COLORS.gray;
      const children = _children(person.id).sort((a, b) => _roleOrder(a) - _roleOrder(b));

      return `
        <div style="margin-left:${depth * 24}px;padding:6px 0">
          <div style="display:flex;align-items:center;gap:8px">
            ${person.photoUrl
              ? `<img src="${_esc(person.photoUrl)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover" onerror="this.style.display='none'" />`
              : `<div style="width:28px;height:28px;border-radius:50%;background:${c.bg};color:${c.fg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.6rem">${_initials(person.name)}</div>`}
            <div>
              <span style="font-weight:600;font-size:0.8rem">${_esc(person.name)}</span>
              ${role ? `<span style="display:inline-flex;align-items:center;gap:4px;margin-left:6px;padding:1px 8px;border-radius:20px;background:${c.bg};color:${c.fg};font-size:0.6rem;font-weight:600">${_esc(role.name)}</span>` : ''}
            </div>
          </div>
          ${depth < 4 && children.length > 0
            ? `<div style="border-left:2px solid ${c.dot};margin-left:14px;margin-top:4px">${children.map(ch => renderNode(ch, depth + 1)).join('')}</div>`
            : ''}
        </div>
      `;
    };

    // Build department columns
    const deptColumns = departments.map(d => {
      const deptPeople = grouped[d.id] || [];
      const topLevel = deptPeople.filter(p => !p.managerId || !deptPeople.find(x => x.id === p.managerId));
      return `
        <div style="min-width:200px;max-width:280px;flex:1;background:var(--white);border-radius:var(--radius-md);padding:14px;box-shadow:var(--shadow-sm)">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid var(--pink-200)">${_esc(d.name)}</div>
          ${topLevel.length === 0
            ? '<p style="font-size:0.75rem;color:var(--text-muted)">No people assigned</p>'
            : topLevel.map(p => renderNode(p, 0)).join('')}
        </div>
      `;
    }).join('');

    // Unassigned people
    const unassigned = grouped['__none'] || [];
    const unassignedCol = unassigned.length > 0 ? `
      <div style="min-width:200px;max-width:280px;flex:1;background:var(--gray-50);border-radius:var(--radius-md);padding:14px;box-shadow:var(--shadow-sm)">
        <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid var(--gray-200)">Unassigned</div>
        ${unassigned.filter(p => !p.managerId).map(p => renderNode(p, 0)).join('')}
      </div>
    ` : '';

    // Top leadership line
    const topLeaders = people.filter(p => !p.managerId && !p.deptId);
    const leaderLine = topLeaders.length > 0 ? `
      <div style="text-align:center;margin-bottom:20px">
        ${topLeaders.map(p => {
          const role = roles.find(r => r.id === p.roleId);
          const c = role ? (COLORS[role.color] || COLORS.gray) : COLORS.gray;
          return `
            <div style="display:inline-flex;flex-direction:column;align-items:center;margin:0 16px">
              <div style="width:44px;height:44px;border-radius:50%;background:${c.bg};color:${c.fg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem">${_initials(p.name)}</div>
              <span style="font-weight:700;font-size:0.82rem;margin-top:4px">${_esc(p.name)}</span>
              ${role ? `<span style="font-size:0.6rem;padding:1px 8px;border-radius:20px;background:${c.bg};color:${c.fg};font-weight:600">${_esc(role.name)}</span>` : ''}
            </div>
          `;
        }).join(' <span style="font-size:1.2rem;color:var(--text-muted);vertical-align:middle">→</span> ')}
        <div style="width:60px;margin:8px auto 0;border-bottom:2px solid var(--pink-300)"></div>
      </div>
    ` : '';

    const html = `
      <div style="position:fixed;inset:0;z-index:9999;background:var(--bg);overflow:auto;padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h2 style="font-size:1.2rem;font-weight:700;margin:0">🏢 Organization Network</h2>
          <button class="btn btn-secondary btn-sm" onclick="AdminPage.closeOrgPreview()">✕ Close</button>
        </div>
        ${leaderLine}
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start">
          ${deptColumns}
          ${unassignedCol}
        </div>
        <div style="text-align:center;margin-top:24px;font-size:0.7rem;color:var(--text-muted)">
          ${departments.length} departments · ${roles.length} roles · ${people.length} people
        </div>
      </div>
    `;

    // Mount overlay
    let overlay = document.getElementById('org-preview-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'org-preview-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = html;
  }

  function closeOrgPreview() {
    const overlay = document.getElementById('org-preview-overlay');
    if (overlay) overlay.remove();
  }

  /* ─── Role Settings renderer ─── */
  function _renderRoleSettings() {
    const navCfg = Store.getRoleNavConfig();
    const homeCfg = Store.getRoleHomeMode();
    const R = Store.ROLES;
    const roleList = [
      { key: R.OPERATIONS,          label: 'Operations' },
      { key: R.DIRECTOR,            label: 'Marketing Director' },
      { key: R.CONTROLLER,          label: 'Controller' },
      { key: R.MANAGER,             label: 'Marketing Manager' },
      { key: R.DESIGNER,            label: 'Graphic Designer' },
      { key: R.SOCIAL_MEDIA_INTERN, label: 'Social Media Intern' },
      { key: R.PHOTOGRAPHER,        label: 'Photographer' },
      { key: R.SUSTAINABILITY,      label: 'Sustainability' },
      { key: R.DIETITIAN,           label: 'Dietitian' },
    ];
    const tabs = ['dashboard','tasks','locations','more'];
    const tabLabels = { dashboard:'Home', tasks:'Tasks', locations:'Locations', more:'More' };
    const homeModes = [
      { value:'strategic', label:'Strategic Dashboard' },
      { value:'chat',      label:'Internal Chat' },
      { value:'custom',    label:'Custom (future)' },
    ];

    return `
      <div style="margin-bottom:16px">
        <div style="font-size:0.78rem;font-weight:700;color:var(--text);margin-bottom:10px">Navigation Control</div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:0.72rem">
            <thead>
              <tr style="border-bottom:1px solid var(--border)">
                <th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-weight:600">Role</th>
                ${tabs.map(t => '<th style="text-align:center;padding:6px 4px;color:var(--text-muted);font-weight:600">' + tabLabels[t] + '</th>').join('')}
              </tr>
            </thead>
            <tbody>
              ${roleList.map(r => {
                const rc = navCfg[r.key] || { dashboard:true, tasks:true, locations:true, more:true };
                return '<tr style="border-bottom:1px solid var(--border,rgba(0,0,0,0.04))">' +
                  '<td style="padding:8px;font-weight:500;color:var(--text)">' + r.label + '</td>' +
                  tabs.map(t => '<td style="text-align:center;padding:8px 4px"><input type="checkbox" ' + (rc[t] ? 'checked' : '') + ' onchange="AdminPage.toggleNav(\'' + r.key + '\',\'' + t + '\',this.checked)" style="cursor:pointer;width:16px;height:16px;accent-color:var(--pink-500)" /></td>').join('') +
                '</tr>';
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <div style="font-size:0.78rem;font-weight:700;color:var(--text);margin-bottom:10px">Home Screen Mode</div>
        ${roleList.map(r => {
          const mode = homeCfg[r.key] || 'chat';
          return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border,rgba(0,0,0,0.04))">' +
            '<span style="font-size:0.75rem;font-weight:500;color:var(--text)">' + r.label + '</span>' +
            '<select onchange="AdminPage.setHomeMode(\'' + r.key + '\',this.value)" style="font-size:0.7rem;padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--card-bg,#fff);color:var(--text);cursor:pointer">' +
              homeModes.map(m => '<option value="' + m.value + '"' + (mode === m.value ? ' selected' : '') + '>' + m.label + '</option>').join('') +
            '</select>' +
          '</div>';
        }).join('')}
      </div>
    `;
  }

  function toggleNav(role, tab, checked) {
    const cfg = Store.getRoleNavConfig();
    if (!cfg[role]) cfg[role] = { dashboard:true, tasks:true, locations:true, more:true };
    cfg[role][tab] = checked;
    Store.saveRoleNavConfig(cfg);
    App.refresh();
  }

  function setHomeMode(role, mode) {
    const cfg = Store.getRoleHomeMode();
    cfg[role] = mode;
    Store.saveRoleHomeMode(cfg);
  }

  /* ─── Helpers ─── */
  function _esc(s)      { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _initials(n) { return (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }

  /* ─── Delegated Access Links ─── */
  const LINK_ROLES = [
    'Operations', 'Controller', 'Marketing Director', 'Marketing Manager',
    'Graphic Designer', 'Social Media Intern', 'Photographer',
    'Sustainability', 'Dietitian', 'Viewer',
  ];
  const ALL_TABS = ['dashboard','tasks','approvals','assets','content','campaigns','locations','team','controller','feedback','notifications','threads','settings'];

  function _renderLinkForm() {
    return `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <select class="form-select" id="adm-link-role" style="flex:1;min-width:140px">
            ${LINK_ROLES.map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
          <select class="form-select" id="adm-link-expiry" style="width:auto;min-width:100px">
            <option value="1">1 day</option>
            <option value="7" selected>7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input class="form-input" id="adm-link-label" placeholder="Label (optional)" style="flex:1;min-width:120px" />
          <label style="font-size:0.75rem;display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="checkbox" id="adm-link-readonly" checked /> Read-only
          </label>
          <label style="font-size:0.75rem;display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="checkbox" id="adm-link-device" /> Bind to device
          </label>
        </div>
        <button class="btn btn-primary btn-sm" onclick="AdminPage.createLink()" style="align-self:flex-start;margin-top:4px">
          🔑 Generate Link
        </button>
      </div>
    `;
  }

  let _cachedLinks = null;
  function _renderLinksList() {
    // If we have server-backed auth, fetch from API
    if (AuthManager.isAdmin && AuthManager.isAdmin()) {
      // Async load — fill in later
      _loadLinksAsync();
      if (_cachedLinks && _cachedLinks.length > 0) {
        return _renderLinksTable(_cachedLinks);
      }
      return '<p style="color:var(--text-muted);font-size:0.78rem">Loading links...</p>';
    }
    // Legacy mode — show localStorage-based links
    return _renderLegacyLinks();
  }

  async function _loadLinksAsync() {
    try {
      const data = await AuthManager.listShareLinks();
      if (data && data.links) {
        _cachedLinks = data.links;
        const el = document.getElementById('adm-links-list');
        if (el) el.innerHTML = _renderLinksTable(data.links);
      }
    } catch (e) {
      console.warn('[ADMIN] Could not load links:', e);
    }
  }

  function _renderLinksTable(links) {
    if (!links || links.length === 0) {
      return '<p style="color:var(--text-muted);font-size:0.78rem">No active links.</p>';
    }
    const now = new Date();
    return `<div style="display:flex;flex-direction:column;gap:8px">
      ${links.map(l => {
        const expired = new Date(l.expires_at || l.expiresAt) < now;
        const status = l.revoked ? '🔴 Revoked' : expired ? '⏰ Expired' : '🟢 Active';
        const statusColor = l.revoked ? '#e74c3c' : expired ? '#e67e22' : '#27ae60';
        return `
          <div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--bg-card)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:600;font-size:0.82rem">${_esc(l.label || l.role)}</span>
              <span style="font-size:0.68rem;color:${statusColor};font-weight:600">${status}</span>
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:8px">
              <span>🎭 ${_esc(l.role)}</span>
              <span>📅 ${l.expires_at ? new Date(l.expires_at).toLocaleDateString() : (l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : '—')}</span>
              <span>👁️ ${l.use_count || l.useCount || 0} uses</span>
              ${l.device_bound || l.deviceBound ? '<span>🔒 Device-bound</span>' : ''}
              ${l.read_only || l.readOnly ? '<span>📖 Read-only</span>' : ''}
            </div>
            ${!l.revoked && !expired ? `
              <div style="margin-top:8px;display:flex;gap:8px">
                <button class="btn btn-danger btn-sm" onclick="AdminPage.revokeLink('${l.id}')">Revoke</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>`;
  }

  function _renderLegacyLinks() {
    const users = AuthManager.listUsers();
    if (!users || users.length === 0) return '<p style="color:var(--text-muted);font-size:0.78rem">No users.</p>';
    const now = new Date();
    return `<div style="display:flex;flex-direction:column;gap:6px">
      ${users.filter(u => u.role !== 'Admin').map(u => {
        const expired = new Date(u.token_expiry) < now;
        const status = expired ? '⏰ Expired' : '🟢 Active';
        const link = `${window.location.origin}/?auth=${u.access_token}`;
        return `
          <div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--bg-card)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:600;font-size:0.82rem">${_esc(u.name)}</span>
              <span style="font-size:0.68rem;color:${expired ? '#e67e22' : '#27ae60'};font-weight:600">${status}</span>
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px">
              🎭 ${_esc(u.role)} · 📅 Expires ${new Date(u.token_expiry).toLocaleDateString()}
            </div>
            ${!expired ? `
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${link}');this.textContent='✓ Copied';setTimeout(()=>this.textContent='📋 Copy Link',2000)" style="font-size:0.7rem">📋 Copy Link</button>
                <button class="btn btn-sm" onclick="AdminPage.regenerateLegacy('${u.user_id}')" style="font-size:0.7rem">🔄 Regenerate</button>
                <button class="btn btn-danger btn-sm" onclick="AdminPage.revokeLegacy('${u.user_id}')" style="font-size:0.7rem">✕ Revoke</button>
              </div>
            ` : `
              <button class="btn btn-sm" onclick="AdminPage.regenerateLegacy('${u.user_id}')" style="font-size:0.7rem">🔄 Regenerate</button>
            `}
          </div>
        `;
      }).join('')}
    </div>`;
  }

  async function createLink() {
    const role     = document.getElementById('adm-link-role').value;
    const expiry   = parseInt(document.getElementById('adm-link-expiry').value);
    const label    = document.getElementById('adm-link-label').value.trim();
    const readOnly = document.getElementById('adm-link-readonly').checked;
    const deviceBound = document.getElementById('adm-link-device').checked;

    if (AuthManager.isAdmin && AuthManager.isAdmin()) {
      // Server-backed
      const result = await AuthManager.createShareLink({
        role, label: label || `${role} link`,
        readOnly, deviceBound,
        expiresInDays: expiry,
        allowedTabs: ALL_TABS,
      });
      if (result && result.link) {
        await navigator.clipboard.writeText(result.link).catch(() => {});
        alert(`✅ Link created!\n\n${result.link}\n\n(Copied to clipboard)`);
        _loadLinksAsync();
      } else {
        alert('❌ Failed: ' + (result.error || 'Unknown error'));
      }
    } else {
      // Legacy mode — just show existing links
      alert('Server-backed link creation requires admin authentication.\n\nCurrently using legacy localStorage auth.');
    }
  }

  async function revokeLink(linkId) {
    if (!confirm('Revoke this link? It will be instantly invalidated.')) return;
    const result = await AuthManager.revokeShareLink(linkId);
    if (result && result.success) {
      _loadLinksAsync();
    } else {
      alert('Failed to revoke: ' + (result.error || 'Unknown error'));
    }
  }

  function revokeLegacy(userId) {
    if (!confirm('Revoke this token?')) return;
    AuthManager.revokeToken(userId);
    App.refresh();
  }

  function regenerateLegacy(userId) {
    const result = AuthManager.regenerateToken(userId);
    if (result) {
      navigator.clipboard.writeText(result.new_link).catch(() => {});
      alert(`✅ New link for ${result.name}:\n\n${result.new_link}\n\n(Copied to clipboard)`);
      App.refresh();
    }
  }

  return {
    render,
    addDept, deleteDept,
    addRole, deleteRole,
    editPerson, cancelEdit, savePerson, removePerson,
    openOrgPreview, closeOrgPreview,
    toggleNav, setHomeMode,
    createLink, revokeLink,
    revokeLegacy, regenerateLegacy,
  };
})();
