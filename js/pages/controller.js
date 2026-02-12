/* ─── Controller Dashboard — Sales & Analytics ─── */
const ControllerPage = (() => {

  function render() {
    const role = Store.getActiveRole();
    const campaigns = Store.getCampaigns();
    const locations = Store.getLocations();
    const activeCamps = campaigns.filter(c => c.status === 'active');

    return `
      <div class="page active" id="page-controller">
        <h1 class="page-title">Analytics Dashboard</h1>
        <p class="page-subtitle">Sales performance, promotion impact & reports</p>

        <!-- KPI Summary Cards -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
          <div class="card" style="text-align:center;padding:16px">
            <div style="font-size:0.7rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px">Jan Revenue</div>
            <div style="font-size:1.6rem;font-weight:800;color:var(--primary)">$148,320</div>
            <div style="font-size:0.7rem;color:#27ae60">▲ 12.4% vs Dec</div>
          </div>
          <div class="card" style="text-align:center;padding:16px">
            <div style="font-size:0.7rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px">Avg Check</div>
            <div style="font-size:1.6rem;font-weight:800;color:var(--primary)">$8.42</div>
            <div style="font-size:0.7rem;color:#27ae60">▲ 3.1%</div>
          </div>
          <div class="card" style="text-align:center;padding:16px">
            <div style="font-size:0.7rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px">Transactions</div>
            <div style="font-size:1.6rem;font-weight:800;color:var(--primary)">17,612</div>
            <div style="font-size:0.7rem;color:#27ae60">▲ 8.7%</div>
          </div>
          <div class="card" style="text-align:center;padding:16px">
            <div style="font-size:0.7rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px">Discount Rate</div>
            <div style="font-size:1.6rem;font-weight:800;color:var(--warning, #E8A640)">6.2%</div>
            <div style="font-size:0.7rem;color:#e74c3c">▲ 0.8%</div>
          </div>
        </div>

        <!-- Sales by Location -->
        <div class="card" style="margin-bottom:16px">
          <div class="section-header"><span class="section-title">Sales by Location — January 2026</span></div>
          ${_renderLocationSales()}
        </div>

        <!-- Top Products -->
        <div class="card" style="margin-bottom:16px">
          <div class="section-header"><span class="section-title">Top Products</span></div>
          ${_renderTopProducts()}
        </div>

        <!-- Promotion Impact -->
        <div class="card" style="margin-bottom:16px">
          <div class="section-header"><span class="section-title">Promotion Impact</span></div>
          ${_renderPromoImpact(activeCamps)}
        </div>

        <!-- Escalation -->
        ${Store.Permissions.can('escalate_issue') ? `
        <div class="card" style="margin-bottom:16px">
          <div class="section-header"><span class="section-title">Escalate Issue</span></div>
          <textarea id="escalation-text" class="form-input" rows="3" placeholder="Describe the issue for Operations..."></textarea>
          <button class="btn btn-primary btn-block" style="margin-top:8px" onclick="ControllerPage.escalate()">Send to Operations</button>
        </div>` : ''}
      </div>
    `;
  }

  function _renderLocationSales() {
    const data = [
      { name: 'Southside Dining Hall', revenue: '$52,140', transactions: '6,190', avg: '$8.42', trend: '+14%' },
      { name: "Ike's Dining Hall",     revenue: '$38,920', transactions: '4,620', avg: '$8.42', trend: '+9%' },
      { name: 'The Globe',             revenue: '$24,680', transactions: '2,930', avg: '$8.42', trend: '+11%' },
      { name: 'Student Union Retail',  revenue: '$18,340', transactions: '2,178', avg: '$8.42', trend: '+7%' },
      { name: 'Johnson Center',        revenue: '$14,240', transactions: '1,694', avg: '$8.40', trend: '+5%' },
    ];
    return data.map(d => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border, #e5e7eb)">
        <div>
          <div style="font-weight:600;font-size:0.85rem">${d.name}</div>
          <div style="font-size:0.7rem;color:var(--text-secondary)">${d.transactions} txns · Avg ${d.avg}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:0.9rem">${d.revenue}</div>
          <div style="font-size:0.7rem;color:#27ae60">${d.trend}</div>
        </div>
      </div>
    `).join('');
  }

  function _renderTopProducts() {
    const products = [
      { name: 'Hot Honey Sandwich', units: 1842, revenue: '$9,201' },
      { name: 'Heart-to-Table Cookie', units: 3210, revenue: '$6,388' },
      { name: 'Unlimited Coffee Plan', units: 412, revenue: '$5,768' },
      { name: 'Monster 4-Pack Case', units: 687, revenue: '$4,809' },
      { name: 'Vegetarian Pho', units: 623, revenue: '$4,984' },
    ];
    return products.map((p, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border, #e5e7eb)">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="width:22px;height:22px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700">${i + 1}</span>
          <div>
            <div style="font-weight:600;font-size:0.85rem">${p.name}</div>
            <div style="font-size:0.7rem;color:var(--text-secondary)">${p.units.toLocaleString()} units sold</div>
          </div>
        </div>
        <div style="font-weight:700;font-size:0.85rem">${p.revenue}</div>
      </div>
    `).join('');
  }

  function _renderPromoImpact(campaigns) {
    const promos = [
      { name: 'Hot Honey Sandwich ($4.99)', lift: '+34%', sales: '$9,201', roi: '4.2x' },
      { name: 'Heart to Table Cookie ($1.99)', lift: '+52%', sales: '$6,388', roi: '8.1x' },
      { name: 'Seven Buck Case Craze', lift: '+18%', sales: '$4,809', roi: '2.8x' },
      { name: '30% Off Coffee & Tea', lift: '+27%', sales: '$5,768', roi: '3.5x' },
    ];
    return promos.map(p => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border, #e5e7eb)">
        <div>
          <div style="font-weight:600;font-size:0.85rem">${p.name}</div>
          <div style="font-size:0.7rem;color:var(--text-secondary)">Sales lift: ${p.lift} · ROI: ${p.roi}</div>
        </div>
        <div style="font-weight:700;font-size:0.85rem;color:var(--primary)">${p.sales}</div>
      </div>
    `).join('');
  }

  function escalate() {
    const text = document.getElementById('escalation-text');
    if (!text || !text.value.trim()) return;
    Store.addActivity(`[ESCALATION] Controller: ${text.value.trim()}`);
    if (typeof NotificationsPage !== 'undefined') {
      NotificationsPage.addNotification({
        type: 'escalation',
        title: 'Issue Escalated by Controller',
        body: text.value.trim(),
        link: '#controller',
      });
    }
    text.value = '';
    App.showModal('Sent', '<p style="text-align:center">Issue escalated to Operations.</p>');
  }

  return { render, escalate };
})();
