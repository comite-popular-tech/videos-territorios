"""Prévia do vídeo na tela do território (cards.boralula.org): um quadro do mp4 cortado em 4:5 no centro, 360 × 450,
WEBP qualidade 72, como o scripts/acervo.py fazia baixando o começo de cada vídeo do R2 (videos_prontos; ~6 s cada, quase
1 h por tipo no PC do Gui). O trabalho da fila grava previa.webp ao lado do mp4 e o ajudar.mjs sobe os dois para
<prefixo>/<slug>/ no R2, que é onde a página procura; o acervo.py pula quem já tem a prévia lá.

  from previa_video import previa; previa(mp4, fim_abertura)   # trabalhos em Python
  python video/previa_video.py <mp4> <fim da abertura em s>     # trabalhos em Node (video-insulina.mjs)

O quadro é o de 0,25 s antes do fim da abertura padrão (abertura.py e as cópias dos outros vídeos): o cartão inteiro,
com ATENÇÃO, MORADOR DO <BAIRRO>, a etiqueta "Cidade - UF", o selo e o ENTENDA POR QUÊ. Um tempo fixo não serve: o
selo entra quando a voz diz o nome do programa, e com nome comprido (São Salvador do Tocantins) a 3,0 s ainda não entrou.

Não importa nada do video/ (o INSS parou em produção quando o maismedicos.py mudou): só o ffmpeg (o do FFMPEG no ambiente,
que a insulina passa quando usa o ffmpeg-static, ou o do PATH), com libwebp, ou o Pillow quando o ffmpeg não tem. Nunca derruba o vídeo: sem prévia, o acervo.py faz como antes. E prévia com menos de
1.000 bytes não fica, porque o Worker da fila recusaria o item inteiro (TAM_MIN do video/fila/worker.js).
"""
import io
import os
import shutil
import subprocess
import sys
from pathlib import Path

FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or "ffmpeg"
LARG, ALT, QUALIDADE = 360, 450, 72
ANTES_DO_FIM = 0.25     # s antes do corte para a história: o ENTENDA POR QUÊ já terminou de entrar (anima 0,16 s)
SEM_ABERTURA = 3.0      # vídeo sem a abertura (não acontece na fila)
TAM_MIN = 1000


def previa(mp4, fim_abertura: float | None) -> Path | None:
    """Grava previa.webp na pasta do mp4; devolve o caminho, ou None se não deu (o motivo vai para a saída)."""
    mp4 = Path(mp4)
    destino = mp4.with_name("previa.webp")
    t = max(0.0, fim_abertura - ANTES_DO_FIM) if fim_abertura else SEM_ABERTURA
    # o mesmo corte do acervo.py: altura = largura × 5/4, no meio (720 × 1280 -> 720 × 900, de y = 190)
    base = [FFMPEG, "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", str(mp4), "-frames:v", "1",
            "-vf", f"crop=iw:iw*5/4,scale={LARG}:{ALT}:flags=lanczos"]
    try:
        r = subprocess.run([*base, "-c:v", "libwebp", "-quality", str(QUALIDADE), str(destino)], capture_output=True, timeout=60)
        if r.returncode or not destino.exists():
            # ffmpeg sem libwebp: o mesmo quadro em PNG, e o Pillow faz o WEBP
            from PIL import Image
            r = subprocess.run([*base, "-f", "image2pipe", "-c:v", "png", "-"], capture_output=True, timeout=60)
            if r.returncode or not r.stdout:
                raise RuntimeError(r.stderr.decode(errors="replace").strip()[-200:] or f"ffmpeg saiu com {r.returncode}")
            Image.open(io.BytesIO(r.stdout)).save(destino, "WEBP", quality=QUALIDADE)
        if destino.stat().st_size < TAM_MIN:
            raise RuntimeError(f"pequena demais ({destino.stat().st_size} bytes)")
        return destino
    except Exception as e:  # noqa: BLE001
        destino.unlink(missing_ok=True)
        print(f"  {mp4.parent.name}: sem a prévia ({e})")
        return None


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("uso: previa_video.py <mp4> <fim da abertura em s>", file=sys.stderr)
        sys.exit(1)
    sys.exit(0 if previa(sys.argv[1], float(sys.argv[2])) else 1)
