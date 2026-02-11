/* ─── Tasks Page ─── */
const TasksPage = (() => {
  let _filter = 'all';

  const STATUSES = ['draft', 'progress', 'review', 'approved', 'published'];
  const LABELS = { draft: 'Draft', progress: 'In Progress', review: 'Review', approved: 'Approved', published: 'Published' };
  const CHIPS  = { draft: 'chip-todo', progress: 'chip-progress', review: 'chip-review', approved: 'chip-done', published: 'chip-done' };

  function render() {
    const allTasks = Store.getTasks();
    const tasks = Store.Permissions.filterTasks(allTasks);
    const filteredTasks = _filter === 'all' ? tasks : tasks.filter(t => t.status === _filter);
    const canCreate = Store.Permissions.can('create_task');

    return `
      <div class="page active" id="page-tasks">
        <h1 class="page-title">Tasks</h1>
        <p class="page-subtitle">${canCreate ? 'Track and manage all marketing tasks' : 'Your assigned tasks'}</p>

        <div class="filter-bar">
          <button class="filter-chip ${_filter === 'all' ? 'active' : ''}" onclick="TasksPage.setFilter('all')">All</button>
          ${STATUSES.map(s => `
            <button class="filter-chip ${_filter === s ? 'active' : ''}" onclick="TasksPage.setFilter('${s}')">${LABELS[s]}</button>
          `).join('')}
        </div>

        ${filteredTasks.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div class="empty-state-text">No tasks ${_filter !== 'all' ? 'in this status' : 'assigned to you'}</div>
          </div>
        ` : ''}

        ${_filter === 'all' ?
          STATUSES.map(s => _renderGroup(s, LABELS[s], tasks.filter(t => t.status === s))).join('')
          : filteredTasks.map(t => _renderTask(t)).join('')
        }
      </div>

      ${canCreate ? `<button class="fab" onclick="TasksPage.openCreate()" aria-label="Add task">＋</button>` : ''}
    `;
  }

  function _renderGroup(status, label, tasks) {
    if (!tasks.length) return '';
    return `
      <div class="section-header">
        <span class="section-title">${label}</span>
        <span class="section-count">${tasks.length}</span>
      </div>
      ${tasks.map(t => _renderTask(t)).join('')}
    `;
  }

  function _renderTask(t) {
    const chipClass = CHIPS[t.status] || 'chip-todo';
    const statusLabel = LABELS[t.status] || t.status;
    const fileCount = (t.attachments || []).length;

    // Pipeline step indicator
    const curIdx = STATUSES.indexOf(t.status);
    const pipelineHtml = STATUSES.map((s, i) => {
      const done = i < curIdx;
      const active = i === curIdx;
      return `<span class="tp-dot ${done ? 'tp-dot-done' : ''} ${active ? 'tp-dot-active' : ''}" title="${LABELS[s]}"></span>`;
    }).join('');

    return `
      <div class="card priority-${t.priority} task-card" onclick="App.navigate('task-${t.id}')" style="cursor:pointer">
        <div class="card-header">
          <span class="task-title">${_esc(t.title)}</span>
          <span class="chip ${chipClass}">
            <span class="chip-dot"></span>
            ${statusLabel}
          </span>
        </div>
        <div class="tp-pipeline">${pipelineHtml}</div>
        <div class="assignee-row">
          <div class="avatar avatar-sm">${_initials(t.assignee)}</div>
          <span class="assignee-name">${_esc(t.assignee)}</span>
          ${fileCount ? `<span style="font-size:0.7rem;color:var(--text-light)">📎 ${fileCount}</span>` : ''}
          ${t.dueDate ? `<span class="due-date">📅 ${_fmtDate(t.dueDate)}</span>` : ''}
        </div>
      </div>
    `;
  }

  function setFilter(f) {
    _filter = f;
    App.refresh();
  }

  function advance(id) {
    if (!Store.Permissions.can('advance_task')) return;
    const tasks = Store.getTasks();
    const t = tasks.find(x => x.id === id);
    if (t) {
      const next = Store.nextStatus(t.status);
      if (next === t.status) return; // already at end
      Store.updateTask(id, { status: next });
      App.refresh();
    }
  }

  function remove(id) {
    if (!Store.Permissions.can('delete_task')) return;
    if (confirm('Delete this task?')) {
      Store.deleteTask(id);
      App.refresh();
    }
  }

  function openCreate() {
    if (!Store.Permissions.can('create_task')) return;
    const team = Store.getTeam();
    if (!team.length) {
      App.showModal('Cannot Create Task', `
        <div class="empty-state" style="padding:20px 0">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-text">Add team members first.<br>Every task must have an owner.</div>
        </div>
      `);
      return;
    }
    App.showModal('New Task', `
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="form-input" id="task-title" placeholder="Task title" />
      </div>
      <div class="form-group">
        <label class="form-label">What needs to be done *</label>
        <textarea class="form-textarea" id="task-desc" rows="3" placeholder="Describe exactly what needs to be done"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Why it matters *</label>
        <textarea class="form-textarea" id="task-context" rows="2" placeholder="Why is this important? What's the impact?"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Required deliverables *</label>
        <textarea class="form-textarea" id="task-deliverables" rows="3" placeholder="List what must be delivered — one per line"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Owner * <small style="color:var(--danger)">(required)</small></label>
        <select class="form-select" id="task-assignee">
          ${team.map(m => `<option value="${_esc(m.name)}">${_esc(m.name)} — ${_esc(m.role)}</option>`).join('')}
        </select>
        <small style="color:var(--text-light);font-size:0.68rem">Every task must have one owner</small>
      </div>
      <div style="display:flex;gap:12px">
        <div class="form-group" style="flex:1">
          <label class="form-label">Priority</label>
          <select class="form-select" id="task-priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Due Date</label>
          <input class="form-input" id="task-due" type="date" />
        </div>
      </div>
      <button class="btn btn-primary btn-block" onclick="TasksPage.saveCreate()">Create Task</button>
    `);
  }

  function saveCreate() {
    if (!Store.Permissions.can('create_task')) return;
    const title = document.getElementById('task-title').value.trim();
    const desc = document.getElementById('task-desc').value.trim();
    const context = document.getElementById('task-context').value.trim();
    const deliverables = document.getElementById('task-deliverables').value.trim();
    const assignee = document.getElementById('task-assignee').value;
    if (!title || !desc || !context || !deliverables) { alert('All fields are required.'); return; }
    if (!assignee) { alert('Every task must have an owner.'); return; }
    Store.addTask({
      title,
      description: desc,
      context,
      deliverables,
      assignee,
      priority: document.getElementById('task-priority').value,
      dueDate: document.getElementById('task-due').value,
      attachments: [],
    });
    App.closeModal();
    App.refresh();
  }

  function openEdit(id) {
    if (!Store.Permissions.can('edit_task')) return;
    const t = Store.getTasks().find(x => x.id === id);
    if (!t) return;
    const team = Store.getTeam();

    App.showModal('Edit Task', `
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-input" id="edit-title" value="${_esc(t.title)}" />
      </div>
      <div class="form-group">
        <label class="form-label">What needs to be done</label>
        <textarea class="form-textarea" id="edit-desc" rows="3">${_esc(t.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Why it matters</label>
        <textarea class="form-textarea" id="edit-context" rows="2">${_esc(t.context || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Required deliverables</label>
        <textarea class="form-textarea" id="edit-deliverables" rows="3">${_esc(t.deliverables || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Owner *</label>
        <select class="form-select" id="edit-assignee">
          ${team.map(m => `<option value="${_esc(m.name)}" ${m.name === t.assignee ? 'selected' : ''}>${_esc(m.name)}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:12px">
        <div class="form-group" style="flex:1">
          <label class="form-label">Priority</label>
          <select class="form-select" id="edit-priority">
            <option value="low" ${t.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${t.priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${t.priority === 'high' ? 'selected' : ''}>High</option>
          </select>
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Due Date</label>
          <input class="form-input" id="edit-due" type="date" value="${t.dueDate || ''}" />
        </div>
      </div>
      <button class="btn btn-primary btn-block" onclick="TasksPage.saveEdit('${t.id}')">Save Changes</button>
    `);
  }

  function saveEdit(id) {
    if (!Store.Permissions.can('edit_task')) return;
    const assignee = document.getElementById('edit-assignee').value;
    if (!assignee) { alert('Every task must have an owner.'); return; }
    Store.updateTask(id, {
      title: document.getElementById('edit-title').value.trim(),
      description: document.getElementById('edit-desc').value.trim(),
      context: document.getElementById('edit-context').value.trim(),
      deliverables: document.getElementById('edit-deliverables').value.trim(),
      assignee,
      priority: document.getElementById('edit-priority').value,
      dueDate: document.getElementById('edit-due').value,
    });
    App.closeModal();
    App.refresh();
  }

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _initials(n) { return (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
  function _fmtDate(d) {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return d; }
  }

  return { render, setFilter, advance, remove, openCreate, saveCreate, openEdit, saveEdit };
})();
