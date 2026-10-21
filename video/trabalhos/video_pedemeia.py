"""Trabalho "video-pedemeia" da fila: "Escola ou bico" (Pé-de-Meia) por território, só com Python e ffmpeg.
  python video/trabalhos/video_pedemeia.py <pasta-entradas> <pasta-saidas> <slug ...> [--proc N]
  (pela fila: video/trabalhos/video-pedemeia.sh, chamado pelo ajudar.mjs)

Montagem, não render. As cenas que não mudam já estão prontas (pedemeia_pecas.py, baixadas do R2 uma vez por máquina).
Por território só se faz:
  - a voz das três falas que mudam (edge-tts, cache por texto: fala igual sai uma vez por máquina);
  - a legenda das cenas 1 e 2 queimada sobre a peça pronta (ffmpeg);
  - a cena 4, dado da cidade, desenhada em Pillow (pedemeia_cena4.py, ~4 s);
  - a mistura do áudio e a colagem das seis peças sem recodificar (-c copy).
Cena 2 com a mesma fala (todo território sem nome de escola) e cena 4 da mesma cidade (os bairros de uma capital) saem
uma vez e vão para o cache da máquina. Cena com tempo fixo e fala que se ajusta (acelera até 1,3x ou encurta).

Entradas por item (kit_fundos.py): <entradas>/<slug>/<slug>.json e <entradas>/<slug>/<cidade>.jpg.
Saída: <pasta-saidas>/<slug>/pedemeia.mp4 (720x1280, ~42 s).
Precisa: Python 3.10+, pip install edge-tts pillow, ffmpeg no PATH.
"""
import hashlib
import json
import os
import shutil
import sys
import time
import urllib.request
from pathlib import Path

VIDEO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VIDEO))
import pedemeia_cena4  # noqa: E402
import pedemeia_comum as C  # noqa: E402

FILA = os.environ.get("FILA_URL", "https://fila-videos.boralula.workers.dev").rstrip("/")
KIT = VIDEO / "kit" / "video-pedemeia"
COMUM, VOZES, TMP, CACHE = KIT / "comum", KIT / "vozes", KIT / "render", KIT / "cache"
PECAS = ["pecas/peca1.mp4", "pecas/peca2.mp4", "pecas/peca3.mp4", "pecas/peca5.mp4", "pecas/peca6.mp4", "pecas/duracoes.json"]
VARIAVEIS = [0, 1, 3]


def comuns() -> None:
    """Clipes, música e peças prontas: da pasta do Gui quando existem, senão do R2 da fila (uma vez por máquina)."""
    for nome in ["clip1.mp4", "clip2.mp4", "clip3.mp4", "musica.mp3", *PECAS]:
        destino = COMUM / nome
        if destino.exists():
            continue
        destino.parent.mkdir(parents=True, exist_ok=True)
        local = VIDEO / "public" / "pedemeia" / nome
        if local.exists():
            shutil.copy2(local, destino)
            continue
        # User-Agent próprio: o Cloudflare do Worker responde 403 ao "Python-urllib" padrão
        pedido = urllib.request.Request(f"{FILA}/entradas/comum/video-pedemeia/{nome}", headers={"User-Agent": "videos-territorios/1.0 (video_pedemeia.py)"})
        with urllib.request.urlopen(pedido, timeout=120) as r:
            destino.write_bytes(r.read())


