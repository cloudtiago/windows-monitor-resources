/* global app.js — Monitor de Recursos Windows 11 */

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  processes: [],
  networkData: [],
  system: {},
  events: [],
  sortKey: 'cpu',
  sortDir: -1,
  filter: 'all',
  search: '',
  netSearch: '',
  cpuHistory: [],
  ramHistory: [],
  maxHistory: 30,
  procCpuHistory: {},
  expandedPids: new Set(),
};

// ── DOM Refs ───────────────────────────────────────────────────────────────
const $$ = id => document.getElementById(id);
const dot         = $$('connection-dot');
const connText    = $$('connection-text');
const lastUpdate  = $$('last-update');
const procCount   = $$('proc-count');
const cpuValue    = $$('cpu-value');
const ramValue    = $$('ram-value');
const cpuBar      = $$('cpu-bar');
const ramBar      = $$('ram-bar');
const alertCount  = $$('alert-count');
const alertNames  = $$('alert-names');
const alertCard   = $$('kpi-alert');
const alertBanner = $$('alerts-banner');
const alertsList  = $$('alerts-list');
const totalProcs  = $$('total-procs');
const ramDetail   = $$('ram-detail');
const tbody       = $$('proc-tbody');
const searchInput = $$('search-input');
const visibleCount= $$('visible-count');
const eventLog    = $$('event-log');
const eventCount  = $$('event-count');
const toastCont   = $$('toast-container');
const netAppsCount= $$('net-apps-count');
const netSub      = $$('net-sub');
const netTbody    = $$('net-tbody');
const netVisCount = $$('net-visible-count');

// ── Charts ─────────────────────────────────────────────────────────────────
function makeSparkline(canvasId, color) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array(state.maxHistory).fill(''),
      datasets: [{
        data: Array(state.maxHistory).fill(0),
        borderColor: color,
        borderWidth: 1.5,
        fill: true,
        backgroundColor: color + '18',
        pointRadius: 0,
        tension: 0.4
      }]
    },
    options: {
      animation: false,
      responsive: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false, min: 0, max: 100 }
      }
    }
  });
}

const cpuChart = makeSparkline('cpu-chart', '#9f67ff');
const ramChart = makeSparkline('ram-chart', '#22d3ee');

function pushHistory(arr, value) {
  arr.push(value);
  if (arr.length > state.maxHistory) arr.shift();
}

function updateChart(chart, histArr) {
  chart.data.datasets[0].data = [...histArr];
  chart.update('none');
}

// ── Socket.io ──────────────────────────────────────────────────────────────
const socket = io();

socket.on('connect', () => {
  dot.className = 'status-dot connected';
  connText.textContent = 'Conectado — atualizando a cada 2.5s';
  toast('Conectado ao servidor de monitoramento', 'success');
});

socket.on('disconnect', () => {
  dot.className = 'status-dot error';
  connText.textContent = 'Desconectado — tentando reconectar...';
  toast('Conexão perdida com o servidor', 'error');
});

socket.on('metrics', (data) => {
  state.processes   = data.processes   || [];
  state.networkData = data.networkData || [];
  state.system      = data.system      || {};
  state.events      = data.eventLog    || [];

  updateKPIs();
  renderTable();
  renderNetworkTable();
  renderEvents();
  handleNewEvents(data.newEvents || []);

  const now = new Date();
  lastUpdate.textContent = now.toLocaleTimeString('pt-BR');
  procCount.textContent  = state.processes.length;
});

// ── KPI Update ─────────────────────────────────────────────────────────────
function updateKPIs() {
  const { cpuLoad, memPercent, memTotal, memActive } = state.system;

  // CPU
  cpuValue.textContent = (cpuLoad ?? 0).toFixed(1);
  cpuBar.style.width   = Math.min(cpuLoad ?? 0, 100) + '%';
  pushHistory(state.cpuHistory, cpuLoad ?? 0);
  updateChart(cpuChart, state.cpuHistory);

  // RAM
  ramValue.textContent = (memPercent ?? 0).toFixed(1);
  ramBar.style.width   = Math.min(memPercent ?? 0, 100) + '%';
  pushHistory(state.ramHistory, memPercent ?? 0);
  updateChart(ramChart, state.ramHistory);

  const totalGB  = ((memTotal ?? 0) / 1073741824).toFixed(1);
  const activeGB = ((memActive ?? 0) / 1073741824).toFixed(1);
  ramDetail.textContent = `${activeGB} GB / ${totalGB} GB`;
  totalProcs.textContent = state.processes.length;

  // Alerts
  const notResp = state.processes.filter(p => p.responding === false);
  alertCount.textContent = notResp.length;
  if (notResp.length > 0) {
    alertCard.classList.add('has-alert');
    alertNames.textContent = notResp.slice(0,3).map(p => p.name).join(', ')
      + (notResp.length > 3 ? ` +${notResp.length - 3}` : '');
    alertBanner.style.display = 'block';
    alertsList.innerHTML = notResp.map(p =>
      `<div class="alert-chip">⚠️ ${escHtml(p.name)} (PID ${p.pid})</div>`
    ).join('');
  } else {
    alertCard.classList.remove('has-alert');
    alertNames.textContent = 'Todos os apps estão OK ✓';
    alertBanner.style.display = 'none';
  }

  // Internet Apps KPI
  const internetApps = state.networkData.filter(n => n.connections.some(c => c.isInternet));
  netAppsCount.textContent = internetApps.length;
  if (internetApps.length > 0) {
    const withLatency = internetApps.filter(n => n.bestLatency !== null);
    if (withLatency.length > 0) {
      const avg = Math.round(withLatency.reduce((s,n)=>s+n.bestLatency,0) / withLatency.length);
      netSub.textContent = `Latência média: ${avg}ms`;
    } else {
      netSub.textContent = 'Medindo latências...';
    }
  } else {
    netSub.textContent = 'Sem conexões externas';
  }
}

