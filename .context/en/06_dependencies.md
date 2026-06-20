# 06 — Dependencies

## Production dependencies

### `express` ^4.18.2
Serves static files from `public/` and two REST endpoints. Can be replaced by `fastify` or `hono` with minimal impact.

### `socket.io` ^4.7.2
Real-time bidirectional WebSocket. Used for server → client broadcast of `metrics` every 2.5s. Can be replaced by `ws` + SSE with medium refactor effort.

### `systeminformation` ^5.21.22
Cross-platform OS metrics. Functions used: `si.processes()`, `si.currentLoad()`, `si.mem()`, `si.networkStats()`.
Docs: https://systeminformation.io/

---

## Frontend dependencies (CDN — not in package.json)

### Chart.js 4.4.0
`https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`
Used for `'line'` type sparkline charts on CPU/RAM/Network KPI cards.

To host locally:
```bash
npm install chart.js
# Copy dist/chart.umd.min.js to public/libs/
# Update script src in index.html
```

### Google Fonts
Fonts loaded: `Inter` (weights 300–800), `JetBrains Mono` (weights 400, 500).
To host locally: use [google-webfonts-helper](https://gwfh.madebymike.de/).

---

## Native Node.js modules (zero install)

| Module | Usage |
|---|---|
| `http` | Base HTTP server creation |
| `net` | `net.Socket` for TCP latency measurement |
| `child_process` | `spawn('powershell', ...)` for PS scripts |
| `path` | `path.join(__dirname, 'public')` for static files |

---

## Dependency tree (summary)

```
monitor-de-recursos
├── express@4.18.2          (91 total packages)
├── socket.io@4.7.2
└── systeminformation@5.21.22  (zero own dependencies)
```

Run `npm audit` to check for vulnerabilities.
