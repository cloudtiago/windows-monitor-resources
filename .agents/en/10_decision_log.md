# 10 — Architectural Decision Log

## ADR-001: Use PowerShell for `.Responding` detection

**Date**: 2026-05-16

**Context**: Detecting Windows "Not Responding" state. No npm package provides this reliably.

**Decision**: `child_process.spawn('powershell', ...)` running `Get-Process | Select .Responding`.

**Alternatives rejected**: `node-wmi` (outdated), `winax` (native compilation required), `ffi-napi` Win32 bindings (too complex).

**Trade-offs**: ✅ Simple, no extra deps, works on all Windows. ❌ Spawns OS process every 2.5s, Windows-only.

---

## ADR-002: Use `net.Socket` for TCP latency measurement

**Date**: 2026-05-16

**Context**: Measure network latency per process without admin rights.

**Decision**: Time `socket.connect()` → `connect` event using built-in `net` module.

**Alternatives rejected**: ICMP ping (requires admin on Windows), HTTP GET (HTTPS-only servers), PowerShell `Test-Connection` (ICMP, requires admin).

**Trade-offs**: ✅ No dependencies, no admin required, works for any TCP protocol. ❌ Doesn't work for UDP/QUIC, some servers drop SYN silently.

---

## ADR-003: 15s latency cache with TTL

**Date**: 2026-05-16

**Context**: Measuring latency for every connection on every 2.5s cycle would overload network and remote servers.

**Decision**: In-memory `Map` with 15-second TTL per `"ip:port"`.

**Trade-offs**: ✅ Drastically reduces TCP connections opened. ❌ No size limit (potential slow memory leak), up to 15s stale.

---

## ADR-004: Framework-free vanilla frontend

**Date**: 2026-05-16

**Context**: Real-time dashboard with frequent DOM updates.

**Decision**: Plain HTML + CSS + JS, no React/Vue/Svelte.

**Trade-offs**: ✅ Zero build step, easy to read and modify, excellent performance. ❌ Manual state management, no reactivity system.

---

## ADR-005: In-memory data (no database)

**Date**: 2026-05-16

**Context**: Event log and latency cache storage.

**Decision**: Arrays and Maps in Node.js process memory.

**Trade-offs**: ✅ Zero setup, zero latency. ❌ Data lost on restart, no long-term history.

---

## ADR-006: 150 process limit in payload

**Date**: 2026-05-16

**Context**: Windows typically has 100–200+ processes. Sending all via WebSocket every 2.5s increases payload size.

**Decision**: Slice to top 150 after sorting (Not Responding first, then by CPU%).

**Trade-offs**: ✅ Predictable payload size. ❌ Very low CPU processes beyond position 150 are invisible.

---

## ADR-007: Open CORS on Socket.io

**Date**: 2026-05-16

**Context**: Local development, no authentication.

**Decision**: `cors: { origin: '*' }` for dev simplicity.

**Risk**: In production or LAN, any host can connect and receive full process data. Restrict origin and add auth handshake before production deployment.
