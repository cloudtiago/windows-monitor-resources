# 02 — Fluxo de Dados

## Fluxo completo de coleta e exibição

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  WINDOWS OS                                                                        │
│  ┌──────────────────┐  ┌──────────────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Get-Process     │  │ Get-NetTCPConnection  │  │ si.processes │  │si.netStats  │ │
│  │  .Responding     │  │  Established          │  │ currentLoad  │  │(rx_sec,     │ │
│  │  .Name .Id       │  │  OwningProcess        │  │ mem          │  │ tx_sec)     │ │
│  └────────┬─────────┘  └──────────┬───────────┘  └──────┬───────┘  └──────┬──────┘ │
└───────────│────────────────────────│─────────────────────│────────────────│────────┘
            │ PowerShell JSON        │ PowerShell JSON      │ npm lib        │ npm lib
            ▼                        ▼                      ▼                ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│  server.js — collectAndEmit()                                                      │
│                                                                     │
│  respondingMap: Map<pid, bool>   ←  getPowerShellResponding()       │
│  tcpConns: []                    ←  getTcpConnections()             │
│  { procs, load, mem }            ←  getSiProcesses()                │
│  netStats: []                    ←  si.networkStats()               │
│                                                                     │
│  processList = procs.map(p => ({                                    │
│    pid, name, pcpu, pmem, mem,                                      │
│    responding: respondingMap.get(pid) ?? null                       │
│  }))                                                                │
│                                                                     │
│  ── Detecção de eventos ──────────────────────────────────────────  │
│  prevNotResponding (Set global) vs currentNotResponding             │
│  → addEvent('not_responding') ou addEvent('recovered')              │
│                                                                     │
│  ── Latência (assíncrona, não bloqueia) ──────────────────────────  │
│  getLatencies(tcpConns)                                             │
│    → filtra IPs não-privados                                        │
│    → deduplica por "ip:port"                                        │
│    → verifica cache (TTL 15s)                                       │
│    → measureTcpLatency(ip, port) em lotes de 15                     │
│    → latencyCache.set("ip:port", { latency, ts })                   │
│                                                                     │
│  networkData = buildNetworkData(tcpConns, processList)              │
│    → agrupa conns por pid                                           │
│    → lê latencyCache para cada "ip:port"                            │
│    → calcula bestLatency = min(internet latencies)                  │
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
│  renderTable()  → DOM: #proc-tbody (150 rows máx)                   │
│  renderNetworkTable() → DOM: #net-tbody                             │
│  renderEvents() → DOM: #event-log                                   │
│  handleNewEvents() → toast() para eventos novos                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Estrutura do payload `metrics` (WebSocket)

```json
{
  "timestamp": 1747398000000,
  "system": {
    "cpuLoad": 35.9,
    "memTotal": 34123456512,
    "memActive": 26000000000,
    "memPercent": 76.2,
    "internetApps": 15,
    "rxSec": 25410,
    "txSec": 1280
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
    },
    {
      "pid": 18880,
      "name": "brave.exe",
      "pcpu": 3.2,
      "pmem": 1.4,
      "mem": 512000,
      "state": "running",
      "started": "2026-05-16T07:30:00.000Z",
      "responding": true
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
        },
        {
          "remoteIp": "192.168.1.1",
          "remotePort": 53,
          "localPort": 51235,
          "latency": null,
          "isInternet": false
        }
      ]
    }
  ],
  "newEvents": [
    {
      "id": 1747398000123.45,
      "timestamp": "2026-05-16T11:00:00.123Z",
      "procName": "SystemSettings.exe",
      "pid": 6132,
      "type": "not_responding",
      "message": "SystemSettings.exe (PID 6132) não está respondendo"
    }
  ],
  "eventLog": [...]
}
```

---

## Estrutura do processo (`processes[]`)

| Campo | Tipo | Origem | Descrição |
|---|---|---|---|
| `pid` | number | systeminformation | Process ID |
| `name` | string | systeminformation | Nome do executável |
| `pcpu` | number | systeminformation | % CPU (0–100) |
| `pmem` | number | systeminformation | % RAM (0–100) |
| `mem` | number | systeminformation | RSS em KB |
| `state` | string | systeminformation | Estado OS (`running`, `sleeping`, etc.) |
| `started` | string\|null | systeminformation | ISO timestamp de início |
| `responding` | boolean\|null | PowerShell | `true`=OK, `false`=travado, `null`=sem UI |

---

## Estrutura de conexão de rede (`networkData[].connections[]`)

| Campo | Tipo | Origem | Descrição |
|---|---|---|---|
| `remoteIp` | string | PowerShell | IP remoto (IPv4 ou IPv6) |
| `remotePort` | number | PowerShell | Porta remota |
| `localPort` | number | PowerShell | Porta local |
| `latency` | number\|null | `net.Socket` | ms de TCP connect; null = não medido ou timeout |
| `isInternet` | boolean | `isPrivateOrLoopback()` | `true` se IP não é privado/loopback |

---

## Cache de latência (in-memory)

```
latencyCache: Map<"ip:port", { latency: number|null, ts: number }>

TTL: 15.000ms (LATENCY_TTL)
Tamanho: não limitado (cresce com IPs únicos vistos)
Limpeza: automática por TTL a cada acesso
```

---

## Log de eventos (in-memory)

```
eventLog: Array<Event>
MAX_EVENTS: 100 (mais recentes primeiro — unshift)

Event = {
  id:        number     (Date.now() + Math.random())
  timestamp: string     (ISO 8601)
  procName:  string
  pid:       number
  type:      'not_responding' | 'recovered'
  message:   string     (PT-BR)
}
```

---

## Fluxo de detecção de "Not Responding"

```
A cada ciclo de coleta:

currentNotResponding = new Set()

Para cada processo:
  se responding === false:
    currentNotResponding.add(pid)
    se pid NÃO estava em prevNotResponding:
      → addEvent(type='not_responding')  [NOVO EVENTO]

Para cada pid em prevNotResponding:
  se pid NÃO está em currentNotResponding:
    → addEvent(type='recovered')         [RECUPEROU]

prevNotResponding = currentNotResponding
```
