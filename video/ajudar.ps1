# Ajuda a produzir os vídeos da campanha no Windows (PowerShell): prepara o ambiente e roda o ajudar.mjs, que pega lotes
# da fila, renderiza e sobe os vídeos até a fila esvaziar. Quem prefere clicar usa o AJUDAR-windows.bat, que chama este.
#   powershell -ExecutionPolicy Bypass -File video\ajudar.ps1 [--limite N] [--conc 2] [--quem nome]
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "PARE: falta o Node.js. Instale a versao LTS em https://nodejs.org, feche esta janela e abra de novo."; exit 1
}
# "python" do Windows pode ser só o atalho da Microsoft Store, que não roda nada: testa de verdade, e tenta o "py"
$PY = $null
foreach ($c in @("python", "py")) {
  if (Get-Command $c -ErrorAction SilentlyContinue) { & $c --version *> $null; if ($LASTEXITCODE -eq 0) { $PY = $c; break } }
}
if (-not $PY) {
  Write-Host "PARE: falta o Python. Instale em https://python.org (marque 'Add python.exe to PATH'), feche esta janela e abra de novo."; exit 1
}
Write-Host "Preparando (so demora na primeira vez)..."
if (-not (Test-Path node_modules\@remotion\renderer) -or -not (Test-Path node_modules\ffmpeg-static)) { npm i --no-audit --no-fund }
& $PY -c "import edge_tts" 2>$null; if ($LASTEXITCODE -ne 0) { & $PY -m pip install -q edge-tts numpy }
if (-not (Test-Path public\trilha.wav)) { & $PY trilha.py }
Write-Host "Pronto. Comecando a produzir: pode deixar rodando e usar o computador. Para parar: Ctrl+C ou feche a janela."
node ajudar.mjs @args
exit $LASTEXITCODE
