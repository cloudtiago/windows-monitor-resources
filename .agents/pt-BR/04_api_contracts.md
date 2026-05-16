# 04 — API Contracts

## REST Endpoints

O servidor expõe dois endpoints HTTP REST além dos arquivos estáticos:

---

### `GET /api/health`

**Propósito**: Health check — verifica se o servidor está ativo.

**Request**: sem parâmetros

**Response `200 OK`**:
```json
{
  "status": "ok",
  "uptime": 3721.456
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `status` | string | Sempre `"ok"` se o servidor estiver rodando |
| `uptime` | number | Segundos desde o início do processo Node.js |

---

### `GET /api/events`

**Propósito**: Retorna o log completo de eventos em memória.

**Request**: sem parâmetros

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
  },
  {
    "id": 1747398300456.78,
    "timestamp": "2026-05-16T11:05:00.456Z",
    "procName": "SystemSettings.exe",
    "pid": 6132,
    "type": "recovered",
    "message": "SystemSettings.exe (PID 6132) voltou a responder"
  }
]
```

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | number | Identificador único (timestamp + random) |
| `timestamp` | string | ISO 8601 UTC |
| `procName` | string | Nome do processo |
| `pid` | number | Process ID |
| `type` | string | `"not_responding"` ou `"recovered"` |
| `message` | string | Mensagem em PT-BR |

---

## WebSocket Events

### Evento `metrics` (Server → Client)

Emitido a cada **2.5 segundos** para todos os clientes conectados.

**Schema completo**:

```typescript
interface MetricsPayload {
  timestamp: number;        // Unix timestamp em ms
  system: {
    cpuLoad: number;        // % CPU total (0–100, 1 decimal)
    memTotal: number;       // Bytes totais de RAM
    memActive: number;      // Bytes ativos de RAM
    memPercent: number;     // % RAM usada (1 decimal)
    internetApps: number;   // Contagem de apps com conn. internet
  };
  processes: ProcessEntry[];   // Máx 150 processos
  networkData: NetworkEntry[]; // Todos os processos com TCP conn
  newEvents: EventEntry[];     // Somente eventos NOVOS neste ciclo
  eventLog: EventEntry[];      // Últimos 50 eventos totais
}

interface ProcessEntry {
  pid: number;
  name: string;
  pcpu: number;          // % CPU (2 decimais)
  pmem: number;          // % RAM (2 decimais)
  mem: number;           // RSS em KB
  state: string;         // Estado OS
  started: string|null;  // ISO timestamp
  responding: boolean|null; // true/false/null
}

interface NetworkEntry {
  pid: number;
  name: string;
  connectionCount: number;
  bestLatency: number|null;  // ms, menor latência entre conns internet
  connections: ConnectionEntry[];
}

interface ConnectionEntry {
  remoteIp: string;
  remotePort: number;
  localPort: number;
  latency: number|null;  // ms, null se não medido
  isInternet: boolean;
}

interface EventEntry {
  id: number;
  timestamp: string;  // ISO 8601
  procName: string;
  pid: number;
  type: 'not_responding' | 'recovered';
  message: string;
}
```

---

### Evento `event_log` (Server → Client)

Emitido **uma única vez** imediatamente após o cliente conectar, com o log atual completo.

```json
[EventEntry, ...]  // Array de até 100 eventos
```

---

## Como adicionar um novo endpoint REST

1. Abrir `server.js`
2. Adicionar antes da linha `server.listen(...)`:

```js
app.get('/api/meu-endpoint', (req, res) => {
  // lógica aqui
  res.json({ dado: valor });
});
```

3. Reiniciar o servidor

---

## Como adicionar um novo evento WebSocket (Server → Client)

1. Chamar `io.emit('nome-evento', dados)` em qualquer ponto do `server.js`
2. No frontend (`public/app.js`), adicionar:

```js
socket.on('nome-evento', (data) => {
  // processar dados
});
```

---

## Como emitir dados sob demanda (Client → Server)

Atualmente o sistema é **unidirecional** (server push only). Para adicionar um canal Client → Server:

**Backend**:
```js
io.on('connection', (socket) => {
  socket.on('minha-acao', (data) => {
    // processar requisição do cliente
    socket.emit('resposta-acao', resultado);
  });
});
```

**Frontend**:
```js
socket.emit('minha-acao', { parametro: valor });
socket.on('resposta-acao', (res) => { ... });
```
