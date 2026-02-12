/* ─── Org Preview — Organization Structure Grid ─── */
const OrgPreviewPage = (() => {

  /* ── Color palette (matches admin.js) ── */
  const COLORS = {
    blue:  { bg: '#e8f4fd', fg: '#2980b9', dot: '#3498db' },
    green: { bg: '#eafaf1', fg: '#27ae60', dot: '#2ecc71' },
    gray:  { bg: '#f0f0f3', fg: '#636e72', dot: '#95a5a6' },
    red:   { bg: '#fdeaea', fg: '#c0392b', dot: '#e74c3c' },
    peach: { bg: '#fdf2f4', fg: '#C15D6C', dot: '#D4707F' },
  };

  /* dark-mode aware colors */
  const COLORS_DARK = {
    blue:  { bg: 'rgba(41,128,185,0.15)', fg: '#5DADE2', dot: '#3498db' },
    green: { bg: 'rgba(39,174,96,0.15)',  fg: '#58D68D', dot: '#2ecc71' },
    gray:  { bg: 'rgba(149,165,166,0.15)',fg: '#AEB6BF', dot: '#95a5a6' },
    red:   { bg: 'rgba(192,57,43,0.15)',  fg: '#EC7063', dot: '#e74c3c' },
    peach: { bg: 'rgba(193,93,108,0.15)', fg: '#E8A0AB', dot: '#D4707F' },
  };

  let _viewMode = 'hierarchy'; // 'hierarchy' | 'flat'

  function _isDark() {
    return document.body.classList.contains('admin-scope') || document.body.classList.contains('theme-operations');
  }

  function _col(colorKey) {
    const palette = _isDark() ? COLORS_DARK : COLORS;
    return palette[colorKey] || palette.gray;
  }

  /* ══ Render ══ */
  function render() {
    const departments = Store.listDepartments();
    const roles       = Store.listOrgRoles();
    const people      = Store.listPeople();

    // Find Marketing Admin and VP Ops from data
    const adminRole = roles.find(r => r.name === 'Marketing Admin');
    const opsRole   = roles.find(r => r.name === 'VP Operations');
    const admin     = people.find(p => adminRole && p.roleId === adminRole.id);
    const vpOps     = people.find(p => opsRole && p.roleId === opsRole.id);

    const settings = Store.getSettings();

    return `
      <style>
        .org-page { padding: 20px 16px 100px; }
        .org-label {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 8px; font-size: 0.7rem; font-weight: 600;
          background: rgba(47,107,255,0.10); color: #3ED0FF; letter-spacing: 0.05em;
          margin-bottom: 16px;
        }
        .org-title { font-size: 1.4rem; font-weight: 700; margin-bottom: 4px; letter-spacing: -0.02em; }
        .org-subtitle { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 24px; }

        /* Toggle */
        .org-toggle {
          display: flex; gap: 0; border-radius: 10px; overflow: hidden;
          border: 1px solid var(--border, rgba(255,255,255,0.08)); margin-bottom: 20px;
          width: fit-content;
        }
        .org-toggle-btn {
          padding: 7px 18px; font-size: 0.75rem; font-weight: 600; cursor: pointer; border: none;
          background: transparent; color: var(--text-muted, #8FA4C3);
          transition: all 0.2s ease;
        }
        .org-toggle-btn.active {
          background: rgba(47,107,255,0.15); color: #3ED0FF;
        }

        /* Leadership row */
        .org-leaders {
          text-align: center; margin-bottom: 24px;
          padding: 20px 16px; border-radius: 16px;
          background: var(--card-bg, #fff); border: 1px solid var(--border, rgba(0,0,0,0.06));
        }
        .org-leader-card {
          display: inline-flex; flex-direction: column; align-items: center;
          margin: 0 20px; vertical-align: top;
        }
        .org-leader-avatar {
          width: 52px; height: 52px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 1rem; margin-bottom: 6px;
        }
        .org-leader-name { font-weight: 700; font-size: 0.88rem; }
        .org-leader-role {
          display: inline-block; padding: 2px 10px; border-radius: 20px;
          font-size: 0.62rem; font-weight: 600; margin-top: 3px;
        }
        .org-connector {
          width: 40px; margin: 12px auto 0; border-bottom: 2px solid var(--border, rgba(0,0,0,0.1));
        }

        /* Department grid */
        .org-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
        }
        .org-dept-card {
          background: var(--card-bg, #fff); border: 1px solid var(--border, rgba(0,0,0,0.06));
          border-radius: 14px; padding: 16px; overflow: hidden;
          transition: box-shadow 0.2s ease;
        }
        .org-dept-card:hover { box-shadow: var(--shadow-lg, 0 4px 20px rgba(0,0,0,0.08)); }
        .org-dept-header {
          font-weight: 700; font-size: 0.88rem; margin-bottom: 12px;
          padding-bottom: 8px; border-bottom: 2px solid var(--border, rgba(0,0,0,0.06));
          display: flex; align-items: center; justify-content: space-between;
        }
        .org-dept-count {
          font-size: 0.65rem; font-weight: 600; padding: 2px 8px; border-radius: 20px;
          background: rgba(47,107,255,0.10); color: var(--text-muted, #8FA4C3);
        }

        /* Person card */
        .org-person {
          display: flex; align-items: center; gap: 10px; padding: 8px 0;
          border-bottom: 1px solid var(--border, rgba(0,0,0,0.04));
        }
        .org-person:last-child { border-bottom: none; }
        .org-person-avatar {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 0.65rem;
        }
        .org-person-avatar img {
          width: 32px; height: 32px; border-radius: 50%; object-fit: cover;
        }
        .org-person-name { font-weight: 600; font-size: 0.82rem; }
        .org-person-role {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 0.6rem; font-weight: 600; padding: 1px 8px;
          border-radius: 20px;
        }

        /* Hierarchy indent */
        .org-child-group {
          border-left: 2px solid var(--border, rgba(0,0,0,0.08));
          margin-left: 16px; padding-left: 10px; margin-top: 2px;
        }

        /* Empty state */
        .org-empty { text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.78rem; }

        /* Footer */
        .org-footer {
          text-align: center; margin-top: 24px; padding-top: 16px;
          border-top: 1px solid var(--border, rgba(0,0,0,0.06));
          font-size: 0.68rem; color: var(--text-muted, #8FA4C3);
          display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;
        }
      </style>

      <div class="org-page">

        <div class="org-label">
          <span style="width:6px;height:6px;border-radius:50%;background:#3ED0FF;"></span>
          Structure Clarity
        </div>

        <h1 class="org-title">Organization Structure</h1>
        <p class="org-subtitle">${departments.length} departments · ${people.length} people</p>

        <!-- Toggle -->
        <div class="org-toggle">
          <button class="org-toggle-btn ${_viewMode === 'hierarchy' ? 'active' : ''}" onclick="OrgPreviewPage.setView('hierarchy')">Hierarchy View</button>
          <button class="org-toggle-btn ${_viewMode === 'flat' ? 'active' : ''}" onclick="OrgPreviewPage.setView('flat')">Flat View</button>
        </div>

        <!-- Leadership row -->
        ${_renderLeadership(admin, vpOps, adminRole, opsRole)}

        <!-- Department Grid -->
        <div class="org-grid">
          ${departments.map(d => _renderDeptCard(d, people, roles)).join('')}
        </div>

        <!-- Footer -->
        <div class="org-footer">
          <span>${departments.length} Departments</span>
          <span>${roles.length} Roles</span>
          <span>${people.length} People</span>
        </div>

      </div>
    `;
  }

  /* ══ Leadership Row ══ */
  function _renderLeadership(admin, vpOps, adminRole, opsRole) {
    if (!admin && !vpOps) return '';

    const renderLeader = (person, role) => {
      if (!person) return '';
      const c = _col(role?.color || 'gray');
      const displayRole = role?.name === 'Marketing Admin' ? 'Marketing Admin' : (role?.name || 'Unknown');
      return `
        <div class="org-leader-card">
          <div class="org-leader-avatar" style="background:${c.bg};color:${c.fg};">
            ${person.photoUrl
              ? `<img src="${_esc(person.photoUrl)}" style="width:52px;height:52px;border-radius:50%;object-fit:cover" onerror="this.style.display='none'">`
              : _initials(person.name)}
          </div>
          <div class="org-leader-name">${_esc(person.name)}</div>
          <div class="org-leader-role" style="background:${c.bg};color:${c.fg};">${_esc(displayRole)}</div>
        </div>
      `;
    };

    return `
      <div class="org-leaders">
        ${renderLeader(admin, adminRole)}
        ${admin && vpOps ? '<span style="font-size:1.1rem;color:var(--text-muted);vertical-align:middle;display:inline-block;margin:0 8px;">→</span>' : ''}
        ${renderLeader(vpOps, opsRole)}
        <div class="org-connector"></div>
      </div>
    `;
  }

  /* ══ Department Card ══ */
  function _renderDeptCard(dept, allPeople, roles) {
    const deptPeople = allPeople.filter(p => p.deptId === dept.id);

    if (deptPeople.length === 0) {
      return `
        <div class="org-dept-card">
          <div class="org-dept-header">
            ${_esc(dept.name)}
            <span class="org-dept-count">0</span>
          </div>
          <div class="org-empty">No members assigned</div>
        </div>
      `;
    }

    let content;
    if (_viewMode === 'hierarchy') {
      // Find top-level people in this dept (no manager, or manager outside dept)
      const topLevel = deptPeople.filter(p =>
        !p.managerId || !deptPeople.find(x => x.id === p.managerId)
      );
      // Sort by role weight
      topLevel.sort((a, b) => _roleWeight(a, roles) - _roleWeight(b, roles));
      content = topLevel.map(p => _renderPersonHierarchy(p, deptPeople, roles, 0)).join('');
    } else {
      // Flat view — sorted by role weight
      const sorted = [...deptPeople].sort((a, b) => _roleWeight(a, roles) - _roleWeight(b, roles));
      content = sorted.map(p => _renderPersonFlat(p, roles)).join('');
    }

    return `
      <div class="org-dept-card">
        <div class="org-dept-header">
          ${_esc(dept.name)}
          <span class="org-dept-count">${deptPeople.length}</span>
        </div>
        ${content}
      </div>
    `;
  }

  /* ══ Person — Hierarchy View ══ */
  function _renderPersonHierarchy(person, deptPeople, roles, depth) {
    const role = roles.find(r => r.id === person.roleId);
    const c = _col(role?.color || 'gray');
    const children = deptPeople.filter(p => p.managerId === person.id);
    children.sort((a, b) => _roleWeight(a, roles) - _roleWeight(b, roles));

    return `
      <div class="org-person">
        <div class="org-person-avatar" style="background:${c.bg};color:${c.fg};">
          ${person.photoUrl
            ? `<img src="${_esc(person.photoUrl)}" onerror="this.style.display='none'">`
            : _initials(person.name)}
        </div>
        <div style="min-width:0;">
          <div class="org-person-name">${_esc(person.name)}</div>
          ${role ? `<span class="org-person-role" style="background:${c.bg};color:${c.fg};"><span style="width:6px;height:6px;border-radius:50%;background:${c.dot};"></span>${_esc(role.name)}</span>` : ''}
        </div>
      </div>
      ${depth < 4 && children.length > 0 ? `<div class="org-child-group">${children.map(ch => _renderPersonHierarchy(ch, deptPeople, roles, depth + 1)).join('')}</div>` : ''}
    `;
  }

  /* ══ Person — Flat View ══ */
  function _renderPersonFlat(person, roles) {
    const role = roles.find(r => r.id === person.roleId);
    const c = _col(role?.color || 'gray');

    return `
      <div class="org-person">
        <div class="org-person-avatar" style="background:${c.bg};color:${c.fg};">
          ${person.photoUrl
            ? `<img src="${_esc(person.photoUrl)}" onerror="this.style.display='none'">`
            : _initials(person.name)}
        </div>
        <div style="min-width:0;">
          <div class="org-person-name">${_esc(person.name)}</div>
          ${role ? `<span class="org-person-role" style="background:${c.bg};color:${c.fg};"><span style="width:6px;height:6px;border-radius:50%;background:${c.dot};"></span>${_esc(role.name)}</span>` : ''}
        </div>
      </div>
    `;
  }

  /* ══ Toggle ══ */
  function setView(mode) {
    _viewMode = mode;
    const container = document.getElementById('app-content');
    if (container) container.innerHTML = render();
  }

  /* ══ Helpers ══ */
  function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _initials(n) { return (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
  function _roleWeight(person, roles) {
    const r = roles.find(x => x.id === person.roleId);
    if (!r) return 99;
    const order = { admin: 0, marketing: 1, content_social: 2, assets_only: 3 };
    return order[r.scope] ?? 5;
  }

  return { render, setView };
})();
