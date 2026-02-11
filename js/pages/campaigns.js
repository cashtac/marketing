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

    return `
      <div class="card camp-card" onclick="CampaignsPage.openDetail('${c.id}')" style="cursor:pointer">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div>
            <div class="camp-card-icon">${ct.icon}</div>
            <h3 class="camp-card-title">${_esc(c.name)}</h3>
          </div>
          <span class="chip ${statusCls[c.status] || 'chip-todo'}"><span class="chip-dot"></span>${statusLabel[c.status] || c.status}</span>
        </div>
        <p class="camp-card-desc">${_esc(c.description || '')}</p>
        <div class="camp-card-meta">
          <span class="camp-card-type">${ct.label}</span>
          <span class="apv-meta-dot">·</span>
          <span>${c.start_date || '—'} → ${c.end_date || '—'}</span>
          ${daysLeft !== null && c.status === 'active' ? `
            <span class="apv-meta-dot">·</span>
            <span style="color:${daysLeft <= 7 ? 'var(--danger)' : 'var(--text-light)'}">${daysLeft > 0 ? daysLeft + 'd left' : 'Ending today'}</span>
          ` : ''}
        </div>
        <div class="camp-card-placements">${_esc(_countPlacements(c.id))} placements</div>
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

  return { render, setFilter, setTypeFilter, openDetail, goBack, setCampaignId, openCreate, saveNew, openEdit, saveEdit };
})();
