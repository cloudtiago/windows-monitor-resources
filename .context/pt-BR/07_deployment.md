# 07 — Deployment

## Execução local (desenvolvimento)

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor
npm start
# ou
node server.js

# 3. Acessar dashboard
# Abrir http://localhost:3030 no navegador
```

**Pré-requisitos**:
- Windows 10 ou 11
- Node.js >= 16.x instalado
- PowerShell >= 5.1 (já incluso no Windows)

---

## Executar em porta diferente

Alterar a linha 13 de `server.js`:
```js
const PORT = 3030;  // Alterar aqui
```

Ou temporariamente via linha de comando:
```powershell
# Não suportado nativamente sem dotenv — modificar server.js
```

---

## Executar como serviço Windows (produção)

### Opção 1: PM2

```bash
npm install -g pm2

# Iniciar
pm2 start server.js --name "monitor-recursos"

# Auto-start com Windows
pm2 startup
pm2 save

# Monitorar
pm2 logs monitor-recursos
pm2 status
```

### Opção 2: NSSM (Non-Sucking Service Manager)

```powershell
# Instalar NSSM: https://nssm.cc/
nssm install MonitorRecursos "C:\Program Files\nodejs\node.exe"
nssm set MonitorRecursos AppParameters "Z:\VITAI\QI140 APPS\Monitor de Recursos\server.js"
nssm set MonitorRecursos AppDirectory "Z:\VITAI\QI140 APPS\Monitor de Recursos"
nssm start MonitorRecursos
```

### Opção 3: Tarefa agendada Windows

```powershell
$action = New-ScheduledTaskAction -Execute "node.exe" `
  -Argument "server.js" `
  -WorkingDirectory "Z:\VITAI\QI140 APPS\Monitor de Recursos"
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName "MonitorRecursos" -Action $action -Trigger $trigger -RunLevel Highest
```

---

## Não há Docker (limitação intencional)

O sistema usa `Get-Process` e `Get-NetTCPConnection` do PowerShell para monitorar **processos do host Windows**. Dentro de um container Docker (Linux ou Windows), esses comandos só enxergariam processos do container — não do host.

**Alternativa para containerização**: expor uma API REST no host Windows e ter o container consumindo essa API.

---

## Firewall (acesso em rede local)

Por padrão, o servidor escuta em `0.0.0.0:3030` (todas as interfaces). Para acessar de outro computador na rede local:

```powershell
# Abrir porta no Windows Defender Firewall
New-NetFirewallRule -DisplayName "Monitor Recursos" -Direction Inbound `
  -Protocol TCP -LocalPort 3030 -Action Allow
```

Acessar via `http://<IP-DO-HOST>:3030`.

**⚠️ Atenção**: O dashboard expõe informações de todos os processos do sistema. **Não expor à internet sem autenticação.**

---

## Atualização do projeto

```bash
# Parar servidor (se usando PM2)
pm2 stop monitor-recursos

# Atualizar código
git pull

# Reinstalar dependências (se package.json mudou)
npm install

# Reiniciar
pm2 restart monitor-recursos
```

---

## Estrutura de produção recomendada

```
Z:\VITAI\QI140 APPS\Monitor de Recursos\
├── server.js
├── package.json
├── package-lock.json
├── node_modules\        (não versionar)
└── public\
    ├── index.html
    ├── style.css
    └── app.js
```

**O que versionar**: todos os arquivos exceto `node_modules/`.
