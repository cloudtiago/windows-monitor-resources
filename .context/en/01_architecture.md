# 01 — Architecture

## File structure

```
Monitor de Recursos/
├── server.js              # Main backend (Node.js)
├── package.json           # Dependencies and npm scripts
├── package-lock.json      # Lock file
├── node_modules/          # Installed dependencies
├── public/                # Statically served files
│   ├── index.html         # Dashboard HTML (single-page app)
│   ├── style.css          # Styles (Vanilla CSS, dark glassmorphism)
│   └── app.js             # Frontend JavaScript (Socket.io client)
└── .context/               # Technical documentation (this directory)
    ├── pt-BR/             # Portuguese documentation
    └── en/                # English documentation
```

---

## Backend architecture (`server.js`)

The backend is a single Node.js file with well-defined responsibilities:

### Modules and functions

| Function | Responsibility |
|---|---|
| `getPowerShellResponding()` | Spawns PowerShell, runs `Get-Process`, returns `[{Name, Id, Responding}]` |
| `getTcpConnections()` | Spawns PowerShell, runs `Get-NetTCPConnection`, returns established TCP connections |
| `isPrivateOrLoopback(ip)` | Filters private/loopback IPs (RFC1918 + IPv6) to isolate internet traffic |
| `measureTcpLatency(host, port)` | Measures TCP connect time in ms using native `net.Socket` |
| `getLatencies(connections)` | Orchestrates batch measurements (max 15 parallel), respects 15s cache |
| `getSiProcesses()` | Async wrapper for `si.processes()`, `si.currentLoad()`, `si.mem()` |
| `si.networkStats()` | Native `systeminformation` function used to obtain transfer rates (rx/tx bytes) |
| `buildNetworkData(connections, processList)` | Groups connections by PID, calculates best latency per process |
| `collectAndEmit()` | Main function: collects everything in parallel and emits `metrics` via Socket.io |
| `poll()` | Re-entrancy guard + calls `collectAndEmit()` every 2.5s |
| `addEvent(...)` | Appends to in-memory `eventLog[]` array (max 100 events) |

### Collection flow (every 2.5s)

```
poll()
  ↓
collectAndEmit()
  ├── getSiProcesses()      ─── parallel ───▶  { procs, load, mem }
  ├── getPowerShellResponding()              ▶  [{Name, Id, Responding}]
  ├── getTcpConnections()                   ▶  [{LocalPort, RemoteAddress, RemotePort, OwningProcess}]
  └── si.networkStats()                     ▶  [{rx_sec, tx_sec, operstate}] (Filtered by 'up')
  ↓
  Merge: processList ← procs + respondingMap
  ↓
  Detect not_responding events → addEvent()
  ↓
  getLatencies(tcpConns)   [async, does not block emit]
  ↓
  buildNetworkData(tcpConns, processList)
  ↓
  io.emit('metrics', payload)  →  all WebSocket clients
```

---

## Frontend architecture (`public/app.js`)

The frontend is a framework-free SPA organized into functional modules:

### Global state (`state`)

```js
const state = {
  processes: [],        // Process list from last emit
  networkData: [],      // Apps with network connections
  system: {},           // CPU%, RAM%, totals, rxSec, txSec
  events: [],           // Event log (mirror of backend)
  sortKey: 'cpu',       // Active sort column
  sortDir: -1,          // -1=desc, 1=asc
  filter: 'all',        // Active filter (all/alert/ok)
  search: '',           // Process search text
  netSearch: '',        // Network tab search text
  cpuHistory: [],       // 30-reading history for global CPU
  ramHistory: [],       // 30-reading history for global RAM
  transferHistory: [],  // 30-reading history for global Network Transfer rate
  maxHistory: 30,       // Max size of history arrays
  procCpuHistory: {},   // Map pid→[values] for per-process sparklines
  expandedPids: Set(),  // PIDs with expanded connection details
};
```

### Rendering pipeline

```
socket.on('metrics')
  ↓
  state.* = data.*
  ↓
  updateKPIs()          → Updates 5 KPI cards + sparkline charts
  renderTable()         → Re-renders process table (+ canvas sparklines)
  renderNetworkTable()  → Re-renders network table (only if tab active)
  renderEvents()        → Re-renders right-side event log
  handleNewEvents()     → Fires toast notifications for new events
```

---

## WebSocket communication pattern

```
Server                          Client
   │                               │
   │──── connect ─────────────────▶│
   │◀─── socket.emit('event_log') ─│  (immediate send of current log)
   │                               │
   │  [every 2.5s]                 │
   │──── 'metrics' payload ───────▶│  (broadcast to all clients)
   │                               │
   │◀─── disconnect ───────────────│
```

---

## Separation of concerns

| Responsibility | Location |
|---|---|
| OS data collection | `server.js` — PowerShell functions + systeminformation |
| Latency calculation | `server.js` — `measureTcpLatency`, `getLatencies`, `latencyCache` |
| Event detection | `server.js` — `collectAndEmit()` + `prevNotResponding` |
| State storage | `server.js` — `eventLog[]`, `latencyCache`, `prevNotResponding` (in-memory) |
| Rendering and UI | `public/app.js` — all `render*()` functions |
| Visual styles | `public/style.css` — CSS tokens, components, responsiveness |
| HTML structure | `public/index.html` — static DOM, element IDs |