// ── Table Render ───────────────────────────────────────────────────────────
function filteredProcesses() {
  let list = [...state.processes];
  const q = state.search.toLowerCase();
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q));

  if (state.filter === 'alert') list = list.filter(p => p.responding === false);
  if (state.filter === 'ok')    list = list.filter(p => p.responding !== false);

  // Sort
  list.sort((a, b) => {
    let va, vb;
    switch (state.sortKey) {
      case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
      case 'pid':  va = a.pid;  vb = b.pid;  break;
      case 'cpu':  va = a.pcpu; vb = b.pcpu; break;
      case 'mem':  va = a.mem;  vb = b.mem;  break;
      case 'pmem': va = a.pmem; vb = b.pmem; break;
      default:     va = 0; vb = 0;
    }
    if (va < vb) return state.sortDir;
    if (va > vb) return -state.sortDir;
    return 0;
  });

  return list;
}

function cpuClass(v) {
  if (v >= 20) return 'cpu-high';
  if (v >= 5)  return 'cpu-med';
  return 'cpu-low';
}

function statusBadge(p) {
  if (p.responding === false)
    return `<span class="status-badge badge-alert">⚠️ Travado</span>`;
  if (p.responding === true)
    return `<span class="status-badge badge-ok">✓ OK</span>`;
  return `<span class="status-badge badge-bg">— BG</span>`;
}

