#Requires -Version 5.1
# =============================================================================
#  Monitor de Recursos - Build MSI Installer v1.2.1
#  Copyright © HT Technology® 2026. Todos os direitos reservados.
#  Gera o executavel standalone (pkg) e o instalador .msi (WiX v3)
#  Uso: npm run build:msi
#       powershell -ExecutionPolicy Bypass -File scripts/build-msi.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# --- Paths -------------------------------------------------------------------
$ProjectRoot  = $PSScriptRoot | Split-Path -Parent
$DistDir      = Join-Path $ProjectRoot "dist"
$ToolsWixDir  = Join-Path $ProjectRoot "tools\wix"
$InstallerDir = Join-Path $ProjectRoot "installer"

$AppVersion = "1.2.1"
$ExeName    = "monitor-recursos.exe"
$ExePath    = Join-Path $DistDir $ExeName
$MsiName    = "monitor-recursos-v$AppVersion-win-x64.msi"
$MsiPath    = Join-Path $DistDir $MsiName
$WxsPath    = Join-Path $InstallerDir "monitor-recursos.wxs"
$WixObjPath = Join-Path $DistDir "monitor-recursos.wixobj"

$WixBinUrl  = "https://github.com/wixtoolset/wix3/releases/download/wix3112rtm/wix311-binaries.zip"
$WixZipPath = Join-Path $ProjectRoot "tools\wix311-binaries.zip"
$CandleExe  = Join-Path $ToolsWixDir "candle.exe"
$LightExe   = Join-Path $ToolsWixDir "light.exe"

# --- Banner ------------------------------------------------------------------
Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "    Monitor de Recursos - Build MSI v$AppVersion               " -ForegroundColor Cyan
Write-Host "    Copyright (c) HT Technology 2026                        " -ForegroundColor Cyan
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Prepare directories + clean old artifacts ----------------------
Write-Host "[1/5] Preparando diretorios e limpando build anterior..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $ProjectRoot "tools") | Out-Null

# Remove stale MSI artifacts from previous builds to avoid confusion
Get-ChildItem -Path $DistDir -Filter "monitor-recursos-v*.msi" -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne $MsiName } |
  ForEach-Object {
    Write-Host "      Removendo MSI antigo: $($_.Name)" -ForegroundColor Gray
    Remove-Item $_.FullName -Force
  }
if (Test-Path $WixObjPath) { Remove-Item $WixObjPath -Force }

Write-Host "      OK - diretorios prontos" -ForegroundColor Green

# --- Step 2: Build standalone .exe with pkg ---------------------------------
Write-Host "[2/5] Empacotando com pkg (Node.js standalone .exe)..." -ForegroundColor Yellow
Write-Host "      Isso pode levar 1-3 minutos na primeira execucao..." -ForegroundColor Gray

Set-Location $ProjectRoot
& npx pkg . --targets node18-win-x64 --output $ExePath --compress GZip

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERRO: Falha ao empacotar com pkg. Verifique os erros acima." -ForegroundColor Red
    exit 1
}

$ExeMB = [math]::Round((Get-Item $ExePath).Length / 1MB, 1)
Write-Host "      OK - $ExeName ($ExeMB MB) criado em dist\" -ForegroundColor Green

# --- Step 3: Download WiX v3 binaries ---------------------------------------
Write-Host "[3/5] Verificando WiX Toolset v3..." -ForegroundColor Yellow

if (-not (Test-Path $CandleExe)) {
    Write-Host "      Baixando WiX v3 binarios (~8 MB)..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $WixBinUrl -OutFile $WixZipPath -UseBasicParsing
    Write-Host "      Extraindo..." -ForegroundColor Gray
    Expand-Archive -Path $WixZipPath -DestinationPath $ToolsWixDir -Force
    Remove-Item $WixZipPath -Force
    Write-Host "      OK - WiX extraido em tools\wix\" -ForegroundColor Green
} else {
    Write-Host "      OK - WiX ja disponivel em tools\wix\" -ForegroundColor Green
}

# --- Step 4: Compile WiX source (.wxs -> .wixobj) ---------------------------
Write-Host "[4/5] Compilando fonte WiX (.wxs -> .wixobj)..." -ForegroundColor Yellow

& $CandleExe -arch x64 -out "$WixObjPath" "$WxsPath" -nologo

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERRO: Falha na compilacao WiX (candle.exe). Verifique o .wxs." -ForegroundColor Red
    exit 1
}
Write-Host "      OK - .wixobj gerado" -ForegroundColor Green

# --- Step 5: Link and create .msi -------------------------------------------
Write-Host "[5/5] Gerando instalador .msi (light.exe)..." -ForegroundColor Yellow

& $LightExe -out "$MsiPath" "$WixObjPath" -ext WixUIExtension -nologo -sice:ICE61

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERRO: Falha ao criar o .msi (light.exe)." -ForegroundColor Red
    exit 1
}

$MsiMB = [math]::Round((Get-Item $MsiPath).Length / 1MB, 1)

# --- Summary ----------------------------------------------------------------
Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Green
Write-Host "    Build concluido com sucesso!                              " -ForegroundColor Green
Write-Host "  ============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Executavel  : dist\$ExeName  ($ExeMB MB)" -ForegroundColor White
Write-Host "  Instalador  : dist\$MsiName  ($MsiMB MB)" -ForegroundColor White
Write-Host ""
Write-Host "  --- Proximos passos -------------------------------------------" -ForegroundColor DarkCyan
Write-Host "  1. Teste o instalador: msiexec /i dist\$MsiName /L*V install.log" -ForegroundColor Cyan
Write-Host "  2. Verifique Programs e Features - deve aparecer apenas 1 entrada" -ForegroundColor Cyan
Write-Host "  3. Faca upload do .msi no GitHub Release v$AppVersion :" -ForegroundColor Cyan
Write-Host "     https://github.com/cloudtiago/windows-monitor-resources/releases/new" -ForegroundColor Cyan
Write-Host ""
