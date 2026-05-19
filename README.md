# 🖥️ Windows 11 Resource Monitor

> Real-time web dashboard to monitor process performance and network latency on Windows 11

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-green)](https://nodejs.org)
[![Windows](https://img.shields.io/badge/OS-Windows%2010%2F11-blue)](https://microsoft.com/windows)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

![Dashboard Screenshot](https://raw.githubusercontent.com/leizem/windows-monitor-resources/main/.context/Screenshot1.png)

![Dashboard Screenshot](https://raw.githubusercontent.com/leizem/windows-monitor-resources/main/.context/Screenshot2.png)
---

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Live Process Table** | CPU %, RAM (MB/%), status, sparklines — updated every 2.5s |
| ⚠️ **Not Responding Detection** | Detects and highlights frozen apps using PowerShell `.Responding` |
| 🌐 **Network Latency (ms)** | TCP connect time per internet-connected process |
| 📈 **System KPI Cards** | CPU load, RAM usage, internet apps count with sparkline charts |
| 🔔 **Toast Notifications** | Instant alerts when an app freezes or recovers |
| 📝 **Event Log** | Persistent in-session history of all hang/recover events |
| 🔍 **Filter & Search** | Filter by name, sort by any column, toggle between tabs |
| 🎨 **Premium Dark UI** | Glassmorphism design with animated elements |

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/leizem/windows-monitor-resources.git
cd windows-monitor-resources

# Install dependencies
npm install

# Start the server
npm start

# Open in browser
# http://localhost:3030
```

**Requirements:**
- Windows 10 or Windows 11
- Node.js >= 16.x
- PowerShell >= 5.1 (built into Windows)

---

## 🏗️ Architecture

```
server.js (Node.js Backend)
├── Express         → Serves static files + REST API (/api/health, /api/events)
├── Socket.io       → WebSocket push every 2.5s to all clients
├── systeminformation → CPU %, RAM, process list
├── PowerShell spawn  → Get-Process (.Responding) + Get-NetTCPConnection
└── net.Socket        → TCP connect timing for latency measurement

public/ (Frontend)
├── index.html   → Dashboard structure (tabs, KPI cards, tables)
├── style.css    → Vanilla CSS dark glassmorphism design system
└── app.js       → Socket.io client, Chart.js, table rendering, state management
```

---

## 📡 How Latency Measurement Works

1. **Detect connections**: PowerShell `Get-NetTCPConnection -State Established` retrieves all active TCP connections with their owning process PID
2. **Filter internet**: private/loopback IPs (RFC1918 + IPv6) are excluded
3. **Measure**: `net.Socket.connect()` timing to each unique `ip:port` (TCP handshake time)
4. **Cache**: results cached for 15 seconds to avoid network saturation
5. **Batch**: max 15 parallel measurements per cycle

### Latency thresholds

| Range | Rating |
|---|---|
| ≤ 50ms | 🟢 Excellent |
| 51–150ms | 🔵 Good |
| 151–300ms | 🟡 Slow |
| > 300ms | 🔴 Critical |

---

## 📁 Project Structure

```
windows-monitor-resources/
├── server.js              # Backend (Node.js)
├── package.json
├── public/
│   ├── index.html         # Dashboard
│   ├── style.css          # Styles
│   └── app.js             # Frontend logic
└── .context/               # Technical documentation
    ├── pt-BR/             # Portuguese (BR) docs
    │   ├── 00_system_overview.md
    │   ├── 01_architecture.md
    │   ├── 02_data_flow.md
    │   ├── 03_domain_rules.md
    │   ├── 04_api_contracts.md
    │   ├── 05_environment_variables.md
    │   ├── 06_dependencies.md
    │   ├── 07_deployment.md
    │   ├── 08_extension_points.md
    │   ├── 09_known_limitations.md
    │   └── 10_decision_log.md
    └── en/                # English docs
        └── (same files)
```

---

## 🔌 REST API

| Endpoint | Description |
|---|---|
| `GET /api/health` | `{ "status": "ok", "uptime": <seconds> }` |
| `GET /api/events` | Full event log array (JSON) |

---

## ⚙️ Configuration

All configuration is hardcoded in `server.js`. Key constants:

| Constant | Default | Description |
|---|---|---|
| `PORT` | `3030` | HTTP/WebSocket port |
| `LATENCY_TTL` | `15000ms` | Latency cache TTL |
| `MAX_EVENTS` | `100` | Max events in memory |
| Poll interval | `2500ms` | Collection frequency |
| Process limit | `150` | Max processes in payload |

---

## ⚠️ Known Limitations

- **Windows only** — uses PowerShell Win32 APIs not available on Linux/macOS
- **`.Responding` only works for GUI apps** — services and console processes show `null`
- **No persistence** — event log and cache reset on server restart
- **No authentication** — do not expose to the internet without adding auth
- **TCP latency only** — UDP and QUIC (HTTP/3) connections are not measurable

See [`.context/en/09_known_limitations.md`](.context/en/09_known_limitations.md) for the full list.

---

## 🛠️ Run as a Windows Service

```bash
# Using PM2
npm install -g pm2
pm2 start server.js --name "monitor-recursos"
pm2 startup && pm2 save
```

---

## 📚 Full Documentation

Complete technical documentation (architecture, data flow, API contracts, extension points, decision log) is available in:

- **Portuguese**: [`.context/pt-BR/`](.context/pt-BR/)
- **English**: [`.context/en/`](.context/en/)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) file.

---

## 🙏 Acknowledgements

- [systeminformation](https://systeminformation.io/) — cross-platform system metrics
- [Socket.io](https://socket.io/) — real-time WebSocket communication
- [Chart.js](https://www.chartjs.org/) — sparkline charts
- [Inter](https://rsms.me/inter/) + [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — typography
