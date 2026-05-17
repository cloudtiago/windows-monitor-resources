# 07 — Deployment

## Modo 1: Instalador MSI (distribuição — recomendado)

Este é o modo primário de distribuição para usuários finais.

```powershell
# Gerar o instalador (requer Node.js instalado na máquina de build)
npm run build:msi
# ou
powershell -ExecutionPolicy Bypass -File scripts/build-msi.ps1
```

O script `build-msi.ps1` executa automaticamente:
1. **pkg** — compila `server.js` em `dist/monitor-recursos.exe` (standalone, sem Node.js)
2. **WiX v3** — baixado automaticamente se não encontrado em `tools/wix/`
3. **candle.exe** — compila `installer/monitor-recursos.wxs` → `.wixobj`
4. **light.exe** — linka → `dist/monitor-recursos-v1.0.0-win-x64.msi`

### O instalador oferece:
- Escolha do diretório de instalação (botão **Procurar**)
- Feature opcional: **Atalho na Área de Trabalho** (marcado por padrão)
- Atalhos no Menu Iniciar (obrigatório)
- Desinstalação via Painel de Controle / Adicionar ou Remover Programas

### Fluxo de inicialização pós-instalação:

```
Atalho (launcher.vbs)
  ↓
Inicia monitor-recursos.exe em background (hidden)
  ↓
Polling em http://localhost:3030/api/health (até 30s)
  ↓
Servidor pronto → abre Edge --app="http://localhost:3030" --start-fullscreen
  ↓
Janela própria em tela cheia (sem barra de endereço)
```

**Requisitos do usuário final**: Windows 10/11, Microsoft Edge (pré-instalado), internet para CDN.

---

## Modo 2: Desenvolvimento local

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

Alterar a linha em `server.js`:
```js
const PORT = 3030;  // Alterar aqui
```

---

## Não há Docker (limitação intencional)

O sistema usa `Get-Process` e `Get-NetTCPConnection` do PowerShell para monitorar **processos do host Windows**. Dentro de um container Docker, esses comandos só enxergariam processos do container — não do host.

**Alternativa para containerização**: expor uma API REST no host Windows e ter o container consumindo essa API.

---

## Firewall (acesso em rede local)

Por padrão, o servidor escuta em `0.0.0.0:3030` (todas as interfaces). Para acessar de outro computador na rede local:

```powershell
New-NetFirewallRule -DisplayName "Monitor Recursos" -Direction Inbound `
  -Protocol TCP -LocalPort 3030 -Action Allow
```

Acessar via `http://<IP-DO-HOST>:3030`.

**⚠️ Atenção**: O dashboard expõe informações de todos os processos do sistema. **Não expor à internet sem autenticação.**

---

## Estrutura de produção (instalação via MSI)

```
C:\Program Files\Monitor de Recursos\
├── monitor-recursos.exe   # Servidor Node.js standalone (~38 MB)
├── launcher.vbs           # Launcher (atalhos apontam aqui)
├── public\
│   ├── index.html
│   ├── style.css
│   └── app.js
```

**Atualização**: desinstalar via ARP, substituir o MSI e reinstalar. O UpgradeCode está fixo no `.wxs`, garantindo upgrade limpo sem duplicação.
