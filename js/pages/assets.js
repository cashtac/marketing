/* ─── Marketing Assets Page ─── */
const AssetsPage = (() => {
  let _filter = 'all';
  let _formatFilter = 'all';

  const FORMATS = {
    poster_22x28:  { label: 'Poster 22×28',    icon: '🖼️',  dims: '22″ × 28″' },
    us_letter:     { label: 'US Letter',        icon: '📄',  dims: '8.5″ × 11″' },
    social_media:  { label: 'Social Media',     icon: '📱',  dims: 'Various' },
    event_board:   { label: 'Event Board',      icon: '📺',  dims: 'Screen Display' },
    digital_screen:{ label: 'Digital Screen',   icon: '🖥️', dims: '1920 × 1080' },
  };

  function render() {
    const allAssets = Store.getAssets();
    const assets = Store.Permissions.filterAssets(allAssets);
    const canCreate = Store.Permissions.can('create_asset');
    const canEdit = Store.Permissions.can('edit_asset');
    const canDelete = Store.Permissions.can('delete_asset');

    let filtered = assets;
    if (_filter !== 'all') filtered = filtered.filter(a => a.status === _filter);
    if (_formatFilter !== 'all') filtered = filtered.filter(a => a.format === _formatFilter);

    const counts = { draft: 0, review: 0, approved: 0 };
    assets.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });

    return `
      <div class="page active" id="page-assets">
        <h1 class="page-title">Marketing Assets</h1>
        <p class="page-subtitle">Centrally stored, reusable assets</p>

        <!-- Status filters -->
        <div class="filter-bar">
          <button class="filter-chip ${_filter === 'all' ? 'active' : ''}" onclick="AssetsPage.setFilter('all')">All (${assets.length})</button>
          <button class="filter-chip ${_filter === 'draft' ? 'active' : ''}" onclick="AssetsPage.setFilter('draft')">Draft${counts.draft ? ` (${counts.draft})` : ''}</button>
          <button class="filter-chip ${_filter === 'review' ? 'active' : ''}" onclick="AssetsPage.setFilter('review')">Review${counts.review ? ` (${counts.review})` : ''}</button>
          <button class="filter-chip ${_filter === 'approved' ? 'active' : ''}" onclick="AssetsPage.setFilter('approved')">Approved${counts.approved ? ` (${counts.approved})` : ''}</button>
        </div>

        <!-- Format filters -->
        <div class="filter-bar" style="margin-top:-4px">
          <button class="filter-chip ${_formatFilter === 'all' ? 'active' : ''}" onclick="AssetsPage.setFormatFilter('all')">All Formats</button>
          ${Object.entries(FORMATS).map(([k, v]) => `
            <button class="filter-chip ${_formatFilter === k ? 'active' : ''}" onclick="AssetsPage.setFormatFilter('${k}')">${v.icon} ${v.label}</button>
          `).join('')}
        </div>

        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📂</div>
            <div class="empty-state-text">No assets match this filter</div>
          </div>
        ` : ''}

        ${filtered.map(a => _renderAsset(a, canEdit, canDelete)).join('')}
      </div>

      ${canCreate ? `<button class="fab" onclick="AssetsPage.openCreate()" aria-label="Add asset">＋</button>` : ''}
    `;
  }

  function _renderAsset(a, canEdit, canDelete) {
    const fmt = FORMATS[a.format] || { label: a.format, icon: '📎', dims: '' };
    const statusChip = {
      draft:    '<span class="chip chip-todo"><span class="chip-dot"></span>Draft</span>',
      review:   '<span class="chip chip-review"><span class="chip-dot"></span>In Review</span>',
      approved: '<span class="chip chip-done"><span class="chip-dot"></span>Approved</span>',
    }[a.status] || '';

    return `
      <div class="card asset-card" ${canEdit ? `onclick="AssetsPage.openEdit('${a.id}')" style="cursor:pointer"` : ''}>
        <!-- Format badge -->
        <div class="asset-format-row">
          <div class="asset-format-badge">
            <span class="asset-format-icon">${fmt.icon}</span>
            <div>
              <div class="asset-format-label">${fmt.label}</div>
              <div class="asset-format-dims">${fmt.dims}</div>
            </div>
          </div>
          ${statusChip}
        </div>

        <!-- Title & Description -->
        <h3 class="asset-name">${_esc(a.name)}</h3>
        ${a.description ? `<p class="asset-desc">${_esc(a.description)}</p>` : ''}

        <!-- Usage -->
        <div class="asset-usage">
          <span class="asset-usage-label">📍 Used at:</span> ${_esc(a.usage || '—')}
        </div>

        <!-- Placed at (reverse lookup) -->
        ${_renderPlacedAt(a.id)}

        <!-- Owner & metadata -->
        <div class="asset-meta">
          <div class="avatar avatar-sm">${_initials(a.owner)}</div>
          <span class="asset-owner">${_esc(a.owner)}</span>
          ${(a.attachments || []).length ? `<span style="font-size:0.7rem;color:var(--text-light)">📎 ${a.attachments.length}</span>` : ''}
        </div>

        ${canDelete ? `
          <button class="btn btn-ghost btn-sm asset-delete" onclick="event.stopPropagation(); AssetsPage.remove('${a.id}')">Delete</button>
        ` : ''}
      </div>
    `;
  }

  function setFilter(f) { _filter = f; App.refresh(); }
  function setFormatFilter(f) { _formatFilter = f; App.refresh(); }

  /* Reverse: find every placement where this asset is assigned */
  function _getAssetPlacements(assetId) {
    const results = [];
    Store.getLocations().forEach(loc => {
      loc.zones.forEach(z => {
        z.placements.forEach(p => {
          if (p.currentAssetId === assetId) {
            results.push({ locationName: loc.name, zoneName: z.name, placementName: p.name });
          }
        });
      });
    });
    return results;
  }
  function _renderPlacedAt(assetId) {
    const pls = _getAssetPlacements(assetId);
    if (pls.length === 0) {
      return `<div class="asset-placed"><span class="asset-placed-none">📭 Not placed anywhere yet</span></div>`;
    }
    return pls.map(pl => `
      <div class="asset-placed">
        <span class="asset-placed-dot">●</span>
        ${_esc(pl.locationName)} · ${_esc(pl.zoneName)} · ${_esc(pl.placementName)}
      </div>
    `).join('');
  }

  function openCreate() {
    if (!Store.Permissions.can('create_asset')) return;
    const team = Store.getTeam();
    if (!team.length) {
      App.showModal('Cannot Create Asset', `
        <div class="empty-state" style="padding:20px 0">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-text">Add team members first.<br>Every asset must have an owner.</div>
        </div>
      `);
      return;
    }
    App.showModal('New Asset', `
      <div class="form-group">
        <label class="form-label">Asset Name *</label>
        <input class="form-input" id="asset-name" placeholder="e.g. Spring Launch Poster" />
      </div>
      <div class="form-group">
        <label class="form-label">Format *</label>
        <select class="form-select" id="asset-format">
          ${Object.entries(FORMATS).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label} (${v.dims})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="asset-desc" rows="2" placeholder="Brief description of this asset"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Where will it be used? *</label>
        <input class="form-input" id="asset-usage" placeholder="e.g. Lobby displays, email headers" />
      </div>
      <div class="form-group">
        <label class="form-label">Owner * <small style="color:var(--danger)">(required)</small></label>
        <select class="form-select" id="asset-owner">
          ${team.map(m => `<option value="${_esc(m.name)}">${_esc(m.name)} — ${_esc(m.role)}</option>`).join('')}
        </select>
        <small style="color:var(--text-light);font-size:0.68rem">Every asset must have one owner</small>
      </div>
      <button class="btn btn-primary btn-block" onclick="AssetsPage.saveCreate()">Create Asset</button>
    `);
  }

  function saveCreate() {
    if (!Store.Permissions.can('create_asset')) return;
    const name = document.getElementById('asset-name').value.trim();
    const usage = document.getElementById('asset-usage').value.trim();
    const owner = document.getElementById('asset-owner').value;
    if (!name || !usage) { alert('Name and usage are required.'); return; }
    if (!owner) { alert('Every asset must have an owner.'); return; }
    Store.addAsset({
      name,
      format: document.getElementById('asset-format').value,
      description: document.getElementById('asset-desc').value.trim(),
      usage,
      owner,
      status: 'draft',
      attachments: [],
    });
    App.closeModal();
    App.refresh();
  }

  function openEdit(id) {
    if (!Store.Permissions.can('edit_asset')) return;
    const a = Store.getAssets().find(x => x.id === id);
    if (!a) return;
    const team = Store.getTeam();

    App.showModal('Edit Asset', `
      <div class="form-group">
        <label class="form-label">Asset Name</label>
        <input class="form-input" id="edit-name" value="${_esc(a.name)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Format</label>
        <select class="form-select" id="edit-format">
          ${Object.entries(FORMATS).map(([k, v]) => `<option value="${k}" ${k === a.format ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="edit-desc" rows="2">${_esc(a.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Where will it be used?</label>
        <input class="form-input" id="edit-usage" value="${_esc(a.usage || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Owner *</label>
        <select class="form-select" id="edit-owner">
          ${team.map(m => `<option value="${_esc(m.name)}" ${m.name === a.owner ? 'selected' : ''}>${_esc(m.name)} — ${_esc(m.role)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary btn-block" onclick="AssetsPage.saveEdit('${a.id}')">Save Changes</button>
    `);
  }

  function saveEdit(id) {
    if (!Store.Permissions.can('edit_asset')) return;
    const owner = document.getElementById('edit-owner').value;
    if (!owner) { alert('Every asset must have an owner.'); return; }
    Store.updateAsset(id, {
      name: document.getElementById('edit-name').value.trim(),
      format: document.getElementById('edit-format').value,
      description: document.getElementById('edit-desc').value.trim(),
      usage: document.getElementById('edit-usage').value.trim(),
      owner,
    });
    App.closeModal();
    App.refresh();
  }

  function remove(id) {
    if (!Store.Permissions.can('delete_asset')) return;
    if (confirm('Delete this asset?')) {
      Store.deleteAsset(id);
      App.refresh();
    }
  }

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _initials(n) { return (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }

  return { render, setFilter, setFormatFilter, openCreate, saveCreate, openEdit, saveEdit, remove };
})();
