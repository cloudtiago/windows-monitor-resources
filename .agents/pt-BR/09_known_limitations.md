# 09 — Limitações Conhecidas e Dívidas Técnicas

## Limitações de sistema operacional

### 🔴 Windows-only (bloqueante)

O sistema **não funciona no Linux/macOS**. As dependências que causam isso:

| Dependência | Comando | Alternativa Linux |
|---|---|---|
| `responding` status | `Get-Process .Responding` (Win32 API) | Não existe equivalente direto |
| TCP connections | `Get-NetTCPConnection` | `ss -tnp` ou `/proc/net/tcp` |
| PowerShell | Disponível no Windows nativo | PowerShell Core 7+ (mas `.Responding` não existe) |

**Impacto**: migração para Linux requer substituição das duas funções PowerShell e abandono da feature `.Responding`.

---

## Limitações da propriedade `.Responding`

- **Só funciona para aplicações Win32 com janela** (UI). Serviços, console apps e processos background sempre retornam `null`.
- **Falsos positivos temporários**: um app fazendo operação intensiva (cálculo, I/O) pode aparecer como "Not Responding" por alguns segundos antes de responder. O sistema não tem debounce — qualquer leitura `false` gera evento imediatamente.
- **Permissões**: processos de outros usuários ou do sistema podem retornar erro silencioso, resultando em `null` ao invés de `false`.

---

## Limitações de latência

- **Mede TCP connect, não ICMP ping**: o valor em ms representa o tempo de estabelecer uma conexão TCP, não o round-trip de ping. Para algumas aplicações (UDP, QUIC), não é mensurável.
- **HTTPS/TLS overhead não incluído**: a latência medida é apenas do TCP handshake, sem TLS.
- **Servidores com SYN firewall**: alguns servidores dropam SYN packets sem RST, resultando em timeout de 3s e `latency = null`.
- **Cache de 15s**: durante esse período, a latência exibida pode não refletir mudanças na rede.
- **Sem histórico de latência**: o sistema não rastreia variação de latência ao longo do tempo por conexão.

---

## Limitações de dados em memória

- **Sem persistência**: ao reiniciar o servidor, `eventLog`, `latencyCache` e `prevNotResponding` são zerados.
- **Sem banco de dados**: não há histórico de eventos, trends ou exportação.
- **`latencyCache` sem limite de tamanho**: em máquinas com muitas conexões únicas de longa duração, o Map pode crescer indefinidamente (vazamento de memória lento).
- **`procCpuHistory` no frontend**: o histórico por PID no cliente (`state.procCpuHistory`) nunca limpa PIDs que não existem mais, causando acúmulo de memória no browser em sessões longas.

---

## Limitações de escalabilidade

- **Sem autenticação**: qualquer pessoa que acessar `http://localhost:3030` vê todos os processos do sistema.
- **Sem multi-tenancy**: um único servidor serve todos os clientes com os mesmos dados do host.
- **Broadcast para todos os clientes**: `io.emit('metrics', payload)` envia para **todos** os clientes conectados. Com muitos clientes simultâneos, o servidor pode sobrecarregar.
- **PowerShell spawn a cada 2.5s**: dois processos PowerShell são criados e destruídos a cada ciclo de coleta. Isso é custoso em CPU. Em máquinas com alta carga, o timeout de 5s/6s pode ser atingido com frequência.

---

## Dívidas técnicas

| Dívida | Severidade | Impacto | Solução sugerida |
|---|---|---|---|
| Sem `.env` / configuração externalizada | Média | Requer editar código para mudar porta/TTL | Implementar `dotenv` |
| Sem autenticação | Alta | Exposição de dados do sistema | Implementar JWT ou Basic Auth |
| Sem persistência de eventos | Baixa | Perda de histórico no restart | SQLite via `better-sqlite3` |
| `latencyCache` sem LRU/limite | Baixa | Crescimento indefinido de memória | Implementar `lru-cache` |
| `procCpuHistory` acumula no browser | Baixa | Memória crescente em sessões longas | Limpar PIDs ausentes no render |
| PowerShell spawn duplo por ciclo | Média | CPU overhead | Usar `pwsh` persistente com stdin/stdout |
| Sem debounce em eventos "Not Responding" | Média | Eventos falsos positivos | Exigir N ciclos consecutivos antes de emitir |
| CDN para Chart.js e fontes | Baixa | Falha offline ou bloqueio corporativo | Hospedar localmente em `public/libs/` |
| Sem testes automatizados | Alta | Regressões em qualquer mudança | Implementar Jest para server.js |
| Código frontend monolítico | Baixa | Dificulta manutenção futura | Modularizar em ES Modules |
| Sem rate limiting na API REST | Média | Vulnerável a abuso | Implementar `express-rate-limit` |

---

## Comportamentos não-óbvios

1. **`getLatencies()` não bloqueia o emit**: a medição de latência é iniciada de forma assíncrona mas o `io.emit('metrics')` não espera o resultado. Isso significa que nas primeiras coletas, `latency` aparece como `null` até o cache ser populado.

2. **Processo morto enquanto estava "Not Responding"**: dispara evento `recovered` — porque ele sai do set `prevNotResponding`. É um comportamento esperado mas pode confundir.

3. **`collecting = false` como guard**: se `collectAndEmit()` demorar mais de 2.5s (ex: PowerShell lento), o próximo ciclo é ignorado. Isso evita acúmulo de chamadas mas pode causar gaps de dados maiores que 2.5s.

4. **`socket.io` CORS aberto**: `cors: { origin: '*' }` permite conexão de qualquer origem. Em produção, restringir para a origem específica.
