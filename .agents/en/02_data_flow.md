# 02 — Data Flow

## Complete collection and display flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  WINDOWS OS                                                         │
│  ┌──────────────────┐  ┌──────────────────────┐  ┌──────────────┐  │
│  │  Get-Process     │  │ Get-NetTCPConnection  │  │ si.processes │  │
│  │  .Responding     │  │  Established          │  │ currentLoad  │  │
│  │  .Name .Id       │  │  OwningProcess        │  │ mem          │  │
│  └────────┬─────────┘  └──────────┬───────────┘  └──────┬───────┘  │
└───────────│────────────────────────│─────────────────────│──────────┘
            │ PowerShell JSON        │ PowerShell JSON      │ npm lib
            ▼                        ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  server.js — collectAndEmit()                                       │
│                                                                     │
│  respondingMap: Map<pid, bool>   ←  getPowerShellResponding()       │
│  tcpConns: []                    ←  getTcpConnections()             │
│  { procs, load, mem }            ←  getSiProcesses()                │
│                                                                     │
│  processList = procs.map(p => ({                                    │
│    pid, name, pcpu, pmem, mem,                                      │
│    responding: respondingMap.get(pid) ?? null                       │
│  }))                                                                │
│                                                                     │
│  ── Event detection ──────────────────────────────────────────────  │
│  prevNotResponding (global Set) vs currentNotResponding             │
│  → addEvent('not_responding') or addEvent('recovered')              │
│                                                                     │
│  ── Latency (async, does not block emit) ─────────────────────────  │
│  getLatencies(tcpConns)                                             │
│    → filter non-private IPs                                         │
│    → deduplicate by "ip:port"                                       │
│    → check cache (TTL 15s)                                          │
│    → measureTcpLatency(ip, port) in batches of 15                   │
│    → latencyCache.set("ip:port", { latency, ts })                   │
│                                                                     │
│  networkData = buildNetworkData(tcpConns, processList)              │
│    → group connections by PID                                       │
│    → read latencyCache for each "ip:port"                           │
│    → compute bestLatency = min(internet latencies)                  │
│                                                                     │
│  payload = {                                                        │
│    timestamp, system, processes[0..149],                            │
│    networkData, newEvents, eventLog[0..49]                          │
│  }                                                                  │
│                                                                     │
│  io.emit('metrics', payload)                                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  public/app.js — socket.on('metrics')                               │
│                                                                     │
│  state.* ← data.*                                                   │
│                                                                     │
│  updateKPIs()   → DOM: #cpu-value, #ram-value, #alert-count, etc.  │
│  renderTable()  → DOM: #proc-tbody (max 150 rows)                   │
│  renderNetworkTable() → DOM: #net-tbody                             │
│  renderEvents() → DOM: #event-log                                   │
│  handleNewEvents() → toast() for new events                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## `metrics` payload structure (WebSocket)

```json
{
  "timestamp": 1747398000000,
  "system": {
    "cpuLoad": 35.9,
    "memTotal": 34123456512,
    "memActive": 26000000000,
    "memPercent": 76.2,
    "internetApps": 15
  },
  "processes": [
    {
      "pid": 6132,
      "name": "SystemSettings.exe",
      "pcpu": 0.0,
      "pmem": 0.1,
      "mem": 45056,
      "state": "sleeping",
      "started": "2026-05-16T08:00:00.000Z",
      "responding": false
    }
  ],
  "networkData": [
    {
      "pid": 18880,
      "name": "brave.exe",
      "connectionCount": 7,
      "bestLatency": 6,
      "connections": [
        {
          "remoteIp": "146.112.41.2",
          "remotePort": 443,
          "localPort": 51234,
          "latency": 6,
          "isInternet": true
        }
      ]
    }
  ],
  "newEvents": [...],
  "eventLog": [...]
}
```

---

## Process entry fields (`processes[]`)

| Field | Type | Source | Description |
|---|---|---|---|
| `pid` | number | systeminformation | Process ID |
| `name` | string | systeminformation | Executable name |
| `pcpu` | number | systeminformation | CPU % (0–100) |
| `pmem` | number | systeminformation | RAM % (0–100) |
| `mem` | number | systeminformation | RSS in KB |
| `state` | string | systeminformation | OS state (`running`, `sleeping`, etc.) |
| `started` | string\|null | systeminformation | ISO timestamp of process start |
| `responding` | boolean\|null | PowerShell | `true`=OK, `false`=hung, `null`=no UI |

---

## Network connection fields (`networkData[].connections[]`)

| Field | Type | Source | Description |
|---|---|---|---|
| `remoteIp` | string | PowerShell | Remote IP (IPv4 or IPv6) |
| `remotePort` | number | PowerShell | Remote port |
| `localPort` | number | PowerShell | Local port |
| `latency` | number\|null | `net.Socket` | TCP connect time in ms; null = not measured or timeout |
| `isInternet` | boolean | `isPrivateOrLoopback()` | `true` if IP is not private/loopback |

---

## Latency cache (in-memory)

```
latencyCache: Map<"ip:port", { latency: number|null, ts: number }>

TTL: 15,000ms (LATENCY_TTL)
Size: unbounded (grows with unique IPs seen)
Cleanup: automatic via TTL on each access
```

---

## Event log (in-memory)

```
eventLog: Array<Event>
MAX_EVENTS: 100 (newest first — unshift)

Event = {
  id:        number     (Date.now() + Math.random())
  timestamp: string     (ISO 8601)
  procName:  string
  pid:       number
  type:      'not_responding' | 'recovered'
  message:   string     (Portuguese)
}
```

---

## "Not Responding" detection flow

```
Each collection cycle:

currentNotResponding = new Set()

For each process:
  if responding === false:
    currentNotResponding.add(pid)
    if pid was NOT in prevNotResponding:
      → addEvent(type='not_responding')  [NEW EVENT]

For each pid in prevNotResponding:
  if pid is NOT in currentNotResponding:
    → addEvent(type='recovered')         [RECOVERED]

prevNotResponding = currentNotResponding
```
