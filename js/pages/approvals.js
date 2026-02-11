/* ─── Approvals Page — Preview-first, fast decisions ─── */
const ApprovalsPage = (() => {
  let _filter = 'pending';

  function render() {
    const allApprovals = Store.getApprovals();
    const approvals = Store.Permissions.filterApprovals(allApprovals);
    const canApprove = Store.Permissions.can('approve');
    const canComment = Store.Permissions.can('comment_approval');
    const filtered = _filter === 'all' ? approvals : approvals.filter(a => a.status === _filter);
    const pendingCount = approvals.filter(a => a.status === 'pending').length;

    return `
      <div class="page active" id="page-approvals">
        <h1 class="page-title">Approvals</h1>
        <p class="page-subtitle">${canApprove ? `${pendingCount} item${pendingCount !== 1 ? 's' : ''} waiting for your decision` : 'Track your submissions'}</p>

        <div class="filter-bar">
          <button class="filter-chip ${_filter === 'pending' ? 'active' : ''}" onclick="ApprovalsPage.setFilter('pending')">Pending${pendingCount ? ` (${pendingCount})` : ''}</button>
          <button class="filter-chip ${_filter === 'approved' ? 'active' : ''}" onclick="ApprovalsPage.setFilter('approved')">Approved</button>
          <button class="filter-chip ${_filter === 'changes' ? 'active' : ''}" onclick="ApprovalsPage.setFilter('changes')">Needs Changes</button>
          <button class="filter-chip ${_filter === 'all' ? 'active' : ''}" onclick="ApprovalsPage.setFilter('all')">All</button>
        </div>

        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">${_filter === 'pending' ? '✅' : '📋'}</div>
            <div class="empty-state-text">${_filter === 'pending' ? 'No items awaiting review' : `No ${_filter} items`}</div>
          </div>
        ` : ''}

        ${filtered.map(a => _renderCard(a, canApprove, canComment)).join('')}
      </div>
    `;
  }

  function _renderCard(a, canApprove, canComment) {
    const statusBadge = {
      pending:  '<span class="chip chip-review"><span class="chip-dot"></span>Pending</span>',
      approved: '<span class="chip chip-done"><span class="chip-dot"></span>Approved</span>',
      changes:  '<span class="chip chip-todo"><span class="chip-dot"></span>Needs Changes</span>',
    }[a.status] || '';

    const previewIcon = {
      image:    '🖼️',
      video:    '🎬',
      document: '📄',
    }[a.previewType] || '📎';

    const previewLabel = {
      image:    'Image',
      video:    'Video',
      document: 'Document',
    }[a.previewType] || 'File';

    const comments = a.comments || [];
    const role = Store.getSettings().role;

    return `
      <div class="card approval-preview-card">
        <!-- Preview area -->
        <div class="apv-preview" onclick="${a.previewUrl ? `ApprovalsPage.openPreview('${a.id}')` : ''}">
          ${a.previewUrl ? `
            <img src="${a.previewUrl}" alt="${_esc(a.title)}" class="apv-preview-img" />
          ` : `
            <div class="apv-preview-placeholder">
              <div class="apv-preview-icon">${previewIcon}</div>
              <div class="apv-preview-type">${previewLabel}</div>
            </div>
          `}
        </div>

        <!-- Content -->
        <div class="apv-content">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
            <h3 class="apv-title">${_esc(a.title)}</h3>
            ${statusBadge}
          </div>

          <p class="apv-desc">${_esc(a.description || '')}</p>

          ${a.context ? `
            <div class="apv-context">
              <span class="apv-context-label">Context:</span> ${_esc(a.context)}
            </div>
          ` : ''}

          <div class="apv-meta">
            <div class="avatar avatar-sm">${_initials(a.submittedBy)}</div>
            <span>${_esc(a.submittedBy)}</span>
            <span class="apv-meta-dot">·</span>
            <span>${_timeAgo(a.createdAt)}</span>
          </div>

          <!-- Structured Comments Log -->
          ${comments.length > 0 ? `
            <div class="rv-comments">
              <div class="rv-comments-label">Review Notes</div>
              ${comments.map(c => `
                <div class="rv-comment ${c.type === 'change_request' ? 'rv-comment-change' : c.type === 'decision' ? 'rv-comment-decision' : 'rv-comment-note'}">
                  <div class="rv-comment-header">
                    <div class="avatar avatar-xs">${_initials(c.author)}</div>
                    <span class="rv-comment-author">${_esc(c.author)}</span>
                    <span class="rv-comment-badge">${_commentBadge(c.type)}</span>
                    <span class="rv-comment-time">${_timeAgo(c.time)}</span>
                  </div>
                  <div class="rv-comment-text">${_esc(c.text)}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- Actions — only for pending items, only for approvers -->
          ${a.status === 'pending' && canApprove ? `
            <div class="apv-actions">
              <button class="btn apv-btn-approve" onclick="ApprovalsPage.openApproveModal('${a.id}')">
                ✓ Approve
              </button>
              <button class="btn apv-btn-changes" onclick="ApprovalsPage.openChangesModal('${a.id}')">
                Needs changes
              </button>
            </div>
          ` : ''}

          <!-- Inline comment (Manager) — for pending or changes items -->
          ${canComment && (a.status === 'pending' || a.status === 'changes') ? `
            <div class="rv-inline-add">
              <input class="rv-inline-input" type="text" placeholder="Add a review note…" id="rv-note-${a.id}" onkeydown="if(event.key==='Enter')ApprovalsPage.addNote('${a.id}')" />
              <button class="btn btn-sm btn-secondary" onclick="ApprovalsPage.addNote('${a.id}')">Add</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function setFilter(f) { _filter = f; App.refresh(); }

  /* ── Approve with optional decision note ── */
  function openApproveModal(id) {
    if (!Store.Permissions.can('approve')) return;
    const a = Store.getApprovals().find(x => x.id === id);
    if (!a) return;
    App.showModal('Approve: ' + a.title, `
      <div class="rv-modal">
        <p class="rv-modal-desc">You're approving <strong>${_esc(a.title)}</strong>.</p>
        <label class="rv-modal-label">Decision Note <span style="color:var(--text-light);font-weight:400">(optional)</span></label>
        <textarea id="rv-approve-note" class="rv-modal-textarea" rows="3" placeholder="e.g. Looks great, ship it!"></textarea>
        <button class="btn btn-primary btn-block" onclick="ApprovalsPage.confirmApprove('${id}')">✓ Approve</button>
      </div>
    `);
  }
  function confirmApprove(id) {
    if (!Store.Permissions.can('approve')) return;
    const note = (document.getElementById('rv-approve-note')?.value || '').trim();
    if (note) {
      Store.addApprovalComment(id, { text: note, type: 'decision', author: Store.getSettings().name, time: new Date().toISOString() });
    }
    Store.updateApproval(id, { status: 'approved' });
    Store.addActivity(`Approval approved by ${Store.getSettings().name}`);
    App.closeModal();
    App.refresh();
  }

  /* ── Needs Changes with required change notes ── */
  function openChangesModal(id) {
    if (!Store.Permissions.can('request_changes')) return;
    const a = Store.getApprovals().find(x => x.id === id);
    if (!a) return;
    App.showModal('Request Changes: ' + a.title, `
      <div class="rv-modal">
        <p class="rv-modal-desc">What needs to change in <strong>${_esc(a.title)}</strong>?</p>
        <label class="rv-modal-label">Required Changes <span style="color:var(--danger)">*</span></label>
        <textarea id="rv-changes-note" class="rv-modal-textarea" rows="4" placeholder="Be specific: what to fix, revise, or redo…" required></textarea>
        <div id="rv-changes-error" class="rv-modal-error" style="display:none">Please describe what needs to change.</div>
        <button class="btn btn-primary btn-block" style="background:var(--warning,#E8A640);border-color:var(--warning,#E8A640)" onclick="ApprovalsPage.confirmChanges('${id}')">Request Changes</button>
      </div>
    `);
  }
  function confirmChanges(id) {
    if (!Store.Permissions.can('request_changes')) return;
    const note = (document.getElementById('rv-changes-note')?.value || '').trim();
    if (!note) {
      const err = document.getElementById('rv-changes-error');
      if (err) err.style.display = 'block';
      return;
    }
    Store.addApprovalComment(id, { text: note, type: 'change_request', author: Store.getSettings().name, time: new Date().toISOString() });
    Store.updateApproval(id, { status: 'changes' });
    Store.addActivity(`Changes requested by ${Store.getSettings().name}`);
    App.closeModal();
    App.refresh();
  }

  /* ── Inline note (any commenter) ── */
  function addNote(id) {
    if (!Store.Permissions.can('comment_approval')) return;
    const input = document.getElementById('rv-note-' + id);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    Store.addApprovalComment(id, { text, type: 'note', author: Store.getSettings().name, time: new Date().toISOString() });
    App.refresh();
  }

  function openPreview(id) {
    const a = Store.getApprovals().find(x => x.id === id);
    if (!a || !a.previewUrl) return;
    App.showModal(a.title, `
      <div style="text-align:center">
        <img src="${a.previewUrl}" style="max-width:100%;border-radius:var(--radius-md)" alt="${_esc(a.title)}" />
      </div>
    `);
  }

  function _commentBadge(type) {
    if (type === 'change_request') return '<span class="rv-badge rv-badge-change">Change Request</span>';
    if (type === 'decision') return '<span class="rv-badge rv-badge-decision">Decision</span>';
    return '<span class="rv-badge rv-badge-note">Note</span>';
  }

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _initials(n) { return (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
  function _timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return { render, setFilter, openApproveModal, confirmApprove, openChangesModal, confirmChanges, addNote, openPreview };
})();
