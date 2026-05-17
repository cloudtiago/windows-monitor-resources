# 00 — System Overview

> **Windows 11 Resource Monitor**
> Version: 1.0.0 | Language: English

---

## What is this system?

A **real-time web application** that monitors all running processes on Windows 11, displaying:

- **CPU %** and **RAM** per process and system-wide
- **Responsiveness status** (`Responding` / `Not Responding`) for GUI applications
- **Network latency in ms** (TCP connect time) for processes with active internet connections
- **Event log** of app hangs and recoveries
- **Toast notifications** when new anomalies are detected

The system runs **locally** as a Node.js server and is accessed via browser at `http://localhost:3030`.

---

## Use context

| Who uses it | How |
|---|---|
| Developer / sysadmin | Opens browser and monitors resources in real time |
| Automated agent | Consumes `/api/health` and `/api/events` via HTTP REST |

---

## Main components

```
┌─────────────────────────────────────────────────────────┐
│                   Browser (Frontend)                    │
│   public/index.html  public/style.css  public/app.js   │
│   Socket.io Client + Chart.js + Canvas2D               │
└────────────────────┬────────────────────────────────────┘
                     │ WebSocket (Socket.io)
                     │ events: 'metrics', 'event_log'
┌────────────────────▼────────────────────────────────────┐
│              Node.js Backend (server.js)                │
│   Express (HTTP)  +  Socket.io Server                  │
│   ├── systeminformation  →  CPU / RAM / processes       │
│   ├── PowerShell spawn   →  Responding + TCP conns      │
│   └── net.Socket         →  TCP latency in ms           │
└─────────────────────────────────────────────────────────┘
```

---

## Technology stack

| Layer | Technology | Version | Reason |
|---|---|---|---|
| HTTP server | Express | ^4.18.2 | Serves static files + REST API |
| WebSocket | Socket.io | ^4.7.2 | Push metrics every 2.5s |
| System metrics | systeminformation | ^5.21.22 | CPU, RAM, process list |
| App responsiveness | Native PowerShell | Windows built-in | Only reliable way to check `.Responding` |
| TCP connections | Native PowerShell | Windows built-in | `Get-NetTCPConnection` with OwningProcess |
| Network latency | Node.js `net` (built-in) | Node built-in | TCP connect timing, no extra dependencies |
| Charts | Chart.js | 4.4.0 (CDN) | CPU/RAM sparklines |
| Typography | Inter + JetBrains Mono | Google Fonts (CDN) | Premium design |

---

## Environment requirements

- **Operating System**: Windows 10 / Windows 11 (mandatory — uses Windows-specific APIs)
- **Node.js**: >= 16.x
- **PowerShell**: >= 5.1 (built into Windows 11)
- **Permissions**: No admin rights required for basic reading; `Get-NetTCPConnection` may return partial data without elevated privileges
- **Internet**: Only required to load Chart.js and Google Fonts from CDN on first access
