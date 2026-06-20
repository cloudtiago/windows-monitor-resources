# 🖥️ Monitor de Recursos — HT Technology

> Dashboard web em tempo real para monitorar performance de processos e latência de rede no Windows

[![Versão](https://img.shields.io/badge/versão-1.2.0-7c3aed)](https://github.com/leizem/windows-monitor-resources/releases)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-green)](https://nodejs.org)
[![Windows](https://img.shields.io/badge/OS-Windows%2010%2F11-blue)](https://microsoft.com/windows)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Copyright](https://img.shields.io/badge/Copyright-%C2%A9%20HT%20Technology%C2%AE%202026-orange)](https://github.com/leizem)

---

## ✨ Features

| Feature | Descrição |
|---|---|
| 📊 **Processos em Tempo Real** | CPU %, RAM (MB/%), status, sparklines — atualizado a cada 2.5s |
| 🌡️ **Temperatura da CPU** | Monitoramento via sensor de hardware (quando disponível) |
| ⚠️ **Detecção de Travamentos** | Detecta e destaca apps congelados via PowerShell `.Responding` |
| 🚀 **Velocidade de Rede** | Download & Upload em tempo real com sparkline auto-escalável |
| 🌐 **Latência por App** | Tempo TCP por processo conectado à internet |
| 📈 **KPI Cards** | CPU, RAM, Temperatura, Alertas, Processos, Apps online, Taxa de rede |
| 🔔 **Toast Notifications** | Alertas instantâneos quando um app trava ou recupera |
| 📝 **Log de Eventos** | Histórico em sessão de todos os eventos de hang/recover |
| 📥 **Export CSV** | Exporta lista de processos filtrada (Ctrl+E) |
| 🔍 **Filtro & Busca** | Filtra por nome, ordena por qualquer coluna, alterna entre abas |
| 🎨 **UI Glassmorphism** | Design dark premium com animações e tema claro/escuro |

---

## 🚀 Quick Start

```bash
# Clone o repositório
git clone https://github.com/leizem/windows-monitor-resources.git
cd windows-monitor-resources

# Instale as dependências
npm install

# Inicie o servidor
npm start

# Abra no browser
# http://localhost:3030
```

**Requisitos:**
- Windows 10 ou Windows 11
- Node.js >= 16.x
- PowerShell >= 5.1 (built-in no Windows)

---

## 📦 Instalador MSI (Recomendado)

Baixe o instalador pronto na [página de releases](https://github.com/leizem/windows-monitor-resources/releases):

```
monitor-recursos-v1.2.0-win-x64.msi  (13.2 MB)
```

O instalador:
- Instala em `%ProgramFiles%\Monitor de Recursos\`
- Cria atalho no Menu Iniciar
- Cria atalho no Desktop (opcional)
- Abre automaticamente no Microsoft Edge em modo `--app`

---

## 🆕 Novidades v1.2.0 (20/06/2026)

| Melhoria | Detalhe |
|---|---|
| 🌡️ **KPI Temperatura CPU** | Novo card com indicador visual (Frio/Normal/Quente/Crítico) |
| 📥 **Export CSV** | Botão + atalho Ctrl+E para exportar processos filtrados |
| 🔒 **Upgrade limpo** | `MajorUpgrade Schedule=afterInstallInitialize` — sem entradas duplicadas no Painel de Controle |
| ⬆️ **Limite de processos** | 150 → 200 processos no payload |
| 📝 **Log expandido** | MAX_EVENTS 100 → 200 |
| 🛑 **Graceful Shutdown** | Servidor encerra corretamente com SIGINT/SIGTERM |
| 🌐 **Endpoint `/api/version`** | Retorna metadata completa do app |
| 🏷️ **Copyright © HT Technology® 2026** | Em todos os arquivos e no footer da UI |

---

## 🏗️ Arquitetura

```
server.js (Node.js Backend)
├── Express         → Serve arquivos estáticos + REST API
├── Socket.io       → WebSocket push a cada 2.5s para todos os clientes
├── systeminformation → CPU %, RAM, processos, rede, temperatura
├── PowerShell spawn  → Get-Process (.Responding) + Get-NetTCPConnection
└── net.Socket        → Medição de latência TCP

public/ (Frontend)
├── index.html   → Dashboard (tabs, KPI cards, tabelas, footer)
├── style.css    → Vanilla CSS glassmorphism (dark/light, responsivo)
└── app.js       → Socket.io client, Chart.js, sparklines, Export CSV
```

---

## 📡 Como a Medição de Latência Funciona

1. **Detecta conexões**: PowerShell `Get-NetTCPConnection -State Established` com o PID do processo dono
2. **Filtra internet**: IPs privados/loopback (RFC1918 + IPv6) são excluídos
3. **Mede**: `net.Socket.connect()` timing para cada `ip:port` único (TCP handshake)
4. **Cache**: resultados cacheados por 15 segundos para evitar saturação da rede
5. **Batch**: máximo 15 medições paralelas por ciclo

### Thresholds de Latência

| Faixa | Classificação |
|---|---|
| ≤ 50ms | 🟢 Ótimo |
| 51–150ms | 🔵 Bom |
| 151–300ms | 🟡 Lento |
| > 300ms | 🔴 Crítico |

---

## 📁 Estrutura do Projeto

```
windows-monitor-resources/
├── server.js              # Backend (Node.js)
├── package.json           # v1.2.0
├── public/
│   ├── index.html         # Dashboard
│   ├── style.css          # Estilos
│   └── app.js             # Lógica frontend
├── installer/
│   ├── monitor-recursos.wxs  # WiX v3 installer source
│   ├── launcher.vbs          # Abre Edge --app na porta 3030
│   ├── license.rtf           # Licença MIT exibida no installer
│   ├── icon.ico              # Ícone do app
│   └── icon.png              # Ícone PNG
├── scripts/
│   └── build-msi.ps1         # Build automatizado (pkg + WiX)
└── .context/                 # Documentação técnica
    ├── pt-BR/
    └── en/
```

---

## 🔌 REST API

| Endpoint | Descrição |
|---|---|
| `GET /api/health` | `{ "status": "ok", "uptime": <segundos>, "version": "1.2.0" }` |
| `GET /api/events` | Array do log de eventos (JSON) |
| `GET /api/version` | `{ "name", "version", "author", "copyright", "buildDate", "homepage" }` |

---

## ⚙️ Configuração

Todas as configurações estão em `server.js`:

| Constante | Padrão | Descrição |
|---|---|---|
| `PORT` | `3030` | Porta HTTP/WebSocket |
| `LATENCY_TTL` | `15000ms` | TTL do cache de latência |
| `MAX_EVENTS` | `200` | Máximo de eventos em memória |
| Poll interval | `2500ms` | Frequência de coleta |
| Process limit | `200` | Máximo de processos no payload |
| `CPU_TEMP_TTL` | `10000ms` | Cache de temperatura CPU |

---

## ⚠️ Limitações Conhecidas

- **Somente Windows** — usa APIs PowerShell Win32 não disponíveis no Linux/macOS
- **`.Responding` só funciona para apps GUI** — serviços e processos de console exibem `null`
- **Temperatura CPU pode não estar disponível** — depende do suporte do hardware/driver
- **Sem persistência** — log de eventos e cache reiniciam ao reiniciar o servidor
- **Sem autenticação** — não exponha à internet sem adicionar auth
- **Somente latência TCP** — conexões UDP e QUIC (HTTP/3) não são mensuráveis

---

## 🛠️ Executar como Serviço Windows

```bash
# Usando PM2
npm install -g pm2
pm2 start server.js --name "monitor-recursos"
pm2 startup && pm2 save
```

---

## 🤝 Contribuindo

1. Fork o repositório
2. Crie uma branch: `git checkout -b feature/minha-feature`
3. Commit: `git commit -m 'feat: adiciona minha feature'`
4. Push: `git push origin feature/minha-feature`
5. Abra um Pull Request

---

## 📄 Licença

MIT License — veja o arquivo [LICENSE](LICENSE).

---

## 📚 Documentação Completa

Documentação técnica completa (arquitetura, fluxo de dados, contratos de API, pontos de extensão) em:

- **Português**: [`.context/pt-BR/`](.context/pt-BR/)
- **English**: [`.context/en/`](.context/en/)

---

## 🙏 Agradecimentos

- [systeminformation](https://systeminformation.io/) — métricas de sistema multiplataforma
- [Socket.io](https://socket.io/) — comunicação WebSocket em tempo real
- [Chart.js](https://www.chartjs.org/) — gráficos sparkline
- [Inter](https://rsms.me/inter/) + [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — tipografia

---

**Copyright © HT Technology® 2026. Todos os direitos reservados.**
