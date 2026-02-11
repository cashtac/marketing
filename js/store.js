/* ─── Store — localStorage + API adapter layer ─── */
/*
 * Dual-mode data layer:
 *   API_ENABLED = false  →  all reads/writes go to localStorage (current)
 *   API_ENABLED = true   →  all reads/writes go to /api/* via fetch
 *
 * When backend is ready:
 *   1. Deploy Cloudflare Functions under /functions/api/
 *   2. Set API_ENABLED = true
 *   3. Convert page-level callers to async/await (second pass)
 */
const Store = (() => {

  /* ═══ Seed Version — bump to force reseed ═══ */
  const VERSION = '2026-02-11-v1';
  const VERSION_KEY = 'ims_seed_version';

  /* ═══ API Adapter Config ═══ */
  const API_ENABLED = false;
  const API_BASE = '/api';  // Cloudflare Functions base path

  async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function apiPut(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function apiDelete(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  /* ═══ localStorage Keys ═══ */
  const KEYS = {
    tasks: 'ims_tasks',
    approvals: 'ims_approvals',
    assets: 'ims_assets',
    team: 'ims_team',
    settings: 'ims_settings',
    activity: 'ims_activity',
    locations: 'ims_locations',
    content: 'ims_content',
    campaigns: 'ims_campaigns',
    displayUnits: 'ims_display_units',
    comments: 'ims_comments',
  };

  /* ── Helpers ── */
  const _get = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || null; }
    catch { return null; }
  };
  const _set = (key, val) => localStorage.setItem(key, JSON.stringify(val));
  const _id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const _now = () => new Date().toISOString();

  /* ── Settings ── */
  // API: GET /api/settings · PUT /api/settings
  function getSettings() {
    return _get(KEYS.settings) || {
      role: 'Admin',
      name: 'You',
      avatar: ''
    };
  }
  function saveSettings(s) { _set(KEYS.settings, s); }

  /* ── Team ── */
  // API: GET /api/team · POST /api/team · PUT /api/team/:id · DELETE /api/team/:id
  function getTeam() { return _get(KEYS.team) || []; }
  function saveTeam(t) { _set(KEYS.team, t); }
  function addTeamMember(m) {
    const team = getTeam();
    m.id = _id();
    team.push(m);
    saveTeam(team);
    return m;
  }
  function updateTeamMember(id, data) {
    const team = getTeam();
    const idx = team.findIndex(t => t.id === id);
    if (idx > -1) { Object.assign(team[idx], data); saveTeam(team); }
  }
  function deleteTeamMember(id) {
    saveTeam(getTeam().filter(t => t.id !== id));
  }

  /* ── Tasks ── */
  // API: GET /api/tasks · POST /api/tasks · PUT /api/tasks/:id · DELETE /api/tasks/:id
  function getTasks() { return _get(KEYS.tasks) || []; }
  function saveTasks(t) { _set(KEYS.tasks, t); }
  function addTask(t) {
    if (!t.assignee) return null; // enforce owner
    const tasks = getTasks();
    t.id = _id();
    t.createdAt = _now();
    t.status = t.status || 'draft';
    tasks.unshift(t);
    saveTasks(tasks);
    addActivity(`New task "${t.title}" created`);
    return t;
  }
  function updateTask(id, data) {
    if ('assignee' in data && !data.assignee) return; // never clear owner
    const tasks = getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx > -1) {
      const old = tasks[idx];
      Object.assign(tasks[idx], data);
      saveTasks(tasks);
      if (data.status && data.status !== old.status) {
        addActivity(`Task "${old.title}" moved to ${_statusLabel(data.status)}`);
      }
    }
  }
  function deleteTask(id) {
    const tasks = getTasks();
    const t = tasks.find(x => x.id === id);
    saveTasks(tasks.filter(x => x.id !== id));
    if (t) addActivity(`Task "${t.title}" deleted`);
  }

  /* ── Approvals ── */
  // API: GET /api/approvals · POST /api/approvals · PUT /api/approvals/:id · POST /api/approvals/:id/comments
  function getApprovals() { return _get(KEYS.approvals) || []; }
  function saveApprovals(a) { _set(KEYS.approvals, a); }
  function addApproval(a) {
    const approvals = getApprovals();
    a.id = _id();
    a.createdAt = _now();
    a.status = 'pending';
    a.approval_stage = a.approval_stage || 'manager_review';
    a.comments = [];
    approvals.unshift(a);
    saveApprovals(approvals);
    addActivity(`Approval requested: "${a.title}"`);
    return a;
  }
  function updateApproval(id, data) {
    const approvals = getApprovals();
    const idx = approvals.findIndex(a => a.id === id);
    if (idx > -1) {
      Object.assign(approvals[idx], data);
      saveApprovals(approvals);
      if (data.status) {
        addActivity(`Approval "${approvals[idx].title}" ${data.status}`);
      }
    }
  }
  function addApprovalComment(id, comment) {
    const approvals = getApprovals();
    const idx = approvals.findIndex(a => a.id === id);
    if (idx > -1) {
      // Accept structured object or plain string
      const entry = typeof comment === 'string'
        ? { author: getSettings().name, text: comment, type: 'note', time: _now() }
        : { author: comment.author || getSettings().name, text: comment.text, type: comment.type || 'note', time: comment.time || _now() };
      approvals[idx].comments.push(entry);
      saveApprovals(approvals);
    }
  }

  /* ── Assets ── */
  // API: GET /api/assets · POST /api/assets · PUT /api/assets/:id · DELETE /api/assets/:id
  function getAssets() { return _get(KEYS.assets) || []; }
  function saveAssets(a) { _set(KEYS.assets, a); }
  function addAsset(a) {
    if (!a.owner) return null; // enforce owner
    const assets = getAssets();
    a.id = _id();
    a.createdAt = _now();
    a.createdBy = getSettings().name;
    assets.unshift(a);
    saveAssets(assets);
    addActivity(`Asset "${a.name}" created`);
    return a;
  }
  function updateAsset(id, data) {
    if ('owner' in data && !data.owner) return; // never clear owner
    const assets = getAssets();
    const idx = assets.findIndex(a => a.id === id);
    if (idx > -1) {
      Object.assign(assets[idx], data);
      saveAssets(assets);
      if (data.status) addActivity(`Asset "${assets[idx].name}" → ${data.status}`);
    }
  }
  function deleteAsset(id) {
    const assets = getAssets();
    const a = assets.find(x => x.id === id);
    saveAssets(assets.filter(x => x.id !== id));
    if (a) addActivity(`Asset "${a.name}" deleted`);
  }

  /* ── Content (Video / Social) ── */
  // API: GET /api/content · POST /api/content · PUT /api/content/:id · DELETE /api/content/:id
  function getContent() { return _get(KEYS.content) || []; }
  function saveContent(c) { _set(KEYS.content, c); }

  function addContent(item) {
    if (!item.taskId) return null; // enforce task link
    if (!item.assignee) return null; // enforce owner
    const c = getContent();
    item.id = _id(); item.createdAt = _now();
    item.createdBy = getSettings().name;
    c.unshift(item);
    saveContent(c);
    addActivity(`Content "${item.title}" added`);
    return item;
  }
  function updateContent(id, data) {
    if ('assignee' in data && !data.assignee) return; // never clear owner
    const c = getContent();
    const idx = c.findIndex(x => x.id === id);
    if (idx > -1) {
      Object.assign(c[idx], data);
      saveContent(c);
      if (data.status) addActivity(`Content "${c[idx].title}" → ${data.status}`);
    }
  }
  function deleteContent(id) {
    const c = getContent();
    const item = c.find(x => x.id === id);
    saveContent(c.filter(x => x.id !== id));
    if (item) addActivity(`Content "${item.title}" deleted`);
  }

  /* ── Locations & Screens ── */
  // API: GET /api/locations · POST /api/locations · PUT /api/locations/:id · DELETE /api/locations/:id
  function getLocations() { return _get(KEYS.locations) || []; }
  function saveLocations(l) { _set(KEYS.locations, l); }

  function addLocation(loc) {
    const locs = getLocations();
    loc.id = _id(); loc.createdAt = _now(); loc.zones = loc.zones || [];
    locs.unshift(loc);
    saveLocations(locs);
    addActivity(`Location "${loc.name}" added`);
    return loc;
  }
  function updateLocation(id, data) {
    const locs = getLocations();
    const idx = locs.findIndex(l => l.id === id);
    if (idx > -1) { Object.assign(locs[idx], data); saveLocations(locs); }
  }
  function deleteLocation(id) {
    const locs = getLocations();
    const l = locs.find(x => x.id === id);
    saveLocations(locs.filter(x => x.id !== id));
    if (l) addActivity(`Location "${l.name}" deleted`);
  }

  /* Zone helpers — mutate within a location */
  function _getLocationMut(id) {
    const locs = getLocations();
    const loc = locs.find(l => l.id === id);
    return loc ? { locs, loc } : null;
  }
  function addZone(locationId, zone) {
    const r = _getLocationMut(locationId); if (!r) return;
    zone.id = _id(); zone.placements = zone.placements || [];
    r.loc.zones.push(zone);
    saveLocations(r.locs);
    return zone;
  }
  function updateZone(locationId, zoneId, data) {
    const r = _getLocationMut(locationId); if (!r) return;
    const z = r.loc.zones.find(z => z.id === zoneId);
    if (z) { Object.assign(z, data); saveLocations(r.locs); }
  }
  function deleteZone(locationId, zoneId) {
    const r = _getLocationMut(locationId); if (!r) return;
    r.loc.zones = r.loc.zones.filter(z => z.id !== zoneId);
    saveLocations(r.locs);
  }

  /* Placement helpers — mutate within a zone */
  function addPlacement(locationId, zoneId, placement) {
    const r = _getLocationMut(locationId); if (!r) return;
    const z = r.loc.zones.find(z => z.id === zoneId);
    if (!z) return;
    placement.id = _id();
    placement.currentAssetId = null; placement.currentAssetName = '';
    placement.status = 'empty'; placement.lastUpdated = _now();
    placement.history = [];
    z.placements.push(placement);
    saveLocations(r.locs);
    return placement;
  }
  function updatePlacement(locationId, zoneId, placementId, data) {
    const r = _getLocationMut(locationId); if (!r) return;
    const z = r.loc.zones.find(z => z.id === zoneId);
    if (!z) return;
    const p = z.placements.find(p => p.id === placementId);
    if (p) { Object.assign(p, data); saveLocations(r.locs); }
  }
  function deletePlacement(locationId, zoneId, placementId) {
    const r = _getLocationMut(locationId); if (!r) return;
    const z = r.loc.zones.find(z => z.id === zoneId);
    if (!z) return;
    z.placements = z.placements.filter(p => p.id !== placementId);
    saveLocations(r.locs);
  }

  /* Content assignment — links asset to placement with version history */
  function assignContent(locationId, zoneId, placementId, assetId) {
    const r = _getLocationMut(locationId); if (!r) return;
    const z = r.loc.zones.find(z => z.id === zoneId);
    if (!z) return;
    const p = z.placements.find(p => p.id === placementId);
    if (!p) return;
    const asset = getAssets().find(a => a.id === assetId);
    if (!asset) return;
    // Record history if replacing existing content
    if (p.currentAssetId) {
      p.history.unshift({ assetId: p.currentAssetId, assetName: p.currentAssetName, action: 'replaced', date: _now(), by: getSettings().name });
    }
    p.currentAssetId = assetId;
    p.currentAssetName = asset.name;
    p.status = 'active';
    p.lastUpdated = _now();
    p.history.unshift({ assetId, assetName: asset.name, action: 'assigned', date: _now(), by: getSettings().name });
    saveLocations(r.locs);
    addActivity(`"${asset.name}" assigned to ${p.name} at ${r.loc.name}`);
  }

  function removeContent(locationId, zoneId, placementId) {
    const r = _getLocationMut(locationId); if (!r) return;
    const z = r.loc.zones.find(z => z.id === zoneId);
    if (!z) return;
    const p = z.placements.find(p => p.id === placementId);
    if (!p || !p.currentAssetId) return;
    p.history.unshift({ assetId: p.currentAssetId, assetName: p.currentAssetName, action: 'removed', date: _now(), by: getSettings().name });
    p.currentAssetId = null;
    p.currentAssetName = '';
    p.status = 'empty';
    p.lastUpdated = _now();
    saveLocations(r.locs);
  }

  /* ── Campaigns ── */
  // API: GET /api/campaigns · POST /api/campaigns · PUT /api/campaigns/:id · DELETE /api/campaigns/:id
  function getCampaigns() { return _get(KEYS.campaigns) || []; }
  function saveCampaigns(c) { _set(KEYS.campaigns, c); }
  function addCampaign(c) {
    const list = getCampaigns();
    c.id = _id(); c.createdAt = _now();
    if (!c.status) c.status = 'draft';
    list.unshift(c);
    saveCampaigns(list);
    addActivity(`Campaign created: "${c.name}"`);
    return c;
  }
  function updateCampaign(id, data) {
    const list = getCampaigns();
    const idx = list.findIndex(c => c.id === id);
    if (idx > -1) { Object.assign(list[idx], data); saveCampaigns(list); }
  }
  function deleteCampaign(id) {
    saveCampaigns(getCampaigns().filter(c => c.id !== id));
  }

  /* Upcoming events — campaigns with type 'event' within N days */
  function getUpcomingEvents(daysAhead = 7) {
    const campaigns = getCampaigns();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() + daysAhead);

    return campaigns
      .filter(c => (c.type || '').toLowerCase() === 'event')
      .filter(c => c.start_date)
      .map(c => ({ ...c, _start: new Date(c.start_date + 'T00:00:00') }))
      .filter(c => c._start >= now && c._start <= end)
      .sort((a, b) => a._start - b._start);
  }

  /* ── Display Units ── */
  function getDisplayUnits() { return _get(KEYS.displayUnits) || []; }
  function saveDisplayUnits(d) { _set(KEYS.displayUnits, d); }
  function addDisplayUnit(d) {
    const list = getDisplayUnits();
    d.id = _id(); d.installedAt = _now();
    if (!d.status) d.status = 'active';
    list.push(d);
    saveDisplayUnits(list);
    return d;
  }
  function updateDisplayUnit(id, data) {
    const list = getDisplayUnits();
    const idx = list.findIndex(u => u.id === id);
    if (idx > -1) { Object.assign(list[idx], data); saveDisplayUnits(list); }
  }
  function deleteDisplayUnit(id) {
    saveDisplayUnits(getDisplayUnits().filter(u => u.id !== id));
  }

  /* ── Activity Feed ── */
  function getActivity() { return _get(KEYS.activity) || []; }
  function addActivity(text) {
    const feed = getActivity();
    feed.unshift({ text, time: _now() });
    if (feed.length > 50) feed.length = 50;
    _set(KEYS.activity, feed);
  }

  /* ── Comments (Instagram-style event comments) ── */
  function getComments() { return _get(KEYS.comments) || []; }
  function saveComments(c) { _set(KEYS.comments, c); }
  function getEventComments(eventId) {
    return getComments().filter(c => c.eventId === eventId);
  }
  function addComment({ eventId, userId, text, mentions }) {
    const comments = getComments();
    const comment = {
      id: _id(),
      eventId,
      userId,
      text,
      createdAt: _now(),
      mentions: mentions || [],
    };
    comments.push(comment);
    saveComments(comments);
    addActivity(`New comment on event`);
    return comment;
  }
  function deleteComment(id) {
    saveComments(getComments().filter(c => c.id !== id));
  }

  /* ── Status helpers ── */
  function _statusLabel(s) {
    return { draft: 'Draft', progress: 'In Progress', review: 'Review', approved: 'Approved', published: 'Published' }[s] || s;
  }
  const STATUS_ORDER = ['draft', 'progress', 'review', 'approved', 'published'];
  function nextStatus(current) {
    const i = STATUS_ORDER.indexOf(current);
    return i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : current;
  }
  function prevStatus(current) {
    const i = STATUS_ORDER.indexOf(current);
    return i > 0 ? STATUS_ORDER[i - 1] : current;
  }

  /* ── Expiry checker — runs on each render ── */
  function checkExpiryAndCreateTasks() {
    const today = new Date().toISOString().slice(0, 10);
    const locs = getLocations();
    const campaigns = getCampaigns();
    const tasks = getTasks();
    let locsDirty = false;

    locs.forEach(loc => {
      loc.zones.forEach(zone => {
        zone.placements.forEach(pl => {
          if (!pl.campaignId) return;

          const camp = campaigns.find(c => c.id === pl.campaignId);

          // Compute effective removal date
          let effectiveRemoval = pl.removal_date;
          if (!effectiveRemoval && camp && camp.end_date) {
            // Default: end_date + 1 day
            const d = new Date(camp.end_date + 'T00:00:00');
            d.setDate(d.getDate() + 1);
            effectiveRemoval = d.toISOString().slice(0, 10);
            pl.removal_date = effectiveRemoval;
            locsDirty = true;
          }

          // Check expiry
          if (effectiveRemoval && today > effectiveRemoval) {
            // Mark placement as expired if not already
            if (pl.status !== 'expired') {
              pl.status = 'expired';
              pl.lastUpdated = _now();
              locsDirty = true;
            }

            // Auto-create RemoveExpired task (deduplicate)
            const taskKey = `remove_expired_${pl.id}`;
            const alreadyExists = tasks.some(t => t._expiryKey === taskKey);
            if (!alreadyExists) {
              const newTask = {
                id: _id(),
                title: `Remove expired placement: ${pl.name}`,
                description: `Campaign "${pl.campaignName || 'Unknown'}" has expired at "${loc.name} › ${zone.name}". Physical media should be removed or replaced.`,
                assignee: 'Admin',
                status: 'draft',
                priority: 'high',
                dueDate: effectiveRemoval,
                task_type: 'RemoveExpired',
                _expiryKey: taskKey,
                placementId: pl.id,
                locationName: loc.name,
                zoneName: zone.name,
                createdAt: _now(),
              };
              tasks.unshift(newTask);
              addActivity(`Auto-task: Remove expired placement "${pl.name}" at ${loc.name}`);
            }
          }
        });
      });
    });

    // Auto-create VerifyPlacement tasks for placements not verified in >14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const verCutoff = fourteenDaysAgo.toISOString();

    locs.forEach(loc => {
      loc.zones.forEach(zone => {
        zone.placements.forEach(pl => {
          const needsVerify = !pl.last_verified_at || pl.last_verified_at < verCutoff;
          if (!needsVerify) return;

          const taskKey = `verify_placement_${pl.id}`;
          const alreadyExists = tasks.some(t => t._verifyKey === taskKey);
          if (!alreadyExists) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 3); // due in 3 days
            tasks.unshift({
              id: _id(),
              title: `Verify placement: ${pl.name}`,
              description: `Placement "${pl.name}" at "${loc.name} › ${zone.name}" has not been verified in over 14 days. Please physically verify the placement is correct.`,
              assignee: 'Admin',
              status: 'draft',
              priority: 'medium',
              dueDate: dueDate.toISOString().slice(0, 10),
              task_type: 'VerifyPlacement',
              _verifyKey: taskKey,
              placementId: pl.id,
              locationName: loc.name,
              zoneName: zone.name,
              createdAt: _now(),
            });
            addActivity(`Auto-task: Verify placement "${pl.name}" at ${loc.name}`);
          }
        });
      });
    });

    if (locsDirty) saveLocations(locs);
    saveTasks(tasks);
  }
  /* ── Seed data ── */
  function seed() {
    // Versioned seed: if version mismatch, clear and reseed
    const storedVersion = localStorage.getItem(VERSION_KEY);
    if (storedVersion === VERSION && _get(KEYS.team)) return; // already seeded with current version
    if (storedVersion !== VERSION) { clearAll(); }
    localStorage.setItem(VERSION_KEY, VERSION);

    const team = [
      { id: 'user-alex', name: 'Alex Rivera', role: 'Marketing Director', avatar: '' },
      { id: 'user-jordan', name: 'Jordan Lee', role: 'Marketing Manager', avatar: '' },
      { id: 'user-sam', name: 'Sam Chen', role: 'Graphic Designer', avatar: '' },
      { id: 'user-taylor', name: 'Taylor Kim', role: 'Graphic Designer', avatar: '' },
      { id: 'user-morgan', name: 'Morgan Ellis', role: 'Social Media Manager', avatar: '' },
    ];
    saveTeam(team);

    const tasks = [
      { id: 'task-spring-banners', title: 'Design Spring Campaign Banners', description: 'Create a set of digital banners for the spring product launch. Sizes needed: 1200×628 (Facebook), 1080×1080 (Instagram), 728×90 (web).', context: 'Spring launch is our biggest Q1 revenue driver. These banners will run across all paid channels starting Feb 25.', deliverables: '3 banner sizes in PNG + editable PSD\nColor palette aligned with spring brand guide\nMobile-optimized variants', assignee: 'Sam Chen', status: 'progress', priority: 'high', dueDate: '2026-02-20', attachments: [], createdAt: _now() },
      { id: 'task-q1-analytics', title: 'Review Q1 Analytics Report', description: 'Compile marketing metrics from all Q1 campaigns including paid, organic, and email channels.', context: 'Leadership needs this for the quarterly board meeting. Data informs next quarter budget allocation.', deliverables: 'PDF report with executive summary\nChannel-by-channel breakdown\nTop 5 recommendations', assignee: 'Jordan Lee', status: 'review', priority: 'medium', dueDate: '2026-02-15', attachments: [], createdAt: _now() },
      { id: 'task-social-w8', title: 'Schedule Social Posts — Week 8', description: 'Plan and schedule all social media content for next week across Instagram, Twitter, and LinkedIn.', context: 'Consistent posting schedule maintains engagement momentum. Gap in posts last week caused 15% reach drop.', deliverables: 'Content calendar spreadsheet\nAll post copy + hashtags\nScheduled in Buffer/Hootsuite', assignee: 'Morgan Ellis', status: 'draft', priority: 'medium', dueDate: '2026-02-18', attachments: [], createdAt: _now() },
      { id: 'task-brand-guide', title: 'Update Brand Guidelines PDF', description: 'Incorporate new logo variants, updated typography, and color additions into the brand book.', context: 'Outdated guidelines are causing inconsistent brand usage across teams. Legal flagged this as a priority.', deliverables: 'Updated brand book PDF\nNew logo asset package (SVG + PNG)\nTypography specimen sheet', assignee: 'Taylor Kim', status: 'draft', priority: 'low', dueDate: '2026-02-28', attachments: [], createdAt: _now() },
      { id: 'task-email-redesign', title: 'Email Template Redesign', description: 'Modernize transactional email templates with new brand system.', context: 'Current templates have 12% lower open rate than industry average. Redesign should improve engagement.', deliverables: 'HTML email templates (responsive)\nPreview screenshots', assignee: 'Sam Chen', status: 'published', priority: 'high', dueDate: '2026-02-10', attachments: [], createdAt: _now() },
    ];
    saveTasks(tasks);

    const approvals = [
      { id: 'appr-spring-deck', title: 'Spring Campaign Concept Deck', submittedBy: 'Jordan Lee', description: '12-slide concept deck covering creative direction, target audience, and channel strategy for the spring product launch.', previewType: 'document', context: 'Needed before Feb 25 launch. Budget already allocated.', status: 'pending', approval_stage: 'manager_review', createdAt: _now(), comments: [] },
      { id: 'appr-insta-reel', title: 'New Instagram Reel Script', submittedBy: 'Morgan Ellis', description: '30-second product showcase reel. Script covers hook, feature highlights, and CTA.', previewType: 'video', context: 'Part of weekly content calendar. Scheduled to post Thursday.', status: 'pending', approval_stage: 'admin_review', createdAt: _now(), comments: [] },
      { id: 'appr-hero-banner', title: 'Homepage Hero Banner v2', submittedBy: 'Sam Chen', description: 'Revised 1440×600 hero banner with updated spring color palette and new headline copy.', previewType: 'image', context: 'Replaces current outdated banner. A/B test ready.', status: 'approved', approval_stage: 'approved', createdAt: _now(), comments: [] },
    ];
    saveApprovals(approvals);

    const activities = [
      { text: 'Email Template Redesign marked done', time: _now() },
      { text: 'Spring Campaign Concept Deck submitted for approval', time: _now() },
      { text: 'Sam Chen started Spring Campaign Banners', time: _now() },
    ];
    _set(KEYS.activity, activities);

    const assets = [
      { id: 'asset-spring-poster', name: 'Spring Launch Poster', format: 'poster_22x28', usage: 'Lobby display boards, event entrance', status: 'draft', owner: 'Sam Chen', description: 'Large-format poster for spring product launch event', createdAt: _now(), createdBy: 'Jordan Lee', attachments: [] },
      { id: 'asset-q1-onepager', name: 'Q1 Results One-Pager', format: 'us_letter', usage: 'Stakeholder handouts, email attachment', status: 'review', owner: 'Jordan Lee', description: 'Summary of Q1 marketing results for leadership review', createdAt: _now(), createdBy: 'Jordan Lee', attachments: [] },
      { id: 'asset-spring-promo', name: 'Spring Promo — Instagram', format: 'social_media', usage: 'Instagram feed, Facebook, LinkedIn', status: 'approved', owner: 'Morgan Ellis', description: '1080×1080 promotional graphic for spring campaign social push', createdAt: _now(), createdBy: 'Sam Chen', attachments: [] },
      { id: 'asset-cafe-board', name: 'Cafeteria Event Board', format: 'event_board', usage: 'Digital screens in cafeteria and common areas', status: 'draft', owner: 'Taylor Kim', description: 'Rotating event display for upcoming spring launch party', createdAt: _now(), createdBy: 'Jordan Lee', attachments: [] },
      { id: 'asset-lobby-screen', name: 'Lobby Welcome Screen', format: 'digital_screen', usage: 'Lobby digital signage, reception area', status: 'review', owner: 'Sam Chen', description: '1920×1080 welcome display with brand messaging', createdAt: _now(), createdBy: 'Jordan Lee', attachments: [] },
    ];
    saveAssets(assets);

    /* Locations & Screens seed */
    const loc1Id = 'loc-southside', loc2Id = 'loc-student-union', loc3Id = 'loc-globe', loc4Id = 'loc-ikes', loc5Id = 'loc-jc';
    const z1a = 'zone-ss-entrance', z1b = 'zone-ss-cashier', z1c = 'zone-ss-wall';
    const z2a = 'zone-su-storefront', z2b = 'zone-su-checkout';
    const z3a = 'zone-gl-entrance', z3b = 'zone-gl-dining';
    const z4a = 'zone-ik-entrance', z4b = 'zone-ik-mainwall', z4c = 'zone-ik-multiroom';
    const z5a = 'zone-jc-common';
    const locations = [
      {
        id: loc1Id, name: 'Southside Dining Hall', type: 'dining_hall',
        manager: 'Jordan Lee', createdAt: _now(),
        zones: [
          { id: z1a, name: 'Entrance', placements: [
            { id: 'pl-ss-ent-digital', name: 'Entrance Digital Sign', type: 'digital_screen', resolution: '1920x1080', orientation: 'landscape', format: null, currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: 'Rotate every 15s', history: [] },
            { id: 'pl-ss-ent-poster', name: 'Welcome Poster Frame', type: 'poster_22x28', resolution: null, orientation: 'portrait', format: '22x28', currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: '', history: [] },
          ]},
          { id: z1b, name: 'Cashier Area', placements: [
            { id: 'pl-ss-menu', name: 'Menu Board Screen', type: 'digital_screen', resolution: '3840x2160', orientation: 'landscape', format: null, currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: 'Static during service hours', history: [] },
            { id: 'pl-ss-flyer', name: 'Promo Flyer Holder', type: 'us_letter', resolution: null, orientation: 'portrait', format: 'us_letter', currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: '', history: [] },
          ]},
          { id: z1c, name: '1st Floor Wall', placements: [
            { id: 'pl-ss-wall-board', name: 'Wall Event Board', type: 'event_board', resolution: '1920x1080', orientation: 'landscape', format: null, currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: 'Update weekly', history: [] },
            { id: 'pl-ss-poster-a', name: 'Campaign Poster A', type: 'poster_22x28', resolution: null, orientation: 'portrait', format: '22x28', currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: '', history: [] },
            { id: 'pl-ss-poster-b', name: 'Campaign Poster B', type: 'poster_22x28', resolution: null, orientation: 'portrait', format: '22x28', currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: '', history: [] },
          ]},
        ],
      },
      {
        id: loc2Id, name: 'Student Union Retail', type: 'retail',
        manager: 'Morgan Ellis', createdAt: _now(),
        zones: [
          { id: z2a, name: 'Storefront Window', placements: [
            { id: 'pl-su-digital', name: 'Window Digital Panel', type: 'digital_screen', resolution: '1920x1080', orientation: 'portrait', format: null, currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: 'Rotate every 10s', history: [] },
            { id: 'pl-su-poster', name: 'Window Poster Frame', type: 'poster_22x28', resolution: null, orientation: 'portrait', format: '22x28', currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: '', history: [] },
          ]},
          { id: z2b, name: 'Checkout Counter', placements: [
            { id: 'pl-su-flyer', name: 'Counter Flyer Stand', type: 'us_letter', resolution: null, orientation: 'portrait', format: 'us_letter', currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: '', history: [] },
          ]},
        ],
      },
      {
        id: loc3Id, name: 'The Globe (The Globe Grill)', type: 'dining_hall',
        manager: 'Jordan Lee', createdAt: _now(),
        zones: [
          { id: z3a, name: 'Entrance', placements: [
            { id: 'pl-gl-aframe', name: 'A-Frame Sign', type: 'a_frame', resolution: null, orientation: 'portrait', format: '22x28', currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: '', history: [] },
          ]},
          { id: z3b, name: 'Dining Area Wall', placements: [
            { id: 'pl-gl-wall-board', name: 'Wall Event Board', type: 'event_board', resolution: '1920x1080', orientation: 'landscape', format: null, currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: 'Update weekly', history: [] },
          ]},
        ],
      },
      {
        id: loc4Id, name: "Ike's Dining Hall", type: 'dining_hall',
        manager: 'Sam Chen', createdAt: _now(),
        zones: [
          { id: z4a, name: 'Entrance', placements: [
            { id: 'pl-ik-aframe', name: 'A-Frame Sign', type: 'a_frame', resolution: null, orientation: 'portrait', format: '22x28', currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: '', history: [] },
          ]},
          { id: z4b, name: 'Main Wall', placements: [
            { id: 'pl-ik-wall-board', name: 'Wall Event Board (What\'s Happening in the House)', type: 'event_board', resolution: '1920x1080', orientation: 'landscape', format: null, currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: 'Update weekly', history: [] },
          ]},
          { id: z4c, name: 'Multipurpose Room', placements: [
            { id: 'pl-ik-poster', name: 'Event Poster Frame', type: 'poster_22x28', resolution: null, orientation: 'portrait', format: '22x28', currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: '', history: [] },
          ]},
        ],
      },
      {
        id: loc5Id, name: 'Johnson Center', type: 'retail',
        manager: 'Taylor Kim', createdAt: _now(),
        zones: [
          { id: z5a, name: 'Common Area', placements: [
            { id: 'pl-jc-board', name: 'Event Board (Area Board)', type: 'event_board', resolution: '1920x1080', orientation: 'landscape', format: null, currentAssetId: null, currentAssetName: '', status: 'empty', installedAt: _now(), lastUpdated: _now(), schedule: 'Update weekly', history: [] },
          ]},
        ],
      },
    ];
    saveLocations(locations);

    /* Campaigns seed */
    const camp1 = { id: 'camp-spring-2026', name: 'Spring Launch 2026', type: 'seasonal', description: 'Campus-wide spring product launch campaign across all dining and retail locations.', start_date: '2026-02-15', end_date: '2026-04-01', status: 'active', createdAt: _now() };
    const camp2 = { id: 'camp-welcome-week', name: 'Welcome Week', type: 'event', description: 'New student welcome week posters and digital signage.', start_date: '2026-01-20', end_date: '2026-02-05', status: 'expired', createdAt: _now() };
    const camp3 = { id: 'camp-healthy-eating', name: 'Healthy Eating Initiative', type: 'ongoing', description: 'Year-round nutritional awareness campaign for dining halls.', start_date: '2026-01-01', end_date: '2026-12-31', status: 'active', createdAt: _now() };

    /* Event campaigns — Feb 2026 */
    const campCasino = { id: 'camp-casino-night', name: 'Supper Club: Casino Night', type: 'event', description: 'Supper Club Casino Night at The Globe. QR code / RSVP (limited spots). 6–8 PM.', start_date: '2026-02-27', end_date: '2026-02-27', removal_date: '2026-02-28', status: 'active', createdAt: _now() };
    const campChocChar = { id: 'camp-choc-char', name: 'First Year Eats: Chocolate & Charcuterie', type: 'event', description: 'Chocolate-dipped treats + build-your-own charcuterie box. Dinner at Ike\'s Multipurpose Room.', start_date: '2026-02-13', end_date: '2026-02-13', removal_date: '2026-02-14', status: 'expired', createdAt: _now() };
    const campValCook = { id: 'camp-val-cook', name: 'Teaching Kitchen: Valentine\'s Cooking Class', type: 'event', description: 'Valentine\'s cooking class for 1st Year & Transfer Students. Free event. 2:00–4:00 PM at Ike\'s Multipurpose Room.', start_date: '2026-02-12', end_date: '2026-02-12', removal_date: '2026-02-13', status: 'expired', createdAt: _now() };
    const campFanFoodie = { id: 'camp-fan-foodie', name: 'Fan Foodie Feast: Big Game Edition', type: 'event', description: 'Big game day fan feast at Ike\'s Dining Hall. 5–7 PM.', start_date: '2026-02-05', end_date: '2026-02-05', removal_date: '2026-02-06', status: 'expired', createdAt: _now() };
    const campFebCal = { id: 'camp-feb-cal', name: 'February Events Calendar', type: 'calendar', description: 'Monthly calendar board listing all February dining events.', start_date: '2026-02-01', end_date: '2026-02-28', removal_date: '2026-03-01', status: 'active', createdAt: _now() };
    const campVegPho = { id: 'camp-veg-pho', name: 'Vegetarian Pho', type: 'event', description: 'Vegetarian Pho special at The Spot. 11am–1pm.', start_date: '2026-02-02', end_date: '2026-02-02', removal_date: '2026-02-03', status: 'expired', createdAt: _now() };
    const campCoffeeScrub = { id: 'camp-coffee-scrub', name: 'Coffee & Sustainable Coffee Body Scrub', type: 'event', description: 'Coffee & sustainable coffee body scrub event. 12pm at Southside, 1st Floor.', start_date: '2026-02-03', end_date: '2026-02-03', removal_date: '2026-02-04', status: 'expired', createdAt: _now() };
    const campMilkHoney = { id: 'camp-milk-honey', name: 'Restaurant Takeover: Milk & Honey', type: 'event', description: 'Milk & Honey restaurant takeover at Southside. Lunch.', start_date: '2026-02-03', end_date: '2026-02-03', removal_date: '2026-02-04', status: 'expired', createdAt: _now() };
    const campShawarma = { id: 'camp-shawarma', name: 'Chef George Shawarma Pop-Up', type: 'event', description: 'Chef George shawarma pop-up at Southside. Lunch.', start_date: '2026-02-04', end_date: '2026-02-04', removal_date: '2026-02-05', status: 'expired', createdAt: _now() };
    const campFanFoodie2 = { id: 'camp-fan-foodie2', name: 'Fan Foodie Feast (Calendar)', type: 'event', description: 'Fan Foodie Feast at Ike\'s. 5–7pm. (Calendar entry)', start_date: '2026-02-05', end_date: '2026-02-05', removal_date: '2026-02-06', status: 'expired', createdAt: _now() };
    const campMeetMegan = { id: 'camp-meet-megan', name: 'Meet & Greet: Chef Megan Wallace', type: 'event', description: 'Meet & greet with Chef Megan Wallace at The Spot.', start_date: '2026-02-10', end_date: '2026-02-10', removal_date: '2026-02-11', status: 'expired', createdAt: _now() };
    const campTeachWill = { id: 'camp-teach-will', name: 'Teaching Kitchen with Chef Will', type: 'event', description: 'Teaching Kitchen with Chef Will. 2–4pm at Ike\'s Multipurpose Room.', start_date: '2026-02-12', end_date: '2026-02-12', removal_date: '2026-02-13', status: 'expired', createdAt: _now() };
    const campChocChar2 = { id: 'camp-choc-char2', name: 'First Year Eats: Chocolate & Charcuterie (Calendar)', type: 'event', description: 'Chocolate & charcuterie dinner at Ike\'s Multipurpose Room. (Calendar entry)', start_date: '2026-02-13', end_date: '2026-02-13', removal_date: '2026-02-14', status: 'expired', createdAt: _now() };
    const campDelight = { id: 'camp-delight', name: 'Delight-FUL: A Week of Random Acts of Joy', type: 'event', description: 'A week of random acts of joy across campus dining. Feb 16–20.', start_date: '2026-02-16', end_date: '2026-02-20', removal_date: '2026-02-21', status: 'active', createdAt: _now() };
    const campDunkin = { id: 'camp-dunkin', name: 'Dunkin\' Cruiser | Love, Mason Dining', type: 'event', description: 'Dunkin\' Cruiser event — Love, Mason Dining. Feb 20.', start_date: '2026-02-20', end_date: '2026-02-20', removal_date: '2026-02-21', status: 'active', createdAt: _now() };
    const campWeighWaste = { id: 'camp-weigh-waste', name: 'Weigh the Waste with Gabby', type: 'event', description: 'Weigh the Waste sustainability event with Gabby. 12pm at Southside.', start_date: '2026-02-25', end_date: '2026-02-25', removal_date: '2026-02-26', status: 'active', createdAt: _now() };
    const campCasino2 = { id: 'camp-casino2', name: 'Supper Club: Casino Night (Calendar)', type: 'event', description: 'Supper Club Casino Night at The Globe. 6–8pm. (Calendar entry)', start_date: '2026-02-27', end_date: '2026-02-27', removal_date: '2026-02-28', status: 'active', createdAt: _now() };

    saveCampaigns([camp1, camp2, camp3,
      campCasino, campChocChar, campValCook, campFanFoodie, campFebCal,
      campVegPho, campCoffeeScrub, campMilkHoney, campShawarma, campFanFoodie2,
      campMeetMegan, campTeachWill, campChocChar2, campDelight, campDunkin,
      campWeighWaste, campCasino2
    ]);

    /* Display Units seed */
    const displayUnits = [
      { id: 'du-ss-ent-poster', locationId: loc1Id, zoneId: z1a, name: 'Entrance Poster Frame A', format_type: 'poster_22x28', physical_specs: { width: 22, height: 28, material: 'Aluminum frame' }, status: 'active', installedAt: _now() },
      { id: 'du-ss-cashier-banner', locationId: loc1Id, zoneId: z1b, name: 'Cashier Banner Stand', format_type: 'banner_stand', physical_specs: { width: 33, height: 78, material: 'Retractable banner' }, status: 'active', installedAt: _now() },
      { id: 'du-ss-wall-aframe', locationId: loc1Id, zoneId: z1c, name: 'Main Wall A-Frame', format_type: 'a_frame', physical_specs: { width: 24, height: 36, material: 'Corrugated plastic' }, status: 'active', installedAt: _now() },
      { id: 'du-su-storefront', locationId: loc2Id, zoneId: z2a, name: 'Storefront Poster Case', format_type: 'poster_22x28', physical_specs: { width: 22, height: 28, material: 'Acrylic case' }, status: 'active', installedAt: _now() },
      { id: 'du-gl-aframe', locationId: loc3Id, zoneId: z3a, name: 'Globe A-Frame', format_type: 'a_frame', physical_specs: { width: 22, height: 28, material: 'Corrugated plastic' }, status: 'active', installedAt: _now() },
      { id: 'du-ik-aframe', locationId: loc4Id, zoneId: z4a, name: 'Ike\'s A-Frame', format_type: 'a_frame', physical_specs: { width: 22, height: 28, material: 'Corrugated plastic' }, status: 'active', installedAt: _now() },
      { id: 'du-jc-board', locationId: loc5Id, zoneId: z5a, name: 'JC Area Event Board', format_type: 'event_board', physical_specs: { width: 48, height: 36, material: 'Cork board' }, status: 'active', installedAt: _now() },
    ];
    saveDisplayUnits(displayUnits);

    /* ── Assign campaigns to placements ── */
    // Existing original assignments
    locations[0].zones[0].placements[1].campaignId = camp1.id;
    locations[0].zones[0].placements[1].campaignName = camp1.name;
    locations[0].zones[0].placements[1].campaign_type = camp1.type;
    locations[0].zones[0].placements[1].removal_date = '2026-04-01';
    locations[0].zones[2].placements[0].campaignId = camp3.id;
    locations[0].zones[2].placements[0].campaignName = camp3.name;
    locations[0].zones[2].placements[0].campaign_type = camp3.type;
    locations[0].zones[2].placements[0].removal_date = '2026-12-31';
    locations[1].zones[0].placements[1].campaignId = camp2.id;
    locations[1].zones[0].placements[1].campaignName = camp2.name;
    locations[1].zones[0].placements[1].campaign_type = camp2.type;
    locations[1].zones[0].placements[1].removal_date = '2026-02-05';

    // Event 1 — Casino Night → Globe A-Frame, Globe Wall Event Board, JC Event Board
    const _assignCamp = (loc, zi, pi, camp) => {
      loc.zones[zi].placements[pi].campaignId = camp.id;
      loc.zones[zi].placements[pi].campaignName = camp.name;
      loc.zones[zi].placements[pi].campaign_type = camp.type;
      loc.zones[zi].placements[pi].removal_date = camp.removal_date || '';
      loc.zones[zi].placements[pi].status = 'active';
    };
    _assignCamp(locations[2], 0, 0, campCasino); // Globe A-Frame
    _assignCamp(locations[2], 1, 0, campCasino); // Globe Wall Event Board ("What's Happening Around the Table")
    _assignCamp(locations[4], 0, 0, campCasino); // JC Event Board

    // Event 2 — Chocolate & Charcuterie → Southside Wall Event Board, Ike's A-Frame
    _assignCamp(locations[0], 2, 0, campChocChar); // Southside wall event board
    _assignCamp(locations[3], 0, 0, campChocChar); // Ike's A-Frame

    // Event 3 — Valentine's Cooking Class → Ike's A-Frame (already taken, use poster)
    _assignCamp(locations[3], 2, 0, campValCook); // Ike's Multipurpose Room Event Poster Frame

    // Event 4 — Fan Foodie Feast → Ike's Wall Board
    _assignCamp(locations[3], 1, 0, campFanFoodie); // Ike's Wall Event Board

    // February Calendar Board → Southside Campaign Poster A
    _assignCamp(locations[0], 2, 1, campFebCal); // Southside 1st Floor Wall — Campaign Poster A

    saveLocations(locations);

    /* Content seed — linked to tasks */
    const taskList = getTasks();
    const contentItems = [
      { id: 'content-spring-video', title: 'Spring Campaign Launch Video', platform: 'youtube', type: 'long_form', description: 'Full product launch video for YouTube channel. 3-5 min. Covers features, pricing, and CTA.', status: 'draft', assignee: 'Sam Chen', taskId: taskList[0]?.id || '', taskTitle: taskList[0]?.title || 'Unlinked', createdAt: _now(), createdBy: 'Jordan Lee' },
      { id: 'content-spring-reel', title: 'Spring Promo Reel', platform: 'instagram', type: 'reel', description: '15-second teaser reel for Instagram. Quick cuts, trending audio, product highlights.', status: 'review', assignee: 'Morgan Ellis', taskId: taskList[2]?.id || '', taskTitle: taskList[2]?.title || 'Unlinked', createdAt: _now(), createdBy: 'Jordan Lee' },
      { id: 'content-bts-tiktok', title: 'Behind the Scenes TikTok', platform: 'tiktok', type: 'short_form', description: 'BTS of the spring photoshoot. Casual tone, 30-60s, vertical format.', status: 'draft', assignee: 'Morgan Ellis', taskId: taskList[2]?.id || '', taskTitle: taskList[2]?.title || 'Unlinked', createdAt: _now(), createdBy: 'Morgan Ellis' },
      { id: 'content-q1-recap', title: 'Q1 Recap LinkedIn Video', platform: 'linkedin', type: 'long_form', description: 'Professional recap of Q1 marketing results for LinkedIn. Data-driven, 2 min.', status: 'approved', assignee: 'Jordan Lee', taskId: taskList[1]?.id || '', taskTitle: taskList[1]?.title || 'Unlinked', createdAt: _now(), createdBy: 'Jordan Lee' },
    ];
    saveContent(contentItems);

    /* Seed demo comments on events */
    const seedComments = [
      { id: 'comment-1', eventId: 'camp-casino-night', userId: 'user-jordan', text: 'Need to finalize the QR code design by Feb 20. @Sam Chen can you prep the artwork?', createdAt: '2026-02-10T14:30:00Z', mentions: ['user-sam'] },
      { id: 'comment-2', eventId: 'camp-casino-night', userId: 'user-sam', text: 'On it! Draft will be ready by EOD Thursday.', createdAt: '2026-02-10T15:05:00Z', mentions: [] },
      { id: 'comment-3', eventId: 'camp-delight', userId: 'user-morgan', text: 'I\'ll handle the social teasers for this. @Jordan Lee should we do countdown posts?', createdAt: '2026-02-11T09:00:00Z', mentions: ['user-jordan'] },
      { id: 'comment-4', eventId: 'camp-spring-2026', userId: 'user-alex', text: 'Great progress on the banners. Let\'s make sure all locations have updated materials by Feb 25.', createdAt: '2026-02-09T11:20:00Z', mentions: [] },
    ];
    saveComments(seedComments);

    saveSettings({ role: 'Admin', name: 'You', avatar: '' });
  }

  /* ── Clear all ── */
  function clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(VERSION_KEY);
  }

  /* ── Permissions ── */
  const Permissions = {
    /*  Which pages each role can see  */
    pages: {
      'Admin':                  ['dashboard','tasks','approvals','assets','content','campaigns','locations','team','settings'],
      'Marketing Director':     ['dashboard','approvals','content','campaigns','locations','settings'],
      'Marketing Manager':      ['dashboard','tasks','approvals','assets','content','campaigns','locations','settings'],
      'Graphic Designer':       ['dashboard','tasks','assets','content','locations','settings'],
      'Social Media Manager':   ['dashboard','tasks','assets','content','locations','settings'],
    },

    /*  Action capabilities per role  */
    can(action) {
      const role = getSettings().role;
      const matrix = {
        /* Task actions */
        'create_task':       ['Admin'],
        'edit_task':         ['Admin', 'Marketing Manager'],
        'delete_task':       ['Admin'],
        'advance_task':      ['Admin', 'Marketing Manager', 'Graphic Designer', 'Social Media Manager'],

        /* Approval actions */
        'approve':           ['Admin', 'Marketing Director'],
        'request_changes':   ['Admin', 'Marketing Director'],
        'submit_approval':   ['Admin', 'Marketing Manager'],
        'comment_approval':  ['Admin', 'Marketing Director', 'Marketing Manager'],

        /* Asset actions */
        'create_asset':      ['Admin', 'Marketing Manager'],
        'edit_asset':        ['Admin', 'Marketing Manager'],
        'delete_asset':      ['Admin'],

        /* Location actions */
        'manage_locations':  ['Admin', 'Marketing Manager'],
        'assign_content':    ['Admin', 'Marketing Manager', 'Graphic Designer', 'Social Media Manager'],

        /* Campaign actions */
        'manage_campaigns':  ['Admin', 'Marketing Manager'],

        /* Content actions */
        'create_content':    ['Admin', 'Marketing Manager', 'Social Media Manager'],
        'edit_content':      ['Admin', 'Marketing Manager', 'Social Media Manager'],
        'delete_content':    ['Admin'],

        /* Team management */
        'manage_team':       ['Admin'],

        /* Settings */
        'export_data':       ['Admin'],
        'clear_data':        ['Admin'],
      };
      return (matrix[action] || []).includes(role);
    },

    /*  Whether a role can see a page  */
    canAccessPage(page) {
      const role = getSettings().role;
      return (this.pages[role] || []).includes(page);
    },

    /*  Which pages the current role can see  */
    visiblePages() {
      const role = getSettings().role;
      return this.pages[role] || ['dashboard', 'settings'];
    },

    /*  Filter tasks for the current role  */
    filterTasks(tasks) {
      const role = getSettings().role;
      const name = getSettings().name;
      if (role === 'Admin' || role === 'Marketing Manager') return tasks;
      // Designers & SMM see only their assigned tasks
      return tasks.filter(t => t.assignee === name);
    },

    /*  Filter approvals for the current role  */
    filterApprovals(approvals) {
      const role = getSettings().role;
      const name = getSettings().name;
      if (role === 'Admin' || role === 'Marketing Director') return approvals;
      // Manager sees all (they submit); designers/SMM see only their own
      if (role === 'Marketing Manager') return approvals;
      return approvals.filter(a => a.submittedBy === name);
    },

    /*  Filter assets for the current role  */
    filterAssets(assets) {
      const role = getSettings().role;
      const name = getSettings().name;
      if (role === 'Admin' || role === 'Marketing Manager' || role === 'Marketing Director') return assets;
      return assets.filter(a => a.owner === name);
    },

    /*  Filter content for the current role  */
    filterContent(content) {
      const role = getSettings().role;
      const name = getSettings().name;
      if (role === 'Admin' || role === 'Marketing Manager' || role === 'Marketing Director') return content;
      return content.filter(c => c.assignee === name);
    },

    /* Items for the "More" drawer — role-based */
    drawerItems() {
      const role = getSettings().role;
      const ALL = [
        { page: 'assets',    icon: '📁', label: 'Assets' },
        { page: 'content',   icon: '🎬', label: 'Content' },
        { page: 'campaigns', icon: '📣', label: 'Campaigns' },
        { page: 'approvals', icon: '⏱️', label: 'Approvals' },
        { page: 'team',      icon: '👥', label: 'Team' },
        { page: 'settings',  icon: '⚙️', label: 'Settings' },
      ];
      const map = {
        'Admin':                  ['assets','content','campaigns','approvals','team','settings'],
        'Marketing Director':     ['content','campaigns','approvals','settings'],
        'Marketing Manager':      ['assets','content','campaigns','settings'],
        'Graphic Designer':       ['assets','content','settings'],
        'Social Media Manager':   ['content','settings'],
      };
      const allowed = map[role] || ['settings'];
      return ALL.filter(i => allowed.includes(i.page));
    },

    /*  Default landing page for the current role  */
    defaultPage() {
      return 'dashboard';
    },
  };

  return {
    VERSION,
    getSettings, saveSettings,
    getTeam, saveTeam, addTeamMember, updateTeamMember, deleteTeamMember,
    getTasks, saveTasks, addTask, updateTask, deleteTask,
    getApprovals, saveApprovals, addApproval, updateApproval, addApprovalComment,
    getAssets, saveAssets, addAsset, updateAsset, deleteAsset,
    getContent, saveContent, addContent, updateContent, deleteContent,
    getLocations, saveLocations, addLocation, updateLocation, deleteLocation,
    addZone, updateZone, deleteZone,
    addPlacement, updatePlacement, deletePlacement,
    assignContent, removeContent,
    getCampaigns, saveCampaigns, addCampaign, updateCampaign, deleteCampaign, getUpcomingEvents,
    getDisplayUnits, saveDisplayUnits, addDisplayUnit, updateDisplayUnit, deleteDisplayUnit,
    getActivity, addActivity,
    getComments, getEventComments, addComment, deleteComment,
    nextStatus, prevStatus, STATUS_ORDER,
    Permissions,
    seed, clearAll, checkExpiryAndCreateTasks,
    /* API adapter — use when API_ENABLED is flipped to true */
    API_ENABLED, apiGet, apiPost, apiPut, apiDelete,
  };
})();
