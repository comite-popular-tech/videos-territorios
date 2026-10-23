"""Vídeo "O mercado da Dona Rose" (Bolsa Família, roteiro 5 de video/roteiros-narracao.md): peças prontas e montagem.

  python video/mercadorose.py pecas                 # peças que não mudam (clipes do Flow, corte, compartilhe)
  python video/mercadorose.py montar <slug ...>     # um vídeo por território, em E:/30000-cards/mercadorose-exemplos/

Mesmo molde do Mais Médicos (maismedicos.py): as cenas fixas saem uma vez em 720x1280, já no tempo final (1,25x), e
por território só se faz a voz das falas 1 e 4 e da abertura, a legenda da cena 1, a cena do dado (Remotion em lote,
src/InfoMercadoRose.tsx, pelo mercadorose_render.mjs, cópia do maismedicos_render.mjs com porta própria) e a mistura. A abertura vem do abertura.py.

Entradas em video/public/mercadorose/: clip1-3.mp4 (Flow), musica.mp3 e a foto de cada cidade (<uf>-<cidade>.jpg, a
mesma do kit da fila em entradas/fundos/). Dados: dados/indicadores_municipios.csv (Bolsa Família de agosto).
"""
import hashlib
import json
import os
import shutil
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import abertura as AB  # noqa: E402  (abertura padrão, comum a todos os vídeos de história)
import maismedicos as MM  # noqa: E402  (acelera, chave e OPCOES_RENDER: iguais nos dois vídeos)
import mercadorose_comum as C  # noqa: E402

KIT = C.VIDEO / "kit" / "video-mercadorose"
VOZES, TMP, CACHE = KIT / "vozes", KIT / "render", KIT / "cache"
PECAS = C.PUB / "pecas"
SAIDA = Path(os.environ.get("MERCADOROSE_SAIDA", "E:/30000-cards/mercadorose-exemplos"))
FADE = MM.FADE


def remotion(cenas: list, raiz: Path = C.PUB) -> None:
    lista = TMP / "cenas.json"
    lista.write_text(json.dumps({"raiz": str(raiz), "kit": "video-mercadorose", "cenas": [{**c, "saida": str(c["saida"])} for c in cenas]},
                                ensure_ascii=False), encoding="utf-8")
    import subprocess
    r = subprocess.run(["node", str(C.VIDEO / "mercadorose_render.mjs"), str(lista), *MM.OPCOES_RENDER], cwd=C.VIDEO, text=True,
                       encoding="utf-8", errors="replace")
    falta = [Path(c["saida"]).name for c in cenas if not Path(c["saida"]).exists()]
    if r.returncode != 0 and falta:
        raise RuntimeError(f"Remotion falhou em {', '.join(falta)}")


def peca_clipe(i: int, dur: int, saida: Path, ass_txt: str = None) -> None:
    """Clipe i do Flow em dur frames de render: desacelera se a cena for mais longa que o clipe, escurece nas pontas
    (a primeira cena não entra escurecendo: o primeiro quadro é a prévia no WhatsApp)."""
    lento = max(1.0, dur / C.CLIPES[i])
    pre = [f"scale={C.LARG}:{C.ALT}:force_original_aspect_ratio=increase", f"crop={C.LARG}:{C.ALT}", f"setpts=PTS*{lento:.4f}",
           f"fps={C.FPS}", f"trim=end_frame={dur}", "setpts=PTS-STARTPTS"]
    if i > 0:
        pre.append(f"fade=t=in:s=0:n={FADE}")
    pre.append(f"fade=t=out:s={dur - FADE}:n={FADE}")
    MM.acelera(C.PUB / f"clip{i + 1}.mp4", dur, saida, ass_txt, pre)


def quadro_final(i: int, dur: int, saida: Path) -> None:
    """O último quadro que aparece do clipe i (antes de escurecer): fundo do corte (clipe 2) e do compartilhe (clipe 3)."""
    t = (dur - FADE - 1) / C.FPS / max(1.0, dur / C.CLIPES[i])
    C.ffmpeg("-ss", f"{min(t, C.CLIPES[i] / C.FPS - 0.05):.3f}", "-i", C.PUB / f"clip{i + 1}.mp4", "-frames:v", "1",
             "-vf", f"scale={C.LARG}:{C.ALT}:force_original_aspect_ratio=increase,crop={C.LARG}:{C.ALT}", "-q:v", "2", saida)


