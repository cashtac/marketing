/* ─── Campaigns Page — Physical media campaign management ─── */
const CampaignsPage = (() => {
  let _filter = 'all';
  let _typeFilter = 'all';
  let _currentCampaignId = null;

  const CAMP_TYPES = {
    seasonal:  { label: 'Seasonal',  icon: '🌸' },
    event:     { label: 'Event',     icon: '🎉' },
    ongoing:   { label: 'Ongoing',   icon: '♻️' },
    promotion: { label: 'Promotion', icon: '🏷️' },
    calendar:  { label: 'Calendar',  icon: '📅' },
  };

  function render() {
    if (_currentCampaignId) return _renderDetail();
    return _renderList();
  }

  /* ═══════ LIST ═══════ */
  function _renderList() {
    const campaigns = Store.getCampaigns();
    const canManage = Store.Permissions.can('manage_campaigns');

    let filtered = campaigns;
    if (_filter !== 'all') filtered = filtered.filter(c => c.status === _filter);
    if (_typeFilter !== 'all') filtered = filtered.filter(c => c.type === _typeFilter);

    const activeCount = campaigns.filter(c => c.status === 'active').length;

    return `
      <div class="page active" id="page-campaigns">
        <h1 class="page-title">Campaigns</h1>
        <p class="page-subtitle">${activeCount} active campaign${activeCount !== 1 ? 's' : ''}</p>

        <div class="filter-bar">
          <button class="filter-chip ${_filter === 'all' ? 'active' : ''}" onclick="CampaignsPage.setFilter('all')">All</button>
          <button class="filter-chip ${_filter === 'active' ? 'active' : ''}" onclick="CampaignsPage.setFilter('active')">Active</button>
          <button class="filter-chip ${_filter === 'expired' ? 'active' : ''}" onclick="CampaignsPage.setFilter('expired')">Expired</button>
          <button class="filter-chip ${_filter === 'draft' ? 'active' : ''}" onclick="CampaignsPage.setFilter('draft')">Draft</button>
        </div>

        <div class="filter-bar" style="margin-top:-4px">
          <button class="filter-chip ${_typeFilter === 'all' ? 'active' : ''}" onclick="CampaignsPage.setTypeFilter('all')">All Types</button>
          ${Object.entries(CAMP_TYPES).map(([k, v]) => `
            <button class="filter-chip ${_typeFilter === k ? 'active' : ''}" onclick="CampaignsPage.setTypeFilter('${k}')">${v.icon} ${v.label}</button>
          `).join('')}
        </div>

        ${canManage ? `<button class="btn btn-primary btn-block" style="margin:12px 0" onclick="CampaignsPage.openCreate()">+ New Campaign</button>` : ''}

        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📢</div>
            <div class="empty-state-text">No campaigns match filters</div>
          </div>
        ` : filtered.map(c => _renderCard(c)).join('')}
      </div>
    `;
  }

  function _renderCard(c) {
    const ct = CAMP_TYPES[c.type] || { label: c.type, icon: '📌' };
    const statusCls = { active: 'chip-done', expired: 'chip-todo', draft: 'chip-review' };
    const statusLabel = { active: 'Active', expired: 'Expired', draft: 'Draft' };
    const daysLeft = c.end_date ? Math.ceil((new Date(c.end_date) - Date.now()) / 86400000) : null;

    // Color-coded expiration
    let expiryColor = 'var(--text-light)';
    let expiryBg = 'transparent';
    let expiryWarning = '';
    if (daysLeft !== null && c.status === 'active') {
      if (daysLeft <= 3) {
        expiryColor = 'var(--danger)'; expiryBg = 'var(--danger-bg)';
        expiryWarning = '🔴';
      } else if (daysLeft <= 7) {
        expiryColor = '#B8860B'; expiryBg = 'var(--warning-bg)';
        expiryWarning = '🟡';
      } else if (daysLeft <= 14) {
        expiryColor = 'var(--warning)'; expiryBg = 'var(--warning-bg)';
        expiryWarning = '🟡';
      } else {
        expiryColor = 'var(--success)';
        expiryWarning = '🟢';
      }
    }
    const placementCount = _countPlacements(c.id);

    return `
      <div class="card camp-card" onclick="CampaignsPage.openDetail('${c.id}')" style="cursor:pointer;${daysLeft !== null && daysLeft <= 3 && c.status === 'active' ? 'border-left:3px solid var(--danger);' : ''}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div>
            <div class="camp-card-icon">${ct.icon}</div>
            <h3 class="camp-card-title">${_esc(c.name)}</h3>
          </div>
          <span class="chip ${statusCls[c.status] || 'chip-todo'}"><span class="chip-dot"></span>${statusLabel[c.status] || c.status}</span>
        </div>
        <p class="camp-card-desc">${_esc(c.description || '')}</p>
        <div class="camp-card-meta">
          <span class="camp-card-type">${ct.label.toUpperCase()}</span>
          <span class="apv-meta-dot">·</span>
          <span>${c.start_date || '—'} → ${c.end_date || '—'}</span>
          ${daysLeft !== null && c.status === 'active' ? `
            <span class="apv-meta-dot">·</span>
            <span style="color:${expiryColor};font-weight:600">${expiryWarning} ${daysLeft > 0 ? daysLeft + 'd left' : 'Ending today'}</span>
          ` : ''}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
          <span class="camp-card-placements">${placementCount} placement${placementCount !== 1 ? 's' : ''}</span>
          ${daysLeft !== null && daysLeft <= 3 && c.status === 'active' ? `<span style="font-size:0.68rem;padding:2px 8px;border-radius:var(--radius-full);background:${expiryBg};color:${expiryColor};font-weight:600">⚠ Expiring soon</span>` : ''}
        </div>
      </div>
    `;
  }

  /* ═══════ DETAIL ═══════ */
  function _renderDetail() {
    const c = Store.getCampaigns().find(x => x.id === _currentCampaignId);
    if (!c) { _currentCampaignId = null; return _renderList(); }

    const ct = CAMP_TYPES[c.type] || { label: c.type, icon: '📌' };
    const statusCls = { active: 'chip-done', expired: 'chip-todo', draft: 'chip-review' };
    const statusLabel = { active: 'Active', expired: 'Expired', draft: 'Draft' };
    const placements = _getCampaignPlacements(c.id);
    const canManage = Store.Permissions.can('manage_campaigns');

    /* Comments with RBAC visibility */
    const visibleComments = Store.getVisibleEventComments(c.id);
    const hiddenCount = Store.getHiddenCommentCount(c.id);
    const team = Store.getTeam();
    const settings = Store.getSettings();
    const currentRole = settings.role;
    const _userById = id => team.find(m => m.id === id) || { name: id, fullName: id, role: '', username: '', avatarInitials: '??' };
    const _initials = u => u.avatarInitials || (u.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const _highlightMentions = text => {
      return _esc(text).replace(/@(\w+)/g, (match, uname) => {
        const u = team.find(m => m.username === uname);
        return `<span class="comment-mention">@${u ? _esc(u.fullName || u.name) : uname}</span>`;
      });
    };
    const _visLabel = vis => {
      if (!vis) return '';
      if (vis.mode === 'private') return '🔒 Private';
      const r = vis.rolesAllowed || [];
      if (r.length === Store.ALL_ROLES.length) return '👥 Team';
      if (r.length <= 3 && r.includes('ADMIN') && r.includes('DIRECTOR') && r.includes('MANAGER')) return '🔐 Leadership';
      return '👁️ Restricted';
    };
    /* Visibility presets for composer */
    const presets = Store.getVisibilityPresets(currentRole);

    return `
      <div class="page active" id="page-campaigns">
        <div class="loc-back" onclick="CampaignsPage.goBack()">← Campaigns</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin:8px 0 4px">
          <h2 style="margin:0;font-size:1.2rem">${ct.icon} ${_esc(c.name)}</h2>
          <span class="chip ${statusCls[c.status] || 'chip-todo'}"><span class="chip-dot"></span>${statusLabel[c.status] || c.status}</span>
        </div>
        <p style="font-size:0.82rem;color:var(--text-muted);margin:0 0 16px">${_esc(c.description || '')}</p>

        <div class="card" style="padding:16px">
          <div class="pd-section-label">Campaign Details</div>
          <div class="pd-specs">
            <div class="pd-spec"><span class="pd-spec-label">Type</span><span class="pd-spec-value">${ct.icon} ${ct.label}</span></div>
            <div class="pd-spec"><span class="pd-spec-label">Start Date</span><span class="pd-spec-value">${c.start_date || '—'}</span></div>
            <div class="pd-spec"><span class="pd-spec-label">End Date</span><span class="pd-spec-value">${c.end_date || '—'}</span></div>
            <div class="pd-spec"><span class="pd-spec-label">Created</span><span class="pd-spec-value">${_timeAgo(c.createdAt)}</span></div>
          </div>
        </div>

        <div class="card" style="padding:16px;margin-top:12px">
          <div class="pd-section-label">📍 Assigned Placements (${placements.length})</div>
          ${placements.length === 0 ? `
            <div class="pd-empty-content">
              <div style="font-size:1.4rem;margin-bottom:4px">📭</div>
              No placements assigned to this campaign
            </div>
          ` : placements.map(p => `
            <div class="camp-placement" onclick="App.navigate('placement-${p.locationId}_${p.zoneId}_${p.id}')" style="cursor:pointer">
              <div class="camp-placement-loc">${_esc(p.locationName)} › ${_esc(p.zoneName)}</div>
              <div class="camp-placement-name">${_esc(p.name)}</div>
              <div class="camp-placement-meta">
                ${p.removal_date ? `<span>Remove by: ${p.removal_date}</span>` : ''}
                <span class="chip chip-${p.status === 'active' ? 'done' : p.status === 'empty' ? 'todo' : 'review'}" style="font-size:0.6rem;padding:2px 6px"><span class="chip-dot"></span>${p.status}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Comments Section -->
        <div class="card comment-section" style="padding:16px;margin-top:12px">
          <div class="pd-section-label">💬 Comments (${visibleComments.length})</div>
          ${hiddenCount > 0 ? `
            <div class="comment-hidden-indicator">
              <span>🔒</span> ${hiddenCount} comment${hiddenCount > 1 ? 's' : ''} hidden due to visibility settings.
            </div>
          ` : ''}
          ${visibleComments.length === 0 ? `
            <div class="pd-empty-content" style="padding:12px 0">
              <div style="font-size:1.2rem;margin-bottom:4px">💬</div>
              <span style="font-size:0.78rem;color:var(--text-muted)">No comments yet. Be the first!</span>
            </div>
          ` : visibleComments.map(cm => {
            const u = _userById(cm.userId);
            return `
              <div class="comment-item">
                <div class="comment-avatar">${_initials(u)}</div>
                <div class="comment-body">
                  <div class="comment-header">
                    <span class="comment-author">${_esc(u.fullName || u.name)}</span>
                    <span class="comment-vis-badge">${_visLabel(cm.visibility)}</span>
                    <span class="comment-time">${_timeAgo(cm.createdAt)}</span>
                  </div>
                  <div class="comment-text">${_highlightMentions(cm.text)}</div>
                </div>
              </div>
            `;
          }).join('')}
          <div class="comment-input-row">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <label style="font-size:0.7rem;font-weight:600;color:var(--text-muted);white-space:nowrap">Visible to:</label>
              <select id="comment-visibility" class="comment-vis-select">
                ${presets.map((p, i) => `<option value="${i}">${p.label}</option>`).join('')}
              </select>
            </div>
            <textarea id="comment-text" class="comment-textarea" placeholder="Add a comment… Use @username to mention" rows="2"></textarea>
            <button class="btn btn-primary" style="padding:6px 14px;font-size:0.78rem;margin-top:6px;align-self:flex-end" onclick="CampaignsPage.postComment('${c.id}')">Post</button>
          </div>
        </div>

        ${canManage ? `<button class="btn btn-primary btn-block" style="margin-top:16px" onclick="CampaignsPage.openEdit('${c.id}')">✏️ Edit Campaign</button>` : ''}
      </div>
    `;
  }

  /* ═══════ HELPERS ═══════ */
  function _getCampaignPlacements(campaignId) {
    const locs = Store.getLocations();
    const result = [];
    locs.forEach(loc => {
      loc.zones.forEach(z => {
        z.placements.forEach(p => {
          if (p.campaignId === campaignId) {
            result.push({ ...p, locationId: loc.id, locationName: loc.name, zoneId: z.id, zoneName: z.name });
          }
        });
      });
    });
    return result;
  }

  function _countPlacements(campaignId) {
    return _getCampaignPlacements(campaignId).length;
  }

  /* ═══════ ACTIONS ═══════ */
  function setFilter(f) { _filter = f; App.refresh(); }
  function setTypeFilter(f) { _typeFilter = f; App.refresh(); }
  function openDetail(id) { _currentCampaignId = id; App.navigate('campaign-' + id); }
  function goBack() { _currentCampaignId = null; App.navigate('campaigns'); }

  function setCampaignId(id) { _currentCampaignId = id; }

  function openCreate() {
    if (!Store.Permissions.can('manage_campaigns')) return;
    App.showModal('New Campaign', `
      <div class="rv-modal">
        <label class="rv-modal-label">Campaign Name <span style="color:var(--danger)">*</span></label>
        <input type="text" id="camp-name" class="rv-inline-input" style="width:100%;margin-bottom:10px" placeholder="e.g. Spring Launch 2026" />
        <label class="rv-modal-label">Type</label>
        <select id="camp-type" class="rv-inline-input" style="width:100%;margin-bottom:10px;padding:8px 12px">
          <option value="seasonal">🌸 Seasonal</option>
          <option value="event">🎉 Event</option>
          <option value="ongoing">♻️ Ongoing</option>
          <option value="promotion">🏷️ Promotion</option>
        </select>
        <label class="rv-modal-label">Description</label>
        <textarea id="camp-desc" class="rv-modal-textarea" rows="2" placeholder="Campaign description…"></textarea>
        <div style="display:flex;gap:8px">
          <div style="flex:1">
            <label class="rv-modal-label">Start Date</label>
            <input type="date" id="camp-start" class="rv-inline-input" style="width:100%" />
          </div>
          <div style="flex:1">
            <label class="rv-modal-label">End Date</label>
            <input type="date" id="camp-end" class="rv-inline-input" style="width:100%" />
          </div>
        </div>
        <label class="rv-modal-label" style="margin-top:10px">Status</label>
        <select id="camp-status" class="rv-inline-input" style="width:100%;margin-bottom:12px;padding:8px 12px">
          <option value="draft">Draft</option>
          <option value="active">Active</option>
        </select>
        <button class="btn btn-primary btn-block" onclick="CampaignsPage.saveNew()">Create Campaign</button>
      </div>
    `);
  }

  function saveNew() {
    const name = (document.getElementById('camp-name')?.value || '').trim();
    if (!name) return;
    Store.addCampaign({
      name,
      type: document.getElementById('camp-type')?.value || 'seasonal',
      description: document.getElementById('camp-desc')?.value || '',
      start_date: document.getElementById('camp-start')?.value || '',
      end_date: document.getElementById('camp-end')?.value || '',
      status: document.getElementById('camp-status')?.value || 'draft',
    });
    App.closeModal();
    App.refresh();
  }

  function openEdit(id) {
    const c = Store.getCampaigns().find(x => x.id === id);
    if (!c) return;
    App.showModal('Edit Campaign', `
      <div class="rv-modal">
        <label class="rv-modal-label">Name</label>
        <input type="text" id="camp-name" class="rv-inline-input" style="width:100%;margin-bottom:10px" value="${_esc(c.name)}" />
        <label class="rv-modal-label">Type</label>
        <select id="camp-type" class="rv-inline-input" style="width:100%;margin-bottom:10px;padding:8px 12px">
          ${Object.entries(CAMP_TYPES).map(([k, v]) => `<option value="${k}" ${c.type === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
        </select>
        <label class="rv-modal-label">Description</label>
        <textarea id="camp-desc" class="rv-modal-textarea" rows="2">${_esc(c.description || '')}</textarea>
        <div style="display:flex;gap:8px">
          <div style="flex:1"><label class="rv-modal-label">Start</label><input type="date" id="camp-start" class="rv-inline-input" style="width:100%" value="${c.start_date || ''}" /></div>
          <div style="flex:1"><label class="rv-modal-label">End</label><input type="date" id="camp-end" class="rv-inline-input" style="width:100%" value="${c.end_date || ''}" /></div>
        </div>
        <label class="rv-modal-label" style="margin-top:10px">Status</label>
        <select id="camp-status" class="rv-inline-input" style="width:100%;margin-bottom:12px;padding:8px 12px">
          <option value="draft" ${c.status === 'draft' ? 'selected' : ''}>Draft</option>
          <option value="active" ${c.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="expired" ${c.status === 'expired' ? 'selected' : ''}>Expired</option>
        </select>
        <button class="btn btn-primary btn-block" onclick="CampaignsPage.saveEdit('${id}')">Save Changes</button>
      </div>
    `);
  }

  function saveEdit(id) {
    Store.updateCampaign(id, {
      name: document.getElementById('camp-name')?.value || '',
      type: document.getElementById('camp-type')?.value || 'seasonal',
      description: document.getElementById('camp-desc')?.value || '',
      start_date: document.getElementById('camp-start')?.value || '',
      end_date: document.getElementById('camp-end')?.value || '',
      status: document.getElementById('camp-status')?.value || 'draft',
    });
    App.closeModal();
    _currentCampaignId = id;
    App.refresh();
  }

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  /* ═══════ COMMENT ACTION ═══════ */
  function postComment(campaignId) {
    const textarea = document.getElementById('comment-text');
    const text = (textarea?.value || '').trim();
    if (!text) return;

    /* Resolve @username mentions to userIds */
    const team = Store.getTeam();
    const mentions = [];
    const mentionRegex = /@(\w+)/g;
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const mentioned = team.find(m => m.username === match[1].toLowerCase());
      if (mentioned && !mentions.includes(mentioned.id)) mentions.push(mentioned.id);
    }

    /* Use current user — resolve from settings */
    const settings = Store.getSettings();
    const currentUser = team.find(m => m.fullName === settings.name || m.username === settings.username) || team[0];

    /* Get visibility from dropdown */
    const visSelect = document.getElementById('comment-visibility');
    const presetIdx = parseInt(visSelect?.value || '0', 10);
    const presets = Store.getVisibilityPresets(settings.role);
    let visibility = presets[presetIdx] || presets[0];
    // For private, fill in current user
    if (visibility.mode === 'private') {
      visibility = { ...visibility, usersAllowed: [currentUser.id] };
    }
    // Strip the label before storing
    const { label, ...vis } = visibility;

    Store.addComment({
      eventId: campaignId,
      userId: currentUser.id,
      text,
      mentions,
      visibility: vis,
    });

    App.refresh();
  }

  return { render, setFilter, setTypeFilter, openDetail, goBack, setCampaignId, openCreate, saveNew, openEdit, saveEdit, postComment };
})();
