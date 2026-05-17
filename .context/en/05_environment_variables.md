# 05 — Environment Variables & Configuration

## Current status

The project **does not use a `.env` file** or environment variables. All configuration is hardcoded in `server.js`.

---

## Configurable constants (currently hardcoded)

| Constant | Location | Default | Description |
|---|---|---|---|
| `PORT` | `server.js` line 13 | `3030` | HTTP/WebSocket server port |
| `MAX_EVENTS` | `server.js` line 18 | `100` | Max events in memory log |
| `LATENCY_TTL` | `server.js` line 108 | `15000` ms | Latency cache TTL |
| `BATCH` | `server.js` line 135 | `15` | Max parallel TCP measurements |
| TCP latency timeout | `measureTcpLatency()` line 94 | `3000` ms | Timeout per latency measurement |
| PowerShell Responding timeout | `getPowerShellResponding()` line 49 | `5000` ms | PS process kill timeout |
| PowerShell TCP timeout | `getTcpConnections()` line 75 | `6000` ms | PS process kill timeout |
| Poll interval | `server.js` line 293 | `2500` ms | Collection frequency |
| `maxHistory` | `public/app.js` line 16 | `30` | Chart history points |
| Process limit | `server.js` line 266 | `150` | Max processes in payload |
| Events in payload | `server.js` line 269 | `50` | Max events per emit |

---

## How to implement environment variable support

```bash
npm install dotenv
```

Create `.env` at root:
```env
PORT=3030
MAX_EVENTS=100
LATENCY_TTL_MS=15000
POLL_INTERVAL_MS=2500
PROCESS_LIMIT=150
```

Top of `server.js`:
```js
require('dotenv').config();
const PORT = parseInt(process.env.PORT) || 3030;
const MAX_EVENTS = parseInt(process.env.MAX_EVENTS) || 100;
const LATENCY_TTL = parseInt(process.env.LATENCY_TTL_MS) || 15000;
```

Add `.env` to `.gitignore`.

---

## Recommended `.gitignore`

```gitignore
node_modules/
.env
*.log
```
