# 00 — System Overview
# Visão Geral do Sistema

> **Monitor de Recursos — Windows 11**
> Versão: 1.0.0 | Idioma: Português (PT-BR)

---

## O que é este sistema?

Aplicação web **em tempo real** que monitora todos os processos em execução no Windows 11, exibindo:

- **CPU %** e **RAM** por processo e do sistema global
- **Taxa de transferência global de rede** (Upload e Download em KB/s e MB/s)
- **Status de resposta** (`Responding` / `Not Responding`) de apps com interface gráfica
- **Latência de rede em ms** (TCP connect time) para processos com conexões à internet
- **Log de eventos** de travamentos e recuperações
- **Notificações em toast** ao detectar novas anomalias

O sistema roda **localmente** como servidor Node.js e é acessado pelo **Microsoft Edge em modo `--app`** (janela própria, sem barra de endereço, tela cheia), ou pelo navegador em `http://localhost:3030` quando em modo desenvolvimento.

---

## Contexto de uso

| Quem usa | Como usa |
|---|---|
| Desenvolvedor / sysadmin | Abre o browser e monitora recursos em tempo real |
| Agente automatizado | Consome `/api/health` e `/api/events` via HTTP REST |

---

## Componentes principais

```
┌─────────────────────────────────────────────────────────┐
│                   Browser (Frontend)                    │
│   public/index.html  public/style.css  public/app.js   │
│   Socket.io Client + Chart.js + Canvas2D               │
└────────────────────┬────────────────────────────────────┘
                     │ WebSocket (Socket.io)
                     │ eventos: 'metrics', 'event_log'
┌────────────────────▼────────────────────────────────────┐
│              Node.js Backend (server.js)                │
│   Express (HTTP)  +  Socket.io Server                  │
│   ├── systeminformation  →  CPU / RAM / processes       │
│   ├── PowerShell spawn   →  Responding + TCP conns      │
│   └── net.Socket         →  Latência TCP em ms          │
└─────────────────────────────────────────────────────────┘
```

---

## Tecnologias utilizadas

| Camada | Tecnologia | Versão | Motivo |
|---|---|---|---|
| Servidor HTTP | Express | ^4.18.2 | Serve arquivos estáticos + API REST |
| WebSocket | Socket.io | ^4.7.2 | Push de métricas a cada 2.5s |
| Socket.io Client | Socket.io CDN | 4.7.2 | Carregado do CDN (necessidade do pkg bundle) |
| Métricas do sistema | systeminformation | ^5.21.22 | CPU, RAM, lista de processos, taxa de transferência de rede |
| Responsividade de apps | PowerShell nativo | Windows built-in | Única forma confiável de checar `.Responding` |
| Conexões TCP | PowerShell nativo | Windows built-in | `Get-NetTCPConnection` com OwningProcess |
| Latência de rede | Node.js `net` (built-in) | Node built-in | TCP connect timing sem dependências externas |
| Gráficos | Chart.js | 4.4.0 (CDN) | Sparklines de CPU/RAM/Rede |
| Tipografia | Inter + JetBrains Mono | Google Fonts (CDN) | Design premium |
| Empacotamento | pkg | ^5.8.1 | Compila Node.js em .exe standalone |
| Instalador | WiX Toolset v3 | 3.11.2 | Gera .msi com UI FeatureTree (atalho Desktop opcional) |
| Janela desktop | Microsoft Edge --app | Pré-instalado Win10/11 | Janela própria sem chrome do browser |

---

## Requisitos de ambiente

- **Sistema Operacional**: Windows 10 / Windows 11 (obrigatório — usa APIs Windows-specific)
- **Node.js**: >= 16.x (apenas em modo desenvolvimento; não necessário com o instalador .msi)
- **PowerShell**: >= 5.1 (já incluso no Windows 11)
- **Microsoft Edge**: qualquer versão moderna (já incluso no Windows 10/11) — usado para abrir a UI em modo `--app`
- **Permissões**: Sem necessidade de admin para leitura básica; `Get-NetTCPConnection` pode retornar dados parciais sem privilégios elevados
- **Internet**: Necessária para carregar Socket.io, Chart.js e fontes Google do CDN
