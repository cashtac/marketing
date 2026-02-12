/* ─── Shift Feedback Page ─── */
const FeedbackPage = (() => {
  const FEEDBACK_KEY = 'ims_shift_feedback';

  function _getFeedback() {
    try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY)) || []; }
    catch { return []; }
  }
  function _saveFeedback(data) { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(data)); }

  function render() {
    const canSubmit = Store.Permissions.can('submit_feedback');
    const canView = Store.Permissions.can('view_feedback');
    const feedback = _getFeedback();
    const locations = Store.getLocations();

    return `
      <div class="page active" id="page-feedback">
        <h1 class="page-title">Shift Feedback</h1>
        <p class="page-subtitle">End-of-shift ratings and comments</p>

        ${canSubmit ? `
        <div class="card" style="margin-bottom:16px">
          <div class="section-header"><span class="section-title">Submit Feedback</span></div>

          <div class="form-group">
            <label class="form-label">Location</label>
            <select class="form-select" id="fb-location">
              ${locations.map(l => `<option value="${l.id}">${_esc(l.name)}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Shift Rating</label>
            <div id="fb-stars" style="display:flex;gap:8px;font-size:1.8rem;cursor:pointer">
              ${[1,2,3,4,5].map(n => `<span onclick="FeedbackPage.setRating(${n})" data-star="${n}" style="opacity:0.3;transition:opacity 0.15s">⭐</span>`).join('')}
            </div>
            <input type="hidden" id="fb-rating" value="0" />
          </div>

          <div class="form-group">
            <label class="form-label">Comments (optional)</label>
            <textarea class="form-input" id="fb-comment" rows="3" placeholder="How was your shift?"></textarea>
          </div>

          <button class="btn btn-primary btn-block" onclick="FeedbackPage.submit()">Submit Feedback</button>
        </div>` : ''}

        ${canView ? `
        <div class="card">
          <div class="section-header"><span class="section-title">Recent Feedback (${feedback.length})</span></div>
          ${feedback.length === 0 ? '<p style="color:var(--text-secondary);font-size:0.85rem;padding:8px 0">No feedback submitted yet.</p>' :
            feedback.slice().reverse().slice(0, 20).map(f => `
              <div style="padding:12px 0;border-bottom:1px solid var(--border, #e5e7eb)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <span style="font-weight:600;font-size:0.85rem">${_esc(f.user_name)}</span>
                  <span style="font-size:0.65rem;color:var(--text-secondary)">${_timeAgo(f.timestamp)}</span>
                </div>
                <div style="font-size:0.8rem;margin-bottom:4px">
                  ${'⭐'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}
                  <span style="color:var(--text-secondary);margin-left:8px;font-size:0.7rem">${_esc(f.location_name)}</span>
                </div>
                ${f.comment ? `<p style="font-size:0.8rem;color:var(--text-secondary);margin:0">${_esc(f.comment)}</p>` : ''}
              </div>
            `).join('')}
        </div>` : ''}
      </div>
    `;
  }

  let _currentRating = 0;

  function setRating(n) {
    _currentRating = n;
    const input = document.getElementById('fb-rating');
    if (input) input.value = n;
    document.querySelectorAll('#fb-stars span').forEach(s => {
      s.style.opacity = parseInt(s.dataset.star) <= n ? '1' : '0.3';
    });
  }

  function submit() {
    const rating = _currentRating;
    if (rating < 1 || rating > 5) return;
    const locationEl = document.getElementById('fb-location');
    const commentEl = document.getElementById('fb-comment');
    const location_id = locationEl ? locationEl.value : '';
    const locations = Store.getLocations();
    const loc = locations.find(l => l.id === location_id);
    const settings = Store.getSettings();

    const entry = {
      id: 'fb_' + Date.now(),
      user_id: settings.username || 'unknown',
      user_name: settings.name || 'Unknown',
      location_id,
      location_name: loc ? loc.name : 'Unknown',
      rating,
      comment: commentEl ? commentEl.value.trim() : '',
      timestamp: new Date().toISOString(),
    };

    const fb = _getFeedback();
    fb.push(entry);
    _saveFeedback(fb);
    _currentRating = 0;

    Store.addActivity(`Shift feedback submitted: ${rating}⭐ at ${entry.location_name}`);
    if (typeof NotificationsPage !== 'undefined') {
      NotificationsPage.addNotification({
        type: 'feedback',
        title: 'Shift Feedback Submitted',
        body: `${settings.name} rated ${rating}⭐ at ${entry.location_name}`,
        link: '#feedback',
      });
    }
    App.refresh();
  }

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return { render, setRating, submit };
})();
