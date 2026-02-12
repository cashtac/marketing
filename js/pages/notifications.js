/* ─── Notifications Page ─── */
const NotificationsPage = (() => {
  const NOTIF_KEY = 'ims_notifications';

  function _getAll() {
    try { return JSON.parse(localStorage.getItem(NOTIF_KEY)) || []; }
    catch { return []; }
  }
  function _save(data) { localStorage.setItem(NOTIF_KEY, JSON.stringify(data)); }

  /** Add a notification programmatically */
  function addNotification({ type, title, body, link, for_roles }) {
    const all = _getAll();
    all.push({
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: type || 'info',
      title,
      body,
      link: link || '#dashboard',
      for_roles: for_roles || null,
      read: false,
      timestamp: new Date().toISOString(),
    });
    _save(all);
  }

  /** Get unread count for badge */
  function unreadCount() {
    const role = Store.getActiveRole();
    return _getAll().filter(n => {
      if (n.read) return false;
      if (n.for_roles && !n.for_roles.includes(role)) return false;
      return true;
    }).length;
  }

  function render() {
    const role = Store.getActiveRole();
    const all = _getAll()
      .filter(n => !n.for_roles || n.for_roles.includes(role))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Seed some demo notifications if empty
    if (all.length === 0) {
      _seedDemoNotifications();
      return render(); // re-render with seeded data
    }

    return `
      <div class="page active" id="page-notifications">
        <h1 class="page-title">Notifications</h1>
        <p class="page-subtitle">${all.filter(n => !n.read).length} unread</p>

        ${all.length === 0 ? `
          <div class="card" style="text-align:center;padding:32px">
            <div style="font-size:2.5rem;margin-bottom:8px">🔔</div>
            <p style="color:var(--text-secondary)">No notifications yet</p>
          </div>` :
          all.map(n => `
            <div class="card" style="margin-bottom:8px;padding:14px;cursor:pointer;opacity:${n.read ? 0.6 : 1};border-left:3px solid ${_typeColor(n.type)}" onclick="NotificationsPage.open('${n.id}')">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                    <span style="font-size:1rem">${_typeIcon(n.type)}</span>
                    <span style="font-weight:600;font-size:0.85rem">${_esc(n.title)}</span>
                    ${!n.read ? '<span style="width:6px;height:6px;border-radius:50%;background:var(--primary);display:inline-block;margin-left:4px"></span>' : ''}
                  </div>
                  <p style="font-size:0.8rem;color:var(--text-secondary);margin:0">${_esc(n.body)}</p>
                </div>
                <span style="font-size:0.65rem;color:var(--text-secondary);white-space:nowrap;margin-left:8px">${_timeAgo(n.timestamp)}</span>
              </div>
            </div>
          `).join('')}

        ${all.length > 0 ? `
        <button class="btn btn-secondary btn-block" style="margin-top:12px" onclick="NotificationsPage.markAllRead()">Mark All Read</button>` : ''}
      </div>
    `;
  }

  function open(id) {
    const all = _getAll();
    const n = all.find(x => x.id === id);
    if (!n) return;
    n.read = true;
    _save(all);
    if (n.link && n.link.startsWith('#')) {
      location.hash = n.link.replace('#', '');
    }
    App.refresh();
  }

  function markAllRead() {
    const all = _getAll();
    all.forEach(n => n.read = true);
    _save(all);
    App.refresh();
  }

  function _seedDemoNotifications() {
    const demos = [
      { type: 'event', title: 'Event Updated', body: 'Heart to Table Valentine cookie launch details have been finalized.', link: '#campaigns' },
      { type: 'asset', title: 'Asset Ready', body: 'Valentine\'s Day poster 22×28 has been marked as ready by Anna Simakova.', link: '#assets' },
      { type: 'approval', title: 'Approval Requested', body: 'Katie Kennedy submitted Hot Honey Sandwich poster for approval.', link: '#approvals' },
      { type: 'comment', title: 'New Comment', body: 'Sofya Vetrova commented on the Monster Energy campaign.', link: '#campaigns' },
      { type: 'feedback', title: 'Shift Feedback', body: 'New shift feedback submitted at Southside Dining Hall.', link: '#feedback' },
    ];
    demos.forEach(d => addNotification(d));
  }

  function _typeIcon(type) {
    return { event: '📅', asset: '📁', approval: '⏱️', comment: '💬', feedback: '⭐', escalation: '🚨', info: '🔔' }[type] || '🔔';
  }
  function _typeColor(type) {
    return { event: '#6c5ce7', asset: '#00b894', approval: '#fdcb6e', comment: '#0984e3', feedback: '#e17055', escalation: '#d63031', info: '#636e72' }[type] || '#636e72';
  }

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return { render, addNotification, unreadCount, open, markAllRead };
})();
