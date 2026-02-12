/* ─── Command Center — Executive Operations Visibility ─── */
const CommandPage = (() => {

  let _countersAnimated = false;
  let _feedInterval = null;

  /* ══ Counter animation ══ */
  function _animateCounter(el, target, duration) {
    const start = 0;
    const startTime = performance.now();
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(start + (target - start) * eased);
      el.textContent = current.toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function _startCounters() {
    if (_countersAnimated) return;
    _countersAnimated = true;
    setTimeout(() => {
      document.querySelectorAll('[data-count]').forEach(el => {
        const target = parseInt(el.dataset.count, 10);
        _animateCounter(el, target, 2200);
      });
    }, 300);
  }

  /* ══ Live feed simulation ══ */
  const FEED_EVENTS = [
    { icon: '📋', text: 'New event created — Spring BBQ at UNC Charlotte', time: 'just now' },
    { icon: '✅', text: 'Task approved — Social media calendar Q2', time: '12s ago' },
    { icon: '📁', text: 'Asset uploaded — Campus dining poster v3', time: '34s ago' },
    { icon: '🚀', text: 'Campaign launched — Healthy Eating Week', time: '1m ago' },
    { icon: '👤', text: 'New team member onboarded — Marketing Intern', time: '2m ago' },
    { icon: '📊', text: 'Analytics report generated — Feb engagement', time: '3m ago' },
    { icon: '🔔', text: 'Notification sent — Event reminder blast', time: '4m ago' },
    { icon: '📋', text: 'New event created — Valentine\'s Dinner Special', time: '5m ago' },
    { icon: '✅', text: 'Task approved — Brand guidelines update', time: '6m ago' },
    { icon: '📁', text: 'Asset uploaded — Menu board design final', time: '7m ago' },
    { icon: '🚀', text: 'Campaign launched — Sustainability Month', time: '8m ago' },
    { icon: '👤', text: 'Role assigned — Dietitian at Arizona State', time: '9m ago' },
    { icon: '📊', text: 'Weekly digest published — 12 universities', time: '10m ago' },
    { icon: '✅', text: 'Approval completed — Mural project at Ike\'s', time: '11m ago' },
    { icon: '🔔', text: 'Alert resolved — Display unit maintenance', time: '12m ago' },
  ];

  let _feedIndex = 5;
  function _addFeedItem() {
    const feed = document.getElementById('cmd-feed');
    if (!feed) return;
    const ev = FEED_EVENTS[_feedIndex % FEED_EVENTS.length];
    _feedIndex++;
    const item = document.createElement('div');
    item.className = 'cmd-feed-item cmd-feed-enter';
    item.innerHTML = `<span class="cmd-feed-icon">${ev.icon}</span><span class="cmd-feed-text">${ev.text}</span><span class="cmd-feed-time">just now</span>`;
    feed.insertBefore(item, feed.firstChild);
    requestAnimationFrame(() => { item.classList.remove('cmd-feed-enter'); });
    // Cap at 8
    while (feed.children.length > 8) feed.removeChild(feed.lastChild);
  }

  function _startFeed() {
    if (_feedInterval) clearInterval(_feedInterval);
    _feedInterval = setInterval(_addFeedItem, 4500);
  }

  /* ══ US Network Map (inline SVG) ══ */
  function _renderMap() {
    // Simplified US outline with key cluster points
    // Charlotte HQ, Northeast cluster, Florida cluster, Mid-Atlantic (George Mason)
    return `
      <div class="cmd-map-container" style="position:relative;width:100%;padding-top:62%;overflow:hidden;border-radius:16px;background:#0D1117;border:1px solid rgba(255,255,255,0.06);">
        <svg viewBox="0 0 960 600" style="position:absolute;inset:0;width:100%;height:100%;" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="glowHQ" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glowNode" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="rgba(47,107,255,0.0)"/>
              <stop offset="50%" stop-color="rgba(47,107,255,0.5)"/>
              <stop offset="100%" stop-color="rgba(47,107,255,0.0)"/>
            </linearGradient>
          </defs>

          <!-- US outline (simplified) -->
          <path d="M120,200 L180,120 L260,100 L340,90 L420,85 L500,90 L560,110 L620,130 L680,120 L740,140 L800,160 L840,200 L850,260 L830,320 L800,370 L760,400 L720,440 L680,460 L640,450 L600,470 L560,490 L520,480 L480,460 L440,440 L400,420 L360,430 L320,450 L280,440 L240,420 L200,380 L160,340 L130,300 L120,260 Z"
                fill="none" stroke="rgba(47,107,255,0.12)" stroke-width="1.5"/>

          <!-- Network lines (animated) -->
          <line x1="680" y1="330" x2="780" y2="160" stroke="rgba(47,107,255,0.20)" stroke-width="1" stroke-dasharray="4,4">
            <animate attributeName="stroke-dashoffset" from="0" to="8" dur="2s" repeatCount="indefinite"/>
          </line>
          <line x1="680" y1="330" x2="720" y2="430" stroke="rgba(47,107,255,0.20)" stroke-width="1" stroke-dasharray="4,4">
            <animate attributeName="stroke-dashoffset" from="0" to="8" dur="2.5s" repeatCount="indefinite"/>
          </line>
          <line x1="680" y1="330" x2="740" y2="260" stroke="rgba(47,107,255,0.25)" stroke-width="1.2" stroke-dasharray="4,4">
            <animate attributeName="stroke-dashoffset" from="0" to="8" dur="1.8s" repeatCount="indefinite"/>
          </line>
          <!-- Secondary lines -->
          <line x1="680" y1="330" x2="500" y2="280" stroke="rgba(47,107,255,0.10)" stroke-width="0.8" stroke-dasharray="3,5">
            <animate attributeName="stroke-dashoffset" from="0" to="8" dur="3s" repeatCount="indefinite"/>
          </line>
          <line x1="680" y1="330" x2="400" y2="300" stroke="rgba(47,107,255,0.08)" stroke-width="0.8" stroke-dasharray="3,5">
            <animate attributeName="stroke-dashoffset" from="0" to="8" dur="3.5s" repeatCount="indefinite"/>
          </line>
          <line x1="680" y1="330" x2="300" y2="250" stroke="rgba(47,107,255,0.06)" stroke-width="0.8" stroke-dasharray="3,5">
            <animate attributeName="stroke-dashoffset" from="0" to="8" dur="4s" repeatCount="indefinite"/>
          </line>

          <!-- Scatter nodes (universities) -->
          ${_mapNodes()}

          <!-- HQ: Charlotte, NC -->
          <circle cx="680" cy="330" r="8" fill="rgba(47,107,255,0.3)" filter="url(#glowHQ)">
            <animate attributeName="r" values="8;12;8" dur="3s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="1;0.6;1" dur="3s" repeatCount="indefinite"/>
          </circle>
          <circle cx="680" cy="330" r="4" fill="#2F6BFF"/>
          <text x="680" y="355" text-anchor="middle" fill="#3ED0FF" font-size="10" font-weight="600" font-family="Inter,system-ui,sans-serif">HQ · Charlotte, NC</text>

          <!-- Northeast cluster -->
          <text x="790" y="148" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="9" font-family="Inter,system-ui,sans-serif">Northeast</text>

          <!-- Florida cluster -->
          <text x="715" y="455" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="9" font-family="Inter,system-ui,sans-serif">Florida</text>

          <!-- Mid-Atlantic — George Mason highlighted -->
          <circle cx="740" cy="260" r="5" fill="rgba(62,208,255,0.4)" filter="url(#glowNode)">
            <animate attributeName="opacity" values="1;0.5;1" dur="4s" repeatCount="indefinite"/>
          </circle>
          <circle cx="740" cy="260" r="2.5" fill="#3ED0FF"/>
          <text x="740" y="250" text-anchor="middle" fill="#3ED0FF" font-size="8.5" font-weight="600" font-family="Inter,system-ui,sans-serif">George Mason</text>
        </svg>
      </div>
    `;
  }

  function _mapNodes() {
    // Scatter nodes representing university clusters
    const nodes = [
      // Northeast
      {x:780,y:160,r:3.5}, {x:800,y:170,r:2.5}, {x:770,y:145,r:2}, {x:810,y:155,r:2.5}, {x:765,y:175,r:2},
      // Mid-Atlantic
      {x:755,y:230,r:2.5}, {x:730,y:275,r:2}, {x:720,y:245,r:2}, {x:750,y:280,r:2},
      // Southeast
      {x:700,y:360,r:2.5}, {x:660,y:380,r:2}, {x:640,y:350,r:2},
      // Florida (peninsula — moves southeast of Charlotte)
      {x:700,y:420,r:3}, {x:710,y:440,r:2.5}, {x:720,y:435,r:2}, {x:705,y:460,r:2},
      // Central
      {x:500,y:280,r:2.5}, {x:520,y:300,r:2}, {x:480,y:260,r:2}, {x:460,y:310,r:2},
      // Midwest
      {x:400,y:250,r:2.5}, {x:420,y:230,r:2}, {x:440,y:270,r:2},
      // West
      {x:300,y:250,r:2}, {x:200,y:280,r:2}, {x:250,y:300,r:2}, {x:180,y:240,r:2},
      // Southwest
      {x:340,y:370,r:2}, {x:380,y:350,r:2},
    ];
    return nodes.map((n,i) =>
      `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="rgba(47,107,255,${0.25 + Math.random()*0.2})" filter="url(#glowNode)">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="${3+i*0.3}s" begin="${i*0.2}s" repeatCount="indefinite"/>
      </circle>`
    ).join('');
  }

  /* ══ Render ══ */
  function render() {
    _countersAnimated = false;
    if (_feedInterval) clearInterval(_feedInterval);
    _feedIndex = 5;

    setTimeout(() => { _startCounters(); _startFeed(); }, 100);

    const settings = Store.getSettings();
    const name = settings.name || 'Admin';

    return `
      <style>
        .cmd-page { padding: 20px 16px 100px; }
        .cmd-role-label {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 8px; font-size: 0.7rem; font-weight: 600;
          background: rgba(47,107,255,0.10); color: #3ED0FF; letter-spacing: 0.05em;
          margin-bottom: 20px;
        }
        .cmd-role-dot { width: 6px; height: 6px; border-radius: 50%; background: #3ED0FF; animation: cmdPulse 2s ease-in-out infinite; }
        @keyframes cmdPulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }

        .cmd-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; letter-spacing: -0.02em; }
        .cmd-subtitle { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 28px; }

        /* Counters */
        .cmd-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 28px; }
        .cmd-stat {
          background: var(--card-bg, #111A2E); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px; padding: 18px 16px; position: relative; overflow: hidden;
        }
        .cmd-stat::after {
          content: ''; position: absolute; top: -30px; right: -30px; width: 80px; height: 80px;
          border-radius: 50%; background: rgba(47,107,255,0.05); pointer-events: none;
        }
        .cmd-stat-value {
          font-size: 1.6rem; font-weight: 700; color: #fff; letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums; line-height: 1.2;
        }
        .cmd-stat-label { font-size: 0.7rem; color: var(--text-muted, #8FA4C3); margin-top: 4px; letter-spacing: 0.04em; text-transform: uppercase; }
        .cmd-stat-sub { font-size: 0.65rem; color: var(--text-light, #5A6B86); margin-top: 6px; line-height: 1.4; }
        .cmd-stat.wide { grid-column: 1 / -1; }

        /* Map */
        .cmd-section-label {
          font-size: 0.68rem; font-weight: 600; color: var(--text-muted, #8FA4C3); text-transform: uppercase;
          letter-spacing: 0.1em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
        }
        .cmd-section-label::before { content: ''; width: 18px; height: 1px; background: rgba(47,107,255,0.3); }

        /* Feed */
        .cmd-feed-item {
          display: flex; align-items: center; gap: 12px; padding: 12px 14px;
          background: var(--card-bg, #111A2E); border: 1px solid rgba(255,255,255,0.04);
          border-radius: 12px; margin-bottom: 8px; transition: all 0.4s ease; opacity: 1; transform: translateY(0);
        }
        .cmd-feed-enter { opacity: 0; transform: translateY(-16px); }
        .cmd-feed-icon { font-size: 1rem; flex-shrink: 0; }
        .cmd-feed-text { flex: 1; font-size: 0.8rem; color: var(--text, #E0E6F0); line-height: 1.4; }
        .cmd-feed-time { font-size: 0.65rem; color: var(--text-light, #5A6B86); flex-shrink: 0; white-space: nowrap; }
      </style>

      <div class="cmd-page">

        <!-- Role label -->
        <div class="cmd-role-label">
          <span class="cmd-role-dot"></span>
          Marketing Admin – Campus Level
        </div>

        <h1 class="cmd-title">Internal Operations Visibility</h1>
        <p class="cmd-subtitle">Live overview across 320 universities</p>

        <!-- ── Animated Counters ── -->
        <div class="cmd-stats">
          <div class="cmd-stat">
            <div class="cmd-stat-value" data-count="320">0</div>
            <div class="cmd-stat-label">Universities</div>
          </div>
          <div class="cmd-stat">
            <div class="cmd-stat-value" data-count="635425">0</div>
            <div class="cmd-stat-label">Employees</div>
          </div>
          <div class="cmd-stat wide">
            <div class="cmd-stat-value" data-count="1500000">0</div>
            <div class="cmd-stat-label">Customers Served</div>
            <div class="cmd-stat-sub">Last 12 hours</div>
          </div>
          <div class="cmd-stat wide">
            <div class="cmd-stat-value" data-count="1500000">0</div>
            <div class="cmd-stat-label">Active Platform Users</div>
            <div class="cmd-stat-sub">1,200,000 students · 300,000 guests</div>
          </div>
        </div>

        <!-- ── US Network Map ── -->
        <div class="cmd-section-label">Network Coverage</div>
        ${_renderMap()}

        <div style="display:flex;justify-content:center;gap:20px;margin-top:12px;margin-bottom:28px;">
          <span style="display:flex;align-items:center;gap:5px;font-size:0.65rem;color:var(--text-muted,#8FA4C3);">
            <span style="width:6px;height:6px;border-radius:50%;background:#2F6BFF;"></span> HQ
          </span>
          <span style="display:flex;align-items:center;gap:5px;font-size:0.65rem;color:var(--text-muted,#8FA4C3);">
            <span style="width:6px;height:6px;border-radius:50%;background:#3ED0FF;"></span> Highlighted
          </span>
          <span style="display:flex;align-items:center;gap:5px;font-size:0.65rem;color:var(--text-muted,#8FA4C3);">
            <span style="width:4px;height:4px;border-radius:50%;background:rgba(47,107,255,0.4);"></span> Cluster
          </span>
        </div>

        <!-- ── Live Activity Feed ── -->
        <div class="cmd-section-label">Live Activity</div>
        <div id="cmd-feed">
          ${FEED_EVENTS.slice(0, 5).map(ev => `
            <div class="cmd-feed-item">
              <span class="cmd-feed-icon">${ev.icon}</span>
              <span class="cmd-feed-text">${ev.text}</span>
              <span class="cmd-feed-time">${ev.time}</span>
            </div>
          `).join('')}
        </div>

      </div>
    `;
  }

  return { render };
})();
