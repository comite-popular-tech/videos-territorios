"""Vídeo "A merenda da Júlia" (merenda escolar, roteiro 8 de video/roteiros-narracao.md): peças prontas e montagem.

  python video/merenda.py pecas                 # peças que não mudam (clipes do Flow, corte, compartilhe)
  python video/merenda.py montar <slug ...>     # um vídeo por território, em E:/30000-cards/merenda-exemplos/

Cópia do maismedicos.py (o padrão da produção em massa: montagem, não render): as cenas fixas saem uma vez em 720x1280,
já no tempo final (1,25x), e por território só se faz a voz das falas 1 e 4, a legenda da cena 1, a cena do dado e a
mistura. Os infográficos são do Remotion (src/InfoMerenda.tsx e o fecho do InfoFarmacia.tsx, pela composição "Merenda"
de src/MerendaRoot.tsx, renderizados por merenda_render.mjs com um bundle só para todas as cenas); os clipes passam só
pelo ffmpeg. Diferenças: uma peça de corte só (a cena 4 fala o valor da cidade, do estado ou do Brasil, e a 5 o valor
por aluno, que é nacional) e o selo da abertura.

Entradas em video/public/merenda/: clip1-3.mp4 (Flow), musica.mp3 e a foto de cada cidade (<uf>-<cidade>.jpg, a
mesma do kit da fila em entradas/fundos/). Dados: video/merenda.json (merenda_dados.py).
"""
import hashlib
import unicodedata
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import merenda_comum as C  # noqa: E402
from pedemeia_comum import _tempo  # noqa: E402

KIT = C.VIDEO / "kit" / "video-merenda"
VOZES, TMP, CACHE = KIT / "vozes", KIT / "render", KIT / "cache"
PECAS = C.PUB / "pecas"
SAIDA = Path(os.environ.get("MERENDA_SAIDA", "E:/30000-cards/merenda-exemplos"))
FADE = 5   # frames de render do escurecimento entre as cenas dos clipes
OPCOES_RENDER = []   # repassadas ao merenda_render.mjs (--gl swangle --conc 4 no Actions)


