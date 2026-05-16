# 09 — Known Limitations & Technical Debt

## OS limitations

### 🔴 Windows-only (blocking constraint)

| Dependency | Command | Linux alternative |
|---|---|---|
| `responding` status | `Get-Process .Responding` (Win32 API) | No direct equivalent |
| TCP connections | `Get-NetTCPConnection` | `ss -tnp` or `/proc/net/tcp` |

Migration to Linux requires replacing both PowerShell functions and dropping the `.Responding` feature.

---

## `.Responding` property limitations

- **Only valid for Win32 GUI apps**. Services, console apps, and headless processes return `null`.
- **Temporary false positives**: a busy app may appear as "Not Responding" for a few seconds. No debounce implemented.
- **Permission boundaries**: processes owned by other users may silently error, returning `null` instead of `false`.

---

## Latency limitations

- **Measures TCP connect, not ICMP ping**: not applicable for UDP or QUIC (HTTP/3) connections.
- **TLS overhead not included**: only TCP handshake is measured.
- **Servers with SYN firewall**: some servers drop SYN packets silently, causing 3s timeout and `latency = null`.
- **15s cache**: displayed latency may be up to 15s stale.
- **No latency history**: no per-connection trend tracking over time.

---

## In-memory data limitations

- **No persistence**: restart clears all `eventLog`, `latencyCache`, and `prevNotResponding`.
- **No database**: no historical data, trends, or export.
- **`latencyCache` has no size limit**: slow memory leak with many unique long-running connections.
- **`procCpuHistory` never purges dead PIDs**: browser memory accumulates over long sessions.

---

## Scalability limitations

- **No authentication**: anyone accessing `http://localhost:3030` sees all system processes.
- **Broadcast to all clients**: `io.emit('metrics', payload)` sends to every connected client simultaneously.
- **PowerShell spawn per cycle**: two PS processes created and destroyed every 2.5s — CPU-costly.
- **CORS open**: `origin: '*'` allows connections from any origin.

---

## Technical debt table

| Debt | Severity | Suggested fix |
|---|---|---|
| No `.env` / externalized config | Medium | Add `dotenv` |
| No authentication | High | Implement JWT or Basic Auth |
| No event persistence | Low | Add SQLite via `better-sqlite3` |
| `latencyCache` without LRU/limit | Low | Use `lru-cache` |
| `procCpuHistory` browser accumulation | Low | Prune absent PIDs in render loop |
| PowerShell double spawn per cycle | Medium | Use persistent `pwsh` process with stdin |
| No debounce on Not Responding events | Medium | Require N consecutive cycles before firing |
| CDN for Chart.js and fonts | Low | Host locally in `public/libs/` |
| No automated tests | High | Add Jest for server.js |
| Monolithic frontend | Low | Modularize into ES Modules |
| No REST rate limiting | Medium | Add `express-rate-limit` |

---

## Non-obvious behaviors

1. **`getLatencies()` doesn't block emit**: latency measurement is fired async without awaiting. First few cycles show `null` until cache populates.
2. **Process killed while Not Responding**: triggers `recovered` event — expected but may confuse.
3. **`collecting` re-entrancy guard**: if a cycle takes >2.5s (slow PowerShell), the next cycle is skipped entirely — may cause data gaps.
4. **Socket.io open CORS**: `cors: { origin: '*' }` — restrict in production.
