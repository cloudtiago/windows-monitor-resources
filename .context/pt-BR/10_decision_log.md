# 10 — Decision Log (Registro de Decisões Arquiteturais)

## ADR-001: Usar PowerShell para detectar `.Responding`

**Data**: 2026-05-16

**Contexto**: Precisávamos detectar se um app Windows estava travado ("Not Responding"). O npm ecosystem não oferece isso.

**Decisão**: Usar `child_process.spawn('powershell', ...)` para executar `Get-Process | Select .Responding`.

**Alternativas consideradas**:
- WMI direto (via `node-wmi`): pacote desatualizado, instável
- `winax` / `node-windows`: complexos, requerem compilação nativa
- Polling de janelas Win32 com `ffi-napi`: muito complexo, requer bindings C++

**Consequências**:
- ✅ Simples de implementar
- ✅ Sem dependências extras
- ✅ Funciona em qualquer Windows com PS 5.1+
- ❌ Spawna processo OS a cada 2.5s (overhead de CPU)
- ❌ Só funciona no Windows

---

## ADR-002: Usar `net.Socket` para medir latência TCP

**Data**: 2026-05-16

**Contexto**: Precisávamos medir latência de rede por processo sem precisar de admin rights.

**Decisão**: Medir o tempo de `socket.connect()` até o evento `connect` usando o módulo `net` nativo do Node.

**Alternativas consideradas**:
- ICMP ping (`ping` command): requer admin no Windows para raw sockets
- `ping` npm package: usa ICMP, mesma limitação
- HTTP GET timing: só funciona para servidores web, muitos usam HTTPS apenas
- `Test-Connection` PowerShell: ICMP, requer admin

**Consequências**:
- ✅ Sem dependências externas
- ✅ Não requer admin
- ✅ Funciona para qualquer protocolo TCP
- ❌ Não mede UDP ou QUIC (HTTP/3)
- ❌ Alguns servidores dropam SYN sem RST (timeout de 3s)
- ❌ Mede TCP handshake, não round-trip de dados reais

---

## ADR-003: Cache de latência com TTL de 15s

**Data**: 2026-05-16

**Contexto**: Medir latência TCP para cada endereço remoto a cada 2.5s sobrecarregaria a rede e os servidores remotos.

**Decisão**: Cache em `Map` com TTL de 15 segundos por `"ip:port"`.

**Alternativas consideradas**:
- Sem cache: impraticável (muitas conexões simultâneas)
- Cache por minuto: latência muito desatualizada
- Cache por 30s: tradeoff razoável mas escolhemos 15s para maior frescor

**Consequências**:
- ✅ Reduz drasticamente o número de conexões TCP abertas
- ✅ Sem dependências extras (Map nativo)
- ❌ Map sem limite de tamanho (potencial memory leak lento)
- ❌ Latência pode estar desatualizada em até 15s

---

## ADR-004: Frontend sem framework (Vanilla JS)

**Data**: 2026-05-16

**Contexto**: Precisávamos de um dashboard responsivo e em tempo real.

**Decisão**: HTML + CSS Vanilla + JS puro, sem React, Vue ou Svelte.

**Alternativas consideradas**:
- React: overhead de bundle, requer build step, complexidade para projeto simples
- Vue 3: mais leve, mas ainda requer configuração
- Svelte: excelente para este caso, mas requer compilação

**Consequências**:
- ✅ Zero build step — `node server.js` e pronto
- ✅ Fácil de entender e modificar
- ✅ Performance excelente (renderização direta em DOM)
- ❌ Estado global manual (`const state = {}`) sem reatividade automática
- ❌ Re-renderizações manuais a cada ciclo

---

## ADR-005: Dados em memória (sem banco)

**Data**: 2026-05-16

**Contexto**: Precisávamos de log de eventos e cache de latência.

**Decisão**: Arrays e Maps em memória do processo Node.js, sem persistência.

**Alternativas consideradas**:
- SQLite (`better-sqlite3`): persistência, queries, mas overhead
- Redis: overkill para projeto local
- Arquivo JSON: race conditions, I/O frequente

**Consequências**:
- ✅ Zero configuração de banco
- ✅ Latência de acesso zero
- ❌ Dados perdidos no restart
- ❌ Sem histórico de longo prazo

---

## ADR-006: Limite de 150 processos no payload

**Data**: 2026-05-16

**Contexto**: Um Windows típico tem 100–200+ processos. Enviar todos via WebSocket a cada 2.5s aumenta o tamanho do payload.

**Decisão**: Limitar a 150 processos após ordenação (Not Responding primeiro, depois por CPU%).

**Consequências**:
- ✅ Payload previsível (~150 objetos)
- ❌ Processos com CPU muito baixo além da posição 150 são invisíveis

**Para alterar**: `processList.slice(0, 150)` em `server.js` linha 266.

---

## ADR-007: Socket.io com CORS aberto

**Data**: 2026-05-16

**Contexto**: Desenvolvimento local, sem autenticação.

**Decisão**: `cors: { origin: '*' }` para simplicidade em dev.

**Risco**: Em produção ou em rede local, qualquer host pode conectar ao WebSocket e receber dados de todos os processos do sistema.

**Ação necessária para produção**: Restringir origin e implementar autenticação no handshake.