def remotion(cenas: list, raiz: Path = C.PUB) -> None:
    """Renderiza as cenas de infográfico ({"saida", "dur", "info"}) no Remotion, todas com o mesmo bundle; "@/<arquivo>"
    no fundo é um arquivo da pasta raiz."""
    lista = TMP / "cenas.json"
    lista.write_text(json.dumps({"raiz": str(raiz), "kit": "video-merenda", "cenas": [{**c, "saida": str(c["saida"])} for c in cenas]}, ensure_ascii=False),
                     encoding="utf-8")
    r = subprocess.run(["node", str(C.VIDEO / "merenda_render.mjs"), str(lista), *OPCOES_RENDER], cwd=C.VIDEO, text=True, encoding="utf-8",
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


def info_corte(texto: str) -> dict:
    leg = C.legenda_de(texto, VOZES)
    quadro = lambda p: round(C.tempo_palavra(leg, p) * C.FPS)
    return {"tipo": "md_corte", "congelado": quadro("congelad"), "lula": quadro("Lula"), "flavio": quadro("Flávio"),
            "ameaca": quadro("ameaçad"), "fundo": "@/refeitorio.jpg", "fonte": C.FONTE_CORTE}


def info_dado(it: dict, fundo: str) -> dict:
    """A cena do dado, com os frames em que a fala diz a média de Bolsonaro (o cartão sobe pouco antes) e a de Lula."""
    leg, ex, d = it["leg"][3], it["extra"][3], it["dado"]
    quadro = lambda p, depois=0.0: round(C.tempo_palavra(leg, p, depois=depois, extra=ex) * C.FPS)
    t_lula = next((t for t, _d, p in leg if p.startswith("Lula")), 0.0)
    return {"tipo": "md_dado", "local": d["rotulo"], "antes": d["medias"][0], "agora": d["medias"][1],
            "tAntes": quadro(C.reais(d["medias"][0]).split()[0]), "tAgora": quadro(C.reais(d["medias"][1]).split()[0], t_lula),
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
        # o conteúdo da foto entra na chave: o mesmo nome já foi mapa, foto e satélite
        foto_hash = hashlib.sha1(it["foto"].read_bytes()).hexdigest()[:12]
        it["p4"] = CACHE / f"dado-{chave(it['texto'][3], it['extra'][3], it['dado'], foto_hash, it.get('credito'), dur)}.mp4"
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
    C.gerar_vozes(VOZES, [*C.FIXAS.values()])
    dur = C.duracoes(VOZES)
    (PECAS / "duracoes.json").write_text(json.dumps({"dur": dur, "vel": C.VEL, "fps": C.FPS}), encoding="utf-8")
    print("durações (frames de render):", *dur, f"= {sum(dur) / C.FPS / C.VEL:.1f} s no final")
    quadro_final(1, dur[1], C.PUB / "refeitorio.jpg")
    quadro_final(2, dur[2], C.PUB / "mesa.jpg")
    leg = lambda i: C.ass(C.legenda_de(C.FIXAS[i], VOZES))
    for i in range(3):
        t0 = time.time()
        peca_clipe(i, dur[i], PECAS / f"peca{i + 1}.mp4", leg(i) if i in C.FIXAS else None)
        print(f"peça {i + 1}: {dur[i]} frames, {time.time() - t0:.0f} s")
    infos = [("peca5", C.FIXAS[4], dur[4], info_corte(C.FIXAS[4])),
             ("peca6", C.FIXAS[5], dur[5], {"tipo": "fecho", "fundo": "@/mesa.jpg", "frase": "Merenda: comida de verdade na escola"})]
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


# ---------------------------------------------------------------- abertura padrão (aprovada em 21/10 no Mais Médicos):
# uns 6 s antes da história, no primeiro quadro do clipe 1 escurecido, com voz ("Atenção, morador do Capão Redondo: a
# merenda escolar está ameaçada. Entenda por quê.").
AMARELO, VERMELHO = "&H0001B3F5", "&H002626DC"   # ASS em BGR


def _estilos(ass_txt: str, linhas: list) -> str:
    return ass_txt.replace("\n\n[Events]", "\n" + "\n".join(linhas) + "\n\n[Events]", 1)


# largura de cada letra da Archivo Condensed Black a 100 px (medida no Pillow em 21/10), para a etiqueta caber no texto
_LARGURA = {**dict(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ", [62, 59, 60, 60, 55, 49, 63, 62, 30, 52, 62, 51, 79, 62, 65, 56, 65, 60,
                                                       57, 56, 62, 59, 82, 60, 58, 56])),
            **dict(zip("0123456789", [52, 47, 51, 52, 51, 52, 52, 49, 51, 52])), " ": 13, "-": 27, ".": 27}


def _largura(texto: str, tam: int, espaco: float) -> float:
    base = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    # o libass põe o tamanho na altura da linha (subida + descida), não no em do Pillow: as letras saem a ~70%
    return sum(_LARGURA.get(c, 60) for c in base) * tam / 100 * 0.70 + espaco * max(0, len(base) - 1)


def _pilula(w: float, h: float) -> str:
    r = h / 2
    return (f"m {r:.0f} 0 l {w - r:.0f} 0 b {w:.0f} 0 {w:.0f} {h:.0f} {w - r:.0f} {h:.0f} l {r:.0f} {h:.0f} "
            f"b 0 {h:.0f} 0 0 {r:.0f} 0")


ALFINETE = "m 12 0 b 5.4 0 0 5.4 0 12 b 0 21 12 32 12 32 b 12 32 24 21 24 12 b 24 5.4 18.6 0 12 0"
FURO = "m 12 7 b 14.8 7 17 9.2 17 12 b 17 14.8 14.8 17 12 17 b 9.2 17 7 14.8 7 12 b 7 9.2 9.2 7 12 7"


