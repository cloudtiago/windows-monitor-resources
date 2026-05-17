# 03 — Domain Rules

## Process response classification

```
responding === true   →  badge "✓ OK"      (green)  — app responds to UI
responding === false  →  badge "⚠️ Hung"   (red)    — Windows "Not Responding"
responding === null   →  badge "— BG"      (gray)   — no UI / system process
```

**Source**: PowerShell `Get-Process | Select-Object Name, Id, Responding`

**Limitation**: `.Responding` is valid **only for Win32 processes with a window**. System services, console apps, and headless processes always return `null`.

---

## Network latency classification

| Range | CSS class | Color | Meaning |
|---|---|---|---|
| `null` | `none` | gray | Not yet measured or timeout |
| ≤ 50ms | `good` | green | Excellent |
| 51–150ms | `ok` | cyan | Good |
| 151–300ms | `warn` | yellow | Slow |
| > 300ms | `bad` | red | Critical |

**Responsible function** (frontend): `latClass(ms)` in `public/app.js` lines 325–331

**To change thresholds**: modify only `latClass()` in the frontend — the backend sends the raw ms value.

---

## Per-process CPU classification (sparkline color)

| Range | CSS class | Color | Meaning |
|---|---|---|---|
| `pcpu >= 20` | `cpu-high` | red | High consumption |
| `pcpu >= 5` | `cpu-med` | yellow | Moderate consumption |
| `pcpu < 5` | `cpu-low` | green | Normal |

**Responsible function**: `cpuClass(v)` in `public/app.js` lines 205–209

---

## Private/loopback IP identification

`isPrivateOrLoopback(ip)` in `server.js` (lines 80–92) determines if a connection is **internal** or **internet**:

```
Blocked (isInternet = false):
  IPv6: ::1, fe80:*, ::ffff:127.*
  IPv4: 127.0.0.0/8    (loopback)
         10.0.0.0/8     (RFC1918)
         192.168.0.0/16 (RFC1918)
         172.16.0.0/12  (RFC1918)

Allowed (isInternet = true):
  Any other public IP
```

**To add new private ranges**: modify `isPrivateOrLoopback()` in `server.js`.

---

## Process table sorting

**Default sort**: CPU% descending, with `Not Responding` processes always at the top.

```js
processList.sort((a, b) => {
  if (a.responding === false && b.responding !== false) return -1;
  if (b.responding === false && a.responding !== false) return 1;
  return b.pcpu - a.pcpu;
});
```

Applied **in the backend** before sending the payload. The user can re-sort in the frontend by clicking column headers (name, pid, cpu, mem, pmem).

---

## Process display limit

The backend limits the slice to **150 processes** before emitting:

```js
processes: processList.slice(0, 150)
```

**Impact**: processes with very low CPU beyond position 150 are not visible in the dashboard.

---

## Event log limit

```
MAX_EVENTS = 100  (server.js, line 18)
```

Array maintained with `unshift` (newest first) and truncated with `pop` when exceeded. Frontend receives only the 50 most recent:

```js
eventLog: eventLog.slice(0, 50)
```

---

## Latency measurement rules

1. Only `Established` connections are queried (not `Listen`, `TimeWait`, etc.)
2. Only non-private IPs are measured
3. Deduplication by `"ip:port"` — same server not pinged multiple times per process
4. Batches of **15 parallel measurements** to avoid saturating the network
5. **15-second cache** per `"ip:port"` — fixed value (`LATENCY_TTL = 15000`)
6. TCP connect timeout: **3 seconds** (hardcoded in `measureTcpLatency`)
7. If connect fails (timeout/error): `latency = null`

---

## Automatically detected events

| Type | Trigger condition | Message |
|---|---|---|
| `not_responding` | Process changes from `responding=true/null` to `responding=false` | `"<name> (PID <N>) não está respondendo"` |
| `recovered` | Process that was in `not_responding` returns to `responding=true` or disappears | `"<name> (PID <N>) voltou a responder"` |

> **Note**: A process that is terminated while `Not Responding` also triggers `recovered`. This is intentional behavior.
