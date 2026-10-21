#!/usr/bin/env bash
# Trabalho "video-pedemeia" da fila (Escola ou bico, Pé-de-Meia): chama a montagem em Python (sem Node nem Chrome).
#   bash video/trabalhos/video-pedemeia.sh <pasta-entradas> <pasta-saidas> <slug ...>
# Usa o primeiro Python que tiver edge-tts e Pillow (no Windows o python3 do PATH às vezes é outro).
set -euo pipefail
for PY in python3 python py; do
  if command -v "$PY" >/dev/null && "$PY" -c "import edge_tts, PIL" 2>/dev/null; then
    exec "$PY" "$(dirname "$0")/video_pedemeia.py" "$@"
  fi
done
echo "falta um Python com edge-tts e Pillow: pip install edge-tts pillow" >&2
exit 1
