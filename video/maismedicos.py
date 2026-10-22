"""Vídeo "A doutora do posto" (Mais Médicos, roteiro 7 de video/roteiros-narracao.md): peças prontas e montagem.

  python video/maismedicos.py pecas                 # peças que não mudam (clipes do Flow, corte, compartilhe)
  python video/maismedicos.py montar <slug ...>     # um vídeo por território, em E:/30000-cards/maismedicos-exemplos/

Montagem, não render, no molde do Pé-de-Meia (pedemeia_pecas.py e trabalhos/video_pedemeia.py): as cenas fixas saem uma
vez em 720x1280, já no tempo final (1,25x), e por território só se faz a voz das falas 1 e 4, a legenda da cena 1, a
cena do dado e a mistura. Os infográficos são do Remotion, como na insulina (src/InfoMaisMedicos.tsx e o fecho do
InfoFarmacia.tsx, renderizados por maismedicos_render.mjs com um bundle só para todas as cenas); os clipes passam só
pelo ffmpeg.

Entradas em video/public/mais-medicos/: clip1-3.mp4 (Flow), musica.mp3 e a foto de cada cidade (<uf>-<cidade>.jpg, a
mesma do kit da fila em entradas/fundos/). Dados: video/maismedicos.json (maismedicos_dados.py).
"""
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import maismedicos_comum as C  # noqa: E402
from pedemeia_comum import _tempo  # noqa: E402

KIT = C.VIDEO / "kit" / "video-maismedicos"
VOZES, TMP, CACHE = KIT / "vozes", KIT / "render", KIT / "cache"
PECAS = C.PUB / "pecas"
SAIDA = Path(os.environ.get("MAISMEDICOS_SAIDA", "E:/30000-cards/maismedicos-exemplos"))
FADE = 5   # frames de render do escurecimento entre as cenas dos clipes
OPCOES_RENDER = []   # repassadas ao maismedicos_render.mjs (--gl swangle --conc 4 no Actions)


def remotion(cenas: list, raiz: Path = C.PUB) -> None:
    """Renderiza as cenas de infográfico ({"saida", "dur", "info"}) no Remotion, todas com o mesmo bundle; "@/<arquivo>"
    no fundo é um arquivo da pasta raiz."""
    lista = TMP / "cenas.json"
    lista.write_text(json.dumps({"raiz": str(raiz), "cenas": [{**c, "saida": str(c["saida"])} for c in cenas]}, ensure_ascii=False),
                     encoding="utf-8")
    r = subprocess.run(["node", str(C.VIDEO / "maismedicos_render.mjs"), str(lista), *OPCOES_RENDER], cwd=C.VIDEO, text=True, encoding="utf-8",
                       errors="replace")
    falta = [c["saida"].name for c in cenas if not Path(c["saida"]).exists()]
    if r.returncode != 0 and falta:
        raise RuntimeError(f"Remotion falhou em {', '.join(falta)}")


def acelera(bruto: Path, dur: int, saida: Path, ass_txt: str = None, filtros_antes=()) -> None:
    """Corta a cena em dur frames de render, acelera 1,25x e queima a legenda (se houver), com os parâmetros de todas."""
    filtros = [*filtros_antes, f"trim=end_frame={dur}", "setpts=PTS-STARTPTS", f"setpts=PTS/{C.VEL}", f"fps={C.FPS}"]
    if ass_txt:
        ass_arq = saida.with_suffix(".ass")
        ass_arq.write_text(ass_txt, encoding="utf-8")
        filtros.append(C.filtro_ass(ass_arq))
    C.ffmpeg("-i", bruto, "-vf", ",".join(filtros), *C.ENC, saida)


def peca_clipe(i: int, dur: int, saida: Path, ass_txt: str = None) -> None:
    """Clipe i do Flow em dur frames de render: desacelera se a cena for mais longa que o clipe, escurece nas pontas
    (a primeira cena não entra escurecendo: o primeiro quadro é a prévia no WhatsApp)."""
    lento = max(1.0, dur / C.CLIPES[i])
    pre = [f"scale={C.LARG}:{C.ALT}:force_original_aspect_ratio=increase", f"crop={C.LARG}:{C.ALT}", f"setpts=PTS*{lento:.4f}",
           f"fps={C.FPS}", f"trim=end_frame={dur}", "setpts=PTS-STARTPTS"]
    if i > 0:
        pre.append(f"fade=t=in:s=0:n={FADE}")
    pre.append(f"fade=t=out:s={dur - FADE}:n={FADE}")
    acelera(C.PUB / f"clip{i + 1}.mp4", dur, saida, ass_txt, pre)


