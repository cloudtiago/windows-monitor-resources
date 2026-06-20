# 06 — Dependências

## Dependências de produção (`dependencies`)

### `express` ^4.18.2

**Papel**: Servidor HTTP — serve os arquivos estáticos de `public/` e os dois endpoints REST.

**Uso no projeto**:
```js
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', ...);
app.get('/api/events', ...);
```

**Pode ser substituído por**: `fastify`, `hono`, `http` nativo do Node. Impacto baixo — apenas 3 linhas de roteamento.

---

### `socket.io` ^4.7.2

**Papel**: Comunicação bidirecional WebSocket entre backend e browser.

**Uso no projeto**:
- Server: `io.emit('metrics', payload)` — broadcast a cada 2.5s
- Server: `socket.emit('event_log', eventLog)` — envio inicial ao conectar
- Client: `const socket = io()` + `socket.on('metrics', handler)`

**Pode ser substituído por**: `ws` (WebSocket puro), SSE (Server-Sent Events). Impacto médio — requer refatoração do cliente e do servidor.

---

### `systeminformation` ^5.21.22

**Papel**: Coleta cross-platform de métricas do sistema operacional.

**Funções usadas**:
| Função | Dados retornados |
|---|---|
| `si.processes()` | `{ list: [{ pid, name, pcpu, pmem, mem_rss, state, started }] }` |
| `si.currentLoad()` | `{ currentLoad: number }` — % CPU total |
| `si.mem()` | `{ total, active }` — bytes |
| `si.networkStats()` | `[{ rx_sec, tx_sec, operstate, ... }]` — taxa de transferência global de rede |

**Documentação**: https://systeminformation.io/

**Pode ser substituído por**: PowerShell direto para tudo, mas perderia a simplicidade. `os-utils` é alternativa mais leve mas com menos dados.

---

## Dependências de frontend (CDN — não estão no package.json)

### `Chart.js` 4.4.0

**Origem**: `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`

**Papel**: Gráficos sparkline de CPU, RAM e Rede nos cards KPI.

**Funções usadas**: apenas `new Chart(ctx, config)` do tipo `'line'` com animação desabilitada.

**Para hospedar localmente**:
```bash
npm install chart.js
# Copiar dist/chart.umd.min.js para public/libs/
# Atualizar script src em index.html
```

---

### Google Fonts

**Origem**: `https://fonts.googleapis.com`

**Fontes carregadas**:
- `Inter` (pesos 300, 400, 500, 600, 700, 800) — texto geral
- `JetBrains Mono` (pesos 400, 500) — valores numéricos, IPs, PIDs

**Para hospedar localmente**: baixar via [google-webfonts-helper](https://gwfh.madebymike.de/) e adicionar ao `public/fonts/`.

---

## Módulos Node.js nativos utilizados (zero instalação)

| Módulo | Uso |
|---|---|
| `http` | Criação do servidor HTTP base |
| `net` | `net.Socket` para medir latência TCP |
| `child_process` | `spawn('powershell', ...)` para executar scripts PS |
| `path` | `path.join(__dirname, 'public')` para arquivos estáticos |

---

## Árvore de dependências (resumida)

```
monitor-de-recursos
├── express@4.18.2
│   ├── accepts, array-flatten, body-parser, content-type...
│   └── (91 pacotes totais no node_modules)
├── socket.io@4.7.2
│   ├── engine.io, socket.io-adapter, socket.io-parser...
└── systeminformation@5.21.22
    └── (zero dependências próprias)
```

**Total**: 91 pacotes, ~39KB no package-lock.json.

---

## Verificação de vulnerabilidades

Ao instalar:
```
found 0 vulnerabilities
```

Para verificar periodicamente:
```bash
npm audit
npm audit fix
```