def chave(*partes) -> str:
    return hashlib.sha1(json.dumps(partes, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]


def montar(it: dict, dur: list, total: float, proc: int) -> None:
    tmp = lambda n: TMP / f"{it['slug']}-{n}"
    pecas = []
    for i in range(6):
        if i in C.FIXAS:
            pecas.append(COMUM / f"pecas/peca{i + 1}.mp4")
            continue
        ass_txt = C.ass(it["leg"][i], extra=it["extra"][i])
        if i == 0:   # quarto: a fala tem a cidade (e o bairro), é só deste território
            ass_arq = tmp("1.ass")
            ass_arq.write_text(ass_txt, encoding="utf-8")
            C.ffmpeg("-i", COMUM / "pecas/peca1.mp4", "-vf", C.filtro_ass(ass_arq), *C.ENC, tmp("p1.mp4"))
            pecas.append(tmp("p1.mp4"))
            continue
        # portão (fala sem a cidade) e dado da cidade: iguais entre territórios que têm o mesmo texto e o mesmo dado
        k = chave(i, it["texto"][i], it["extra"][i], it["dado"] if i == 3 else None, it["fundo"].name if i == 3 else None, dur[i])
        pronto = CACHE / f"cena{i + 1}-{k}.mp4"
        if not pronto.exists():
            ass_arq = tmp(f"{i + 1}.ass")
            ass_arq.write_text(ass_txt, encoding="utf-8")
            parcial = tmp(f"p{i + 1}.mp4")
            if i == 1:
                C.ffmpeg("-i", COMUM / "pecas/peca2.mp4", "-vf", C.filtro_ass(ass_arq), *C.ENC, parcial)
            else:
                pedemeia_cena4.desenhar(it["fundo"], it["dado"], dur[3], parcial, ass_arq, proc)
            os.replace(parcial, pronto)
        pecas.append(pronto)
    # cola as seis peças sem recodificar
    lista = tmp("lista.txt")
    lista.write_text("\n".join(f"file '{str(p).replace(chr(92), '/')}'" for p in pecas), encoding="utf-8")
    C.ffmpeg("-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", tmp("video.mp4"))
    # áudio: vozes no começo de cada cena (aceleradas 1,25x e, se preciso, um pouco mais), som ambiente dos três clipes e a música
    entradas, filtros, mix = [], [], []

    def add(arq):
        entradas.extend(["-i", str(arq)])
        return len(entradas) // 2 - 1

    for i in range(6):
        n = add(C.voz_arquivo(VOZES, it["texto"][i]))
        atraso = round((C.inicio_final(dur, i) + C.ATRASO / C.FPS / C.VEL) * 1000)
        filtros.append(f"[{n}:a]atempo={C.VEL * it['extra'][i]:.4f},adelay={atraso}|{atraso}[v{i}]")
        mix.append(f"[v{i}]")
    for i in range(3):
        n = add(COMUM / f"clip{i + 1}.mp4")
        vel, seg = min(1, C.CLIPES[i] / dur[i]), dur[i] / C.FPS / C.VEL
        atraso = round(C.inicio_final(dur, i) * 1000)
        filtros.append(f"[{n}:a]atempo={C.VEL * vel:.4f},atrim=0:{seg:.3f},afade=t=in:d=0.5,afade=t=out:st={seg - 0.6:.3f}:d=0.6,"
                       f"volume={C.AMBIENTE},adelay={atraso}|{atraso}[a{i}]")
        mix.append(f"[a{i}]")
    m = add(COMUM / "musica.mp3")
    filtros.append(f"[{m}:a]atrim=0:{total:.2f},afade=t=in:d=2,afade=t=out:st={total - 4:.2f}:d=4,volume={C.MUSICA}[mu]")
    mix.append("[mu]")
    filtros.append(f"{''.join(mix)}amix=inputs={len(mix)}:duration=longest:normalize=0,atrim=0:{total:.3f}[a]")
    C.ffmpeg(*entradas, "-filter_complex", ";".join(filtros), "-map", "[a]", "-c:a", "aac", "-b:a", "160k", tmp("audio.m4a"))
    fin = it["saida"]
    fin.parent.mkdir(parents=True, exist_ok=True)
    C.ffmpeg("-i", tmp("video.mp4"), "-i", tmp("audio.m4a"), "-c", "copy", "-shortest", "-movflags", "+faststart", fin)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    a = sys.argv[1:]
    proc = int(a[a.index("--proc") + 1]) if "--proc" in a else min(8, os.cpu_count() or 4)
    # o ajudar.mjs passa as opções dele depois dos slugs (--gl swangle --conc 4): valor de opção não é slug
    pos = [x for k, x in enumerate(a) if not x.startswith("--") and (k == 0 or not a[k - 1].startswith("--"))]
    if len(pos) < 3:
        print("uso: video_pedemeia.py <entradas> <saidas> <slug ...>", file=sys.stderr)
        return 1
    ent, sai, slugs = Path(pos[0]), Path(pos[1]), pos[2:]
    for d in (COMUM, VOZES, TMP, CACHE):
        d.mkdir(parents=True, exist_ok=True)
    comuns()
    dur = json.loads((COMUM / "pecas/duracoes.json").read_text(encoding="utf-8"))["dur"]
    total = sum(dur) / C.FPS / C.VEL
    pdm = json.loads((VIDEO / "pedemeia.json").read_text(encoding="utf-8"))
    escolas = json.loads((VIDEO / "pedemeia_escolas.json").read_text(encoding="utf-8"))

    itens = []
    for slug in slugs:
        try:
            d = json.loads((ent / slug / f"{slug}.json").read_text(encoding="utf-8"))
            fundo = ent / slug / f"{slug.split('--')[0]}.jpg"
            if not fundo.exists():
                raise FileNotFoundError("sem o fundo")
            itens.append({"slug": slug, "fundo": fundo, "saida": sai / slug / "pedemeia.mp4", **C.roteiro(d["pedidos"], slug, pdm, escolas)})
        except Exception as e:  # noqa: BLE001
            print(f"  {slug}: entradas incompletas ({e})")
    if not itens:
        return 1
    # todas as versões de uma vez (são poucas e o cache guarda): a escolha da que cabe vem depois
    C.gerar_vozes(VOZES, [*C.FIXAS.values(), *(t for it in itens for i in VARIAVEIS for t in it["falas"][i])])
    ok = 0
    for it in itens:
        t0 = time.time()
        try:
            C.encaixa(it, VOZES)
            for i in VARIAVEIS:
                if it["texto"][i] != it["falas"][i][0]:
                    print(f"  {it['slug']}: fala {i + 1} encurtada ({it['texto'][i]})")
            montar(it, dur, total, proc)
            ok += 1
            print(f"  {it['slug']}: {total:.1f} s, montagem {time.time() - t0:.0f} s")
        except Exception as e:  # noqa: BLE001
            print(f"  {it['slug']}: falhou ({e})")
        finally:
            for f in TMP.glob(f"{it['slug']}-*"):
                f.unlink(missing_ok=True)
    return 0 if ok == len(slugs) else 1


if __name__ == "__main__":
    sys.exit(main())