def quadro_final(i: int, dur: int, saida: Path) -> None:
    """O último quadro que aparece do clipe i (antes de escurecer): fundo do corte (clipe 2) e do compartilhe (clipe 3)."""
    t = (dur - FADE - 1) / C.FPS / max(1.0, dur / C.CLIPES[i])
    C.ffmpeg("-ss", f"{min(t, C.CLIPES[i] / C.FPS - 0.05):.3f}", "-i", C.PUB / f"clip{i + 1}.mp4", "-frames:v", "1",
             "-vf", f"scale={C.LARG}:{C.ALT}:force_original_aspect_ratio=increase,crop={C.LARG}:{C.ALT}", "-q:v", "2", saida)


def info_corte(texto: str, so_corte: bool) -> dict:
    leg = C.legenda_de(texto, VOZES)
    quadro = lambda p: round(C.tempo_palavra(leg, p) * C.FPS)
    return {"tipo": "mm_corte", "soCorte": so_corte, "dobrou": quadro("dobrou"), "flavio": quadro("Flávio"), "ameaca": quadro("ameaçad"),
            "fundo": "@/consultorio.jpg", "fonte": C.FONTE_CORTE}


def info_dado(it: dict, fundo: str) -> dict:
    """A cena do dado, com os frames em que a fala diz o número de antes e o "Hoje" (o cartão sobe pouco antes)."""
    leg, ex, d = it["leg"][3], it["extra"][3], it["dado"]
    quadro = lambda p: round(C.tempo_palavra(leg, p, extra=ex) * C.FPS)
    return {"tipo": "mm_dado", "local": d["rotulo"], "antes": d["antes"], "agora": d["agora"],
            "tAntes": quadro("nenhum" if d["antes"] == 0 else C.falado(d["antes"]).split()[0]), "tHoje": quadro("Hoje"),
            "fundo": f"@/{fundo}", "fonte": C.FONTE_DADO + (f" · {it['credito']}" if it.get("credito") else "")}  # satélite: crédito na tela


