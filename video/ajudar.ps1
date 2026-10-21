# Ajuda a produzir os vídeos da campanha no Windows (PowerShell): prepara o ambiente e roda o ajudar.mjs, que pega lotes
# da fila, renderiza e sobe os vídeos até a fila esvaziar. Quem prefere clicar usa o AJUDAR-windows.bat, que chama este.
#   powershell -ExecutionPolicy Bypass -File video\ajudar.ps1 [--trabalho video-bolsa-familia] [--limite N] [--conc 2] [--quem nome]
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
if (-not (Test-Path node_modules\@remotion\renderer) -or -not (Test-Path node_modules\ffmpeg-static) -or -not (Test-Path node_modules\hyperframes)) { npm i --no-audit --no-fund }
& $PY -c "import edge_tts" 2>$null; if ($LASTEXITCODE -ne 0) { & $PY -m pip install -q edge-tts numpy }
if (-not (Test-Path public\trilha.wav)) { & $PY trilha.py }
$env:PYTHON = $PY  # os trabalhos que chamam Python (video-bolsa-familia --pillow) usam este
# o video do Bolsa Familia e renderizado pelo HyperFrames: precisa do Node 22+ e do navegador dele (baixado uma vez)
# (com --pillow ele e desenhado em Python, sem navegador: precisa so do Pillow e do numpy)
if ($args -contains "video-bolsa-familia") {
  if ($args -contains "--pillow") {
    & $PY -c "import PIL, numpy" 2>$null; if ($LASTEXITCODE -ne 0) { & $PY -m pip install -q pillow numpy }
  } else {
    $nodeMaior = [int](node -p "process.versions.node.split('.')[0]")
    if ($nodeMaior -lt 22) { Write-Host "PARE: o video do Bolsa Familia precisa do Node 22 ou mais novo. Instale a versao LTS em https://nodejs.org, feche esta janela e abra de novo."; exit 1 }
    npx --no-install hyperframes browser ensure
  }
}
Write-Host "Pronto. Comecando a produzir: pode deixar rodando e usar o computador. Para parar: Ctrl+C ou feche a janela."
node ajudar.mjs @args
exit $LASTEXITCODE
