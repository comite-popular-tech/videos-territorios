#!/usr/bin/env bash
# Trabalho "video-cida" da fila (A visita da Cida, dinheiro do SUS): montagem em Python, cena do dado no Remotion.
#   bash video/trabalhos/video-cida.sh <pasta-entradas> <pasta-saidas> <slug ...>
# Usa o primeiro Python que tiver edge-tts (no Windows o python3 do PATH às vezes é outro).
set -euo pipefail
for PY in python3 python py; do
  if command -v "$PY" >/dev/null && "$PY" -c "import edge_tts" 2>/dev/null; then
    exec "$PY" "$(dirname "$0")/video_cida.py" "$@"
  fi
done
echo "falta um Python com edge-tts: pip install edge-tts" >&2
exit 1
