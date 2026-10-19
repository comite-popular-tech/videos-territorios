# Ajuda a produzir os vídeos de Saúde no Windows (PowerShell): prepara o ambiente e roda o ajudar.mjs, que pega lotes da
# fila, renderiza e sobe os MP4 até a fila esvaziar.
#   powershell -ExecutionPolicy Bypass -File video\ajudar.ps1 [--limite N] [--gl angle|swangle] [--quem nome]
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "PARE: instale o Node 20+ (https://nodejs.org)"; exit 1 }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { Write-Host "PARE: instale o Python 3.10+ (https://python.org)"; exit 1 }
if (-not (Test-Path node_modules\@remotion\renderer)) { npm i --no-audit --no-fund }
python -c "import edge_tts" 2>$null; if ($LASTEXITCODE -ne 0) { python -m pip install -q edge-tts numpy }
if (-not (Test-Path public\trilha.wav)) { python trilha.py }
node ajudar.mjs @args
exit $LASTEXITCODE
