# 08 — Pontos de Extensão

## Como adicionar uma nova métrica por processo

**Cenário**: adicionar o tempo de uptime do processo em horas.

### Passo 1 — Backend (`server.js`)

A `systeminformation` já retorna `p.started`. Adicionar ao objeto do processo no `processList.map()`:

```js
const processList = (procs.list || []).map(p => ({
  // ... campos existentes ...
  uptime: p.started ? Math.round((Date.now() - new Date(p.started)) / 3600000) : null
}));
```

### Passo 2 — Frontend (`public/index.html`)

Adicionar coluna `<th>` na tabela de processos:
```html
<th class="col-uptime sortable" data-sort="uptime">Uptime (h)</th>
```

### Passo 3 — Frontend (`public/app.js`)

1. Adicionar case no switch de ordenação em `filteredProcesses()`:
```js
case 'uptime': va = a.uptime ?? -1; vb = b.uptime ?? -1; break;
```

2. Adicionar célula no `tr.innerHTML` de `renderTable()`:
```js
<td>${p.uptime !== null ? p.uptime + 'h' : '—'}</td>
```

---

## Como adicionar uma nova aba no dashboard

**Cenário**: aba "Serviços Windows" listando serviços do sistema.

### Passo 1 — Backend

Criar função PowerShell para `Get-Service`:
```js
function getWindowsServices() {
  return new Promise((resolve) => {
    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', `
      Get-Service | Select-Object Name, DisplayName, Status | ConvertTo-Json -Compress
    `], { windowsHide: true });
    let output = '';
    ps.stdout.on('data', d => { output += d.toString(); });
    ps.on('close', () => {
      try { resolve(JSON.parse(output.trim())); } catch { resolve([]); }
    });
    setTimeout(() => { ps.kill(); resolve([]); }, 5000);
  });
}
```

Incluir no `collectAndEmit()`:
```js
const [siData, psData, tcpConns, services] = await Promise.all([
  getSiProcesses(),
  getPowerShellResponding(),
  getTcpConnections(),
  getWindowsServices()
]);
// Adicionar ao payload:
payload.services = services;
```

### Passo 2 — HTML

Adicionar botão na `.tab-nav`:
```html
<button class="tab-btn" id="tab-servicos" data-tab="servicos">🔧 Serviços</button>
```

Adicionar view:
```html
<div id="view-servicos" class="tab-view" style="display:none">
  <!-- tabela de serviços -->
</div>
```

### Passo 3 — Frontend JS

Adicionar `state.services = []`, handler no `socket.on('metrics')`, e função `renderServicesTable()`.

---

## Como adicionar alertas por threshold de CPU

**Cenário**: gerar evento quando um processo ultrapassar 80% de CPU por mais de 10s.

### Passo 1 — Backend (`server.js`)

Adicionar estado de rastreamento:
```js
const highCpuTracker = new Map(); // pid → { firstSeen, alerted }
const CPU_ALERT_THRESHOLD = 80;
const CPU_ALERT_DURATION = 10000; // ms
```

Na função `collectAndEmit()`, após montar `processList`:
```js
for (const p of processList) {
  if (p.pcpu >= CPU_ALERT_THRESHOLD) {
    const now = Date.now();
    if (!highCpuTracker.has(p.pid)) {
      highCpuTracker.set(p.pid, { firstSeen: now, alerted: false });
    }
    const tracker = highCpuTracker.get(p.pid);
    if (!tracker.alerted && now - tracker.firstSeen >= CPU_ALERT_DURATION) {
      addEvent(p.name, p.pid, 'high_cpu', `${p.name} com CPU acima de ${CPU_ALERT_THRESHOLD}% por ${CPU_ALERT_DURATION/1000}s`);
      tracker.alerted = true;
    }
  } else {
    highCpuTracker.delete(p.pid);
  }
}
```

### Passo 2 — Frontend

Em `handleNewEvents()`, adicionar case para `type === 'high_cpu'`.

---

## Como trocar o Socket.io por SSE (Server-Sent Events)

**Cenário**: ambientes que não suportam WebSocket.

### Backend

```js
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const interval = setInterval(async () => {
    const payload = await buildPayload(); // extrair lógica de collectAndEmit
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }, 2500);

  req.on('close', () => clearInterval(interval));
});
```

### Frontend

```js
const evtSource = new EventSource('/api/stream');
evtSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  // mesma lógica do socket.on('metrics')
};
```

---

## Como adicionar autenticação básica

```js
// Middleware simples - adicionar antes das rotas
app.use((req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || auth !== 'Basic ' + Buffer.from('admin:senha123').toString('base64')) {
    res.set('WWW-Authenticate', 'Basic realm="Monitor"');
    return res.status(401).send('Autenticação necessária');
  }
  next();
});
```

> **⚠️ Para WebSocket**: a autenticação deve ser implementada no handshake do Socket.io via `io.use()`.

---

## Pontos de extensão mapeados

| Feature | Arquivo | Linha de referência |
|---|---|---|
| Adicionar métrica por processo | `server.js` → `processList.map()` | ~213 |
| Adicionar fonte de dados OS | `server.js` → `collectAndEmit()` | ~201 |
| Alterar thresholds de latência | `public/app.js` → `latClass()` | 325 |
| Alterar thresholds de CPU cor | `public/app.js` → `cpuClass()` | 205 |
| Alterar limite de processos | `server.js` → `processList.slice(0, 150)` | 266 |
| Alterar frequência de coleta | `server.js` → `setInterval(poll, 2500)` | 293 |
| Adicionar aba na UI | `public/index.html` → `.tab-nav` | ~143 |
| Adicionar endpoint REST | `server.js` → antes de `server.listen` | 295+ |
| Adicionar token CSS | `public/style.css` → `:root` | 9 |
| Alterar paleta de cores | `public/style.css` → variáveis `--purple`, `--cyan`, etc. | 9–30 |
