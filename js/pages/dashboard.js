/* ─── Dashboard Page — Smart home: insights, actions, overview ─── */
const DashboardPage = (() => {

  function render() {
    const settings = Store.getSettings();
    const role = settings.role;
    const allTasks = Store.getTasks();
    const tasks = Store.Permissions.filterTasks(allTasks);
    const approvals = Store.Permissions.filterApprovals(Store.getApprovals());
    const campaigns = Store.getCampaigns();
    const locations = Store.getLocations();

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const threeDays = new Date(now); threeDays.setDate(threeDays.getDate() + 3);
    const threeDaysStr = threeDays.toISOString().slice(0, 10);
    const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    // Overdue tasks
    const overdueTasks = tasks.filter(t =>
      t.status !== 'published' && t.dueDate && new Date(t.dueDate + 'T23:59:59') < now
    );

    // Pending approvals
    const pendingApprovals = approvals.filter(a => a.status === 'pending');

    // Tomorrow's events (kept for attention banner count)
    const tomorrowEvents = campaigns.filter(c =>
      c.type === 'event' && c.start_date && c.start_date === tomorrowStr
    );

    // Upcoming events (next 7 days) via Store helper
    const upcomingEvents = Store.getUpcomingEvents(7);

    // Expiring placements (removal within 3 days)
    const expiringPlacements = [];
    locations.forEach(loc => {
      (loc.zones || []).forEach(zone => {
        (zone.placements || []).forEach(pl => {
          if (pl.removal_date && pl.removal_date >= todayStr && pl.removal_date <= threeDaysStr && pl.status === 'active') {
            expiringPlacements.push({ ...pl, locationName: loc.name, zoneName: zone.name });
          }
        });
      });
    });

    // Week overview
    const activeTasks = tasks.filter(t => t.status !== 'published');
    const tasksDueThisWeek = tasks.filter(t =>
      t.status !== 'published' && t.dueDate && t.dueDate >= todayStr && t.dueDate <= weekEndStr
    );
    const eventsThisWeek = campaigns.filter(c =>
      c.type === 'event' && c.start_date && c.start_date >= todayStr && c.start_date <= weekEndStr
    );

    const greetHour = now.getHours();
    const greet = greetHour < 12 ? 'Good morning' : greetHour < 18 ? 'Good afternoon' : 'Good evening';

    const totalUrgent = overdueTasks.length + pendingApprovals.length + expiringPlacements.length;

    return `
      <div class="page active" id="page-dashboard">
        <p class="page-subtitle" style="margin-bottom:2px">${greet},</p>
        <h1 class="page-title" style="margin-bottom:8px">${_esc(settings.name)}</h1>

        <!-- Attention banner -->
        <div class="card ${totalUrgent > 0 ? 'card-pink' : ''}" style="margin-bottom:16px;padding:14px 16px;display:flex;align-items:center;gap:12px">
          <div style="font-size:1.6rem;line-height:1">${totalUrgent === 0 ? '✨' : '📌'}</div>
          <div>
            <div style="font-size:0.9rem;font-weight:600;color:var(--text)">
              ${totalUrgent === 0 ? "You're all clear" : `${totalUrgent} urgent item${totalUrgent !== 1 ? 's' : ''}`}
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:1px">${_roleHint(role)}</div>
          </div>
        </div>

        ${_renderOverdueTasks(overdueTasks)}
        ${_renderExpiringPlacements(expiringPlacements)}
        ${Store.Permissions.canAccessPage('approvals') ? _renderPendingApprovals(pendingApprovals) : ''}
        ${_renderUpcomingEvents(upcomingEvents)}
        ${_renderWeekOverview(tasksDueThisWeek, eventsThisWeek, expiringPlacements, activeTasks)}
      </div>
    `;
  }

  /* ── Overdue Tasks ── */
  function _renderOverdueTasks(tasks) {
    if (!tasks.length) return '';
    return `
      <div class="section-header">
        <span class="section-title">⚠️ Overdue Tasks</span>
        <span class="section-count" style="background:var(--danger-bg);color:var(--danger)">${tasks.length}</span>
      </div>
      ${tasks.map(t => `
        <div class="card priority-${t.priority}" style="padding:14px 16px;cursor:pointer" onclick="App.navigate('task-${t.id}')">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px">
            <span class="task-title" style="flex:1;font-size:0.88rem">${_esc(t.title)}</span>
            <span class="chip chip-todo" style="flex-shrink:0;font-size:0.6rem"><span class="chip-dot"></span>${_statusLabel(t.status)}</span>
          </div>
          <div style="font-size:0.72rem;color:var(--danger);font-weight:600">
            ⚠️ Due ${_fmtDate(t.dueDate)} — overdue
          </div>
        </div>
      `).join('')}
    `;
  }

  /* ── Expiring Placements ── */
  function _renderExpiringPlacements(pls) {
    if (!pls.length) return '';
    return `
      <div class="section-header" style="margin-top:8px">
        <span class="section-title">🕐 Expiring Soon</span>
        <span class="section-count" style="background:var(--warning-bg);color:#B8860B">${pls.length}</span>
      </div>
      ${pls.map(pl => `
        <div class="card" style="padding:14px 16px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px">
            <span style="font-weight:600;font-size:0.88rem;flex:1">${_esc(pl.name)}</span>
            <span style="font-size:0.65rem;color:var(--danger);font-weight:600;white-space:nowrap">Remove by ${_fmtDate(pl.removal_date)}</span>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted)">${_esc(pl.locationName)} · ${_esc(pl.zoneName)}</div>
        </div>
      `).join('')}
    `;
  }

  /* ── Pending Approvals ── */
  function _renderPendingApprovals(apps) {
    if (!apps.length) return '';
    return `
      <div class="section-header" style="margin-top:8px">
        <span class="section-title">⏱️ Pending Approvals</span>
        <span class="section-count">${apps.length}</span>
      </div>
      ${apps.map(a => `
        <div class="card" style="padding:14px 16px;cursor:pointer" onclick="App.navigate('approvals')">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px">
            <span class="task-title" style="flex:1;font-size:0.88rem">${_esc(a.title)}</span>
            <span class="chip chip-review" style="flex-shrink:0;font-size:0.6rem"><span class="chip-dot"></span>Pending</span>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted)">
            Submitted by ${_esc(a.submittedBy)} · ${_timeAgo(a.createdAt)}
            ${a.approval_stage ? ` · Stage: ${_stageLabel(a.approval_stage)}` : ''}
          </div>
        </div>
      `).join('')}
    `;
  }

  /* ── Upcoming Events ── */
  function _renderUpcomingEvents(events) {
    if (!events.length) return '';
    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    function _dayLabel(dateStr) {
      if (dateStr === todayStr) return '📍 Today';
      if (dateStr === tomorrowStr) return '📅 Tomorrow';
      try {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      } catch { return dateStr; }
    }

    return `
      <div class="section-header" style="margin-top:8px">
        <span class="section-title">📅 Upcoming Events</span>
        <span class="section-count">${events.length}</span>
      </div>
      ${events.map(c => `
        <div class="card" style="padding:14px 16px;cursor:pointer" onclick="App.navigate('campaign-${c.id}')">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:1.1rem">🎉</span>
            <span style="font-weight:600;font-size:0.88rem;flex:1">${_esc(c.name)}</span>
            <span style="font-size:0.65rem;font-weight:600;color:var(--pink-500);white-space:nowrap">${_dayLabel(c.start_date)}</span>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted)">${_esc(c.description || '').slice(0, 80)}</div>
        </div>
      `).join('')}
    `;
  }

  /* ── This Week Overview ── */
  function _renderWeekOverview(tasksDue, events, expiring, allActive) {
    return `
      <div class="section-header" style="margin-top:8px">
        <span class="section-title">📊 This Week</span>
      </div>
      <div class="card" style="padding:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="text-align:center;padding:10px 0;background:var(--gray-50);border-radius:var(--radius-sm)">
            <div style="font-size:1.4rem;font-weight:700;color:var(--text)">${allActive.length}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">Active Tasks</div>
          </div>
          <div style="text-align:center;padding:10px 0;background:var(--gray-50);border-radius:var(--radius-sm)">
            <div style="font-size:1.4rem;font-weight:700;color:var(--pink-500)">${tasksDue.length}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">Due This Week</div>
          </div>
          <div style="text-align:center;padding:10px 0;background:var(--gray-50);border-radius:var(--radius-sm)">
            <div style="font-size:1.4rem;font-weight:700;color:var(--info)">${events.length}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">Events</div>
          </div>
          <div style="text-align:center;padding:10px 0;background:var(--gray-50);border-radius:var(--radius-sm)">
            <div style="font-size:1.4rem;font-weight:700;color:${expiring.length > 0 ? 'var(--warning)' : 'var(--success)'}">${expiring.length}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">Expiring</div>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Helpers ── */
  function _statusLabel(s) {
    return { draft: 'Draft', progress: 'In Progress', review: 'Review', approved: 'Approved', published: 'Published' }[s] || s;
  }

  function _stageLabel(s) {
    return { manager_review: 'Manager Review', admin_review: 'Admin Review', director_review: 'Director Review', approved: 'Approved' }[s] || s;
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
