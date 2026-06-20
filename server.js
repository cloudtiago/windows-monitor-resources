/**
 * Monitor de Recursos — Backend v1.2.0
 * Copyright © HT Technology ® 2026. Todos os direitos reservados.
 * https://github.com/leizem/windows-monitor-resources
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const si = require('systeminformation');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const APP_VERSION = '1.2.0';
const APP_NAME    = 'Monitor de Recursos';
const APP_AUTHOR  = 'HT Technology';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = 3030;
// When packaged with pkg, public/ must be resolved relative to the .exe location
const publicPath = process.pkg
  ? path.join(path.dirname(process.execPath), 'public')
  : path.join(__dirname, 'public');
app.use(express.static(publicPath));

// ─── In-memory event log ──────────────────────────────────────────────────────
const eventLog = [];
const MAX_EVENTS = 200;
const prevNotResponding = new Set();

function addEvent(procName, pid, type, message) {
  const event = { id: Date.now() + Math.random(), timestamp: new Date().toISOString(), procName, pid, type, message };
  eventLog.unshift(event);
  if (eventLog.length > MAX_EVENTS) eventLog.pop();
  return event;
}

// ─── PowerShell: Responding status ───────────────────────────────────────────
function getPowerShellResponding() {
  return new Promise((resolve) => {
    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', `
      try {
        $procs = Get-Process -ErrorAction SilentlyContinue |
          Select-Object Name, Id, @{Name='Responding';Expression={ try { $_.Responding } catch { $null } }} |
          ConvertTo-Json -Depth 2 -Compress
        Write-Output $procs
      } catch { Write-Output '[]' }
    `], { windowsHide: true });
    let output = '';
    ps.stdout.on('data', d => { output += d.toString(); });
    ps.on('close', () => {
      try {
        const t = output.trim();
        if (!t || t === 'null') return resolve([]);
        const p = JSON.parse(t);
        resolve(Array.isArray(p) ? p : [p]);
      } catch { resolve([]); }
    });
    setTimeout(() => { ps.kill(); resolve([]); }, 5000);
  });
}

// ─── PowerShell: TCP connections with owning PID ─────────────────────────────
function getTcpConnections() {
  return new Promise((resolve) => {
    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', `
      try {
        $conns = Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue |
          Where-Object { $_.RemoteAddress -ne '0.0.0.0' -and $_.RemoteAddress -ne '::' } |
          Select-Object LocalPort, RemoteAddress, RemotePort, OwningProcess |
          ConvertTo-Json -Depth 2 -Compress
        if ($conns) { Write-Output $conns } else { Write-Output '[]' }
      } catch { Write-Output '[]' }
    `], { windowsHide: true });
    let output = '';
    ps.stdout.on('data', d => { output += d.toString(); });
    ps.on('close', () => {
      try {
        const t = output.trim();
        if (!t || t === 'null') return resolve([]);
        const p = JSON.parse(t);
        resolve(Array.isArray(p) ? p : [p]);
      } catch { resolve([]); }
    });
    setTimeout(() => { ps.kill(); resolve([]); }, 6000);
  });
}

// ─── TCP latency measurement ──────────────────────────────────────────────────
function isPrivateOrLoopback(ip) {
  if (!ip) return true;
  // IPv6 loopback/link-local
  if (ip === '::1' || ip.startsWith('fe80') || ip.startsWith('::ffff:127')) return true;
  // IPv4 mapped
  const v4 = ip.replace('::ffff:', '');
  return (
    v4.startsWith('127.') ||
    v4.startsWith('10.') ||
    v4.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v4)
  );
}

function measureTcpLatency(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => { resolve(Date.now() - start); socket.destroy(); });
    socket.on('timeout', () => { resolve(null); socket.destroy(); });
    socket.on('error', () => { resolve(null); socket.destroy(); });
    try { socket.connect(port, host); } catch { resolve(null); }
  });
}

// ─── Latency cache (15s TTL) ──────────────────────────────────────────────────
const latencyCache = new Map(); // key "ip:port" → { latency, ts }
const LATENCY_TTL = 15000;

async function getLatencies(connections) {
  // Filter to internet IPs only (non-private)
  const internetConns = connections.filter(c => !isPrivateOrLoopback(c.RemoteAddress));

  // Deduplicate by "ip:port"
  const toMeasure = new Map();
  for (const c of internetConns) {
    const key = `${c.RemoteAddress}:${c.RemotePort}`;
    if (!toMeasure.has(key)) toMeasure.set(key, { ip: c.RemoteAddress, port: c.RemotePort });
  }

  const now = Date.now();
  const measurePromises = [];

  for (const [key, { ip, port }] of toMeasure) {
    const cached = latencyCache.get(key);
    if (cached && now - cached.ts < LATENCY_TTL) continue; // still fresh
    measurePromises.push(
      measureTcpLatency(ip, port).then(ms => {
        latencyCache.set(key, { latency: ms, ts: Date.now() });
      })
    );
  }

  // Limit parallel connections
  const BATCH = 15;
  for (let i = 0; i < measurePromises.length; i += BATCH) {
    await Promise.all(measurePromises.slice(i, i + BATCH));
  }
}

// ─── systeminformation ────────────────────────────────────────────────────────
async function getSiProcesses() {
  try {
    const [procs, load, mem] = await Promise.all([si.processes(), si.currentLoad(), si.mem()]);
    return { procs, load, mem };
  } catch {
    return { procs: { list: [] }, load: { currentLoad: 0 }, mem: { total: 1, active: 0 } };
  }
}

// ─── CPU Temperature (cached, refreshed every 10s) ───────────────────────────
let cpuTempCache = null;
let cpuTempTs = 0;
const CPU_TEMP_TTL = 10000;

async function getCpuTemperature() {
  const now = Date.now();
  if (cpuTempCache !== null && now - cpuTempTs < CPU_TEMP_TTL) return cpuTempCache;
  try {
    const temp = await si.cpuTemperature();
    cpuTempCache = temp && temp.main !== null ? parseFloat(temp.main.toFixed(1)) : null;
  } catch {
    cpuTempCache = null;
  }
  cpuTempTs = now;
  return cpuTempCache;
}

// ─── Build network view data ──────────────────────────────────────────────────
function buildNetworkData(connections, processList) {
  // pid → process name map
  const pidName = new Map(processList.map(p => [p.pid, p.name]));

  // Group connections by pid
  const byPid = new Map();
  for (const c of connections) {
    const pid = c.OwningProcess;
    if (!byPid.has(pid)) byPid.set(pid, []);
    byPid.get(pid).push(c);
  }

  const result = [];
  for (const [pid, conns] of byPid) {
    const name = pidName.get(pid) || `PID ${pid}`;
    const entries = conns.map(c => {
      const key = `${c.RemoteAddress}:${c.RemotePort}`;
      const cached = latencyCache.get(key);
      const isInternet = !isPrivateOrLoopback(c.RemoteAddress);
      return {
        remoteIp: c.RemoteAddress,
        remotePort: c.RemotePort,
        localPort: c.LocalPort,
        latency: cached ? cached.latency : null,
        isInternet
      };
    });

    // Best latency for this process (internet connections only)
    const internetEntries = entries.filter(e => e.isInternet && e.latency !== null);
    const bestLatency = internetEntries.length
      ? Math.min(...internetEntries.map(e => e.latency))
      : null;

    result.push({ pid, name, connections: entries, bestLatency, connectionCount: conns.length });
  }

  // Sort by best latency asc (no data last)
  result.sort((a, b) => {
    if (a.bestLatency === null && b.bestLatency === null) return a.name.localeCompare(b.name);
    if (a.bestLatency === null) return 1;
    if (b.bestLatency === null) return -1;
    return a.bestLatency - b.bestLatency;
  });

  return result;
}

// ─── Main collect & emit ──────────────────────────────────────────────────────
async function collectAndEmit() {
  const [siData, psData, tcpConns, netStats, cpuTemp] = await Promise.all([
    getSiProcesses(),
    getPowerShellResponding(),
    getTcpConnections(),
    si.networkStats(),
    getCpuTemperature()
  ]);

  const { procs, load, mem } = siData;

  const respondingMap = new Map();
  for (const p of psData) respondingMap.set(p.Id, p.Responding);

  const processList = (procs.list || []).map(p => ({
    pid: p.pid,
    name: p.name,
    pcpu: parseFloat((p.pcpu || 0).toFixed(2)),
    pmem: parseFloat((p.pmem || 0).toFixed(2)),
    mem: Math.round((p.mem_rss || 0) / 1024),
    state: p.state || '',
    started: p.started || null,
    responding: respondingMap.has(p.pid) ? respondingMap.get(p.pid) : null
  }));

  // Not responding events
  const newEvents = [];
  const currentNotResponding = new Set();
  for (const p of processList) {
    if (p.responding === false) {
      currentNotResponding.add(p.pid);
      if (!prevNotResponding.has(p.pid))
        newEvents.push(addEvent(p.name, p.pid, 'not_responding', `${p.name} (PID ${p.pid}) não está respondendo`));
    }
  }
  for (const pid of prevNotResponding) {
    if (!currentNotResponding.has(pid)) {
      const proc = processList.find(p => p.pid === pid);
      if (proc) newEvents.push(addEvent(proc.name, pid, 'recovered', `${proc.name} (PID ${pid}) voltou a responder`));
    }
  }
  prevNotResponding.clear();
  for (const pid of currentNotResponding) prevNotResponding.add(pid);

  processList.sort((a, b) => {
    if (a.responding === false && b.responding !== false) return -1;
    if (b.responding === false && a.responding !== false) return 1;
    return b.pcpu - a.pcpu;
  });

  // Calculate global network transfer rates (Download/Upload)
  let rxSec = 0;
  let txSec = 0;
  if (Array.isArray(netStats)) {
    for (const iface of netStats) {
      if (iface.operstate === 'up' && iface.rx_sec !== null && iface.tx_sec !== null) {
        rxSec += iface.rx_sec;
        txSec += iface.tx_sec;
      }
    }
  }

  // Update latency cache (async, don't block emit)
  getLatencies(tcpConns).catch(() => {});

  // Build network data with current cache
  const networkData = buildNetworkData(tcpConns, processList);

  const internetAppsCount = networkData.filter(n => n.connections.some(c => c.isInternet)).length;

  const payload = {
    timestamp: Date.now(),
    version: APP_VERSION,
    system: {
      cpuLoad: parseFloat((load.currentLoad || 0).toFixed(1)),
      cpuTemp: cpuTemp,
      memTotal: mem.total,
      memActive: mem.active,
      memPercent: parseFloat(((mem.active / mem.total) * 100).toFixed(1)),
      internetApps: internetAppsCount,
      rxSec: Math.round(rxSec),
      txSec: Math.round(txSec)
    },
    processes: processList.slice(0, 200),
    networkData,
    newEvents,
    eventLog: eventLog.slice(0, 50)
  };

  io.emit('metrics', payload);
}

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Cliente conectado: ${socket.id}`);
  socket.emit('event_log', eventLog);
  socket.on('disconnect', () => console.log(`[-] Cliente desconectado: ${socket.id}`));
});

// ─── Poll ─────────────────────────────────────────────────────────────────────
let collecting = false;
async function poll() {
  if (collecting) return;
  collecting = true;
  try { await collectAndEmit(); }
  catch (err) { console.error('Erro:', err.message); }
  finally { collecting = false; }
}

poll();
setInterval(poll, 2500);

// ─── API endpoints ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime(), version: APP_VERSION }));
app.get('/api/events', (req, res) => res.json(eventLog));
app.get('/api/version', (req, res) => res.json({
  name: APP_NAME,
  version: APP_VERSION,
  author: APP_AUTHOR,
  copyright: `© ${APP_AUTHOR} ® 2026`,
  buildDate: '2026-06-20',
  homepage: 'https://github.com/leizem/windows-monitor-resources'
}));

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[!] Sinal ${signal} recebido. Encerrando servidor...`);
  io.close(() => {
    server.close(() => {
      console.log('[✓] Servidor encerrado com sucesso.');
      process.exit(0);
    });
  });
  setTimeout(() => { console.error('[!] Forçando encerramento após timeout.'); process.exit(1); }, 5000);
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log(`  ║   🖥️  ${APP_NAME} v${APP_VERSION}                  ║`);
  console.log(`  ║   © ${APP_AUTHOR} ® 2026                       ║`);
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║   URL : http://localhost:${PORT}                    ║`);
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
});