function renderTable() {
  const list = filteredProcesses();
  visibleCount.textContent = list.length;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-3)">Nenhum processo encontrado</td></tr>`;
    return;
  }

  const frag = document.createDocumentFragment();
  list.forEach(p => {
    // Track per-process CPU history
    if (!state.procCpuHistory[p.pid]) state.procCpuHistory[p.pid] = [];
    const hist = state.procCpuHistory[p.pid];
    hist.push(p.pcpu);
    if (hist.length > 10) hist.shift();

    const tr = document.createElement('tr');
    if (p.responding === false) tr.className = 'row-alert';

    const memMB  = (p.mem / 1024).toFixed(1);
    const cpuW   = Math.min(p.pcpu, 100);
    const cpuCls = cpuClass(p.pcpu);

    tr.innerHTML = `
      <td>${statusBadge(p)}</td>
      <td class="proc-name"><span class="proc-name-txt" title="${escHtml(p.name)}">${escHtml(p.name)}</span></td>
      <td><span class="pid-txt">${p.pid}</span></td>
      <td>
        <span>${p.pcpu.toFixed(1)}</span>
        <div class="cpu-bar-inline"><div class="cpu-fill ${cpuCls}" style="width:${cpuW}%"></div></div>
      </td>
      <td>${memMB > 0 ? memMB + ' MB' : '—'}</td>
      <td>${p.pmem > 0 ? p.pmem.toFixed(1) + '%' : '—'}</td>
      <td><canvas id="spark-${p.pid}" width="72" height="24"></canvas></td>
    `;
    frag.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(frag);

  // Draw sparklines
  list.forEach(p => {
    const el = document.getElementById(`spark-${p.pid}`);
    if (!el || !el.getContext) return;
    const ctx = el.getContext('2d');
    const hist = state.procCpuHistory[p.pid] || [0];
    const max  = Math.max(...hist, 1);
    const w = el.width, h = el.height;
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    hist.forEach((v, i) => {
      const x = (i / (hist.length - 1 || 1)) * w;
      const y = h - (v / max) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    const col = p.responding === false ? '#ef4444' : p.pcpu >= 20 ? '#f59e0b' : '#7c3aed';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

// ── Event Log ──────────────────────────────────────────────────────────────
function renderEvents() {
  if (!state.events.length) {
    eventLog.innerHTML = `<div class="event-empty">Nenhum evento registrado ainda.</div>`;
    eventCount.textContent = 0;
    return;
  }
  eventCount.textContent = state.events.length;
  eventLog.innerHTML = state.events.map(ev => {
    const cls  = ev.type === 'not_responding' ? 'event-not-responding'
               : ev.type === 'recovered'       ? 'event-recovered'
               : 'event-info';
    const time = new Date(ev.timestamp).toLocaleTimeString('pt-BR');
    return `
      <div class="event-item ${cls}">
        <span class="event-title">${escHtml(ev.message)}</span>
        <span class="event-time">${time}</span>
      </div>`;
  }).join('');
}

function handleNewEvents(newEvs) {
  newEvs.forEach(ev => {
    if (ev.type === 'not_responding') {
      toast(`⚠️ ${ev.procName} não está respondendo!`, 'error');
    } else if (ev.type === 'recovered') {
      toast(`✓ ${ev.procName} voltou a responder`, 'success');
    }
  });
}

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  el.onclick = () => el.remove();
  toastCont.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// ── Network Table ──────────────────────────────────────────────────────────
function latClass(ms) {
  if (ms === null || ms === undefined) return 'none';
  if (ms <= 50)  return 'good';
  if (ms <= 150) return 'ok';
  if (ms <= 300) return 'warn';
  return 'bad';
}

function latBadge(ms) {
  const cls = latClass(ms);
  const label = ms !== null ? `${ms} ms` : '— Medindo';
  return `<span class="lat-badge ${cls}">${label}</span>`;
}

function renderNetworkTable() {
  const q = state.netSearch.toLowerCase();
  let list = state.networkData.filter(n => n.connections.some(c => c.isInternet));
  if (q) list = list.filter(n => n.name.toLowerCase().includes(q));
  netVisCount.textContent = list.length;

  if (!list.length) {
    netTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-3)">Nenhum app com conexão de internet encontrado.<br><small>Aguardando dados...</small></td></tr>`;
    return;
  }

  const frag = document.createDocumentFragment();
  list.forEach(n => {
    const expanded = state.expandedPids.has(n.pid);
    const internetConns = n.connections.filter(c => c.isInternet);
    const bestConn = internetConns.find(c => c.latency === n.bestLatency) || internetConns[0];

    // Main row
    const tr = document.createElement('tr');
    tr.dataset.pid = n.pid;
    tr.innerHTML = `
      <td><button class="expand-btn" data-pid="${n.pid}" title="Ver conexões">${expanded ? '▾' : '▸'}</button></td>
      <td class="proc-name"><span class="proc-name-txt" title="${escHtml(n.name)}">${escHtml(n.name)}</span></td>
      <td><span class="pid-txt">${n.pid}</span></td>
      <td>${latBadge(n.bestLatency)}</td>
      <td><span style="color:var(--text-2)">${n.connectionCount}</span></td>
      <td><span class="mono" style="font-size:0.75rem;color:var(--text-2)">${bestConn ? bestConn.remoteIp : '—'}</span></td>
      <td><span class="mono" style="font-size:0.75rem;color:var(--text-3)">${bestConn ? bestConn.remotePort : '—'}</span></td>
    `;
    frag.appendChild(tr);

    // Expanded detail row
    if (expanded) {
      const detRow = document.createElement('tr');
      detRow.className = 'detail-row';
      const allConns = n.connections.filter(c => c.isInternet);
      const connCards = allConns.map(c => {
        const cls = latClass(c.latency);
        return `
          <div class="detail-conn conn-type-internet">
            <span class="lat-badge ${cls}" style="font-size:0.72rem;padding:2px 8px">${c.latency !== null ? c.latency + ' ms' : '—'}</span>
            <div>
              <div class="mono">${escHtml(c.remoteIp)}<span style="color:var(--text-3)">:${c.remotePort}</span></div>
              <div style="font-size:0.7rem;color:var(--text-3)">Porta local: ${c.localPort}</div>
            </div>
          </div>`;
      }).join('');
      detRow.innerHTML = `<td colspan="7"><div class="detail-inner"><div class="detail-grid">${connCards}</div></div></td>`;
      frag.appendChild(detRow);
    }
  });

  netTbody.innerHTML = '';
  netTbody.appendChild(frag);

  // Expand buttons
  netTbody.querySelectorAll('.expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = parseInt(btn.dataset.pid);
      if (state.expandedPids.has(pid)) state.expandedPids.delete(pid);
      else state.expandedPids.add(pid);
      renderNetworkTable();
    });
  });
}

// ── Sort controls ──────────────────────────────────────────────────────────
document.querySelectorAll('th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (state.sortKey === key) {
      state.sortDir *= -1;
    } else {
      state.sortKey = key;
      state.sortDir = -1;
    }
    document.querySelectorAll('th').forEach(t => t.classList.remove('active-sort'));
    th.classList.add('active-sort');
    renderTable();
  });
});

// ── Filter buttons ─────────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTable();
  });
});

// ── Search ─────────────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  state.search = searchInput.value;
  renderTable();
});

// ── Clear events ───────────────────────────────────────────────────────────
$$('clear-events').addEventListener('click', () => {
  state.events = [];
  renderEvents();
});

// ── Tab switching ──────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $$('view-processos').style.display = tab === 'processos' ? '' : 'none';
    $$('view-rede').style.display      = tab === 'rede'      ? 'block' : 'none';
    if (tab === 'rede') renderNetworkTable();
  });
});

// ── Network search ─────────────────────────────────────────────────────────
$$('net-search').addEventListener('input', e => {
  state.netSearch = e.target.value;
  renderNetworkTable();
});

// ── Helper ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
