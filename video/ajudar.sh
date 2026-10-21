#!/bin/bash
# Ajuda a produzir os vídeos da campanha: prepara o ambiente (npm i, edge-tts, trilha) e roda o ajudar.mjs, que pega lotes
# da fila, renderiza e sobe os MP4 até a fila esvaziar. Linux, macOS e Git Bash no Windows.
#   bash video/ajudar.sh [--limite N] [--gl angle|swangle] [--quem nome]
# FILA_URL no ambiente troca a fila (padrão: o Worker publicado). Sai com 0 quando a fila está vazia.
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "PARE: instale o Node 20+ (https://nodejs.org)"; exit 1; }
PY=python; command -v python >/dev/null || PY=python3
command -v $PY >/dev/null || { echo "PARE: instale o Python 3.10+"; exit 1; }
{ [ -d node_modules/@remotion/renderer ] && [ -d node_modules/ffmpeg-static ]; } || npm i --no-audit --no-fund
$PY -c "import edge_tts" 2>/dev/null || $PY -m pip install -q edge-tts numpy
[ -f public/trilha.wav ] || $PY trilha.py
echo "Pronto. Começando a produzir: pode deixar rodando e usar o computador. Para parar: Ctrl+C."
exec node ajudar.mjs "$@"
