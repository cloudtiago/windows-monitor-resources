# 01 — Arquitetura

## Estrutura de arquivos

```
Monitor de Recursos/
├── server.js              # Backend principal (Node.js)
├── package.json           # Dependências e scripts npm
├── package-lock.json      # Lock file
├── node_modules/          # Dependências instaladas
├── public/                # Arquivos servidos estaticamente
│   ├── index.html         # Dashboard HTML (SPA single-page)
│   ├── style.css          # Estilos (Vanilla CSS, dark glassmorphism)
│   └── app.js             # Frontend JavaScript (Socket.io client)
└── .agents/               # Documentação técnica (este diretório)
    ├── pt-BR/             # Documentação em Português
    └── en/                # Documentação em Inglês
```

---

## Arquitetura do backend (`server.js`)

O backend é um único arquivo Node.js com responsabilidades bem definidas:

### Módulos e funções

| Função | Responsabilidade |
|---|---|
| `getPowerShellResponding()` | Spawna powershell, executa `Get-Process`, retorna `[{Name, Id, Responding}]` |
| `getTcpConnections()` | Spawna powershell, executa `Get-NetTCPConnection`, retorna conexões TCP estabelecidas |
| `isPrivateOrLoopback(ip)` | Filtra IPs privados/loopback (RFC1918 + IPv6) para isolamento de tráfego internet |
| `measureTcpLatency(host, port)` | Mede tempo de TCP connect em ms usando `net.Socket` nativo |
| `getLatencies(connections)` | Orquestra medições em lote (15 paralelas máx), respeita cache de 15s |
| `getSiProcesses()` | Wrapper async de `si.processes()`, `si.currentLoad()`, `si.mem()` |
| `buildNetworkData(connections, processList)` | Agrupa conexões por PID, calcula melhor latência por processo |
| `collectAndEmit()` | Função principal: coleta tudo em paralelo e emite evento `metrics` via Socket.io |
| `poll()` | Guard de re-entrância + chama `collectAndEmit()` a cada 2.5s |
| `addEvent(...)` | Adiciona ao array `eventLog[]` em memória (máx 100 eventos) |

### Fluxo de coleta (a cada 2.5s)

```
poll()
  ↓
collectAndEmit()
  ├── getSiProcesses()      ─── paralelo ───▶  { procs, load, mem }
  ├── getPowerShellResponding()               ▶  [{Name, Id, Responding}]
  └── getTcpConnections()                    ▶  [{LocalPort, RemoteAddress, RemotePort, OwningProcess}]
  ↓
  Merge: processList ← procs + respondingMap
  ↓
  Detect not_responding events → addEvent()
  ↓
  getLatencies(tcpConns)   [async, não bloqueia emit]
  ↓
  buildNetworkData(tcpConns, processList)
  ↓
  io.emit('metrics', payload)  →  todos os clientes WebSocket
```

---

## Arquitetura do frontend (`public/app.js`)

O frontend é um SPA (Single Page Application) sem framework, organizado em módulos funcionais:

### Estado global (`state`)

```js
const state = {
  processes: [],        // Lista de processos do último emit
  networkData: [],      // Apps com conexões de rede
  system: {},           // CPU%, RAM%, totais
  events: [],           // Log de eventos (espelho do backend)
  sortKey: 'cpu',       // Coluna de ordenação ativa
  sortDir: -1,          // -1=desc, 1=asc
  filter: 'all',        // Filtro ativo (all/alert/ok)
  search: '',           // Texto do campo de busca (processos)
  netSearch: '',        // Texto de busca da aba rede
  cpuHistory: [],       // Histórico de 30 leituras de CPU global
  ramHistory: [],       // Histórico de 30 leituras de RAM global
  maxHistory: 30,       // Tamanho máximo dos arrays de histórico
  procCpuHistory: {},   // Map pid→[valores] para sparklines por processo
  expandedPids: Set(),  // PIDs com detalhe de conexão expandido
};
```

### Pipeline de renderização

```
socket.on('metrics')
  ↓
  state.* = data.*
  ↓
  updateKPIs()          → Atualiza 5 cards KPI + gráficos sparkline
  renderTable()         → Re-renderiza tabela de processos (+ sparklines canvas)
  renderNetworkTable()  → Re-renderiza tabela de rede (somente se tab ativa)
  renderEvents()        → Re-renderiza log de eventos lateral
  handleNewEvents()     → Dispara toasts para eventos novos
```

---

## Padrão de comunicação WebSocket

```
Servidor                        Cliente
   │                               │
   │──── connect ─────────────────▶│
   │◀─── socket.emit('event_log') ─│  (envio imediato do log atual)
   │                               │
   │  [a cada 2.5s]                │
   │──── 'metrics' payload ───────▶│  (broadcast para todos os clientes)
   │                               │
   │◀─── disconnect ───────────────│
```

---

## Separação de responsabilidades

| Responsabilidade | Onde fica |
|---|---|
| Coleta de dados do OS | `server.js` — funções PowerShell + systeminformation |
| Cálculo de latência | `server.js` — `measureTcpLatency`, `getLatencies`, `latencyCache` |
| Detecção de eventos | `server.js` — `collectAndEmit()` + `prevNotResponding` |
| Armazenamento de estado | `server.js` — `eventLog[]`, `latencyCache`, `prevNotResponding` (in-memory) |
| Renderização e UI | `public/app.js` — todas as funções `render*()` |
| Estilos visuais | `public/style.css` — tokens CSS, componentes, responsividade |
| Estrutura HTML | `public/index.html` — DOM estático, IDs dos elementos |