def chave(*partes) -> str:
    return hashlib.sha1(json.dumps(partes, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]


def cenas_dado(itens: list, raiz: Path, dur: int) -> None:
    """Cena do dado de cada item (it["p4"]), com a legenda: os territórios de mesma fala e mesma foto (os bairros de uma
    cidade) dividem a cena, que fica no cache da máquina; as que faltam saem do Remotion de uma vez, com um bundle só."""
    CACHE.mkdir(parents=True, exist_ok=True)
    faltam = {}
    for it in itens:
        fundo = it["foto"].relative_to(raiz).as_posix()
        # o crédito separa o mapa antigo do satélite que ficou no lugar dele (o arquivo tem o mesmo nome)
        it["p4"] = CACHE / f"dado-{chave(it['texto'][3], it['extra'][3], it['dado'], it['foto'].name, it.get('credito'), dur)}.mp4"
        if not it["p4"].exists() and it["p4"] not in faltam:
            faltam[it["p4"]] = (it, fundo)
    if not faltam:
        return
    t0 = time.time()
    brutos = {p4: TMP / f"{p4.stem}-bruto.mp4" for p4 in faltam}
    remotion([{"saida": brutos[p4], "dur": dur, "info": info_dado(it, fundo)} for p4, (it, fundo) in faltam.items()], raiz)
    for p4, (it, _f) in faltam.items():
        if brutos[p4].exists():
            parcial = TMP / f"{p4.stem}-p4.mp4"
            acelera(brutos[p4], dur, parcial, C.ass(it["leg"][3], extra=it["extra"][3]))
            os.replace(parcial, p4)
            brutos[p4].unlink()
    print(f"  cena do dado: {len(faltam)} no Remotion em {time.time() - t0:.0f} s ({len(itens) - len(faltam)} do cache)")


def pecas() -> int:
    PECAS.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    C.gerar_vozes(VOZES, [*C.FIXAS.values(), C.CORTE_BRASIL])
    dur, dur_br = C.duracoes(VOZES), C.duracoes(VOZES, C.CORTE_BRASIL)
    (PECAS / "duracoes.json").write_text(json.dumps({"dur": dur, "dur_brasil": dur_br, "vel": C.VEL, "fps": C.FPS}), encoding="utf-8")
    print("durações (frames de render):", *dur, f"= {sum(dur) / C.FPS / C.VEL:.1f} s no final; Goiás: {sum(dur_br) / C.FPS / C.VEL:.1f} s")
    quadro_final(1, dur[1], C.PUB / "consultorio.jpg")
    quadro_final(2, dur[2], C.PUB / "corredor.jpg")
    leg = lambda i: C.ass(C.legenda_de(C.FIXAS[i], VOZES))
    for i in range(3):
        t0 = time.time()
        peca_clipe(i, dur[i], PECAS / f"peca{i + 1}.mp4", leg(i) if i in C.FIXAS else None)
        print(f"peça {i + 1}: {dur[i]} frames, {time.time() - t0:.0f} s")
    infos = [("peca5", C.FIXAS[4], dur[4], info_corte(C.FIXAS[4], False)),
             ("peca5-brasil", C.CORTE_BRASIL, dur_br[4], info_corte(C.CORTE_BRASIL, True)),
             ("peca6", C.FIXAS[5], dur[5], {"tipo": "fecho", "fundo": "@/corredor.jpg", "frase": "Mais Médicos: médico no posto de saúde"})]
    t0 = time.time()
    remotion([{"saida": TMP / f"{n}-bruto.mp4", "dur": d, "info": info} for n, _t, d, info in infos])
    for nome, texto, d, _info in infos:
        bruto = TMP / f"{nome}-bruto.mp4"
        acelera(bruto, d, PECAS / f"{nome}.mp4", C.ass(C.legenda_de(texto, VOZES)))
        bruto.unlink()
    print(f"peças 5 e 6 (Remotion): {time.time() - t0:.0f} s")
    for f in PECAS.glob("*.ass"):
        f.unlink()
    return 0


# ---------------------------------------------------------------- abertura padrão (video/abertura.py; aprovada em 21/10)
from abertura import etiqueta  # noqa: E402,F401  (historia_dados.py importa daqui)
import abertura as _ab  # noqa: E402


def abertura(it: dict, saida: Path, pecas_dir: Path) -> float:
    return _ab.abertura(it, saida, pecas_dir / "peca1.mp4", VOZES, "O MAIS MÉDICOS ESTÁ AMEAÇADO", "mais")


def montar_um(it: dict, durs: dict, comum: Path = C.PUB) -> None:
    """Um vídeo: as peças prontas de comum/pecas/, a cena 1 com a legenda do território, a cena do dado (it["p4"]) e a
    mistura do áudio (vozes, som dos clipes de comum/ e a música)."""
    pecas_dir = comum / "pecas"
    dur = durs["dur_brasil"] if it["dado"]["alcance"] == "brasil" else durs["dur"]
    total = sum(dur) / C.FPS / C.VEL
    tmp = lambda n: TMP / f"{it['slug']}-{n}"
    # cena 1: a peça pronta com a legenda deste território
    ass1 = tmp("1.ass")
    ass1.write_text(C.ass(it["leg"][0], extra=it["extra"][0]), encoding="utf-8")
    C.ffmpeg("-i", pecas_dir / "peca1.mp4", "-vf", C.filtro_ass(ass1), *C.ENC, tmp("p1.mp4"))
    d = it["dado"]
    ab = abertura(it, tmp("p0.mp4"), pecas_dir) if it.get("com_abertura", True) else 0.0
    total += ab
    pecas_ = ([tmp("p0.mp4")] if ab else []) + [tmp("p1.mp4"), pecas_dir / "peca2.mp4", pecas_dir / "peca3.mp4", it["p4"],
              pecas_dir / ("peca5-brasil.mp4" if d["alcance"] == "brasil" else "peca5.mp4"), pecas_dir / "peca6.mp4"]
    lista = tmp("lista.txt")
    lista.write_text("\n".join(f"file '{str(p).replace(chr(92), '/')}'" for p in pecas_), encoding="utf-8")
    C.ffmpeg("-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", tmp("video.mp4"))
    # áudio: vozes no começo de cada cena, som ambiente dos três clipes e a música
    entradas, filtros, mix = [], [], []

    def add(arq):
        entradas.extend(["-i", str(arq)])
        return len(entradas) // 2 - 1

    for i in range(6):
        n = add(C.voz_arquivo(VOZES, it["texto"][i]))
        atraso = round((ab + C.inicio_final(dur, i) + C.ATRASO / C.FPS / C.VEL) * 1000)
        filtros.append(f"[{n}:a]atempo={C.VEL * it['extra'][i]:.4f},adelay={atraso}|{atraso}[v{i}]")
        mix.append(f"[v{i}]")
    if ab:
        n = add(C.voz_arquivo(VOZES, it["abertura"]))
        filtros.append(f"[{n}:a]atempo={C.VEL:.4f},adelay=150|150[vab]")
        mix.append("[vab]")
    for i in range(3):
        n = add(comum / f"clip{i + 1}.mp4")
        vel, seg = min(1, C.CLIPES[i] / dur[i]), dur[i] / C.FPS / C.VEL
        atraso = round((ab + C.inicio_final(dur, i)) * 1000)
        filtros.append(f"[{n}:a]atempo={C.VEL * vel:.4f},atrim=0:{seg:.3f},afade=t=in:d=0.5,afade=t=out:st={seg - 0.6:.3f}:d=0.6,"
                       f"volume={C.AMBIENTE},adelay={atraso}|{atraso}[a{i}]")
        mix.append(f"[a{i}]")
    m = add(comum / "musica.mp3")
    filtros.append(f"[{m}:a]apad,atrim=0:{total:.2f},afade=t=in:d=2,afade=t=out:st={total - 4:.2f}:d=4,volume={C.MUSICA}[mu]")
    mix.append("[mu]")
    # a música (que vai até o fim) primeiro e duration=first: com longest o amix parava antes quando havia abertura
    filtros.append("[mu]" + "".join(x for x in mix if x != "[mu]") + f"amix=inputs={len(mix)}:duration=first:normalize=0,atrim=0:{total:.3f}[a]")
    C.ffmpeg(*entradas, "-filter_complex", ";".join(filtros), "-map", "[a]", "-c:a", "aac", "-b:a", "160k", tmp("audio.m4a"))
    it["saida"].parent.mkdir(parents=True, exist_ok=True)
    C.ffmpeg("-i", tmp("video.mp4"), "-i", tmp("audio.m4a"), "-c", "copy", "-shortest", "-movflags", "+faststart", it["saida"])


def montar(slugs: list, com_abertura: bool = True) -> int:
    TMP.mkdir(parents=True, exist_ok=True)
    import fundo_satelite  # só aqui: precisa do Pillow, que o trabalho da fila (sem fundo_satelite.py) não tem
    durs = json.loads((PECAS / "duracoes.json").read_text(encoding="utf-8"))
    mm = C.carregar()
    itens = []
    for slug in slugs:
        ped = json.loads((C.VIDEO.parent / "saida" / "territorios" / slug / "pedidos.json").read_text(encoding="utf-8"))
        r = C.roteiro(ped, mm)
        if r is None:
            print(f"  {slug}: sem médico do Mais Médicos hoje, fica sem o vídeo")
            continue
        foto = C.PUB / f"{slug.split('--')[0]}.jpg"
        if not foto.exists():
            print(f"  {slug}: falta a foto {foto.name}")
            continue
        nome = f"{slug}.mp4" if com_abertura else f"{slug}-sem-abertura.mp4"
        itens.append({"slug": slug, "foto": foto, "saida": SAIDA / nome, "com_abertura": com_abertura, "credito": fundo_satelite.credito_kit(slug), **r})
    C.gerar_vozes(VOZES, [*C.FIXAS.values(), C.CORTE_BRASIL, *(t for it in itens for v in it["falas"].values() for t in v),
                          *(it["abertura"] for it in itens if com_abertura)])
    for it in itens:
        C.encaixa(it, VOZES)
        for i in it["falas"]:
            if it["texto"][i] != it["falas"][i][0]:
                print(f"  {it['slug']}: fala {i + 1} encurtada ({it['texto'][i]})")
    cenas_dado(itens, C.PUB, durs["dur"][3])
    ok = 0
    for it in itens:
        t0 = time.time()
        try:
            montar_um(it, durs)
            ok += 1
            print(f"  {it['slug']}: {it['saida']} ({time.time() - t0:.0f} s)")
        except Exception as e:  # noqa: BLE001
            print(f"  {it['slug']}: falhou ({e})")
        finally:
            for f in TMP.glob(f"{it['slug']}-*"):
                f.unlink(missing_ok=True)
    return 0 if ok == len(itens) else 1


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    a = sys.argv[1:]
    if a[:1] == ["pecas"]:
        return pecas()
    if a[:1] == ["montar"] and len(a) > 1:
        return montar([x for x in a[1:] if not x.startswith("--")], "--sem-abertura" not in a)
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main())
