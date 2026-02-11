/* ─── Task View — Single Task Detail Screen ─── */
const TaskViewPage = (() => {
  let _taskId = null;
  let _attachments = [];      // temporary files before submit
  let _validationShown = false;

  const STATUSES = ['draft', 'progress', 'review', 'approved', 'published'];
  const LABELS = { draft: 'Draft', progress: 'In Progress', review: 'Review', approved: 'Approved', published: 'Published' };
  const CHIPS  = { draft: 'chip-todo', progress: 'chip-progress', review: 'chip-review', approved: 'chip-done', published: 'chip-done' };
  const NEXT_LABELS = { draft: 'Start Work', progress: 'Submit for Review', review: 'Approve', approved: 'Publish' };

  function setTaskId(id) { _taskId = id; }

  function render() {
    const t = Store.getTasks().find(x => x.id === _taskId);
    if (!t) {
      return `
        <div class="page active" id="page-taskview">
          <div class="empty-state" style="padding:60px 20px">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-text">Task not found</div>
            <button class="btn btn-secondary" style="margin-top:16px" onclick="App.navigate('tasks')">← Back to Tasks</button>
          </div>
        </div>`;
    }

    _attachments = t.attachments || [];
    const settings = Store.getSettings();
    const isOwner = t.assignee === settings.name;
    const isManager = ['Admin', 'Marketing Manager'].includes(settings.role);
    const canAdvance = Store.Permissions.can('advance_task') && (isOwner || isManager);
    const canEdit = Store.Permissions.can('edit_task');
    const isEditable = t.status !== 'published';
    const curIdx = STATUSES.indexOf(t.status);
    const isTerminal = t.status === 'published';

    const chipClass = CHIPS[t.status] || 'chip-todo';
    const statusLabel = LABELS[t.status] || t.status;
    const isOverdue = t.dueDate && new Date(t.dueDate + 'T23:59:59') < new Date();

    // Pipeline step indicator
    const pipelineHtml = STATUSES.map((s, i) => {
      const done = i < curIdx;
      const active = i === curIdx;
      return `<div class="tp-step ${done ? 'tp-step-done' : ''} ${active ? 'tp-step-active' : ''}">
        <div class="tp-step-dot">${done ? '✓' : i + 1}</div>
        <div class="tp-step-label">${LABELS[s]}</div>
      </div>`;
    }).join('<div class="tp-step-line"></div>');

    return `
      <div class="page active" id="page-taskview">

        <!-- Back bar -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('tasks')" style="padding:6px 10px;font-size:0.8rem">← Back</button>
          <span class="chip ${chipClass}" style="margin-left:auto"><span class="chip-dot"></span>${statusLabel}</span>
        </div>

        <!-- Title + Priority -->
        <h1 class="page-title" style="margin-bottom:4px">${_esc(t.title)}</h1>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:20px">
          <span class="chip" style="background:${_priorityBg(t.priority)};color:${_priorityColor(t.priority)};font-size:0.65rem">
            ${_priorityIcon(t.priority)} ${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)} Priority
          </span>
          ${t.dueDate ? `
            <span style="font-size:0.75rem;color:${isOverdue ? 'var(--danger)' : 'var(--text-muted)'};font-weight:${isOverdue ? '600' : '400'}">
              ${isOverdue ? '⚠️' : '📅'} ${_fmtDate(t.dueDate)}${isOverdue ? ' — overdue' : ''}
            </span>` : ''}
          <span style="font-size:0.72rem;color:var(--text-light)">
            Owner: <strong>${_esc(t.assignee)}</strong>
          </span>
        </div>

        <!-- Pipeline -->
        <div class="card" style="padding:16px;margin-bottom:16px">
          <div class="tp-step-pipeline">${pipelineHtml}</div>
        </div>

        <!-- WHAT — Description -->
        <div class="card" style="padding:18px">
          <div class="taskview-label">📋 What needs to be done</div>
          ${canEdit && isEditable ? `
            <textarea class="form-textarea" id="tv-description" rows="3" placeholder="Describe exactly what needs to be done…">${_esc(t.description || '')}</textarea>
          ` : `
            <div class="taskview-content">${_esc(t.description || '—')}</div>
          `}
        </div>

        <!-- WHY — Context -->
        <div class="card" style="padding:18px">
          <div class="taskview-label">🎯 Why it matters</div>
          ${canEdit && isEditable ? `
            <textarea class="form-textarea" id="tv-context" rows="3" placeholder="Why is this task important? What's the impact?">${_esc(t.context || '')}</textarea>
          ` : `
            <div class="taskview-content">${_esc(t.context || '—')}</div>
          `}
        </div>

        <!-- DELIVERABLES -->
        <div class="card" style="padding:18px">
          <div class="taskview-label">📦 Required deliverables</div>
          ${canEdit && isEditable ? `
            <textarea class="form-textarea" id="tv-deliverables" rows="3" placeholder="List what must be delivered — one per line">${_esc(t.deliverables || '')}</textarea>
          ` : `
            <div class="taskview-content" style="white-space:pre-line">${_esc(t.deliverables || '—')}</div>
          `}
        </div>

        <!-- FILES -->
        <div class="card" style="padding:18px">
          <div class="taskview-label">📎 Attachments</div>

          ${_attachments.length > 0 ? `
            <div class="tv-file-list">
              ${_attachments.map((f, i) => `
                <div class="tv-file-item">
                  <span class="tv-file-icon">${_fileIcon(f.type)}</span>
                  <span class="tv-file-name">${_esc(f.name)}</span>
                  <span class="tv-file-size">${_fmtSize(f.size)}</span>
                  ${isEditable ? `<button class="tv-file-remove" onclick="TaskViewPage.removeFile(${i})">✕</button>` : ''}
                </div>
              `).join('')}
            </div>
          ` : `
            <p style="font-size:0.78rem;color:var(--text-light);margin:8px 0">No files uploaded yet</p>
          `}

          ${isEditable ? `
            <label class="tv-upload-area" id="tv-upload-area">
              <input type="file" id="tv-file-input" multiple style="display:none"
                     accept="image/*,.pdf,.doc,.docx,.psd,.ai,.fig,.xd,.mp4,.mov,.zip"
                     onchange="TaskViewPage.handleFileUpload(event)" />
              <div class="tv-upload-icon">📤</div>
              <div class="tv-upload-text">Tap to upload files</div>
              <div class="tv-upload-hint">Images, PDFs, design files, video</div>
            </label>
          ` : ''}
        </div>

        <!-- Validation message -->
        <div id="tv-validation" class="tv-validation" style="display:none">
          <span>⚠️</span>
          <span id="tv-validation-text">Please fill all required fields before submitting</span>
        </div>

        <!-- ACTION — Advance to next step -->
        ${!isTerminal && canAdvance ? `
          <button class="btn btn-primary btn-block tv-submit-btn" onclick="TaskViewPage.advanceTask()">
            ${NEXT_LABELS[t.status] || 'Advance'} →
          </button>
          <p class="tv-submit-hint">Moves to: <strong>${LABELS[Store.nextStatus(t.status)]}</strong> — steps cannot be skipped</p>
        ` : ''}

        ${t.status === 'review' ? `
          <div class="card card-pink" style="padding:16px;text-align:center;margin-top:8px">
            <div style="font-size:1.2rem;margin-bottom:4px">⏳</div>
            <div style="font-size:0.85rem;font-weight:600">Submitted for review</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">Waiting for approval</div>
          </div>
        ` : ''}

        ${t.status === 'published' ? `
          <div class="card" style="padding:16px;text-align:center;background:var(--success-bg)">
            <div style="font-size:1.2rem;margin-bottom:4px">✅</div>
            <div style="font-size:0.85rem;font-weight:600;color:var(--pink-600)">Published</div>
          </div>
        ` : ''}

      </div>
    `;
  }

  /* ── Advance task to next step ── */
  function advanceTask() {
    if (!Store.Permissions.can('advance_task')) return;
    const t = Store.getTasks().find(x => x.id === _taskId);
    if (!t) return;
    // Only task owner or Admin/Manager can advance
    const settings = Store.getSettings();
    const isOwner = t.assignee === settings.name;
    const isManager = ['Admin', 'Marketing Manager'].includes(settings.role);
    if (!isOwner && !isManager) return;

    // If moving from draft → progress, save any editable fields first
    if (Store.Permissions.can('edit_task')) {
      const desc = document.getElementById('tv-description');
      const ctx = document.getElementById('tv-context');
      const del = document.getElementById('tv-deliverables');
      if (desc) Store.updateTask(_taskId, { description: desc.value.trim() });
      if (ctx) Store.updateTask(_taskId, { context: ctx.value.trim() });
      if (del) Store.updateTask(_taskId, { deliverables: del.value.trim() });
    }

    // Re-read after save
    const updated = Store.getTasks().find(x => x.id === _taskId);
    const next = Store.nextStatus(updated.status);
    if (next === updated.status) return; // already terminal

    // Validation for "Submit for Review" — require filled fields + file
    if (updated.status === 'progress') {
      const missing = [];
      if (!updated.description?.trim()) missing.push('description');
      if (!updated.context?.trim()) missing.push('context / why it matters');
      if (!updated.deliverables?.trim()) missing.push('deliverables');
      if (!(updated.attachments?.length > 0)) missing.push('at least one file');
      if (missing.length) {
        const el = document.getElementById('tv-validation');
        const txt = document.getElementById('tv-validation-text');
        if (el) el.style.display = 'flex';
        if (txt) txt.textContent = `Missing: ${missing.join(', ')}`;
        return;
      }
    }

    Store.updateTask(_taskId, { status: next });
    Store.addActivity(`"${updated.title}" moved to ${LABELS[next]}`);
    App.refresh();
  }

  /* ── File handling ── */
  function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    const t = Store.getTasks().find(x => x.id === _taskId);
    if (!t) return;

    let remaining = files.length;
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        remaining--;
        if (remaining === 0) App.refresh();
        return; // skip files >10MB
      }

      const reader = new FileReader();
      reader.onload = e => {
        const attachment = {
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: e.target.result,
          uploadedAt: new Date().toISOString(),
        };
        const current = Store.getTasks().find(x => x.id === _taskId);
        if (!current) return;
        const attachments = current.attachments || [];
        attachments.push(attachment);
        Store.updateTask(_taskId, { attachments });
        remaining--;
        if (remaining === 0) App.refresh();
      };
      reader.readAsDataURL(file);
    });
  }

  function removeFile(index) {
    const t = Store.getTasks().find(x => x.id === _taskId);
    if (!t) return;
    const attachments = (t.attachments || []).filter((_, i) => i !== index);
    Store.updateTask(_taskId, { attachments });
    App.refresh();
  }

  /* ── Save edits on blur ── */
  function autosave() {
    if (!Store.Permissions.can('edit_task')) return;
    const desc = document.getElementById('tv-description');
    const ctx = document.getElementById('tv-context');
    const del = document.getElementById('tv-deliverables');
    const updates = {};
    if (desc) updates.description = desc.value.trim();
    if (ctx) updates.context = ctx.value.trim();
    if (del) updates.deliverables = del.value.trim();
    if (Object.keys(updates).length) Store.updateTask(_taskId, updates);
  }

  /* ── Helpers ── */
  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _fmtDate(d) {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return d; }
  }
  function _fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function _priorityBg(p) { return { high: 'var(--pink-50)', medium: 'var(--pink-50)', low: 'var(--gray-100)' }[p] || 'var(--gray-100)'; }
  function _priorityColor(p) { return { high: 'var(--pink-600)', medium: 'var(--pink-500)', low: 'var(--text-muted)' }[p] || 'var(--text)'; }
  function _priorityIcon(p) { return { high: '●', medium: '●', low: '●' }[p] || ''; }
  function _fileIcon(type) {
    if (!type) return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📕';
    if (type.includes('video')) return '🎬';
    if (type.includes('zip') || type.includes('rar')) return '📦';
    return '📄';
  }

  return { render, setTaskId, handleFileUpload, removeFile, advanceTask, autosave };
})();
