# 08 — Extension Points

## Add a new per-process metric

**Example**: add process uptime in hours.

### Step 1 — Backend (`server.js`)
In `processList.map()` (~line 213):
```js
uptime: p.started ? Math.round((Date.now() - new Date(p.started)) / 3600000) : null
```

### Step 2 — Frontend HTML
Add `<th>` column to process table.

### Step 3 — Frontend JS
1. Add `case 'uptime'` in `filteredProcesses()` sort switch
2. Add `<td>` cell in `renderTable()` innerHTML

---

## Add a new dashboard tab

### Backend
Create a new PowerShell function, include in `collectAndEmit()` parallel call, add to payload.

### HTML
Add tab button in `.tab-nav`, add `<div id="view-X">` container.

### JS
Add state field, handle in `socket.on('metrics')`, create `renderXTable()`.

---

## Add CPU threshold alerts

```js
// server.js — global state
const highCpuTracker = new Map();
const CPU_ALERT_THRESHOLD = 80;
const CPU_ALERT_DURATION = 10000;

// In collectAndEmit(), after processList is built:
for (const p of processList) {
  if (p.pcpu >= CPU_ALERT_THRESHOLD) {
    const now = Date.now();
    if (!highCpuTracker.has(p.pid)) highCpuTracker.set(p.pid, { firstSeen: now, alerted: false });
    const t = highCpuTracker.get(p.pid);
    if (!t.alerted && now - t.firstSeen >= CPU_ALERT_DURATION) {
      addEvent(p.name, p.pid, 'high_cpu', `${p.name} CPU above ${CPU_ALERT_THRESHOLD}% for ${CPU_ALERT_DURATION/1000}s`);
      t.alerted = true;
    }
  } else {
    highCpuTracker.delete(p.pid);
  }
}
```

---

## Replace Socket.io with SSE

```js
// Backend
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  const interval = setInterval(async () => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }, 2500);
  req.on('close', () => clearInterval(interval));
});

// Frontend
const evtSource = new EventSource('/api/stream');
evtSource.onmessage = (e) => { const data = JSON.parse(e.data); /* ... */ };
```

---

## Add Basic Auth

```js
// server.js — add before routes
app.use((req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || auth !== 'Basic ' + Buffer.from('admin:password').toString('base64')) {
    res.set('WWW-Authenticate', 'Basic realm="Monitor"');
    return res.status(401).send('Unauthorized');
  }
  next();
});
```

---

## Extension reference map

| Feature | File | Reference line |
|---|---|---|
| Add process metric | `server.js` → `processList.map()` | ~213 |
| Add OS data source | `server.js` → `collectAndEmit()` | ~201 |
| Change latency thresholds | `public/app.js` → `latClass()` | 325 |
| Change CPU color thresholds | `public/app.js` → `cpuClass()` | 205 |
| Change process limit | `server.js` → `processList.slice(0, 150)` | 266 |
| Change poll frequency | `server.js` → `setInterval(poll, 2500)` | 293 |
| Add UI tab | `public/index.html` → `.tab-nav` | ~143 |
| Add REST endpoint | `server.js` → before `server.listen` | 295+ |
| Add CSS token | `public/style.css` → `:root` | 9 |
| Change color palette | `public/style.css` → `--purple`, `--cyan` vars | 9–30 |