def info_corte() -> dict:
    leg = C.legenda_de(C.FIXAS[4], VOZES)
    quadro = lambda p, depois=0.0: round(C.tempo_palavra(leg, p, depois) * C.FPS)
    return {"tipo": "mr_corte", "b2018": C.BENEFICIO["2018"], "b2019": C.BENEFICIO["2019"], "bHoje": C.BENEFICIO["2026"],
            "tSem": quadro("reajuste"), "tHoje": quadro("Hoje"), "tDobro": quadro("dobro"), "flavio": quadro("Flávio"),
            "t250": quadro("250"), "fundo": "@/mercadinho.jpg", "fonte": C.FONTE_CORTE}


def info_dado(it: dict, fundo: str) -> dict:
    """A cena do dado, com os frames em que a fala diz o número de famílias e a segunda frase (o valor ou as casas)."""
    leg, ex, d = it["leg"][3], it["extra"][3], it["dado"]
    quadro = lambda p, depois=0.0: round(C.tempo_palavra(leg, p, depois, extra=ex) * C.FPS)
    t_fam = quadro("famílias") - 20   # o número vem logo antes da palavra
    # a segunda frase começa depois de "agosto" (o "São" de "São Paulo" vem antes)
    agosto = next((t for t, _d, p in leg if p.lower().startswith("agosto")), 0.0)
    segunda = next((p for _t, _d, p in leg if _t > agosto), None)
    t_valor = quadro(segunda, agosto + 0.01) if segunda else quadro("agosto") + 10
    return {"tipo": "mr_dado", "local": d["rotulo"], "familias": d["familias"], "valorMes": d["valor_mes"], "metade": d["metade"],
            "por100": d["por_100_dom"], "tFam": max(30, t_fam), "tValor": t_valor,
            "fundo": f"@/{fundo}", "fonte": C.FONTE_DADO + (f" · {it['credito']}" if it.get("credito") else "")}


def cenas_dado(itens: list, raiz: Path, dur: int) -> None:
    """Cena do dado de cada item (it["p4"]), com a legenda; cache por máquina como no Mais Médicos."""
    CACHE.mkdir(parents=True, exist_ok=True)
    faltam = {}
    for it in itens:
        fundo = it["foto"].relative_to(raiz).as_posix()
        # o conteúdo da foto entra na chave: o satélite que substitui um mapa tem o mesmo nome de arquivo
        conteudo = hashlib.sha1(it["foto"].read_bytes()).hexdigest()[:12]
        it["p4"] = CACHE / f"dado-{MM.chave(it['texto'][3], it['extra'][3], it['dado'], conteudo, it.get('credito'), dur)}.mp4"
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
            MM.acelera(brutos[p4], dur, parcial, C.ass(it["leg"][3], extra=it["extra"][3]))
            os.replace(parcial, p4)
            brutos[p4].unlink()
    print(f"  cena do dado: {len(faltam)} no Remotion em {time.time() - t0:.0f} s ({len(itens) - len(faltam)} do cache)")


def pecas() -> int:
    PECAS.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    C.gerar_vozes(VOZES, C.FIXAS.values())
    dur = C.duracoes(VOZES)
    (PECAS / "duracoes.json").write_text(json.dumps({"dur": dur, "vel": C.VEL, "fps": C.FPS}), encoding="utf-8")
    print("durações (frames de render):", *dur, f"= {sum(dur) / C.FPS / C.VEL:.1f} s no final")
    quadro_final(1, dur[1], C.PUB / "mercadinho.jpg")
    quadro_final(2, dur[2], C.PUB / "prateleira.jpg")
    leg = lambda i: C.ass(C.legenda_de(C.FIXAS[i], VOZES))
    for i in range(3):
        t0 = time.time()
        peca_clipe(i, dur[i], PECAS / f"peca{i + 1}.mp4", leg(i) if i in C.FIXAS else None)
        print(f"peça {i + 1}: {dur[i]} frames, {time.time() - t0:.0f} s")
    infos = [("peca5", C.FIXAS[4], dur[4], info_corte()),
             ("peca6", C.FIXAS[5], dur[5], {"tipo": "fecho", "fundo": "@/prateleira.jpg", "frase": "Bolsa Família: comida na mesa"})]
    t0 = time.time()
    remotion([{"saida": TMP / f"{n}-bruto.mp4", "dur": d, "info": info} for n, _t, d, info in infos])
    for nome, texto, d, _info in infos:
        bruto = TMP / f"{nome}-bruto.mp4"
        MM.acelera(bruto, d, PECAS / f"{nome}.mp4", C.ass(C.legenda_de(texto, VOZES)))
        bruto.unlink()
    print(f"peças 5 e 6 (Remotion): {time.time() - t0:.0f} s")
    for f in PECAS.glob("*.ass"):
        f.unlink()
    return 0


