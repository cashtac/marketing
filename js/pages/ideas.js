/* ─── Ideas Page — Swipe-to-Approve for Marketing Director ─── */
const IdeasPage = (() => {

  /* ══ Seed ideas if empty ══ */
  function _seedIfNeeded() {
    const ideas = Store.listIdeas();
    if (ideas.length > 0) return;
    const seeds = [
      { title: 'Valentine\'s Day Social Campaign', desc: 'Heart-themed Instagram reels + TikTok series showcasing seasonal menu items. Target: 50K impressions.', category: 'campaign', priority: 'high' },
      { title: 'Student Ambassador Program', desc: 'Recruit 10 student brand reps from each dining hall to create organic UGC content and boost peer engagement.', category: 'content', priority: 'high' },
      { title: 'Farm-to-Table Story Series', desc: 'Weekly video series following local farm suppliers, highlighting sustainability and ingredient freshness.', category: 'content', priority: 'medium' },
      { title: 'Late Night Menu Pop-Up', desc: 'Limited-run midnight snack menu at Southside — survey students for demand, run 2-week pilot.', category: 'event', priority: 'medium' },
      { title: 'Dining Hall Mural Project', desc: 'Commission local art students to paint murals in Ike\'s entrance. Document process for social content.', category: 'event', priority: 'low' },
      { title: 'Nutrition Challenge Month', desc: 'Gamified 30-day nutrition challenge with QR check-ins, leaderboard, and prize incentives.', category: 'campaign', priority: 'high' },
    ];
    seeds.forEach(s => Store.addIdea(s));
  }

  /* ══ Render ══ */
  function render() {
    _seedIfNeeded();
    const ideas = Store.listIdeas();
    const pending = ideas.filter(i => i.status === 'pending');
    const decided = ideas.filter(i => i.status !== 'pending').sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0));

    return `
      <div class="app-content" style="padding:20px 16px 100px;">
        <h1 class="page-title" style="font-size:1.6rem;margin-bottom:4px;">Ideas</h1>
        <p class="page-subtitle" style="color:var(--text-muted);margin-bottom:24px;">Swipe right to approve · left to reject</p>

        ${pending.length > 0 ? _renderSwipeStack(pending) : `
          <div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
            <div style="font-size:2.4rem;margin-bottom:12px;">✨</div>
            <div style="font-weight:600;font-size:1rem;margin-bottom:6px;">All caught up!</div>
            <div style="font-size:0.82rem;">No pending ideas to review</div>
          </div>
        `}

        ${decided.length > 0 ? `
          <div style="margin-top:32px;">
            <div class="section-header">
              <span class="section-title">History</span>
              <span class="section-count">${decided.length}</span>
            </div>
            ${decided.map(i => _renderHistoryItem(i)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /* ══ Swipe Stack ══ */
  function _renderSwipeStack(pending) {
    const top = pending[0];
    const remaining = pending.length - 1;
    const catColors = { campaign: '#2F6BFF', content: '#3DDC97', event: '#F5D76E' };
    const prioColors = { high: '#FF4D4F', medium: '#F0B429', low: '#8FA4C3' };

    return `
      <div id="idea-stack" style="position:relative;min-height:320px;margin-bottom:16px;perspective:800px;">
        <!-- Background cards (peek) -->
        ${remaining >= 2 ? `<div style="position:absolute;top:12px;left:12px;right:12px;height:280px;background:var(--card-bg);border-radius:18px;border:1px solid var(--border);opacity:0.3;transform:scale(0.92);"></div>` : ''}
        ${remaining >= 1 ? `<div style="position:absolute;top:6px;left:6px;right:6px;height:290px;background:var(--card-bg);border-radius:18px;border:1px solid var(--border);opacity:0.5;transform:scale(0.96);"></div>` : ''}

        <!-- Active card -->
        <div id="idea-card" data-id="${top.id}"
             style="position:relative;background:var(--card-bg);border-radius:18px;padding:28px 24px;
                    border:1px solid var(--border);box-shadow:var(--shadow-lg);cursor:grab;
                    touch-action:pan-y;user-select:none;transition:none;z-index:2;"
             ontouchstart="IdeasPage.onStart(event)"
             ontouchmove="IdeasPage.onMove(event)"
             ontouchend="IdeasPage.onEnd(event)"
             onmousedown="IdeasPage.onStart(event)">

          <!-- Swipe indicators -->
          <div id="idea-approve-glow" style="position:absolute;inset:0;border-radius:18px;border:3px solid #3DDC97;opacity:0;transition:opacity 0.15s ease;pointer-events:none;"></div>
          <div id="idea-reject-glow" style="position:absolute;inset:0;border-radius:18px;border:3px solid #FF4D4F;opacity:0;transition:opacity 0.15s ease;pointer-events:none;"></div>

          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <span style="display:inline-block;padding:3px 10px;border-radius:9999px;font-size:0.68rem;font-weight:600;
                         background:${catColors[top.category] || '#8FA4C3'}22;color:${catColors[top.category] || '#8FA4C3'};
                         text-transform:uppercase;letter-spacing:0.06em;">${top.category}</span>
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${prioColors[top.priority] || '#8FA4C3'};"></span>
            <span style="font-size:0.7rem;color:var(--text-muted);text-transform:capitalize;">${top.priority}</span>
          </div>

          <h2 style="font-size:1.15rem;font-weight:700;margin-bottom:10px;letter-spacing:-0.01em;line-height:1.35;">${_esc(top.title)}</h2>
          <p style="font-size:0.88rem;color:var(--text-muted);line-height:1.6;">${_esc(top.desc)}</p>

          <div style="display:flex;justify-content:space-between;margin-top:24px;font-size:0.72rem;color:var(--text-light);">
            <span>← Reject</span>
            <span>${pending.length} remaining</span>
            <span>Approve →</span>
          </div>
        </div>
      </div>

      <!-- Action buttons (fallback for non-swipe) -->
      <div style="display:flex;gap:12px;justify-content:center;">
        <button class="btn btn-danger btn-sm" onclick="IdeasPage.decide('${top.id}','rejected')" style="min-width:120px;border-radius:14px;">
          ✕ Reject
        </button>
        <button class="btn btn-success btn-sm" onclick="IdeasPage.decide('${top.id}','approved')" style="min-width:120px;border-radius:14px;background:#3DDC97;color:#0A0A0A;">
          ✓ Approve
        </button>
      </div>
    `;
  }

  /* ══ History item ══ */
  function _renderHistoryItem(idea) {
    const isApproved = idea.status === 'approved';
    const icon = isApproved ? '✓' : '✕';
    const color = isApproved ? '#3DDC97' : '#FF4D4F';
    const label = isApproved ? 'Approved → Task' : 'Rejected';
    const time = idea.decidedAt ? _timeAgo(idea.decidedAt) : '';

    return `
      <div class="card" style="display:flex;align-items:center;gap:14px;padding:14px 16px;">
        <div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;
                    background:${color}18;color:${color};font-weight:700;font-size:0.85rem;flex-shrink:0;">${icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(idea.title)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);display:flex;gap:8px;align-items:center;">
            <span style="color:${color};font-weight:600;">${label}</span>
            ${time ? `<span>· ${time}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /* ══ Swipe gesture handling ══ */
  let _startX = 0, _startY = 0, _currentX = 0, _isDragging = false, _isMouseDown = false;
  const THRESHOLD = 100; // px to trigger action

  function onStart(e) {
    const card = document.getElementById('idea-card');
    if (!card) return;
    _isDragging = true;
    card.style.transition = 'none';

    if (e.type === 'touchstart') {
      _startX = e.touches[0].clientX;
      _startY = e.touches[0].clientY;
    } else {
      _isMouseDown = true;
      _startX = e.clientX;
      _startY = e.clientY;
      document.addEventListener('mousemove', _onMouseMove);
      document.addEventListener('mouseup', _onMouseUp);
      e.preventDefault();
    }
  }

  function onMove(e) {
    if (!_isDragging) return;
    const card = document.getElementById('idea-card');
    if (!card) return;

    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    _currentX = clientX - _startX;
    const rotation = _currentX * 0.08;
    const opacity = Math.min(Math.abs(_currentX) / THRESHOLD, 1);

    card.style.transform = `translateX(${_currentX}px) rotate(${rotation}deg)`;

    const approveGlow = document.getElementById('idea-approve-glow');
    const rejectGlow = document.getElementById('idea-reject-glow');
    if (approveGlow) approveGlow.style.opacity = _currentX > 20 ? opacity : 0;
    if (rejectGlow) rejectGlow.style.opacity = _currentX < -20 ? opacity : 0;
  }

  function onEnd(e) {
    if (!_isDragging) return;
    _isDragging = false;
    _isMouseDown = false;

    const card = document.getElementById('idea-card');
    if (!card) return;
    const id = card.dataset.id;

    if (Math.abs(_currentX) >= THRESHOLD) {
      // Fly out
      const dir = _currentX > 0 ? 1 : -1;
      card.style.transition = 'transform 0.35s ease, opacity 0.35s ease';
      card.style.transform = `translateX(${dir * 500}px) rotate(${dir * 25}deg)`;
      card.style.opacity = '0';

      const status = dir > 0 ? 'approved' : 'rejected';
      setTimeout(() => decide(id, status), 350);
    } else {
      // Snap back
      card.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)';
      card.style.transform = 'translateX(0) rotate(0)';
      const approveGlow = document.getElementById('idea-approve-glow');
      const rejectGlow = document.getElementById('idea-reject-glow');
      if (approveGlow) approveGlow.style.opacity = 0;
      if (rejectGlow) rejectGlow.style.opacity = 0;
    }
    _currentX = 0;
  }

  function _onMouseMove(e) { if (_isMouseDown) onMove(e); }
  function _onMouseUp(e) {
    onEnd(e);
    document.removeEventListener('mousemove', _onMouseMove);
    document.removeEventListener('mouseup', _onMouseUp);
  }

  /* ══ Decide (approve / reject) ══ */
  function decide(id, status) {
    Store.updateIdea(id, { status, decidedAt: new Date().toISOString() });

    // On approve: create a draft task from the idea
    if (status === 'approved') {
      const idea = Store.listIdeas().find(i => i.id === id);
      if (idea) {
        const settings = Store.getSettings();
        Store.addTask({
          title: idea.title,
          description: idea.desc || '',
          assignee: settings.name || 'Unassigned',
          priority: idea.priority || 'medium',
          status: 'draft',
          category: idea.category || 'general',
          dueDate: _futureDate(14),
        });
      }
    }

    // Re-render
    const container = document.getElementById('app-content');
    if (container) container.innerHTML = render();
  }

  /* ══ Helpers ══ */
  function _esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function _futureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function _timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.floor(hrs / 24) + 'd ago';
  }

  return { render, decide, onStart, onMove, onEnd };
})();