def etiqueta(texto: str, y: int, ini: str, fim: str) -> tuple:
    """Etiqueta do lugar no topo ("SÃO PAULO - SP"): pílula escura com o alfinete vermelho, como a da cena do dado;
    desce 18 px aparecendo. Devolve (estilos, eventos) do ASS."""
    tam, esp, h = 54, 2, 74
    w_txt = _largura(texto, tam, esp)
    w = 22 + 30 + 14 + w_txt + 30
    x0 = round(360 - w / 2)
    mv = lambda x, yy: f"\\move({x},{yy - 18},{x},{yy},0,220)\\fad(180,0)"
    estilos = ["Style: Desenho,Arial,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1",
               f"Style: Etiqueta,Archivo Condensed Black,{tam},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,{esp},0,1,0,0,4,0,0,0,1"]
    eventos = [
        f"Dialogue: 2,{ini},{fim},Desenho,,0,0,0,,{{{mv(x0, y)}\\1c&H20110B&\\1a&H28&\\shad3\\4a&HA0&\\p1}}{_pilula(w, h)}",
        f"Dialogue: 3,{ini},{fim},Desenho,,0,0,0,,{{{mv(x0 + 22, y + 15)}\\1c&H2626DC&\\fscx125\\fscy125\\p1}}{ALFINETE}",
        f"Dialogue: 4,{ini},{fim},Desenho,,0,0,0,,{{{mv(x0 + 22, y + 15)}\\1c&HFFFFFF&\\fscx125\\fscy125\\p1}}{FURO}",
        f"Dialogue: 4,{ini},{fim},Etiqueta,,0,0,0,,{{{mv(x0 + 22 + 30 + 14, y + h // 2 + 2)}}}{texto}",
    ]
    return estilos, eventos


def abertura(it: dict, saida: Path, pecas_dir: Path) -> float:
    """Abertura com voz sobre o primeiro quadro do clipe 1 escurecido. O cartão (ATENÇÃO, MORADOR DE <CIDADE>, A MERENDA
    ESTÁ AMEAÇADA) já está inteiro no 1º quadro, que é a prévia do WhatsApp (Gui, 21/10: a cidade, não o
    bairro, em toda prévia). Do 2º quadro em diante as partes entram de novo com a fala: o morador como a voz diz e,
    quando ela diz o bairro, a etiqueta "Cidade - UF" no topo; o "Entenda por quê" por último. Devolve a duração em segundos (tempo final)."""
    leg = C.legenda_de(it["abertura"], VOZES)
    dur = round((0.15 + C.fim_da_fala(leg) / C.VEL + 0.45) * C.FPS) / C.FPS
    quando = lambda alvo, resto: 0.15 + next((t for t, _d, p in leg if p.lower().startswith(alvo)), C.fim_da_fala(leg) * resto) / C.VEL
    t_selo, t_entenda = quando("merenda", 0.5), quando("entenda", 0.8)
    q1 = 0.03   # o 1º quadro (1/30 s; o ASS conta em centésimos)
    quadro = saida.with_suffix(".jpg")
    C.ffmpeg("-i", pecas_dir / "peca1.mp4", "-frames:v", "1", "-q:v", "2", quadro)
    morador, morador_fala = f"MORADOR {it['morador']}".upper(), f"MORADOR {it['morador_fala']}".upper()
    tam = min(66, round(1650 / max(1, len(morador), len(morador_fala))))
    com_bairro = it["morador_fala"] != it["morador"]   # a voz diz o bairro: a cidade vai na etiqueta do topo
    est_local, ev_local = etiqueta(it["local"].upper(), 296, _tempo(q1 + 0.05), _tempo(dur)) if com_bairro else ([], [])
    cab = _estilos(C.ass([]), [
        f"Style: Grande,Archivo Condensed Black,150,{AMARELO},&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,2,0,1,5,4,5,40,40,0,1",
        *est_local,
        f"Style: Morador,Archivo Condensed Black,{tam},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,1,0,1,4,3,5,30,30,0,1",
        f"Style: Entenda,Archivo Condensed Black,64,{AMARELO},&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,2,0,1,4,3,5,30,30,0,1",
        f"Style: Selo,Archivo Condensed Black,60,&H00FFFFFF,&H00FFFFFF,{VERMELHO},{VERMELHO},0,0,0,0,100,100,1,0,3,14,0,5,30,30,0,1",
    ])
    fim = _tempo(dur)
    ev = [
        # 1º quadro (a prévia): o cartão inteiro, parado
        f"Dialogue: 1,{_tempo(0)},{_tempo(q1)},Grande,,0,0,0,,{{\\pos(360,470)}}ATENÇÃO",
        f"Dialogue: 1,{_tempo(0)},{_tempo(q1)},Morador,,0,0,0,,{{\\pos(360,615)}}{morador}",
        f"Dialogue: 1,{_tempo(0)},{_tempo(q1)},Selo,,0,0,0,,{{\\pos(360,765)\\frz3}}A MERENDA ESTÁ AMEAÇADA",
        # quem dá o play vê as partes entrando com a fala
        f"Dialogue: 1,{_tempo(q1 + 0.05)},{fim},Grande,,0,0,0,,{{\\pos(360,470)\\fscx160\\fscy160\\t(0,180,\\fscx100\\fscy100)}}ATENÇÃO",
        *ev_local,
        f"Dialogue: 1,{_tempo(0.45)},{fim},Morador,,0,0,0,,{{\\pos(360,615)\\fad(150,0)}}{morador_fala}",
        f"Dialogue: 1,{_tempo(t_selo)},{fim},Selo,,0,0,0,,{{\\pos(360,765)\\frz3\\fscx140\\fscy140\\t(0,150,\\fscx100\\fscy100)}}A MERENDA ESTÁ AMEAÇADA",
        f"Dialogue: 1,{_tempo(t_entenda)},{fim},Entenda,,0,0,0,,{{\\pos(360,900)\\fscx130\\fscy130\\t(0,160,\\fscx100\\fscy100)}}ENTENDA POR QUÊ",
    ]
    ass_arq = saida.with_suffix(".ass")
    ass_arq.write_text(cab + "\n".join(ev) + "\n", encoding="utf-8")
    n = round(dur * C.FPS)
    filtro = (f"[0:v]scale={C.LARG}:{C.ALT},setsar=1,zoompan=z='1+0.0008*on':d={n}:s={C.LARG}x{C.ALT}:fps={C.FPS}[f];"
              f"color=c=black:s={C.LARG}x{C.ALT}:r={C.FPS}:d={dur:.3f},format=rgba,colorchannelmixer=aa=0.62[v];"
              f"[f][v]overlay=format=auto:shortest=1,{C.filtro_ass(ass_arq)},"
              "scale=out_range=tv,format=yuv420p")   # a foto vem em faixa cheia (yuvj): igual às peças, que são coladas sem recodificar
    C.ffmpeg("-i", quadro, "-filter_complex", filtro, "-frames:v", str(n), *C.ENC, saida)
    return dur


