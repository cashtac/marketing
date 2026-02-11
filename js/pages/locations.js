/* ─── Locations & Screens Page ─── */
const LocationsPage = (() => {
  let _currentLocationId = null;
  let _currentPlacement = null; // { locId, zoneId, plId }
  let _viewMode = 'locations'; // 'locations' | 'directory' | 'physical'
  let _dirSearch = '';
  let _dirFormat = 'all';
  let _dirStatus = 'all';
  let _dirLocType = 'all';
  let _dirCampType = 'all';
  let _dirEmptyOnly = false;
  let _dirNeedsVerify = false;
  let _dirRemovalFrom = '';
  let _dirRemovalTo = '';

  const LOC_TYPES = {
    dining_hall:  { label: 'Dining Hall', icon: '🍽️' },
    retail:       { label: 'Retail',      icon: '🏪' },
    catering:     { label: 'Catering',    icon: '🍳' },
  };
  const PLACEMENT_TYPES = {
    digital_screen: { label: 'Digital Screen', icon: '🖥️' },
    poster_22x28:   { label: 'Poster 22×28',   icon: '🖼️' },
    us_letter:      { label: 'US Letter',      icon: '📄' },
    event_board:    { label: 'Event Board',    icon: '📺' },
    a_frame:        { label: 'A-Frame',        icon: '🪧' },
  };

  function setLocationId(id) { _currentLocationId = id; _currentPlacement = null; }
  function setPlacementPath(locId, zoneId, plId) { _currentPlacement = { locId, zoneId, plId }; _currentLocationId = null; }

  /* ── Render dispatcher ── */
  function render() {
    if (_currentPlacement) return _renderPlacementDetail();
    if (_currentLocationId) return _renderDetail();
    if (_viewMode === 'directory') return _renderDirectory();
    if (_viewMode === 'physical') return _renderPhysicalMedia();
    return _renderList();
  }

  /* ═══════ LIST VIEW ═══════ */
  function _renderList() {
    const locs = Store.getLocations();
    const canManage = Store.Permissions.can('manage_locations');

    return `
      <div class="page active" id="page-locations">
        <h1 class="page-title">Locations & Screens</h1>
        <p class="page-subtitle">${locs.length} location${locs.length !== 1 ? 's' : ''} · ${_totalPlacements(locs)} placements</p>

        ${_renderTabs()}

        ${locs.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📍</div>
            <div class="empty-state-text">No locations yet</div>
          </div>
        ` : ''}

        ${locs.map(l => _renderLocationCard(l)).join('')}
      </div>
      ${canManage ? `<button class="fab" onclick="LocationsPage.openCreateLocation()" aria-label="Add location">＋</button>` : ''}
    `;
  }

  function _renderLocationCard(l) {
    const lt = LOC_TYPES[l.type] || { label: l.type, icon: '📍' };
    const zoneCount = l.zones.length;
    const placementCount = l.zones.reduce((s, z) => s + z.placements.length, 0);
    const activeCount = l.zones.reduce((s, z) => s + z.placements.filter(p => p.status === 'active').length, 0);
    const emptyCount = placementCount - activeCount;

    return `
      <div class="card loc-card" onclick="App.navigate('location-${l.id}')" style="cursor:pointer">
        <div class="loc-card-header">
          <div class="loc-type-badge">
            <span class="loc-type-icon">${lt.icon}</span>
            <span class="loc-type-label">${lt.label}</span>
          </div>
        </div>
        <h3 class="loc-card-name">${_esc(l.name)}</h3>
        <div class="loc-card-stats">
          <span class="loc-stat">${zoneCount} zone${zoneCount !== 1 ? 's' : ''}</span>
          <span class="loc-stat-dot">·</span>
          <span class="loc-stat">${placementCount} placement${placementCount !== 1 ? 's' : ''}</span>
          ${activeCount > 0 ? `<span class="loc-stat-dot">·</span><span class="loc-stat loc-stat-active">${activeCount} active</span>` : ''}
          ${emptyCount > 0 ? `<span class="loc-stat-dot">·</span><span class="loc-stat loc-stat-empty">${emptyCount} empty</span>` : ''}
        </div>
        <div class="loc-card-manager">
          <div class="avatar avatar-sm">${_initials(l.manager)}</div>
          <span>${_esc(l.manager)}</span>
        </div>
      </div>
    `;
  }

  /* ═══════ DETAIL VIEW ═══════ */
  function _renderDetail() {
    const locs = Store.getLocations();
    const loc = locs.find(l => l.id === _currentLocationId);
    if (!loc) { _currentLocationId = null; return _renderList(); }

    const canManage = Store.Permissions.can('manage_locations');
    const canAssign = Store.Permissions.can('assign_content');
    const lt = LOC_TYPES[loc.type] || { label: loc.type, icon: '📍' };

    return `
      <div class="page active" id="page-locations">
        <div class="loc-back" onclick="LocationsPage.goBack()">← All Locations</div>

        <div class="loc-detail-header">
          <div class="loc-type-badge">
            <span class="loc-type-icon">${lt.icon}</span>
            <span class="loc-type-label">${lt.label}</span>
          </div>
          ${canManage ? `<button class="btn btn-ghost btn-sm" onclick="LocationsPage.openEditLocation('${loc.id}')">Edit</button>` : ''}
        </div>
        <h1 class="page-title" style="margin-top:4px">${_esc(loc.name)}</h1>
        <div class="loc-card-manager" style="margin-bottom:16px">
          <div class="avatar avatar-sm">${_initials(loc.manager)}</div>
          <span>Managed by ${_esc(loc.manager)}</span>
        </div>

        ${loc.zones.length === 0 ? `
          <div class="empty-state" style="padding:30px 0">
            <div class="empty-state-icon">📦</div>
            <div class="empty-state-text">No zones in this location</div>
          </div>
        ` : ''}

        ${loc.zones.map(z => _renderZone(loc, z, canManage, canAssign)).join('')}

        ${canManage ? `
          <button class="btn btn-secondary btn-block" style="margin-top:8px" onclick="LocationsPage.openAddZone('${loc.id}')">
            + Add Zone
          </button>
        ` : ''}
      </div>
    `;
  }

  function _renderZone(loc, z, canManage, canAssign) {
    return `
      <div class="loc-zone">
        <div class="loc-zone-header">
          <h3 class="loc-zone-name">${_esc(z.name)}</h3>
          <span class="loc-zone-count">${z.placements.length} placement${z.placements.length !== 1 ? 's' : ''}</span>
          ${canManage ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); LocationsPage.deleteZoneConfirm('${loc.id}','${z.id}')" style="margin-left:auto;color:var(--danger);font-size:0.68rem">✕</button>` : ''}
        </div>
        <div class="loc-zone-placements">
          ${z.placements.map(p => _renderPlacement(loc, z, p, canAssign, canManage)).join('')}
        </div>
        ${canManage ? `
          <button class="btn btn-ghost btn-sm" onclick="LocationsPage.openAddPlacement('${loc.id}','${z.id}')" style="font-size:0.72rem;margin-top:6px">
            + Add Placement
          </button>
        ` : ''}
      </div>
    `;
  }

  function _renderPlacement(loc, z, p, canAssign, canManage) {
    const pt = PLACEMENT_TYPES[p.type] || { label: p.type, icon: '📎' };
    const statusCls = { active: 'chip-done', empty: 'chip-todo', needs_update: 'chip-review', removed: 'chip-todo' };
    const statusLabel = { active: 'Active', empty: 'Empty', needs_update: 'Needs Update', removed: 'Removed' };

    return `
      <div class="loc-placement-card" onclick="App.navigate('placement-${loc.id}_${z.id}_${p.id}')" style="cursor:pointer">
        <div class="loc-placement-top">
          <span class="loc-placement-icon">${pt.icon}</span>
          <div class="loc-placement-info">
            <div class="loc-placement-name">${_esc(p.name)}</div>
            <div class="loc-placement-type">${pt.label}${p.resolution ? ` · ${p.resolution}` : ''}${p.orientation ? ` · ${p.orientation}` : ''}</div>
          </div>
          <span class="chip ${statusCls[p.status] || 'chip-todo'}"><span class="chip-dot"></span>${statusLabel[p.status] || p.status}</span>
        </div>

        ${p.currentAssetName ? `
          <div class="loc-placement-content">
            <span class="loc-placement-content-label">📎 Current:</span>
            <span class="loc-placement-content-name">${_esc(p.currentAssetName)}</span>
          </div>
        ` : ''}

        ${p.schedule ? `
          <div class="loc-placement-schedule">🕐 ${_esc(p.schedule)}</div>
        ` : ''}

        <div class="loc-placement-actions">
          ${canAssign ? `
            <button class="btn btn-sm ${p.currentAssetId ? 'btn-secondary' : 'btn-primary'}" onclick="event.stopPropagation(); LocationsPage.openAssign('${loc.id}','${z.id}','${p.id}')">
              ${p.currentAssetId ? 'Replace' : 'Assign'} Content
            </button>
          ` : ''}
          ${canAssign && p.currentAssetId ? `
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); LocationsPage.removeContentAction('${loc.id}','${z.id}','${p.id}')" style="color:var(--danger)">Remove</button>
          ` : ''}
          ${p.history.length > 0 ? `
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); LocationsPage.showHistory('${loc.id}','${z.id}','${p.id}')">History (${p.history.length})</button>
          ` : ''}
          ${canManage ? `
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); LocationsPage.deletePlacementConfirm('${loc.id}','${z.id}','${p.id}')" style="color:var(--danger);font-size:0.65rem">✕</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /* ═══════ ACTIONS ═══════ */
  function goBack() {
    _currentLocationId = null;
    location.hash = 'locations';
    App.refresh();
  }

  /* ── Create / Edit Location ── */
  function openCreateLocation() {
    if (!Store.Permissions.can('manage_locations')) return;
    const team = Store.getTeam();
    App.showModal('New Location', `
      <div class="form-group">
        <label class="form-label">Location Name *</label>
        <input class="form-input" id="loc-name" placeholder="e.g. Southside Dining Hall" />
      </div>
      <div class="form-group">
        <label class="form-label">Type *</label>
        <select class="form-select" id="loc-type">
          ${Object.entries(LOC_TYPES).map(([k,v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
          <option value="custom">Custom</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Manager</label>
        <select class="form-select" id="loc-manager">
          ${team.map(m => `<option value="${_esc(m.name)}">${_esc(m.name)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary btn-block" onclick="LocationsPage.saveCreateLocation()">Create Location</button>
    `);
  }
  function saveCreateLocation() {
    const name = document.getElementById('loc-name').value.trim();
    if (!name) return;
    Store.addLocation({
      name,
      type: document.getElementById('loc-type').value,
      manager: document.getElementById('loc-manager').value,
    });
    App.closeModal(); App.refresh();
  }

  function openEditLocation(id) {
    if (!Store.Permissions.can('manage_locations')) return;
    const loc = Store.getLocations().find(l => l.id === id);
    if (!loc) return;
    const team = Store.getTeam();
    App.showModal('Edit Location', `
      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-input" id="edit-loc-name" value="${_esc(loc.name)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-select" id="edit-loc-type">
          ${Object.entries(LOC_TYPES).map(([k,v]) => `<option value="${k}" ${k === loc.type ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
          <option value="custom" ${!LOC_TYPES[loc.type] ? 'selected' : ''}>Custom</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Manager</label>
        <select class="form-select" id="edit-loc-manager">
          ${team.map(m => `<option value="${_esc(m.name)}" ${m.name === loc.manager ? 'selected' : ''}>${_esc(m.name)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary btn-block" onclick="LocationsPage.saveEditLocation('${id}')">Save</button>
      <button class="btn btn-danger btn-block" style="margin-top:8px" onclick="LocationsPage.deleteLocationConfirm('${id}')">Delete Location</button>
    `);
  }
  function saveEditLocation(id) {
    Store.updateLocation(id, {
      name: document.getElementById('edit-loc-name').value.trim(),
      type: document.getElementById('edit-loc-type').value,
      manager: document.getElementById('edit-loc-manager').value,
    });
    App.closeModal(); App.refresh();
  }
  function deleteLocationConfirm(id) {
    if (confirm('Delete this location and all its zones/placements?')) {
      Store.deleteLocation(id);
      _currentLocationId = null;
      location.hash = 'locations';
      App.closeModal(); App.refresh();
    }
  }

  /* ── Zones ── */
  function openAddZone(locId) {
    App.showModal('New Zone', `
      <div class="form-group">
        <label class="form-label">Zone Name *</label>
        <input class="form-input" id="zone-name" placeholder="e.g. Entrance, Cashier Area" />
      </div>
      <button class="btn btn-primary btn-block" onclick="LocationsPage.saveAddZone('${locId}')">Add Zone</button>
    `);
  }
  function saveAddZone(locId) {
    const name = document.getElementById('zone-name').value.trim();
    if (!name) return;
    Store.addZone(locId, { name });
    App.closeModal(); App.refresh();
  }
  function deleteZoneConfirm(locId, zoneId) {
    if (confirm('Delete this zone and all its placements?')) {
      Store.deleteZone(locId, zoneId);
      App.refresh();
    }
  }

  /* ── Placements ── */
  function openAddPlacement(locId, zoneId) {
    App.showModal('New Placement', `
      <div class="form-group">
        <label class="form-label">Placement Name *</label>
        <input class="form-input" id="pl-name" placeholder="e.g. Lobby Digital Sign" />
      </div>
      <div class="form-group">
        <label class="form-label">Type *</label>
        <select class="form-select" id="pl-type">
          ${Object.entries(PLACEMENT_TYPES).map(([k,v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Resolution (screens only)</label>
        <input class="form-input" id="pl-res" placeholder="e.g. 1920x1080" />
      </div>
      <div class="form-group">
        <label class="form-label">Orientation</label>
        <select class="form-select" id="pl-orient">
          <option value="landscape">Landscape</option>
          <option value="portrait">Portrait</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Schedule</label>
        <input class="form-input" id="pl-schedule" placeholder="e.g. Rotate every 15s" />
      </div>
      <button class="btn btn-primary btn-block" onclick="LocationsPage.saveAddPlacement('${locId}','${zoneId}')">Add Placement</button>
    `);
  }
  function saveAddPlacement(locId, zoneId) {
    const name = document.getElementById('pl-name').value.trim();
    if (!name) return;
    Store.addPlacement(locId, zoneId, {
      name,
      type: document.getElementById('pl-type').value,
      resolution: document.getElementById('pl-res').value.trim() || null,
      orientation: document.getElementById('pl-orient').value,
      format: document.getElementById('pl-type').value === 'poster_22x28' ? '22x28' : document.getElementById('pl-type').value === 'us_letter' ? 'us_letter' : null,
      schedule: document.getElementById('pl-schedule').value.trim(),
      installedAt: new Date().toISOString(),
    });
    App.closeModal(); App.refresh();
  }
  function deletePlacementConfirm(locId, zoneId, plId) {
    if (confirm('Delete this placement?')) {
      Store.deletePlacement(locId, zoneId, plId);
      App.refresh();
    }
  }

  /* ── Content Assignment ── */
  function openAssign(locId, zoneId, plId) {
    if (!Store.Permissions.can('assign_content')) return;
    const assets = Store.getAssets();
    if (assets.length === 0) {
      App.showModal('No Assets', `<p>Create assets in Marketing Assets first.</p>`);
      return;
    }
    App.showModal('Assign Content', `
      <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px">Select an asset to assign to this placement:</p>
      <div class="loc-asset-picker">
        ${assets.map(a => `
          <div class="loc-asset-option" onclick="LocationsPage.doAssign('${locId}','${zoneId}','${plId}','${a.id}')">
            <span class="loc-asset-option-icon">${_assetIcon(a.format)}</span>
            <div>
              <div class="loc-asset-option-name">${_esc(a.name)}</div>
              <div class="loc-asset-option-meta">${_assetFormatLabel(a.format)} · ${a.status}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `);
  }
  function doAssign(locId, zoneId, plId, assetId) {
    Store.assignContent(locId, zoneId, plId, assetId);
    App.closeModal(); App.refresh();
  }
  function removeContentAction(locId, zoneId, plId) {
    if (confirm('Remove current content from this placement?')) {
      Store.removeContent(locId, zoneId, plId);
      App.refresh();
    }
  }

  /* ── Version History ── */
  function showHistory(locId, zoneId, plId) {
    const loc = Store.getLocations().find(l => l.id === locId);
    if (!loc) return;
    const z = loc.zones.find(z => z.id === zoneId);
    if (!z) return;
    const p = z.placements.find(p => p.id === plId);
    if (!p) return;

    App.showModal(`History: ${p.name}`, `
      <div class="loc-history">
        ${p.history.map(h => `
          <div class="loc-history-entry">
            <div class="loc-history-action">${_historyIcon(h.action)} ${_esc(h.assetName)}</div>
            <div class="loc-history-meta">${h.action} by ${_esc(h.by)} · ${_timeAgo(h.date)}</div>
          </div>
        `).join('')}
      </div>
    `);
  }

  /* ── Helpers ── */
  function _totalPlacements(locs) { return locs.reduce((s, l) => s + l.zones.reduce((s2, z) => s2 + z.placements.length, 0), 0); }
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
  function _assetIcon(fmt) {
    return { poster_22x28: '🖼️', us_letter: '📄', social_media: '📱', event_board: '📺', digital_screen: '🖥️' }[fmt] || '📎';
  }
  function _assetFormatLabel(fmt) {
    return { poster_22x28: 'Poster 22×28', us_letter: 'US Letter', social_media: 'Social Media', event_board: 'Event Board', digital_screen: 'Digital Screen' }[fmt] || fmt;
  }
  function _historyIcon(action) {
    return { assigned: '🟢', replaced: '🔄', removed: '🔴' }[action] || '•';
  }

  /* ── Tab toggle ── */
  function _renderTabs() {
    return `
      <div class="loc-tab-bar">
        <button class="loc-tab ${_viewMode === 'locations' ? 'active' : ''}" onclick="LocationsPage.setViewMode('locations')">By Location</button>
        <button class="loc-tab ${_viewMode === 'directory' ? 'active' : ''}" onclick="LocationsPage.setViewMode('directory')">All Placements</button>
        <button class="loc-tab ${_viewMode === 'physical' ? 'active' : ''}" onclick="LocationsPage.setViewMode('physical')">Physical Media</button>
      </div>
    `;
  }
  function setViewMode(mode) {
    _viewMode = mode;
    _currentLocationId = null;
    App.refresh();
  }

  /* ═══════ PHYSICAL MEDIA VIEW ═══════ */
  const DU_TYPES = {
    poster_22x28:   { label: 'Poster 22×28',   icon: '🖼️' },
    us_letter:      { label: 'US Letter',      icon: '📄' },
    digital_screen: { label: 'Digital Screen', icon: '🖥️' },
    event_board:    { label: 'Event Board',    icon: '📺' },
    banner_stand:   { label: 'Banner Stand',   icon: '🏗️' },
    a_frame:        { label: 'A-Frame',        icon: '🪧' },
  };

  function _renderPhysicalMedia() {
    const locs = Store.getLocations();
    const displayUnits = Store.getDisplayUnits();
    const campaigns = Store.getCampaigns();
    const totalDU = displayUnits.length;
    const totalPl = _totalPlacements(locs);
    const assigned = _countCampaignPlacements(locs);

    return `
      <div class="page active" id="page-locations">
        <h1 class="page-title">Physical Media</h1>
        <p class="page-subtitle">${totalDU} display unit${totalDU !== 1 ? 's' : ''} · ${totalPl} placements · ${assigned} assigned</p>

        ${_renderTabs()}

        <div class="pm-stats-row">
          <div class="pm-stat-card">
            <div class="pm-stat-num">${totalDU}</div>
            <div class="pm-stat-label">Display Units</div>
          </div>
          <div class="pm-stat-card">
            <div class="pm-stat-num">${assigned}</div>
            <div class="pm-stat-label">Campaign Assigned</div>
          </div>
          <div class="pm-stat-card">
            <div class="pm-stat-num">${totalPl - assigned}</div>
            <div class="pm-stat-label">Unassigned</div>
          </div>
        </div>

        ${locs.map(loc => {
          const lt = LOC_TYPES[loc.type] || { label: loc.type, icon: '📍' };
          const locDU = displayUnits.filter(du => du.locationId === loc.id);
          return `
            <div class="card pm-loc-card">
              <div class="pm-loc-header">
                <span class="pm-loc-icon">${lt.icon}</span>
                <div>
                  <h3 class="pm-loc-name">${_esc(loc.name)}</h3>
                  <span class="pm-loc-type">${lt.label}</span>
                </div>
              </div>

              ${loc.zones.map(z => {
                const zoneDU = locDU.filter(du => du.zoneId === z.id);
                return `
                  <div class="pm-zone">
                    <div class="pm-zone-label">📍 ${_esc(z.name)}</div>

                    ${zoneDU.length > 0 ? `
                      <div class="pm-zone-label" style="font-size:0.68rem;color:var(--text-light);margin:-4px 0 6px">Display Units:</div>
                      ${zoneDU.map(du => {
                        const dt = DU_TYPES[du.format_type] || { label: du.format_type, icon: '📦' };
                        const sp = du.physical_specs || {};
                        return `
                          <div class="pm-du-card">
                            <div class="pm-du-head">
                              <span>${dt.icon} ${_esc(du.name)}</span>
                              <span class="chip chip-${du.status === 'active' ? 'done' : 'todo'}" style="font-size:0.6rem;padding:2px 6px"><span class="chip-dot"></span>${du.status}</span>
                            </div>
                            <div class="pm-du-specs">
                              <span>${dt.label}</span>
                              ${sp.width && sp.height ? `<span>${sp.width}" × ${sp.height}"</span>` : ''}
                              ${sp.material ? `<span>${_esc(sp.material)}</span>` : ''}
                            </div>
                          </div>
                        `;
                      }).join('')}
                    ` : ''}

                    <div class="pm-zone-label" style="font-size:0.68rem;color:var(--text-light);margin:4px 0 6px">Placements:</div>
                    ${z.placements.map(p => {
                      const pt = PLACEMENT_TYPES[p.type] || { label: p.type, icon: '📌' };
                      const camp = p.campaignId ? campaigns.find(c => c.id === p.campaignId) : null;
                      return `
                        <div class="pm-placement" onclick="App.navigate('placement-${loc.id}_${z.id}_${p.id}')" style="cursor:pointer">
                          <div class="pm-pl-head">
                            <span>${pt.icon} ${_esc(p.name)}</span>
                            <span class="chip chip-${p.status === 'active' ? 'done' : p.status === 'empty' ? 'todo' : 'review'}" style="font-size:0.6rem;padding:2px 6px"><span class="chip-dot"></span>${p.status}</span>
                          </div>
                          ${camp ? `
                            <div class="pm-pl-campaign">
                              <span class="pm-camp-badge">📢 ${_esc(camp.name)}</span>
                              ${p.removal_date ? `<span class="pm-pl-remove">Remove by: ${p.removal_date}</span>` : ''}
                            </div>
                          ` : '<div class="pm-pl-unassigned">No campaign assigned</div>'}
                        </div>
                      `;
                    }).join('')}
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function _countCampaignPlacements(locs) {
    let count = 0;
    locs.forEach(loc => loc.zones.forEach(z => z.placements.forEach(p => {
      if (p.campaignId) count++;
    })));
    return count;
  }

  /* ═══════ PLACEMENTS DIRECTORY ═══════ */
  function _renderDirectory() {
    const locs = Store.getLocations();

    // Flatten all placements with location/zone context
    let all = [];
    locs.forEach(loc => {
      const lt = LOC_TYPES[loc.type] || { label: loc.type, icon: '📍' };
      loc.zones.forEach(z => {
        z.placements.forEach(p => {
          all.push({
            ...p,
            locationId: loc.id,
            locationName: loc.name,
            locationType: loc.type,
            locationTypeLabel: lt.label,
            locationIcon: lt.icon,
            zoneName: z.name,
            zoneId: z.id,
          });
        });
      });
    });

    const totalAll = all.length;
    const totalActive = all.filter(p => p.status === 'active').length;
    const totalEmpty = all.filter(p => p.status === 'empty').length;

    // Apply filters
    if (_dirFormat !== 'all') all = all.filter(p => p.type === _dirFormat);
    if (_dirStatus !== 'all') all = all.filter(p => p.status === _dirStatus);
    if (_dirLocType !== 'all') all = all.filter(p => p.locationType === _dirLocType);
    if (_dirCampType !== 'all') all = all.filter(p => (p.campaign_type || '') === _dirCampType);
    if (_dirEmptyOnly) all = all.filter(p => p.status === 'empty' && !p.campaignId);
    if (_dirRemovalFrom) all = all.filter(p => p.removal_date && p.removal_date >= _dirRemovalFrom);
    if (_dirRemovalTo) all = all.filter(p => p.removal_date && p.removal_date <= _dirRemovalTo);
    if (_dirNeedsVerify) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 14);
      const cutoffISO = cutoff.toISOString();
      all = all.filter(p => !p.last_verified_at || p.last_verified_at < cutoffISO);
    }

    // Apply search
    if (_dirSearch) {
      const q = _dirSearch.toLowerCase();
      all = all.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.locationName.toLowerCase().includes(q) ||
        p.zoneName.toLowerCase().includes(q) ||
        (p.currentAssetName || '').toLowerCase().includes(q)
      );
    }

    // Sort: location → zone → name
    all.sort((a, b) => {
      if (a.locationName !== b.locationName) return a.locationName.localeCompare(b.locationName);
      if (a.zoneName !== b.zoneName) return a.zoneName.localeCompare(b.zoneName);
      return a.name.localeCompare(b.name);
    });

    return `
      <div class="page active" id="page-locations">
        <h1 class="page-title">Placements Directory</h1>
        <p class="page-subtitle">Every placement across campus</p>

        ${_renderTabs()}

        <input class="dir-search" type="text" placeholder="Search placements, locations, or assets…"
               value="${_esc(_dirSearch)}" oninput="LocationsPage.setDirSearch(this.value)" />

        <!-- Stats -->
        <div class="dir-stats">
          <span class="dir-stat">${totalAll} total</span>
          <span class="dir-stat dir-stat-active">${totalActive} active</span>
          <span class="dir-stat dir-stat-empty">${totalEmpty} empty</span>
        </div>

        <!-- Format filter -->
        <div class="filter-bar">
          <button class="filter-chip ${_dirFormat === 'all' ? 'active' : ''}" onclick="LocationsPage.setDirFormat('all')">All Formats</button>
          ${Object.entries(PLACEMENT_TYPES).map(([k, v]) => `
            <button class="filter-chip ${_dirFormat === k ? 'active' : ''}" onclick="LocationsPage.setDirFormat('${k}')">${v.icon} ${v.label}</button>
          `).join('')}
        </div>

        <!-- Status filter -->
        <div class="filter-bar" style="margin-top:-4px">
          <button class="filter-chip ${_dirStatus === 'all' ? 'active' : ''}" onclick="LocationsPage.setDirStatus('all')">All Status</button>
          <button class="filter-chip ${_dirStatus === 'empty' ? 'active' : ''}" onclick="LocationsPage.setDirStatus('empty')">Empty</button>
          <button class="filter-chip ${_dirStatus === 'active' ? 'active' : ''}" onclick="LocationsPage.setDirStatus('active')">Active</button>
        </div>

        <!-- Location type filter -->
        <div class="filter-bar" style="margin-top:-4px">
          <button class="filter-chip ${_dirLocType === 'all' ? 'active' : ''}" onclick="LocationsPage.setDirLocType('all')">All Types</button>
          ${Object.entries(LOC_TYPES).map(([k, v]) => `
            <button class="filter-chip ${_dirLocType === k ? 'active' : ''}" onclick="LocationsPage.setDirLocType('${k}')">${v.icon} ${v.label}</button>
          `).join('')}
        </div>

        <!-- Campaign type filter -->
        <div class="filter-bar" style="margin-top:-4px">
          <button class="filter-chip ${_dirCampType === 'all' ? 'active' : ''}" onclick="LocationsPage.setDirCampType('all')">All Campaigns</button>
          <button class="filter-chip ${_dirCampType === 'seasonal' ? 'active' : ''}" onclick="LocationsPage.setDirCampType('seasonal')">🌸 Seasonal</button>
          <button class="filter-chip ${_dirCampType === 'event' ? 'active' : ''}" onclick="LocationsPage.setDirCampType('event')">🎉 Event</button>
          <button class="filter-chip ${_dirCampType === 'ongoing' ? 'active' : ''}" onclick="LocationsPage.setDirCampType('ongoing')">♻️ Ongoing</button>
          <button class="filter-chip ${_dirCampType === 'promotion' ? 'active' : ''}" onclick="LocationsPage.setDirCampType('promotion')">🏷️ Promotion</button>
          <button class="filter-chip ${_dirCampType === 'calendar' ? 'active' : ''}" onclick="LocationsPage.setDirCampType('calendar')">📅 Calendar</button>
        </div>

        <!-- Empty-only toggle -->
        <div class="dir-toggle-row">
          <label class="dir-toggle-label">
            <input type="checkbox" ${_dirEmptyOnly ? 'checked' : ''} onchange="LocationsPage.toggleEmptyOnly(this.checked)" />
            Show empty & unassigned only
          </label>
        </div>

        <!-- Needs verification toggle -->
        <div class="dir-toggle-row">
          <label class="dir-toggle-label">
            <input type="checkbox" ${_dirNeedsVerify ? 'checked' : ''} onchange="LocationsPage.toggleNeedsVerify(this.checked)" />
            🔍 Needs verification (>14 days)
          </label>
        </div>

        <!-- Removal date range -->
        <div class="dir-date-range">
          <span class="dir-date-label">Removal date:</span>
          <input type="date" class="dir-date-input" value="${_dirRemovalFrom}" onchange="LocationsPage.setRemovalFrom(this.value)" placeholder="From" />
          <span style="color:var(--text-light)">→</span>
          <input type="date" class="dir-date-input" value="${_dirRemovalTo}" onchange="LocationsPage.setRemovalTo(this.value)" placeholder="To" />
          ${_dirRemovalFrom || _dirRemovalTo ? '<button class="dir-date-clear" onclick="LocationsPage.clearRemovalDates()">✕</button>' : ''}
        </div>

        <p style="font-size:0.7rem;color:var(--text-light);margin:0 0 10px">${all.length} result${all.length !== 1 ? 's' : ''}</p>

        ${all.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-text">No placements match these filters</div>
          </div>
        ` : ''}

        ${all.map(p => _renderDirCard(p)).join('')}
      </div>
    `;
  }

  function _renderDirCard(p) {
    const pt = PLACEMENT_TYPES[p.type] || { label: p.type, icon: '📎' };
    const statusCls = { active: 'chip-done', empty: 'chip-todo' };
    const statusLabel = { active: 'Active', empty: 'Empty' };

    return `
      <div class="card dir-card" onclick="App.navigate('location-${p.locationId}')" style="cursor:pointer">
        <div class="dir-card-top">
          <div style="display:flex;align-items:flex-start">
            <span class="dir-card-type-icon">${pt.icon}</span>
            <div>
              <div class="dir-card-name">${_esc(p.name)}</div>
              <div class="dir-card-location">${p.locationIcon} ${_esc(p.locationName)} · ${_esc(p.zoneName)}</div>
            </div>
          </div>
          <span class="chip ${statusCls[p.status] || 'chip-todo'}"><span class="chip-dot"></span>${statusLabel[p.status] || p.status}</span>
        </div>
        ${p.currentAssetName ? `
          <div class="dir-card-content">
            <span class="dir-card-content-label">📎 Current:</span>
            ${_esc(p.currentAssetName)}
          </div>
        ` : `
          <div class="dir-card-content">
            <span class="dir-card-content-label" style="color:var(--pink-400)">No content assigned</span>
          </div>
        `}
        ${p.schedule ? `<div class="dir-card-schedule">🕐 ${_esc(p.schedule)}</div>` : ''}
        <div style="font-size:0.65rem;color:var(--text-light);margin-top:4px">${pt.label}${p.resolution ? ` · ${p.resolution}` : ''}${p.orientation ? ` · ${p.orientation}` : ''}</div>
      </div>
    `;
  }

  /* Directory filter setters */
  function setDirSearch(v) { _dirSearch = v; App.refresh(); }
  function setDirFormat(v) { _dirFormat = v; App.refresh(); }
  function setDirStatus(v) { _dirStatus = v; App.refresh(); }
  function setDirLocType(v) { _dirLocType = v; App.refresh(); }
  function setDirCampType(v) { _dirCampType = v; App.refresh(); }
  function toggleEmptyOnly(v) { _dirEmptyOnly = !!v; App.refresh(); }
  function setRemovalFrom(v) { _dirRemovalFrom = v; App.refresh(); }
  function setRemovalTo(v) { _dirRemovalTo = v; App.refresh(); }
  function clearRemovalDates() { _dirRemovalFrom = ''; _dirRemovalTo = ''; App.refresh(); }

  /* ═══════ PLACEMENT DETAIL ═══════ */
  function _renderPlacementDetail() {
    const { locId, zoneId, plId } = _currentPlacement;
    const locs = Store.getLocations();
    const loc = locs.find(l => l.id === locId);
    if (!loc) { _currentPlacement = null; return _renderList(); }
    const z = loc.zones.find(z => z.id === zoneId);
    if (!z) { _currentPlacement = null; return _renderList(); }
    const p = z.placements.find(p => p.id === plId);
    if (!p) { _currentPlacement = null; return _renderList(); }

    const pt = PLACEMENT_TYPES[p.type] || { label: p.type, icon: '📎' };
    const lt = LOC_TYPES[loc.type] || { label: loc.type, icon: '📍' };
    const canAssign = Store.Permissions.can('assign_content');
    const statusCls = { active: 'chip-done', empty: 'chip-todo', needs_update: 'chip-review', removed: 'chip-todo', expired: 'chip-todo' };
    const statusLabel = { active: 'Active', empty: 'Empty', needs_update: 'Needs Update', removed: 'Removed', expired: 'Expired' };

    return `
      <div class="page active" id="page-locations">

        <!-- Back -->
        <div class="loc-back" onclick="App.navigate('location-${loc.id}')">← ${_esc(loc.name)}</div>

        <!-- Breadcrumb -->
        <div class="pd-breadcrumb">
          <span onclick="App.navigate('locations')" style="cursor:pointer">${lt.icon} ${_esc(loc.name)}</span>
          <span class="pd-breadcrumb-sep">›</span>
          <span>${_esc(z.name)}</span>
          <span class="pd-breadcrumb-sep">›</span>
          <span style="font-weight:700">${_esc(p.name)}</span>
        </div>

        <!-- Title + Status -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin:8px 0 16px">
          <h1 class="page-title" style="margin:0;font-size:1.3rem">${pt.icon} ${_esc(p.name)}</h1>
          <span class="chip ${statusCls[p.status] || 'chip-todo'}"><span class="chip-dot"></span>${statusLabel[p.status] || p.status}</span>
        </div>

        <!-- Specs Card -->
        <div class="card" style="padding:16px">
          <div class="pd-section-label">Placement Type & Specs</div>
          <div class="pd-specs">
            <div class="pd-spec">
              <span class="pd-spec-label">Type</span>
              <span class="pd-spec-value">${pt.icon} ${pt.label}</span>
            </div>
            ${p.resolution ? `
              <div class="pd-spec">
                <span class="pd-spec-label">Resolution</span>
                <span class="pd-spec-value">${_esc(p.resolution)}</span>
              </div>
            ` : ''}
            ${p.orientation ? `
              <div class="pd-spec">
                <span class="pd-spec-label">Orientation</span>
                <span class="pd-spec-value">${p.orientation === 'landscape' ? '⬒ Landscape' : '⬓ Portrait'}</span>
              </div>
            ` : ''}
            ${p.format ? `
              <div class="pd-spec">
                <span class="pd-spec-label">Format</span>
                <span class="pd-spec-value">${_esc(p.format)}</span>
              </div>
            ` : ''}
            <div class="pd-spec">
              <span class="pd-spec-label">Location Type</span>
              <span class="pd-spec-value">${lt.icon} ${lt.label}</span>
            </div>
          </div>
        </div>

        <!-- Current Content -->
        <div class="card" style="padding:16px">
          <div class="pd-section-label">📎 Current Content</div>
          ${p.currentAssetId ? `
            <div class="pd-current">
              <div class="pd-current-icon">${_assetIcon(p.type)}</div>
              <div>
                <div class="pd-current-name">${_esc(p.currentAssetName)}</div>
                <div class="pd-current-status">Assigned · ${p.status === 'active' ? 'Live' : p.status}</div>
              </div>
            </div>
          ` : `
            <div class="pd-empty-content">
              <div style="font-size:1.4rem;margin-bottom:4px">📭</div>
              <div>No content assigned</div>
              <div style="font-size:0.7rem;color:var(--text-light);margin-top:2px">Assign an asset to make this placement active</div>
            </div>
          `}
        </div>

        <!-- Schedule -->
        ${p.schedule ? `
          <div class="card" style="padding:16px">
            <div class="pd-section-label">🕐 Schedule</div>
            <div style="font-size:0.85rem">${_esc(p.schedule)}</div>
          </div>
        ` : ''}

        <!-- Campaign Assignment -->
        <div class="card" style="padding:16px">
          <div class="pd-section-label">📢 Campaign Assignment</div>
          ${p.campaignId ? (() => {
            const camp = Store.getCampaigns().find(c => c.id === p.campaignId);
            const campStatus = camp ? camp.status : 'unknown';
            const isExpired = campStatus === 'expired' || (p.removal_date && p.removal_date < new Date().toISOString().slice(0,10));
            const campStatusLabel = isExpired ? 'Expired' : 'Active';
            const campStatusCls = isExpired ? 'chip-todo' : 'chip-done';
            return `
              <div class="pd-camp-info">
                <div class="pd-camp-row">
                  <span class="pd-camp-name" onclick="App.navigate('campaign-${p.campaignId}')" style="cursor:pointer">📢 ${_esc(p.campaignName || (camp ? camp.name : 'Unknown'))}</span>
                  <span class="chip ${campStatusCls}" style="font-size:0.6rem;padding:2px 6px"><span class="chip-dot"></span>${campStatusLabel}</span>
                </div>
                ${p.campaign_type ? `<div class="pd-camp-type">${_esc(p.campaign_type)}</div>` : ''}
                <div class="pd-camp-dates">
                  ${camp && camp.end_date ? `<span>Campaign ends: ${camp.end_date}</span>` : ''}
                  ${p.removal_date ? `<span style="color:var(--danger)">Remove by: ${p.removal_date}</span>` : ''}
                </div>
              </div>
              ${canAssign ? `
                <div style="display:flex;gap:6px;margin-top:10px">
                  <button class="btn btn-primary" style="flex:1;font-size:0.78rem" onclick="LocationsPage.openAssignCampaign('${loc.id}','${z.id}','${p.id}')">🔄 Change Campaign</button>
                  <button class="btn btn-ghost" style="flex:1;font-size:0.78rem;color:var(--danger)" onclick="LocationsPage.unassignCampaign('${loc.id}','${z.id}','${p.id}')">Remove Campaign</button>
                </div>
              ` : ''}
            `;
          })() : `
            <div class="pd-empty-content">
              <div style="font-size:1.4rem;margin-bottom:4px">📭</div>
              <div>No campaign assigned</div>
              <div style="font-size:0.7rem;color:var(--text-light);margin-top:2px">Assign a campaign to track physical media at this placement</div>
            </div>
            ${canAssign ? `
              <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="LocationsPage.openAssignCampaign('${loc.id}','${z.id}','${p.id}')">📢 Assign Campaign</button>
            ` : ''}
          `}
        </div>

        <!-- Verification -->
        <div class="card" style="padding:16px">
          <div class="pd-section-label">🔍 Verification</div>
          ${(() => {
            const needsVerify = !p.last_verified_at || (Date.now() - new Date(p.last_verified_at).getTime() > 14 * 86400000);
            const verifiedAgo = p.last_verified_at ? _timeAgo(p.last_verified_at) : null;
            return `
              <div class="pd-specs">
                <div class="pd-spec">
                  <span class="pd-spec-label">Last Verified</span>
                  <span class="pd-spec-value" style="${needsVerify ? 'color:var(--danger);font-weight:600' : ''}">${verifiedAgo || 'Never'}</span>
                </div>
                ${p.last_verified_by ? `
                  <div class="pd-spec">
                    <span class="pd-spec-label">Verified By</span>
                    <span class="pd-spec-value">${_esc(p.last_verified_by)}</span>
                  </div>
                ` : ''}
              </div>
              ${needsVerify ? `<div style="font-size:0.72rem;color:var(--danger);margin:8px 0 4px;display:flex;align-items:center;gap:4px">⚠️ Verification overdue — last verified ${verifiedAgo || 'never'}</div>` : ''}
              <button class="btn ${needsVerify ? 'btn-primary' : 'btn-secondary'} btn-block" style="margin-top:8px" onclick="LocationsPage.markVerified('${loc.id}','${z.id}','${p.id}')">✅ Mark Verified</button>
            `;
          })()}
        </div>

        <!-- Metadata -->
        <div class="card" style="padding:16px">
          <div class="pd-section-label">📝 Details</div>
          <div class="pd-specs">
            <div class="pd-spec">
              <span class="pd-spec-label">Last Updated</span>
              <span class="pd-spec-value">${p.lastUpdated ? _timeAgo(p.lastUpdated) : 'Never'}</span>
            </div>
            ${p.history.length > 0 ? `
              <div class="pd-spec">
                <span class="pd-spec-label">Updated By</span>
                <span class="pd-spec-value">${_esc(p.history[0].by)}</span>
              </div>
            ` : ''}
            ${p.installedAt ? `
              <div class="pd-spec">
                <span class="pd-spec-label">Installed</span>
                <span class="pd-spec-value">${_timeAgo(p.installedAt)}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- History -->
        <div class="card" style="padding:16px">
          <div class="pd-section-label">📜 Version History</div>
          ${p.history.length === 0 ? `
            <div style="font-size:0.78rem;color:var(--text-light);padding:8px 0">No changes yet</div>
          ` : `
            <div class="pd-history">
              ${p.history.map(h => `
                <div class="pd-history-entry">
                  <div class="pd-history-dot ${h.action === 'assigned' ? 'pd-dot-green' : h.action === 'removed' ? 'pd-dot-red' : 'pd-dot-blue'}"></div>
                  <div class="pd-history-body">
                    <div class="pd-history-action">${_historyIcon(h.action)} <strong>${_esc(h.assetName)}</strong></div>
                    <div class="pd-history-meta">${h.action} by ${_esc(h.by)} · ${_timeAgo(h.date)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Replace Button -->
        ${canAssign ? `
          <button class="btn btn-primary btn-block" style="margin-top:8px" onclick="LocationsPage.openAssign('${loc.id}','${z.id}','${p.id}')">
            ${p.currentAssetId ? '🔄 Replace Content' : '➕ Assign Content'}
          </button>
          ${p.currentAssetId ? `
            <button class="btn btn-ghost btn-block" style="margin-top:4px;color:var(--danger)" onclick="LocationsPage.removeContentAction('${loc.id}','${z.id}','${p.id}')">
              Remove Content
            </button>
          ` : ''}
        ` : ''}

      </div>
    `;
  }

  function goBackFromPlacement() {
    if (_currentPlacement) {
      const locId = _currentPlacement.locId;
      _currentPlacement = null;
      App.navigate('location-' + locId);
    }
  }

  /* ═══════ CAMPAIGN ASSIGNMENT ═══════ */
  function openAssignCampaign(locId, zoneId, plId) {
    if (!Store.Permissions.can('assign_content')) return;
    const campaigns = Store.getCampaigns();
    if (campaigns.length === 0) {
      App.showModal('No Campaigns', '<div class="rv-modal"><p style="text-align:center;color:var(--text-muted)">Create a campaign first before assigning.</p></div>');
      return;
    }
    App.showModal('Assign Campaign', `
      <div class="rv-modal">
        <p style="font-size:0.78rem;color:var(--text-muted);margin:0 0 10px">Select a campaign to assign to this placement:</p>
        <div class="camp-pick-list">
          ${campaigns.map(c => {
            const isExpired = c.status === 'expired';
            return `
              <div class="camp-pick-item ${isExpired ? 'camp-pick-expired' : ''}" onclick="LocationsPage.pickCampaignForAssign('${locId}','${zoneId}','${plId}','${c.id}')">
                <div class="camp-pick-name">${_esc(c.name)}</div>
                <div class="camp-pick-meta">
                  <span>${c.type || '—'}</span>
                  <span class="apv-meta-dot">·</span>
                  <span>${c.start_date || '?'} → ${c.end_date || '?'}</span>
                  <span class="chip ${isExpired ? 'chip-todo' : 'chip-done'}" style="font-size:0.55rem;padding:1px 5px;margin-left:4px"><span class="chip-dot"></span>${c.status}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `);
  }

  function pickCampaignForAssign(locId, zoneId, plId, campaignId) {
    const campaign = Store.getCampaigns().find(c => c.id === campaignId);
    if (!campaign) return;

    // Get placement to check format
    const locs = Store.getLocations();
    const loc = locs.find(l => l.id === locId);
    if (!loc) return;
    const zone = loc.zones.find(z => z.id === zoneId);
    if (!zone) return;
    const placement = zone.placements.find(p => p.id === plId);
    if (!placement) return;

    // Find format-matching assets
    const allAssets = Store.getAssets();
    const matchingAssets = allAssets.filter(a => a.type === placement.type);

    App.closeModal();
    setTimeout(() => {
      App.showModal('Select Asset (Optional)', `
        <div class="rv-modal">
          <p style="font-size:0.78rem;color:var(--text-muted);margin:0 0 6px">Campaign: <strong>${_esc(campaign.name)}</strong></p>
          <p style="font-size:0.72rem;color:var(--text-light);margin:0 0 12px">Optionally select a format-matching asset, or assign campaign only.</p>

          <label class="rv-modal-label">Removal Date</label>
          <input type="date" id="camp-assign-removal" class="rv-inline-input" style="width:100%;margin-bottom:12px" value="${campaign.end_date || ''}" />

          <button class="btn btn-primary btn-block" style="margin-bottom:10px" onclick="LocationsPage.saveAssignCampaign('${locId}','${zoneId}','${plId}','${campaignId}','')">
            📢 Assign Campaign Only
          </button>

          ${matchingAssets.length > 0 ? `
            <div class="pd-section-label" style="margin-top:4px">Matching Assets (${matchingAssets.length})</div>
            <div class="camp-pick-list">
              ${matchingAssets.map(a => `
                <div class="camp-pick-item" onclick="LocationsPage.saveAssignCampaign('${locId}','${zoneId}','${plId}','${campaignId}','${a.id}')">
                  <div class="camp-pick-name">${_esc(a.name)}</div>
                  <div class="camp-pick-meta">
                    <span>${a.format || a.type || '—'}</span>
                    ${a.owner ? `<span class="apv-meta-dot">·</span><span>${_esc(a.owner)}</span>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="font-size:0.72rem;color:var(--text-light);text-align:center;padding:12px 0">No format-matching assets available</div>
          `}
        </div>
      `);
    }, 200);
  }

  function saveAssignCampaign(locId, zoneId, plId, campaignId, assetId) {
    const campaign = Store.getCampaigns().find(c => c.id === campaignId);
    if (!campaign) return;

    const locs = Store.getLocations();
    const loc = locs.find(l => l.id === locId);
    if (!loc) return;
    const zone = loc.zones.find(z => z.id === zoneId);
    if (!zone) return;
    const pl = zone.placements.find(p => p.id === plId);
    if (!pl) return;

    const removalDate = document.getElementById('camp-assign-removal')?.value || '';

    // Assign campaign fields
    pl.campaignId = campaign.id;
    pl.campaignName = campaign.name;
    pl.campaign_type = campaign.type;
    pl.removal_date = removalDate;
    pl.lastUpdated = new Date().toISOString();

    // If asset selected, assign it too
    if (assetId) {
      const asset = Store.getAssets().find(a => a.id === assetId);
      if (asset) {
        pl.currentAssetId = asset.id;
        pl.currentAssetName = asset.name;
        pl.status = 'active';
        pl.history.unshift({ action: 'assigned', assetName: asset.name, by: Store.getSettings().name || 'Admin', date: new Date().toISOString() });
      }
    }

    Store.saveLocations(locs);
    Store.addActivity(`Campaign "${campaign.name}" assigned to placement "${pl.name}"`);
    App.closeModal();
    App.refresh();
  }

  function unassignCampaign(locId, zoneId, plId) {
    if (!Store.Permissions.can('assign_content')) return;
    const locs = Store.getLocations();
    const loc = locs.find(l => l.id === locId);
    if (!loc) return;
    const zone = loc.zones.find(z => z.id === zoneId);
    if (!zone) return;
    const pl = zone.placements.find(p => p.id === plId);
    if (!pl) return;

    const campName = pl.campaignName || 'Unknown';
    pl.campaignId = null;
    pl.campaignName = '';
    pl.campaign_type = '';
    pl.removal_date = '';
    pl.lastUpdated = new Date().toISOString();
    Store.saveLocations(locs);
    Store.addActivity(`Campaign "${campName}" removed from placement "${pl.name}"`);
    App.refresh();
  }

  function markVerified(locId, zoneId, plId) {
    const locs = Store.getLocations();
    const loc = locs.find(l => l.id === locId);
    if (!loc) return;
    const zone = loc.zones.find(z => z.id === zoneId);
    if (!zone) return;
    const pl = zone.placements.find(p => p.id === plId);
    if (!pl) return;

    const settings = Store.getSettings();
    pl.last_verified_at = new Date().toISOString();
    pl.last_verified_by = settings.name || settings.role;
    pl.lastUpdated = new Date().toISOString();
    Store.saveLocations(locs);
    Store.addActivity(`Placement "${pl.name}" verified by ${pl.last_verified_by}`);
    App.refresh();
  }

  function toggleNeedsVerify(val) { _dirNeedsVerify = val; App.refresh(); }

  return {
    render, setLocationId, setPlacementPath, setViewMode, goBack, goBackFromPlacement,
    openCreateLocation, saveCreateLocation,
    openEditLocation, saveEditLocation, deleteLocationConfirm,
    openAddZone, saveAddZone, deleteZoneConfirm,
    openAddPlacement, saveAddPlacement, deletePlacementConfirm,
    openAssign, doAssign, removeContentAction,
    showHistory,
    setDirSearch, setDirFormat, setDirStatus, setDirLocType,
    setDirCampType, toggleEmptyOnly, toggleNeedsVerify, setRemovalFrom, setRemovalTo, clearRemovalDates,
    openAssignCampaign, pickCampaignForAssign, saveAssignCampaign, unassignCampaign,
    markVerified,
  };
})();
