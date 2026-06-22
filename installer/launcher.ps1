# =============================================================================
#  Monitor de Recursos — Launcher v4 (PowerShell)
#  Substitui launcher.vbs — compatível com Windows 10 / 11 (incluindo 24H2+)
#  onde o VBScript foi desabilitado por padrão (KB5042881).
#
#  Fluxo:
#    1. Inicia monitor-recursos.exe em background (janela oculta)
#    2. Faz polling em /api/health por até 30 s
#    3. Abre o Microsoft Edge em modo --app (janela própria, sem barra)
#    4. Exibe aviso se o servidor não responder a tempo
# =============================================================================

$installDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exePath    = Join-Path $installDir "monitor-recursos.exe"
$healthUrl  = "http://localhost:3030/api/health"

# ── 1. Inicia o servidor em background (janela oculta) ────────────────────────
$psi                        = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName               = $exePath
$psi.WorkingDirectory       = $installDir
$psi.WindowStyle            = [System.Diagnostics.ProcessWindowStyle]::Hidden
$psi.UseShellExecute        = $true
[System.Diagnostics.Process]::Start($psi) | Out-Null

# ── 2. Aguarda o servidor estar pronto (max 30 s, polling a cada 500 ms) ──────
$ready  = $false
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromMilliseconds(800)

for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $resp = $client.GetAsync($healthUrl).Result
        if ($resp.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {
        # servidor ainda não está pronto — continua tentando
    }
}
$client.Dispose()

# ── 3. Localiza o Microsoft Edge ──────────────────────────────────────────────
$edgeCandidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)

$edgePath = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

# ── 4. Abre a janela ──────────────────────────────────────────────────────────
if ($edgePath) {
    # Edge --app: janela própria sem barra de endereço, tela cheia
    Start-Process -FilePath $edgePath `
        -ArgumentList "--app=`"http://localhost:3030`"", "--start-fullscreen"
} else {
    # Fallback: abre no navegador padrão
    Start-Process "http://localhost:3030"
}

# ── 5. Aviso se o servidor demorou ────────────────────────────────────────────
if (-not $ready) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
        "O servidor demorou mais que o esperado.`nVerifique se a porta 3030 está disponível.",
        "Monitor de Recursos",
        [System.Windows.MessageBoxButton]::OK,
        [System.Windows.MessageBoxImage]::Warning
    ) | Out-Null
}
