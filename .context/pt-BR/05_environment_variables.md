# 05 — Variáveis de Ambiente e Configuração

## Status atual

O projeto **não usa arquivo `.env`** nem variáveis de ambiente. Todas as configurações estão hardcoded em `server.js`.

---

## Constantes configuráveis (atualmente hardcoded)

| Constante | Localização | Valor padrão | Descrição |
|---|---|---|---|
| `PORT` | `server.js` linha 13 | `3030` | Porta HTTP/WebSocket do servidor |
| `MAX_EVENTS` | `server.js` linha 18 | `100` | Máximo de eventos no log em memória |
| `LATENCY_TTL` | `server.js` linha 108 | `15000` (ms) | TTL do cache de latência |
| `BATCH` | `server.js` linha 135 | `15` | Paralelas máximas de medição TCP |
| Timeout TCP latency | `measureTcpLatency()` linha 94 | `3000` (ms) | Timeout por medição de latência |
| Timeout PowerShell Responding | `getPowerShellResponding()` linha 49 | `5000` (ms) | Kill do processo PS se demorar |
| Timeout PowerShell TCP | `getTcpConnections()` linha 75 | `6000` (ms) | Kill do processo PS se demorar |
| Poll interval | `server.js` linha 293 | `2500` (ms) | Frequência de coleta |
| `maxHistory` | `public/app.js` linha 16 | `30` | Pontos de histórico nos gráficos |
| Limite de processos | `server.js` linha 266 | `150` | Max processos no payload |
| Limite de eventos no payload | `server.js` linha 269 | `50` | Max eventos por emit |

---

## Como implementar suporte a variáveis de ambiente

Para transformar qualquer constante em variável de ambiente:

1. Instalar `dotenv` (opcional, Node >= 20 tem suporte nativo):
```bash
npm install dotenv
```

2. Criar `.env` na raiz:
```env
PORT=3030
MAX_EVENTS=100
LATENCY_TTL_MS=15000
POLL_INTERVAL_MS=2500
PROCESS_LIMIT=150
```

3. No topo de `server.js`:
```js
require('dotenv').config();

const PORT = parseInt(process.env.PORT) || 3030;
const MAX_EVENTS = parseInt(process.env.MAX_EVENTS) || 100;
const LATENCY_TTL = parseInt(process.env.LATENCY_TTL_MS) || 15000;
```

4. Adicionar `.env` ao `.gitignore`.

---

## Arquivo `.gitignore` recomendado

```gitignore
node_modules/
.env
*.log
```