def montar_um(it: dict, durs: dict, comum: Path = C.PUB) -> None:
    """Um vídeo: as peças prontas de comum/pecas/, a cena 1 com a legenda do território, a cena do dado (it["p4"]) e a
    mistura do áudio (vozes, som dos clipes de comum/ e a música)."""
    pecas_dir = comum / "pecas"
    dur = durs["dur"]
    total = sum(dur) / C.FPS / C.VEL
    tmp = lambda n: TMP / f"{it['slug']}-{n}"
    # cena 1: a peça pronta com a legenda deste território
    ass1 = tmp("1.ass")
    ass1.write_text(C.ass(it["leg"][0], extra=it["extra"][0]), encoding="utf-8")
    C.ffmpeg("-i", pecas_dir / "peca1.mp4", "-vf", C.filtro_ass(ass1), *C.ENC, tmp("p1.mp4"))
    ab = abertura(it, tmp("p0.mp4"), pecas_dir) if it.get("com_abertura", True) else 0.0
    total += ab
    pecas_ = ([tmp("p0.mp4")] if ab else []) + [tmp("p1.mp4"), pecas_dir / "peca2.mp4", pecas_dir / "peca3.mp4", it["p4"],
              pecas_dir / "peca5.mp4", pecas_dir / "peca6.mp4"]
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
    md = C.carregar()
    itens = []
    for slug in slugs:
        ped = json.loads((C.VIDEO.parent / "saida" / "territorios" / slug / "pedidos.json").read_text(encoding="utf-8"))
        r = C.roteiro(ped, md)
        # fundo sempre do kit (foto aprovada ou satélite), nunca mapa nem cópia velha de outra pasta public/ (Gui, 22/10);
        # copiado para public/merenda/ porque o Remotion só serve a raiz
        try:
            origem, credito = fundo_satelite.fundo_kit(slug)
        except Exception as e:  # noqa: BLE001
            print(f"  {slug}: {e}")
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
