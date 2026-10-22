"""Trabalho "video-postonovo" da fila: O posto novo (UBS) por território.
  python video/trabalhos/video_postonovo.py <pasta-entradas> <pasta-saidas> <slug ...>
  (pela fila: video/trabalhos/video-postonovo.sh, chamado pelo ajudar.mjs)

No padrão de massa do Mais Médicos (historia_dados.trabalho): comuns do R2 uma vez por máquina, voz com cache, a cena
do dado do lote inteiro no Remotion de uma vez (e reaproveitada pelos bairros da mesma cidade), o resto no ffmpeg.
Entradas por item (kit_fundos.py): <entradas>/<slug>/<slug>.json e <entradas>/<slug>/<cidade>.jpg.
Saída: <pasta-saidas>/<slug>/postonovo.mp4 (720x1280).
Precisa: Python 3.10+, pip install edge-tts, ffmpeg no PATH e o node_modules do video/ (Remotion).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import historia_dados as H  # noqa: E402
import postonovo as V  # noqa: E402

if __name__ == "__main__":
    sys.exit(H.trabalho(V, sys.argv[1:]))
