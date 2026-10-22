#!/usr/bin/env bash
# Trabalho "video-mcmv" da fila (Casa nova (Minha Casa, Minha Vida)): montagem em Python (historia_dados.py), cena do dado no Remotion.
#   bash video/trabalhos/video-mcmv.sh <pasta-entradas> <pasta-saidas> <slug ...>
# Usa o primeiro Python que tiver edge-tts (no Windows o python3 do PATH às vezes é outro).
set -euo pipefail
for PY in python3 python py; do
  if command -v "$PY" >/dev/null && "$PY" -c "import edge_tts" 2>/dev/null; then
    exec "$PY" "$(dirname "$0")/video_mcmv.py" "$@"
  fi
done
echo "falta um Python com edge-tts: pip install edge-tts" >&2
exit 1
