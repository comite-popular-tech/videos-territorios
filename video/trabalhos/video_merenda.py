"""Trabalho "video-merenda" da fila: "A merenda da Júlia" (merenda escolar) por território.
  python video/trabalhos/video_merenda.py <pasta-entradas> <pasta-saidas> <slug ...>
  (pela fila: video/trabalhos/video-merenda.sh, chamado pelo ajudar.mjs)

Cópia do video_maismedicos.py (montagem, não render). As cenas que não mudam já estão prontas (merenda.py pecas,
baixadas do R2 uma vez por máquina). Por território só se faz:
  - a voz das falas 1 e 4 e da abertura (edge-tts, cache por texto: fala igual sai uma vez por máquina);
  - a legenda da cena 1 queimada sobre a peça pronta (ffmpeg);
  - a cena 4, média por ano de Bolsonaro contra a de Lula, no Remotion (src/InfoMerenda.tsx, composição "Merenda"): as do
    lote inteiro de uma vez, com um bundle e um navegador só (merenda_render.mjs), e a mesma cena serve aos bairros da
    mesma cidade (cache da máquina);
  - a mistura do áudio e a colagem das peças sem recodificar (-c copy).
Todo município recebe o vídeo: quem não passa no corte fala o estado ou o Brasil (merenda.json).

Entradas por item (kit_fundos.py): <entradas>/<slug>/<slug>.json e <entradas>/<slug>/<cidade>.jpg (foto ou satélite).
Saída: <pasta-saidas>/<slug>/merenda.mp4 (720x1280, ~48 s).
Precisa: Python 3.10+, pip install edge-tts, ffmpeg no PATH e o node_modules do video/ (Remotion).
"""
import json
import os
import shutil
import sys
import time
import urllib.request
from pathlib import Path

VIDEO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VIDEO))
import merenda as M  # noqa: E402
import merenda_comum as C  # noqa: E402

FILA = os.environ.get("FILA_URL", "https://fila-videos.boralula.workers.dev").rstrip("/")
COMUM = M.KIT / "comum"
PECAS = ["pecas/peca1.mp4", "pecas/peca2.mp4", "pecas/peca3.mp4", "pecas/peca5.mp4", "pecas/peca6.mp4", "pecas/duracoes.json"]


def comuns() -> None:
    """Clipes, música e peças prontas: da pasta do Gui quando existem, senão do R2 da fila (uma vez por máquina)."""
    for nome in ["clip1.mp4", "clip2.mp4", "clip3.mp4", "musica.mp3", *PECAS]:
        destino = COMUM / nome
        if destino.exists():
            continue
        destino.parent.mkdir(parents=True, exist_ok=True)
        local = C.PUB / nome
        if local.exists():
            shutil.copy2(local, destino)
            continue
        # User-Agent próprio: o Cloudflare do Worker responde 403 ao "Python-urllib" padrão
        pedido = urllib.request.Request(f"{FILA}/entradas/comum/video-merenda/{nome}", headers={"User-Agent": "videos-territorios/1.0 (video_merenda.py)"})
        with urllib.request.urlopen(pedido, timeout=120) as r:
            destino.write_bytes(r.read())


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    a = sys.argv[1:]
    # o ajudar.mjs passa as opções dele depois dos slugs (--gl swangle --conc 4): valor de opção não é slug
    pos = [x for k, x in enumerate(a) if not x.startswith("--") and (k == 0 or not a[k - 1].startswith("--"))]
    if len(pos) < 3:
        print("uso: video_merenda.py <entradas> <saidas> <slug ...>", file=sys.stderr)
        return 1
    ent, sai, slugs = Path(pos[0]).resolve(), Path(pos[1]), pos[2:]
    for op in ("--gl", "--conc"):
        if op in a:
            M.OPCOES_RENDER += [op, a[a.index(op) + 1]]
    for d in (COMUM, M.VOZES, M.TMP, M.CACHE):
        d.mkdir(parents=True, exist_ok=True)
    comuns()
    durs = json.loads((COMUM / "pecas/duracoes.json").read_text(encoding="utf-8"))
    md = C.carregar()

    itens = []
    for slug in slugs:
        try:
            d = json.loads((ent / slug / f"{slug}.json").read_text(encoding="utf-8"))
            foto = ent / slug / f"{slug.split('--')[0]}.jpg"
            if not foto.exists():
                raise FileNotFoundError("sem o fundo")
            r = C.roteiro(d["pedidos"], md)
            credito = d.get("credito") if d.get("fundo") == "satelite" else None  # satélite: crédito na tela (kit_fundos.py)
            itens.append({"slug": slug, "foto": foto, "saida": sai / slug / "merenda.mp4", "credito": credito, **r})
        except Exception as e:  # noqa: BLE001
            print(f"  {slug}: entradas incompletas ({e})")
    if not itens:
        return 1
    C.gerar_vozes(M.VOZES, [*C.FIXAS.values(), *(t for it in itens for v in it["falas"].values() for t in v),
                            *(it["abertura"] for it in itens)])
    for it in itens:
        C.encaixa(it, M.VOZES)
        for i in it["falas"]:
            if it["texto"][i] != it["falas"][i][0]:
                print(f"  {it['slug']}: fala {i + 1} encurtada ({it['texto'][i]})")
    M.cenas_dado(itens, ent, durs["dur"][3])
    ok = 0
    for it in itens:
        t0 = time.time()
        try:
            if not it["p4"].exists():
                raise RuntimeError("a cena do dado não saiu do Remotion")
            M.montar_um(it, durs, COMUM)
            ok += 1
            print(f"  {it['slug']}: montagem {time.time() - t0:.0f} s")
        except Exception as e:  # noqa: BLE001
            print(f"  {it['slug']}: falhou ({e})")
        finally:
            for f in M.TMP.glob(f"{it['slug']}-*"):
                f.unlink(missing_ok=True)
    return 0 if ok == len(slugs) else 1


if __name__ == "__main__":
    sys.exit(main())