def abertura(it: dict, saida: Path, pecas_dir: Path) -> float:
    """A abertura padrão (video/abertura.py) com o selo "O BOLSA FAMÍLIA ESTÁ AMEAÇADO", que entra na palavra "Bolsa"."""
    return AB.abertura(it, saida, pecas_dir / "peca1.mp4", VOZES, "O BOLSA FAMÍLIA ESTÁ AMEAÇADO", "bolsa")


def montar_um(it: dict, durs: dict, comum: Path = C.PUB) -> None:
    """Um vídeo: as peças prontas de comum/pecas/, a cena 1 com a legenda do território, a cena do dado (it["p4"]) e a
    mistura do áudio (vozes, som dos clipes de comum/ e a música)."""
    pecas_dir = comum / "pecas"
    dur = durs["dur"]
    total = sum(dur) / C.FPS / C.VEL
    tmp = lambda n: TMP / f"{it['slug']}-{n}"
    ass1 = tmp("1.ass")
    ass1.write_text(C.ass(it["leg"][0], extra=it["extra"][0]), encoding="utf-8")
    C.ffmpeg("-i", pecas_dir / "peca1.mp4", "-vf", C.filtro_ass(ass1), *C.ENC, tmp("p1.mp4"))
    ab = abertura(it, tmp("p0.mp4"), pecas_dir) if it.get("com_abertura", True) else 0.0
    it["fim_abertura"] = ab   # a prévia do acervo é um quadro do fim da abertura (previa_video.py)
    total += ab
    pecas_ = ([tmp("p0.mp4")] if ab else []) + [tmp("p1.mp4"), pecas_dir / "peca2.mp4", pecas_dir / "peca3.mp4", it["p4"],
              pecas_dir / "peca5.mp4", pecas_dir / "peca6.mp4"]
    lista = tmp("lista.txt")
    lista.write_text("\n".join(f"file '{str(p).replace(chr(92), '/')}'" for p in pecas_), encoding="utf-8")
    C.ffmpeg("-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", tmp("video.mp4"))
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
    filtros.append("[mu]" + "".join(mix) + f"amix=inputs={len(mix) + 1}:duration=first:normalize=0,atrim=0:{total:.3f}[a]")
    C.ffmpeg(*entradas, "-filter_complex", ";".join(filtros), "-map", "[a]", "-c:a", "aac", "-b:a", "160k", tmp("audio.m4a"))
    it["saida"].parent.mkdir(parents=True, exist_ok=True)
    C.ffmpeg("-i", tmp("video.mp4"), "-i", tmp("audio.m4a"), "-c", "copy", "-shortest", "-movflags", "+faststart", it["saida"])


def montar(slugs: list, com_abertura: bool = True) -> int:
    TMP.mkdir(parents=True, exist_ok=True)
    import fundo_satelite
    durs = json.loads((PECAS / "duracoes.json").read_text(encoding="utf-8"))
    bf = C.carregar()
    itens = []
    for slug in slugs:
        ped = json.loads((C.VIDEO.parent / "saida" / "territorios" / slug / "pedidos.json").read_text(encoding="utf-8"))
        r = C.roteiro(ped, bf)
        # fundo sempre do kit (foto aprovada ou satélite), nunca mapa nem cópia velha de outra pasta public/
        try:
            origem, credito = fundo_satelite.fundo_kit(slug)
        except RuntimeError as e:
            print(f"  {e}")
            continue
        foto = C.PUB / f"{slug.split('--')[0]}.jpg"
        if not foto.exists() or foto.read_bytes() != Path(origem).read_bytes():
            shutil.copyfile(origem, foto)
        nome = f"{slug}.mp4" if com_abertura else f"{slug}-sem-abertura.mp4"
        itens.append({"slug": slug, "foto": foto, "saida": SAIDA / nome, "com_abertura": com_abertura, "credito": credito, **r})
    C.gerar_vozes(VOZES, [*C.FIXAS.values(), *(t for it in itens for v in it["falas"].values() for t in v),
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
