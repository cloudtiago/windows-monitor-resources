# 07 — Deployment

## Local development

```bash
npm install
npm start
# Open http://localhost:3030
```

**Requirements**: Windows 10/11, Node.js >= 16.x, PowerShell >= 5.1

---

## Run as Windows Service (production)

### PM2
```bash
npm install -g pm2
pm2 start server.js --name "monitor-recursos"
pm2 startup && pm2 save
```

### NSSM
```powershell
nssm install MonitorRecursos "C:\Program Files\nodejs\node.exe"
nssm set MonitorRecursos AppParameters "server.js"
nssm set MonitorRecursos AppDirectory "Z:\VITAI\QI140 APPS\Monitor de Recursos"
nssm start MonitorRecursos
```

---

## No Docker support (by design)

PowerShell `Get-Process` and `Get-NetTCPConnection` inside a Docker container can only see processes **within the container**, not the Windows host. Containerization is not viable without a host-side agent exposing an API.

---

## Local network access

By default the server listens on `0.0.0.0:3030`. To allow other machines:

```powershell
New-NetFirewallRule -DisplayName "Monitor Recursos" -Direction Inbound `
  -Protocol TCP -LocalPort 3030 -Action Allow
```

⚠️ **Warning**: Do not expose to the internet without authentication — the dashboard reveals all system processes.

---

## Update procedure

```bash
pm2 stop monitor-recursos
git pull
npm install
pm2 restart monitor-recursos
```
