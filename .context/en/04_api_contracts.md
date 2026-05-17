# 04 — API Contracts

## REST Endpoints

### `GET /api/health`

**Purpose**: Health check — verifies the server is running.

**Response `200 OK`**:
```json
{ "status": "ok", "uptime": 3721.456 }
```

---

### `GET /api/events`

**Purpose**: Returns the full in-memory event log.

**Response `200 OK`**:
```json
[
  {
    "id": 1747398000123.45,
    "timestamp": "2026-05-16T11:00:00.123Z",
    "procName": "SystemSettings.exe",
    "pid": 6132,
    "type": "not_responding",
    "message": "SystemSettings.exe (PID 6132) não está respondendo"
  }
]
```

---

## WebSocket Events

### `metrics` (Server → Client) — every 2.5s

```typescript
interface MetricsPayload {
  timestamp: number;
  system: {
    cpuLoad: number;       // % 0–100, 1 decimal
    memTotal: number;      // bytes
    memActive: number;     // bytes
    memPercent: number;    // % 0–100, 1 decimal
    internetApps: number;
  };
  processes: ProcessEntry[];    // max 150
  networkData: NetworkEntry[];
  newEvents: EventEntry[];      // only NEW in this cycle
  eventLog: EventEntry[];       // last 50 total
}

interface ProcessEntry {
  pid: number;
  name: string;
  pcpu: number;             // CPU % (2 decimals)
  pmem: number;             // RAM % (2 decimals)
  mem: number;              // RSS in KB
  state: string;
  started: string | null;   // ISO timestamp
  responding: boolean | null;
}

interface NetworkEntry {
  pid: number;
  name: string;
  connectionCount: number;
  bestLatency: number | null;   // ms, lowest among internet conns
  connections: ConnectionEntry[];
}

interface ConnectionEntry {
  remoteIp: string;
  remotePort: number;
  localPort: number;
  latency: number | null;   // ms, null if not measured
  isInternet: boolean;
}

interface EventEntry {
  id: number;
  timestamp: string;   // ISO 8601
  procName: string;
  pid: number;
  type: 'not_responding' | 'recovered';
  message: string;
}
```

---

### `event_log` (Server → Client) — on connect

Sent **once** immediately after client connects, with the current full log.

```json
[EventEntry, ...]   // up to 100 events
```

---

## How to add a new REST endpoint

In `server.js`, before `server.listen(...)`:

```js
app.get('/api/my-endpoint', (req, res) => {
  res.json({ data: value });
});
```

---

## How to add bidirectional WebSocket (Client → Server)

**Backend**:
```js
io.on('connection', (socket) => {
  socket.on('my-action', (data) => {
    socket.emit('action-response', result);
  });
});
```

**Frontend**:
```js
socket.emit('my-action', { param: value });
socket.on('action-response', (res) => { ... });
```
