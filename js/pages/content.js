/* ─── Content Page — Video / Social Media ─── */
const ContentPage = (() => {
  let _filter = 'all';
  let _platformFilter = 'all';

  const PLATFORMS = {
    youtube:   { label: 'YouTube',    icon: '▶️',  color: '#C1606E' },
    instagram: { label: 'Instagram',  icon: '📸', color: '#B87088' },
    tiktok:    { label: 'TikTok',     icon: '🎵', color: '#8C8C9E' },
    linkedin:  { label: 'LinkedIn',   icon: '💼', color: '#7A97B8' },
    facebook:  { label: 'Facebook',   icon: '📘', color: '#7A97B8' },
    twitter:   { label: 'X / Twitter', icon: '🐦', color: '#8C8C9E' },
  };
  const CONTENT_TYPES = {
    long_form:  'Long-form Video',
    short_form: 'Short-form Video',
    reel:       'Reel',
    story:      'Story',
  };
  const STATUSES = {
    draft:    { label: 'Draft',    cls: 'chip-todo' },
    review:   { label: 'In Review', cls: 'chip-review' },
    approved: { label: 'Approved', cls: 'chip-done' },
    published:{ label: 'Published', cls: 'chip-done' },
  };

  function setFilter(f)  { _filter = f; App.refresh(); }
  function setPlatformFilter(p) { _platformFilter = p; App.refresh(); }

  function render() {
    const allContent = Store.Permissions.filterContent(Store.getContent());
    const canCreate = Store.Permissions.can('create_content');
    const canEdit   = Store.Permissions.can('edit_content');
    const canDelete = Store.Permissions.can('delete_content');

    // Apply status filter
    let filtered = allContent;
    if (_filter !== 'all') filtered = filtered.filter(c => c.status === _filter);
    // Apply platform filter
    if (_platformFilter !== 'all') filtered = filtered.filter(c => c.platform === _platformFilter);

    const counts = { draft: 0, review: 0, approved: 0, published: 0 };
    allContent.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });

    return `
      <div class="page active" id="page-content">
        <h1 class="page-title">Content</h1>
        <p class="page-subtitle">Videos, reels & social media content</p>

        <!-- Status filters -->
        <div class="filter-bar">
          <button class="filter-chip ${_filter === 'all' ? 'active' : ''}" onclick="ContentPage.setFilter('all')">All (${allContent.length})</button>
          <button class="filter-chip ${_filter === 'draft' ? 'active' : ''}" onclick="ContentPage.setFilter('draft')">Draft (${counts.draft})</button>
          <button class="filter-chip ${_filter === 'review' ? 'active' : ''}" onclick="ContentPage.setFilter('review')">Review (${counts.review})</button>
          <button class="filter-chip ${_filter === 'approved' ? 'active' : ''}" onclick="ContentPage.setFilter('approved')">Approved (${counts.approved})</button>
          <button class="filter-chip ${_filter === 'published' ? 'active' : ''}" onclick="ContentPage.setFilter('published')">Published (${counts.published})</button>
        </div>

        <!-- Platform filters -->
        <div class="filter-bar" style="margin-top:-4px">
          <button class="filter-chip ${_platformFilter === 'all' ? 'active' : ''}" onclick="ContentPage.setPlatformFilter('all')">All Platforms</button>
          ${Object.entries(PLATFORMS).map(([k, v]) => `
            <button class="filter-chip ${_platformFilter === k ? 'active' : ''}" onclick="ContentPage.setPlatformFilter('${k}')">${v.icon} ${v.label}</button>
          `).join('')}
        </div>

        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">🎬</div>
            <div class="empty-state-text">No content matches this filter</div>
          </div>
        ` : ''}

        ${filtered.map(c => _renderCard(c, canEdit, canDelete)).join('')}
      </div>
      ${canCreate ? `<button class="fab" onclick="ContentPage.openCreate()" aria-label="Add content">＋</button>` : ''}
    `;
  }

  function _renderCard(c, canEdit, canDelete) {
    const plat = PLATFORMS[c.platform] || { label: c.platform, icon: '🎥', color: '#666' };
    const st = STATUSES[c.status] || { label: c.status, cls: 'chip-todo' };
    const typeName = CONTENT_TYPES[c.type] || c.type;

    return `
      <div class="card cnt-card" ${canEdit ? `onclick="ContentPage.openEdit('${c.id}')" style="cursor:pointer"` : ''}>
        <div class="cnt-card-top">
          <div class="cnt-platform-badge" style="background:${plat.color}15;color:${plat.color}">
            <span class="cnt-platform-icon">${plat.icon}</span>
            <span class="cnt-platform-label">${plat.label}</span>
          </div>
          <span class="chip ${st.cls}"><span class="chip-dot"></span>${st.label}</span>
        </div>

        <h3 class="cnt-card-title">${_esc(c.title)}</h3>
        <div class="cnt-card-type">${typeName}</div>

        <p class="cnt-card-desc">${_esc(c.description)}</p>

        <div class="cnt-card-task">
          <span class="cnt-task-icon">🔗</span>
          <span class="cnt-task-name">${_esc(c.taskTitle)}</span>
        </div>

        <div class="cnt-card-meta">
          <div class="avatar avatar-sm">${_initials(c.assignee)}</div>
          <span>${_esc(c.assignee)}</span>
        </div>

        ${canDelete ? `<button class="cnt-delete" onclick="event.stopPropagation(); ContentPage.deleteItem('${c.id}')" aria-label="Delete">🗑</button>` : ''}
      </div>
    `;
  }

  /* ── Create ── */
  function openCreate() {
    if (!Store.Permissions.can('create_content')) return;
    const tasks = Store.getTasks();
    if (tasks.length === 0) {
      App.showModal('Cannot Add Content', `
        <div class="empty-state" style="padding:20px 0">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-text">Create a task first.<br>Content must be linked to a task.</div>
        </div>
      `);
      return;
    }
    const team = Store.getTeam();
    if (!team.length) {
      App.showModal('Cannot Add Content', `
        <div class="empty-state" style="padding:20px 0">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-text">Add team members first.<br>Every content item must have an owner.</div>
        </div>
      `);
      return;
    }
    App.showModal('New Content', `
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="form-input" id="cnt-title" placeholder="e.g. Spring Campaign Reel" />
      </div>
      <div class="form-group">
        <label class="form-label">Linked Task *</label>
        <select class="form-select" id="cnt-task">
          ${tasks.map(t => `<option value="${t.id}" data-title="${_esc(t.title)}">${_esc(t.title)}</option>`).join('')}
        </select>
        <small style="color:var(--text-light);font-size:0.68rem">Content must be linked to a task</small>
      </div>
      <div class="form-group">
        <label class="form-label">Platform *</label>
        <select class="form-select" id="cnt-platform">
          ${Object.entries(PLATFORMS).map(([k,v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Content Type</label>
        <select class="form-select" id="cnt-type">
          ${Object.entries(CONTENT_TYPES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Description *</label>
        <textarea class="form-input" id="cnt-desc" rows="3" placeholder="What is this content about?"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Owner * <small style="color:var(--danger)">(required)</small></label>
        <select class="form-select" id="cnt-assignee">
          ${team.map(m => `<option value="${_esc(m.name)}">${_esc(m.name)} — ${_esc(m.role)}</option>`).join('')}
        </select>
        <small style="color:var(--text-light);font-size:0.68rem">Every content item must have one owner</small>
      </div>
      <button class="btn btn-primary btn-block" onclick="ContentPage.saveCreate()">Create Content</button>
    `);
  }

  function saveCreate() {
    const title = document.getElementById('cnt-title').value.trim();
    const desc = document.getElementById('cnt-desc').value.trim();
    const assignee = document.getElementById('cnt-assignee').value;
    if (!title || !desc) { alert('Title and description are required.'); return; }
    if (!assignee) { alert('Every content item must have an owner.'); return; }
    const taskSel = document.getElementById('cnt-task');
    const taskId = taskSel.value;
    const taskTitle = taskSel.options[taskSel.selectedIndex].dataset.title;
    Store.addContent({
      title,
      platform: document.getElementById('cnt-platform').value,
      type: document.getElementById('cnt-type').value,
      description: desc,
      status: 'draft',
      assignee: document.getElementById('cnt-assignee').value,
      taskId,
      taskTitle,
    });
    App.closeModal(); App.refresh();
  }

  /* ── Edit ── */
  function openEdit(id) {
    if (!Store.Permissions.can('edit_content')) return;
    const item = Store.getContent().find(c => c.id === id);
    if (!item) return;
    const team = Store.getTeam();
    const tasks = Store.getTasks();
    App.showModal('Edit Content', `
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-input" id="edit-cnt-title" value="${_esc(item.title)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Linked Task</label>
        <select class="form-select" id="edit-cnt-task">
          ${tasks.map(t => `<option value="${t.id}" data-title="${_esc(t.title)}" ${t.id === item.taskId ? 'selected' : ''}>${_esc(t.title)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Platform</label>
        <select class="form-select" id="edit-cnt-platform">
          ${Object.entries(PLATFORMS).map(([k,v]) => `<option value="${k}" ${k === item.platform ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Content Type</label>
        <select class="form-select" id="edit-cnt-type">
          ${Object.entries(CONTENT_TYPES).map(([k,v]) => `<option value="${k}" ${k === item.type ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-input" id="edit-cnt-desc" rows="3">${_esc(item.description)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Owner *</label>
        <select class="form-select" id="edit-cnt-assignee">
          ${team.map(m => `<option value="${_esc(m.name)}" ${m.name === item.assignee ? 'selected' : ''}>${_esc(m.name)} — ${_esc(m.role)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary btn-block" onclick="ContentPage.saveEdit('${id}')">Save</button>
    `);
  }

  function saveEdit(id) {
    const title = document.getElementById('edit-cnt-title').value.trim();
    const desc = document.getElementById('edit-cnt-desc').value.trim();
    const assignee = document.getElementById('edit-cnt-assignee').value;
    if (!title || !desc) { alert('Title and description are required.'); return; }
    if (!assignee) { alert('Every content item must have an owner.'); return; }
    const taskSel = document.getElementById('edit-cnt-task');
    Store.updateContent(id, {
      title,
      platform: document.getElementById('edit-cnt-platform').value,
      type: document.getElementById('edit-cnt-type').value,
      description: desc,
      assignee,
      taskId: taskSel.value,
      taskTitle: taskSel.options[taskSel.selectedIndex].dataset.title,
    });
    App.closeModal(); App.refresh();
  }

  /* ── Delete ── */
  function deleteItem(id) {
    if (!Store.Permissions.can('delete_content')) return;
    if (confirm('Delete this content item?')) {
      Store.deleteContent(id);
      App.refresh();
    }
  }

  /* ── Helpers ── */
  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _initials(n) { return (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }

  return {
    render, setFilter, setPlatformFilter,
    openCreate, saveCreate,
    openEdit, saveEdit,
    deleteItem,
  };
})();
