/* ─── Dashboard Page — "What am I responsible for right now?" ─── */
const DashboardPage = (() => {
  function render() {
    const settings = Store.getSettings();
    const role = settings.role;
    const allTasks = Store.getTasks();
    const tasks = Store.Permissions.filterTasks(allTasks);
    const approvals = Store.Permissions.filterApprovals(Store.getApprovals());

    // Only active responsibilities — not published
    const activeTasks = tasks.filter(t => t.status !== 'published');
    const pendingApprovals = approvals.filter(a => a.status === 'pending');

    // Sort: high priority first, then by due date
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    activeTasks.sort((a, b) => {
      const pDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      if (pDiff !== 0) return pDiff;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

    const greetHour = new Date().getHours();
    const greet = greetHour < 12 ? 'Good morning' : greetHour < 18 ? 'Good afternoon' : 'Good evening';

    const totalResponsibilities = activeTasks.length + (Store.Permissions.canAccessPage('approvals') ? pendingApprovals.length : 0);

    return `
      <div class="page active" id="page-dashboard">
        <p class="page-subtitle" style="margin-bottom:2px">${greet},</p>
        <h1 class="page-title" style="margin-bottom:6px">${_esc(settings.name)}</h1>

        <div class="card card-pink" style="margin-bottom:20px;padding:16px 18px;display:flex;align-items:center;gap:14px">
          <div style="font-size:1.8rem;line-height:1">${totalResponsibilities === 0 ? '✨' : '📌'}</div>
          <div>
            <div style="font-size:0.95rem;font-weight:600;color:var(--text)">
              ${totalResponsibilities === 0 ? 'You\'re all clear' : `${totalResponsibilities} thing${totalResponsibilities !== 1 ? 's' : ''} need${totalResponsibilities === 1 ? 's' : ''} your attention`}
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${_roleHint(role)}</div>
          </div>
        </div>

        ${activeTasks.length > 0 ? `
          <div class="section-header">
            <span class="section-title">Your Tasks</span>
            <span class="section-count">${activeTasks.length}</span>
          </div>
          ${activeTasks.map(t => _renderTaskCard(t)).join('')}
        ` : ''}

        ${Store.Permissions.canAccessPage('approvals') && pendingApprovals.length > 0 ? `
          <div class="section-header" style="margin-top:${activeTasks.length ? '8' : '0'}px">
            <span class="section-title">Awaiting Your Review</span>
            <span class="section-count">${pendingApprovals.length}</span>
          </div>
          ${pendingApprovals.map(a => _renderApprovalCard(a)).join('')}
        ` : ''}

        ${totalResponsibilities === 0 ? `
          <div class="empty-state" style="padding:50px 20px">
            <div class="empty-state-icon">🎉</div>
            <div class="empty-state-text">Nothing pending right now</div>
            <p style="font-size:0.78rem;color:var(--text-light);margin-top:6px">All your responsibilities are completed</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  function _renderTaskCard(t) {
    const chipClass = { draft: 'chip-todo', progress: 'chip-progress', review: 'chip-review', approved: 'chip-done', published: 'chip-done' }[t.status];
    const statusLabel = { draft: 'Draft', progress: 'In Progress', review: 'Review', approved: 'Approved', published: 'Published' }[t.status];
    const nextSt = Store.nextStatus(t.status);
    const nextLabel = { draft: 'Start Work', progress: 'Submit for Review', review: 'Approve', approved: 'Publish', published: 'Published' }[nextSt];
    const canAdvance = nextSt !== t.status && Store.Permissions.can('advance_task');
    const isOverdue = t.dueDate && new Date(t.dueDate + 'T23:59:59') < new Date();

    return `
      <div class="card priority-${t.priority}" style="padding:16px 18px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px">
          <span class="task-title" style="flex:1">${_esc(t.title)}</span>
          <span class="chip ${chipClass}" style="flex-shrink:0">
            <span class="chip-dot"></span>${statusLabel}
          </span>
        </div>

        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px">
          <span class="chip" style="background:var(--pink-50);color:var(--pink-600);font-size:0.65rem">
            ${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
          </span>
          ${t.dueDate ? `
            <span style="font-size:0.72rem;color:${isOverdue ? 'var(--danger)' : 'var(--text-muted)'};display:flex;align-items:center;gap:4px;font-weight:${isOverdue ? '600' : '400'}">
              ${isOverdue ? '⚠️' : '📅'} ${_fmtDate(t.dueDate)}${isOverdue ? ' — overdue' : ''}
            </span>
          ` : ''}
        </div>

        ${canAdvance ? `
          <button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="event.stopPropagation(); TasksPage.advance('${t.id}'); App.navigate('dashboard')">
            ${nextLabel} →
          </button>
        ` : ''}
      </div>
    `;
  }

  function _renderApprovalCard(a) {
    const canApprove = Store.Permissions.can('approve');
    return `
      <div class="card" style="padding:16px 18px" onclick="App.navigate('approvals')">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:4px">
          <span class="task-title" style="flex:1">${_esc(a.title)}</span>
          <span class="chip chip-review" style="flex-shrink:0"><span class="chip-dot"></span>Pending</span>
        </div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">
          Submitted by ${_esc(a.submittedBy)} · ${_timeAgo(a.createdAt)}
        </div>
        ${canApprove ? `
          <div style="display:flex;gap:8px">
            <button class="btn btn-success btn-sm" onclick="event.stopPropagation(); ApprovalsPage.approve('${a.id}'); App.navigate('dashboard')">✓ Approve</button>
            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); ApprovalsPage.needsChanges('${a.id}'); App.navigate('dashboard')">Changes</button>
          </div>
        ` : `
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('approvals')">View Details →</button>
        `}
      </div>
    `;
  }

  function _roleHint(role) {
    return {
      'Admin': 'Full system overview',
      'Marketing Director': 'Items awaiting your approval',
      'Marketing Manager': 'Tasks and approvals to manage',
      'Graphic Designer': 'Your design assignments',
      'Social Media Manager': 'Your content responsibilities',
    }[role] || '';
  }

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _fmtDate(d) {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return d; }
  }
  function _timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return { render };
})();
