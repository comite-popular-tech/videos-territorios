#!/bin/bash
# Ajuda a produzir os vídeos da campanha: prepara o ambiente (npm i, edge-tts, trilha) e roda o ajudar.mjs, que pega lotes
# da fila, renderiza e sobe os MP4 até a fila esvaziar. Linux, macOS e Git Bash no Windows.
#   bash video/ajudar.sh [--trabalho video-bolsa-familia] [--limite N] [--gl angle|swangle] [--quem nome]
# FILA_URL no ambiente troca a fila (padrão: o Worker publicado). Sai com 0 quando a fila está vazia.
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "PARE: instale o Node 20+ (https://nodejs.org)"; exit 1; }
PY=python; command -v python >/dev/null || PY=python3
command -v $PY >/dev/null || { echo "PARE: instale o Python 3.10+"; exit 1; }
export PYTHON=$PY  # os trabalhos que chamam Python (video-bolsa-familia --pillow) usam este
if [[ " $* " == *" video-pedemeia "* ]]; then
  # o Pé-de-Meia monta só em Python + ffmpeg (trabalhos/video_pedemeia.py): sem Remotion, sem navegador, sem npm i
  command -v ffmpeg >/dev/null || { echo "PARE: instale o ffmpeg (https://ffmpeg.org) e deixe no PATH"; exit 1; }
  $PY -c "import edge_tts, PIL" 2>/dev/null || $PY -m pip install -q edge-tts pillow
  echo "Pronto. Começando a produzir: pode deixar rodando e usar o computador. Para parar: Ctrl+C."
  exec node ajudar.mjs "$@"
fi
{ [ -d node_modules/@remotion/renderer ] && [ -d node_modules/ffmpeg-static ] && [ -d node_modules/hyperframes ]; } || npm i --no-audit --no-fund
$PY -c "import edge_tts" 2>/dev/null || $PY -m pip install -q edge-tts numpy
[ -f public/trilha.wav ] || $PY trilha.py
# o vídeo do Bolsa Família é renderizado pelo HyperFrames: precisa do Node 22+ e do navegador dele (baixado uma vez)
# (com --pillow ele é desenhado em Python, sem navegador: precisa só do Pillow e do numpy)
case " $* " in *" video-bolsa-familia "*)
  if [[ " $* " == *" --pillow "* ]]; then
    $PY -c "import PIL, numpy" 2>/dev/null || $PY -m pip install -q pillow numpy
  else
    [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || { echo "PARE: o vídeo do Bolsa Família precisa do Node 22 ou mais novo (https://nodejs.org)"; exit 1; }
    npx --no-install hyperframes browser ensure
  fi ;;
esac
echo "Pronto. Começando a produzir: pode deixar rodando e usar o computador. Para parar: Ctrl+C."
exec node ajudar.mjs "$@"
