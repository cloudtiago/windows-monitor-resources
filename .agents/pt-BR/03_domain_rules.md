# 03 — Regras de Domínio

## Classificação de resposta de processo

```
responding === true   →  badge "✓ OK"    (verde)   — app responde à UI
responding === false  →  badge "⚠️ Travado" (vermelho) — app não responde (Windows "Not Responding")
responding === null   →  badge "— BG"    (cinza)   — processo sem UI ou de sistema
```

**Fonte**: PowerShell `Get-Process | Select-Object Name, Id, Responding`

**Limitação**: A propriedade `.Responding` é válida **somente para processos com janela Win32**. Serviços de sistema, console apps e processos headless sempre retornarão `null` (não são consultados via `respondingMap`, portanto ficam como `null`).

---

## Classificação de latência de rede

| Faixa | Classe CSS | Cor | Significado |
|---|---|---|---|
| `null` | `none` | cinza | Ainda não medido ou timeout |
| ≤ 50ms | `good` | verde | Excelente |
| 51–150ms | `ok` | cyan | Bom |
| 151–300ms | `warn` | amarelo | Lento |
| > 300ms | `bad` | vermelho | Crítico |

**Função responsável** (frontend): `latClass(ms)` em `public/app.js` linha 325–331

**Para alterar os thresholds**: modificar apenas `latClass()` no frontend — o backend envia o valor bruto em ms.

---

## Classificação de CPU por processo (sparkline)

| Faixa | Classe CSS | Cor | Significado |
|---|---|---|---|
| `pcpu >= 20` | `cpu-high` | vermelho | Alto consumo |
| `pcpu >= 5` | `cpu-med` | amarelo | Consumo moderado |
| `pcpu < 5` | `cpu-low` | verde | Normal |

**Função responsável**: `cpuClass(v)` em `public/app.js` linha 205–209

---

## Identificação de IPs privados/loopback

A função `isPrivateOrLoopback(ip)` em `server.js` (linhas 80–92) determina se uma conexão é **interna** ou **de internet**:

```
Bloqueados (isInternet = false):
  IPv6: ::1, fe80:*, ::ffff:127.*
  IPv4: 127.0.0.0/8  (loopback)
         10.0.0.0/8   (RFC1918)
         192.168.0.0/16 (RFC1918)
         172.16.0.0/12  (RFC1918)

Permitidos (isInternet = true):
  Qualquer outro IP público
```

**Para adicionar novos ranges privados**: modificar `isPrivateOrLoopback()` em `server.js`.

---

## Ordenação da tabela de processos

**Ordenação padrão**: CPU% decrescente, com processos `Not Responding` sempre no topo.

```js
processList.sort((a, b) => {
  if (a.responding === false && b.responding !== false) return -1;
  if (b.responding === false && a.responding !== false) return 1;
  return b.pcpu - a.pcpu;
});
```

Aplicada **no backend** antes de enviar o payload. O usuário pode re-ordenar no frontend clicando nas colunas (name, pid, cpu, mem, pmem).

---

## Limite de processos exibidos

O backend limita o slice a **150 processos** antes de emitir:

```js
processes: processList.slice(0, 150)
```

**Impacto**: processos com CPU muito baixo que ficam além da posição 150 não aparecem no dashboard. Aumentar este valor aumenta o tamanho do payload WebSocket.

---

## Limite do log de eventos

```
MAX_EVENTS = 100  (server.js, linha 18)
```

O array é mantido com `unshift` (mais recente primeiro) e truncado com `pop` quando excede o limite. O frontend recebe apenas os 50 mais recentes:

```js
eventLog: eventLog.slice(0, 50)
```

---

## Regras de medição de latência

1. Somente conexões `Established` são consultadas (não `Listen`, `TimeWait`, etc.)
2. Somente IPs não-privados são medidos
3. Deduplicação por `"ip:port"` — o mesmo servidor não é pingado múltiplas vezes por conexão diferente do mesmo processo
4. Lotes de **15 medições paralelas** para não saturar a rede
5. Cache de **15 segundos** por `"ip:port"` — valor fixo (`LATENCY_TTL = 15000`)
6. Timeout de TCP connect: **3 segundos** (hardcoded em `measureTcpLatency`)
7. Se o connect falhar (timeout/erro): `latency = null`

---

## Eventos detectados automaticamente

| Tipo | Condição de disparo | Mensagem |
|---|---|---|
| `not_responding` | Processo muda de `responding=true/null` para `responding=false` | `"<nome> (PID <N>) não está respondendo"` |
| `recovered` | Processo que estava em `not_responding` volta a ter `responding=true` ou desaparece | `"<nome> (PID <N>) voltou a responder"` |

> **Nota**: Um processo que é encerrado enquanto estava `Not Responding` também dispara `recovered` (porque saiu do set `prevNotResponding`). Este é um comportamento intencional — significa que o problema foi resolvido.
