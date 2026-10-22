"""Montagem dos vídeos "história + dados" com a Dona Marta, no padrão de massa do Mais Médicos (maismedicos.py e
trabalhos/video_maismedicos.py): três clipes do Flow, o dado do lugar, o corte e o compartilhe, mais a abertura.
Serve a qualquer roteiro com esse desenho; cada vídeo é um módulo (mcmv.py, postonovo.py) com os textos, os dados e as
cenas, e chama main() daqui.

Cenas (índice 0 a 5):     vídeo                                              fala
  0 clipe 1 do Flow       peça sem legenda                                   muda (bairro e cidade)
  1 clipe 2 do Flow       peça com legenda                                   fixa
  2 clipe 3 do Flow       peça com legenda                                   fixa
  3 dado                  Remotion por território (hd_dado), lote e cache    muda (cidade, estado ou Brasil)
  4 corte                 Remotion, peça com legenda (hd_corte)              fixa
  5 compartilhe           Remotion, peça com legenda (fecho do InfoFarmacia) fixa
Antes delas, a abertura (ffmpeg + ASS sobre o 1º quadro da peça 1).

O módulo do vídeo (V) define: NOME, TRABALHO, PUB (clip1-3.mp4, musica.mp3 e a foto de cada cidade), SAIDA, FIXAS
{1, 2, 4, 5}, JANELAS {0, 3}, FUNDO_CORTE (clipe cujo último quadro é o fundo do corte), FRASE_FECHO, FONTE_DADO,
FONTE_CORTE, SELO, SELO_PALAVRA, DESCRICAO, dados(), carregar(), roteiro(pedidos, dados) e info_corte(leg). O roteiro
devolve falas {0, 3}, abertura, morador, morador_fala, local e info_dado(leg, extra) (o hd_dado sem fundo e fonte).

Padrão de massa (skill video-historia, "Produção em massa", itens 6 a 9): a cena do dado de todos os itens do lote vai
de uma vez ao maismedicos_render.mjs (um bundle e um navegador), com cache por máquina (os bairros de uma cidade
dividem a cena); o resto é ffmpeg e colagem com -c copy.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pedemeia_comum import (ALT, ATRASO, ENC, FOLGA, FPS, LARG, RESPIRO_FINAL, VEL, VIDEO,  # noqa: E402
                            _tempo, ass, ffmpeg, filtro_ass, fim_da_fala, gerar_vozes, legenda_de, voz_arquivo)

RAIZ = VIDEO.parent
MUSICA, AMBIENTE = 0.25, 0.35
CLIPES = [240, 240, 240]   # frames dos clipes do Flow (8 s cada)
EXTRA_MAX = 1.3
FADE = 5                   # frames de render do escurecimento entre as cenas dos clipes
OPCOES_RENDER = []         # repassadas ao maismedicos_render.mjs (--gl swangle --conc 4 no Actions)
FILA = os.environ.get("FILA_URL", "https://fila-videos.boralula.workers.dev").rstrip("/")
COMUNS = ["clip1.mp4", "clip2.mp4", "clip3.mp4", "musica.mp3", "pecas/peca1.mp4", "pecas/peca2.mp4", "pecas/peca3.mp4",
          "pecas/peca5.mp4", "pecas/peca6.mp4", "pecas/duracoes.json"]


def pastas(V):
    """vozes, render (temporário) e cache da cena do dado, por máquina."""
    kit = VIDEO / "kit" / f"video-{V.NOME}"
    return kit / "vozes", kit / "render", kit / "cache"


def credito_fundo(slug: str) -> str:
    """Crédito da imagem de satélite, quando é ela o fundo da cidade no kit (video/fundo_satelite.py); senão vazio."""
    try:
        from fundo_satelite import credito_kit
    except ImportError:
        return ""
    return credito_kit(slug.split("--")[0]) or ""


def duracoes(V, vozes: Path) -> list:
    """Duração de cada cena, em frames de render: as fixas pelo tamanho da própria fala, as variáveis pela janela."""
    out = []
    for i in range(6):
        fala = V.JANELAS[i] if i in V.JANELAS else fim_da_fala(legenda_de(V.FIXAS[i], vozes))
        out.append(ATRASO + round(fala * FPS) + FOLGA + (RESPIRO_FINAL if i == 5 else 0))
    return out


def inicio_final(dur: list, i: int) -> float:
    """Segundos, no vídeo final, em que a cena i começa."""
    return sum(dur[:i]) / FPS / VEL


def _tem(p: str, alvo: str) -> bool:
    """A palavra da legenda começa com alvo (o edge-tts às vezes junta duas numa só: "500 casas", "7 mil")."""
    return any(w.strip(".,!?:").startswith(alvo.lower()) for w in p.lower().split())


def tempo_palavra(leg: list, alvo: str, depois: float = 0.0, extra: float = 1.0) -> float:
    """Segundos de render, desde o começo da cena, em que a fala chega na primeira palavra que começa com alvo
    (depois do segundo `depois` da fala); sem a palavra, o fim da fala."""
    for t, d, p in leg:
        if t >= depois and _tem(p, alvo):
            return ATRASO / FPS + t / extra
    return ATRASO / FPS + fim_da_fala(leg) / extra


def fim_palavra(leg: list, alvo: str, extra: float = 1.0) -> float:
    """Segundos de render em que a fala termina a primeira palavra que começa com alvo."""
    for t, d, p in leg:
        if _tem(p, alvo):
            return ATRASO / FPS + (t + d) / extra
    return ATRASO / FPS + fim_da_fala(leg) / extra


def quadro(s: float) -> int:
    return round(s * FPS)


def encaixa(V, it: dict, vozes: Path) -> None:
    """Escolhe, para cada fala variável, a versão mais longa que cabe na janela (acelerando até EXTRA_MAX)."""
    it["texto"], it["extra"], it["leg"] = {}, {}, {}
    for i, versoes in it["falas"].items():
        for k, texto in enumerate(versoes):
            leg = legenda_de(texto, vozes)
            extra = max(1.0, fim_da_fala(leg) / V.JANELAS[i])
            if extra <= EXTRA_MAX or k == len(versoes) - 1:
                it["texto"][i], it["extra"][i], it["leg"][i] = texto, min(extra, EXTRA_MAX), leg
                break
    for i, texto in V.FIXAS.items():
        it["texto"][i], it["extra"][i] = texto, 1.0


def remotion(V, cenas: list, raiz: Path, tmp: Path) -> None:
    """Renderiza as cenas de infográfico ({"saida", "dur", "info"}) no Remotion, todas com o mesmo bundle e o mesmo
    navegador (maismedicos_render.mjs); "@/<arquivo>" no fundo é um arquivo da pasta raiz."""
    lista = tmp / "cenas.json"
    lista.write_text(json.dumps({"raiz": str(raiz), "kit": f"video-{V.NOME}",
                                 "cenas": [{**c, "saida": str(c["saida"])} for c in cenas]}, ensure_ascii=False), encoding="utf-8")
    r = subprocess.run(["node", str(VIDEO / "maismedicos_render.mjs"), str(lista), *OPCOES_RENDER], cwd=VIDEO, text=True,
                       encoding="utf-8", errors="replace")
    falta = [Path(c["saida"]).name for c in cenas if not Path(c["saida"]).exists()]
    if r.returncode != 0 and falta:
        raise RuntimeError(f"Remotion falhou em {', '.join(falta)}")


def acelera(bruto: Path, dur: int, saida: Path, ass_txt: str = None, filtros_antes=()) -> None:
    """Corta a cena em dur frames de render, acelera 1,25x e queima a legenda (se houver), com os parâmetros de todas."""
    filtros = [*filtros_antes, f"trim=end_frame={dur}", "setpts=PTS-STARTPTS", f"setpts=PTS/{VEL}", f"fps={FPS}"]
    if ass_txt:
        ass_arq = saida.with_suffix(".ass")
        ass_arq.write_text(ass_txt, encoding="utf-8")
        filtros.append(filtro_ass(ass_arq))
    ffmpeg("-i", bruto, "-vf", ",".join(filtros), *ENC, saida)


def peca_clipe(V, i: int, dur: int, saida: Path, ass_txt: str = None) -> None:
    """Clipe i do Flow em dur frames de render: desacelera se a cena for mais longa que o clipe, escurece nas pontas
    (a primeira cena não entra escurecendo: o primeiro quadro é a prévia no WhatsApp)."""
    lento = max(1.0, dur / CLIPES[i])
    pre = [f"scale={LARG}:{ALT}:force_original_aspect_ratio=increase", f"crop={LARG}:{ALT}", f"setpts=PTS*{lento:.4f}",
           f"fps={FPS}", f"trim=end_frame={dur}", "setpts=PTS-STARTPTS"]
    if i > 0:
        pre.append(f"fade=t=in:s=0:n={FADE}")
    pre.append(f"fade=t=out:s={dur - FADE}:n={FADE}")
    acelera(V.PUB / f"clip{i + 1}.mp4", dur, saida, ass_txt, pre)


def quadro_final(V, i: int, dur: int, saida: Path) -> None:
    """O último quadro que aparece do clipe i (antes de escurecer): fundo do corte e do compartilhe."""
    t = (dur - FADE - 1) / FPS / max(1.0, dur / CLIPES[i])
    ffmpeg("-ss", f"{min(t, CLIPES[i] / FPS - 0.05):.3f}", "-i", V.PUB / f"clip{i + 1}.mp4", "-frames:v", "1",
           "-vf", f"scale={LARG}:{ALT}:force_original_aspect_ratio=increase,crop={LARG}:{ALT}", "-q:v", "2", saida)


def pecas(V) -> int:
    """As peças que não mudam, em V.PUB/pecas/: os três clipes (o 1º sem legenda), o corte e o compartilhe."""
    vozes, tmp, _ = pastas(V)
    pecas_ = V.PUB / "pecas"
    pecas_.mkdir(parents=True, exist_ok=True)
    tmp.mkdir(parents=True, exist_ok=True)
    gerar_vozes(vozes, V.FIXAS.values())
    dur = duracoes(V, vozes)
    (pecas_ / "duracoes.json").write_text(json.dumps({"dur": dur, "vel": VEL, "fps": FPS}), encoding="utf-8")
    print("durações (frames de render):", *dur, f"= {sum(dur) / FPS / VEL:.1f} s no final, sem a abertura")
    quadro_final(V, V.FUNDO_CORTE, dur[V.FUNDO_CORTE], tmp / "corte.jpg")
    quadro_final(V, 2, dur[2], tmp / "fecho.jpg")
    leg = lambda i: ass(legenda_de(V.FIXAS[i], vozes))
    for i in range(3):
        t0 = time.time()
        peca_clipe(V, i, dur[i], pecas_ / f"peca{i + 1}.mp4", leg(i) if i in V.FIXAS else None)
        print(f"peça {i + 1}: {dur[i]} frames, {time.time() - t0:.0f} s")
    infos = [("peca5", 4, {**V.info_corte(legenda_de(V.FIXAS[4], vozes)), "fundo": "@/corte.jpg", "fonte": V.FONTE_CORTE}),
             ("peca6", 5, {"tipo": "fecho", "fundo": "@/fecho.jpg", "frase": V.FRASE_FECHO})]
    t0 = time.time()
    remotion(V, [{"saida": tmp / f"{n}-bruto.mp4", "dur": dur[i], "info": info} for n, i, info in infos], tmp, tmp)
    for nome, i, _info in infos:
        bruto = tmp / f"{nome}-bruto.mp4"
        acelera(bruto, dur[i], pecas_ / f"{nome}.mp4", leg(i))
        bruto.unlink()
    print(f"peças 5 e 6 (Remotion): {time.time() - t0:.0f} s")
    for f in pecas_.glob("*.ass"):
        f.unlink()
    return 0


def chave(*partes) -> str:
    return hashlib.sha1(json.dumps(partes, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]


def cenas_dado(V, itens: list, raiz: Path, dur: int) -> None:
    """Cena do dado de cada item (it["p4"]), já acelerada e com a legenda: os territórios de mesma fala, mesmo dado e
    mesma foto (os bairros de uma cidade) dividem a cena, que fica no cache da máquina; as que faltam saem do Remotion
    de uma vez, com um bundle e um navegador só."""
    _, tmp, cache = pastas(V)
    cache.mkdir(parents=True, exist_ok=True)
    faltam = {}
    for it in itens:
        leg, ex = it["leg"][3], it["extra"][3]
        credito = it.get("credito") or ""
        info = {**it["info_dado"](leg, ex), "fundo": "@/" + it["foto"].relative_to(raiz).as_posix(),
                "fonte": V.FONTE_DADO + (f" · {credito}" if credito else "")}   # satélite: crédito na tela
        # o crédito separa o mapa antigo do satélite que ficou no lugar dele (o arquivo tem o mesmo nome)
        it["p4"] = cache / f"dado-{chave(it['texto'][3], ex, {k: v for k, v in info.items() if k != 'fundo'}, it['foto'].name, dur)}.mp4"
        if not it["p4"].exists() and it["p4"] not in faltam:
            faltam[it["p4"]] = (it, info)
    if not faltam:
        return
    t0 = time.time()
    brutos = {p4: tmp / f"{p4.stem}-bruto.mp4" for p4 in faltam}
    remotion(V, [{"saida": brutos[p4], "dur": dur, "info": info} for p4, (_it, info) in faltam.items()], raiz, tmp)
    for p4, (it, _info) in faltam.items():
        if brutos[p4].exists():
            parcial = tmp / f"{p4.stem}-p4.mp4"
            acelera(brutos[p4], dur, parcial, ass(it["leg"][3], extra=it["extra"][3]))
            os.replace(parcial, p4)
            brutos[p4].unlink()
    print(f"  cena do dado: {len(faltam)} no Remotion em {time.time() - t0:.0f} s ({len(itens) - len(faltam)} do cache)")


# ---------------------------------------------------------------- abertura (a mesma do Mais Médicos, aprovada em 21/10;
# ideia do Gabriel: a pessoa desengajava antes da história esquentar): uns 6 s antes da história, no primeiro quadro do
# clipe 1 escurecido, com voz ("Atenção, morador do Capão Redondo: o <programa> está ameaçado. Entenda por quê.").
AMARELO, VERMELHO = "&H0001B3F5", "&H002626DC"   # ASS em BGR
from maismedicos import etiqueta  # noqa: E402  (a pílula do lugar no topo, com o alfinete)


def abertura(V, it: dict, vozes: Path, saida: Path, pecas_: Path) -> float:
    """O cartão (ATENÇÃO, MORADOR DE <CIDADE>, o selo vermelho V.SELO) já está inteiro no 1º quadro, que é a prévia do
    WhatsApp (Gui, 21/10: a cidade, não o bairro, em toda prévia). Do 2º quadro em diante as partes entram de novo com
    a fala (o selo na palavra V.SELO_PALAVRA), e o "Entenda por quê" por último. Devolve a duração em segundos (tempo
    final)."""
    leg = legenda_de(it["abertura"], vozes)
    dur = round((0.15 + fim_da_fala(leg) / VEL + 0.45) * FPS) / FPS
    quando = lambda alvo, resto: 0.15 + next((t for t, _d, p in leg if p.lower().startswith(alvo)), fim_da_fala(leg) * resto) / VEL
    t_selo, t_entenda = quando(V.SELO_PALAVRA, 0.5), quando("entenda", 0.8)
    q1 = 0.03   # o 1º quadro (1/30 s; o ASS conta em centésimos)
    foto = saida.with_suffix(".jpg")
    ffmpeg("-i", pecas_ / "peca1.mp4", "-frames:v", "1", "-q:v", "2", foto)
    # a prévia diz a cidade; do 2º quadro em diante a linha segue a voz ("MORADOR DO CAPÃO REDONDO"), e aí a cidade
    # vai na etiqueta do topo ("SÃO PAULO - SP"), a mesma do Mais Médicos
    morador, morador_fala = f"MORADOR {it['morador']}".upper(), f"MORADOR {it['morador_fala']}".upper()
    tam = min(66, round(1650 / max(1, len(morador), len(morador_fala))))
    com_bairro = it["morador_fala"] != it["morador"]
    est_local, ev_local = etiqueta(it["local"].upper(), 296, _tempo(q1 + 0.05), _tempo(dur)) if com_bairro else ([], [])
    tam_selo = min(60, round(1500 / max(len(x) for x in V.SELO)))
    estilos = [*est_local,
        f"Style: Grande,Archivo Condensed Black,150,{AMARELO},&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,2,0,1,5,4,5,40,40,0,1",
        f"Style: Morador,Archivo Condensed Black,{tam},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,1,0,1,4,3,5,30,30,0,1",
        f"Style: Entenda,Archivo Condensed Black,64,{AMARELO},&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,2,0,1,4,3,5,30,30,0,1",
        f"Style: Selo,Archivo Condensed Black,{tam_selo},&H00FFFFFF,&H00FFFFFF,{VERMELHO},{VERMELHO},0,0,0,0,100,100,1,0,3,14,0,5,30,30,0,1",
    ]
    cab = ass([]).replace("\n\n[Events]", "\n" + "\n".join(estilos) + "\n\n[Events]", 1)
    fim = _tempo(dur)
    y_entenda = 900 + 35 * (len(V.SELO) - 1)   # selo de duas linhas empurra o "Entenda por quê"
    selo = "\\N".join(V.SELO)
    ev = [
        # 1º quadro (a prévia): o cartão inteiro, parado
        f"Dialogue: 1,{_tempo(0)},{_tempo(q1)},Grande,,0,0,0,,{{\\pos(360,470)}}ATENÇÃO",
        f"Dialogue: 1,{_tempo(0)},{_tempo(q1)},Morador,,0,0,0,,{{\\pos(360,615)}}{morador}",
        f"Dialogue: 1,{_tempo(0)},{_tempo(q1)},Selo,,0,0,0,,{{\\pos(360,775)\\frz3}}{selo}",
        # quem dá o play vê as partes entrando com a fala
        f"Dialogue: 1,{_tempo(q1 + 0.05)},{fim},Grande,,0,0,0,,{{\\pos(360,470)\\fscx160\\fscy160\\t(0,180,\\fscx100\\fscy100)}}ATENÇÃO",
        f"Dialogue: 1,{_tempo(0.45)},{fim},Morador,,0,0,0,,{{\\pos(360,615)\\fad(150,0)}}{morador_fala}",
        f"Dialogue: 1,{_tempo(t_selo)},{fim},Selo,,0,0,0,,{{\\pos(360,775)\\frz3\\fscx140\\fscy140\\t(0,150,\\fscx100\\fscy100)}}{selo}",
        f"Dialogue: 1,{_tempo(t_entenda)},{fim},Entenda,,0,0,0,,{{\\pos(360,{y_entenda})\\fscx130\\fscy130\\t(0,160,\\fscx100\\fscy100)}}ENTENDA POR QUÊ",
        *ev_local,
    ]
    ass_arq = saida.with_suffix(".ass")
    ass_arq.write_text(cab + "\n".join(ev) + "\n", encoding="utf-8")
    n = round(dur * FPS)
    filtro = (f"[0:v]scale={LARG}:{ALT},setsar=1,zoompan=z='1+0.0008*on':d={n}:s={LARG}x{ALT}:fps={FPS}[f];"
              f"color=c=black:s={LARG}x{ALT}:r={FPS}:d={dur:.3f},format=rgba,colorchannelmixer=aa=0.62[v];"
              f"[f][v]overlay=format=auto:shortest=1,{filtro_ass(ass_arq)},"
              "scale=out_range=tv,format=yuv420p")   # o quadro vem em faixa cheia (yuvj): igual às peças, coladas sem recodificar
    ffmpeg("-i", foto, "-filter_complex", filtro, "-frames:v", str(n), *ENC, saida)
    return dur


def montar_um(V, it: dict, dur: list, comum: Path) -> None:
    """Um vídeo: as peças prontas de comum/pecas/, a abertura, a cena 1 com a legenda do território, a cena do dado
    (it["p4"], de cenas_dado) e a mistura do áudio (vozes, som dos clipes de comum/ e a música)."""
    vozes, tmp, _ = pastas(V)
    pecas_ = comum / "pecas"
    total = sum(dur) / FPS / VEL
    arq = lambda n: tmp / f"{it['slug']}-{n}"
    # cena 1: a peça pronta com a legenda deste território
    ass1 = arq("1.ass")
    ass1.write_text(ass(it["leg"][0], extra=it["extra"][0]), encoding="utf-8")
    ffmpeg("-i", pecas_ / "peca1.mp4", "-vf", filtro_ass(ass1), *ENC, arq("p1.mp4"))
    ab = abertura(V, it, vozes, arq("p0.mp4"), pecas_)
    total += ab
    lista = arq("lista.txt")
    partes = [arq("p0.mp4"), arq("p1.mp4"), pecas_ / "peca2.mp4", pecas_ / "peca3.mp4", it["p4"], pecas_ / "peca5.mp4", pecas_ / "peca6.mp4"]
    lista.write_text("\n".join(f"file '{str(p).replace(chr(92), '/')}'" for p in partes), encoding="utf-8")
    ffmpeg("-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", arq("video.mp4"))
    # áudio: vozes no começo de cada cena, som ambiente dos três clipes e a música
    entradas, filtros, mix = [], [], []

    def add(a):
        entradas.extend(["-i", str(a)])
        return len(entradas) // 2 - 1

    for i in range(6):
        n = add(voz_arquivo(vozes, it["texto"][i]))
        atraso = round((ab + inicio_final(dur, i) + ATRASO / FPS / VEL) * 1000)
        filtros.append(f"[{n}:a]atempo={VEL * it['extra'][i]:.4f},adelay={atraso}|{atraso}[v{i}]")
        mix.append(f"[v{i}]")
    n = add(voz_arquivo(vozes, it["abertura"]))
    filtros.append(f"[{n}:a]atempo={VEL:.4f},adelay=150|150[vab]")
    mix.append("[vab]")
    for i in range(3):
        n = add(comum / f"clip{i + 1}.mp4")
        vel, seg = min(1, CLIPES[i] / dur[i]), dur[i] / FPS / VEL
        atraso = round((ab + inicio_final(dur, i)) * 1000)
        filtros.append(f"[{n}:a]atempo={VEL * vel:.4f},atrim=0:{seg:.3f},afade=t=in:d=0.5,afade=t=out:st={seg - 0.6:.3f}:d=0.6,"
                       f"volume={AMBIENTE},adelay={atraso}|{atraso}[a{i}]")
        mix.append(f"[a{i}]")
    m = add(comum / "musica.mp3")
    filtros.append(f"[{m}:a]apad,atrim=0:{total:.2f},afade=t=in:d=2,afade=t=out:st={total - 4:.2f}:d=4,volume={MUSICA}[mu]")
    # a música (que vai até o fim) primeiro e duration=first: com longest o amix parava antes quando havia abertura
    filtros.append(f"[mu]{''.join(mix)}amix=inputs={len(mix) + 1}:duration=first:normalize=0,atrim=0:{total:.3f}[a]")
    ffmpeg(*entradas, "-filter_complex", ";".join(filtros), "-map", "[a]", "-c:a", "aac", "-b:a", "160k", arq("audio.m4a"))
    it["saida"].parent.mkdir(parents=True, exist_ok=True)
    ffmpeg("-i", arq("video.mp4"), "-i", arq("audio.m4a"), "-c", "copy", "-shortest", "-movflags", "+faststart", it["saida"])


def produzir(V, itens: list, raiz: Path, comum: Path) -> int:
    """Vozes, encaixe das falas, cenas do dado do lote inteiro (Remotion de uma vez, cache) e a montagem de cada item."""
    vozes, tmp, cache = pastas(V)
    for d in (vozes, tmp, cache):
        d.mkdir(parents=True, exist_ok=True)
    dur = json.loads((comum / "pecas" / "duracoes.json").read_text(encoding="utf-8"))["dur"]
    gerar_vozes(vozes, [*V.FIXAS.values(), *(t for it in itens for v in it["falas"].values() for t in v),
                        *(it["abertura"] for it in itens)])
    for it in itens:
        encaixa(V, it, vozes)
        for i in it["falas"]:
            if it["texto"][i] != it["falas"][i][0]:
                print(f"  {it['slug']}: fala {i + 1} encurtada ({it['texto'][i]})")
    cenas_dado(V, itens, raiz, dur[3])
    ok = 0
    for it in itens:
        t0 = time.time()
        try:
            if not it["p4"].exists():
                raise RuntimeError("a cena do dado não saiu do Remotion")
            montar_um(V, it, dur, comum)
            ok += 1
            print(f"  {it['slug']}: {it['saida']} (montagem {time.time() - t0:.0f} s)")
        except Exception as e:  # noqa: BLE001
            print(f"  {it['slug']}: falhou ({e})")
        finally:
            for f in tmp.glob(f"{it['slug']}-*"):
                f.unlink(missing_ok=True)
    return ok


def montar(V, slugs: list) -> int:
    """Exemplos no PC: os territórios de saida/territorios/ e as fotos de V.PUB, saída em V.SAIDA."""
    dd = V.carregar()
    itens = []
    for slug in slugs:
        ped = json.loads((RAIZ / "saida" / "territorios" / slug / "pedidos.json").read_text(encoding="utf-8"))
        foto = V.PUB / f"{slug.split('--')[0]}.jpg"
        if not foto.exists():
            print(f"  {slug}: falta a foto {foto.name}")
            continue
        itens.append({"slug": slug, "foto": foto, "saida": V.SAIDA / f"{slug}.mp4", "credito": credito_fundo(slug), **V.roteiro(ped, dd)})
    t0 = time.time()
    ok = produzir(V, itens, V.PUB, V.PUB)
    print(f"{ok} de {len(slugs)} em {time.time() - t0:.0f} s")
    return 0 if ok == len(slugs) else 1


# ---------------------------------------------------------------- fila (trabalhos/video-<x>.sh -> video_<x>.py)
def comuns(V, comum: Path) -> None:
    """Clipes, música e peças prontas: da pasta do Gui quando existem, senão do R2 da fila (uma vez por máquina)."""
    for nome in COMUNS:
        destino = comum / nome
        if destino.exists():
            continue
        destino.parent.mkdir(parents=True, exist_ok=True)
        local = V.PUB / nome
        if local.exists():
            shutil.copy2(local, destino)
            continue
        # User-Agent próprio: o Cloudflare do Worker responde 403 ao "Python-urllib" padrão
        pedido = urllib.request.Request(f"{FILA}/entradas/comum/{V.TRABALHO}/{nome}",
                                        headers={"User-Agent": f"videos-territorios/1.0 ({V.TRABALHO})"})
        with urllib.request.urlopen(pedido, timeout=120) as r:
            destino.write_bytes(r.read())


def trabalho(V, argv: list) -> int:
    """Item da fila: <entradas> <saidas> <slug ...> [--gl X --conc N]. Entradas por item (kit_fundos.py):
    <entradas>/<slug>/<slug>.json e <entradas>/<slug>/<cidade>.jpg; saída <saidas>/<slug>/<V.NOME>.mp4."""
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    # o ajudar.mjs passa as opções dele depois dos slugs (--gl swangle --conc 4): valor de opção não é slug
    pos = [x for k, x in enumerate(argv) if not x.startswith("--") and (k == 0 or not argv[k - 1].startswith("--"))]
    if len(pos) < 3:
        print(f"uso: video_{V.NOME}.py <entradas> <saidas> <slug ...>", file=sys.stderr)
        return 1
    ent, sai, slugs = Path(pos[0]).resolve(), Path(pos[1]), pos[2:]
    for op in ("--gl", "--conc"):
        if op in argv:
            OPCOES_RENDER.extend([op, argv[argv.index(op) + 1]])
    comum = VIDEO / "kit" / f"video-{V.NOME}" / "comum"
    comuns(V, comum)
    dd = V.carregar()
    itens = []
    for slug in slugs:
        try:
            d = json.loads((ent / slug / f"{slug}.json").read_text(encoding="utf-8"))
            foto = ent / slug / f"{slug.split('--')[0]}.jpg"
            if not foto.exists():
                raise FileNotFoundError("sem o fundo")
            credito = d.get("credito") if d.get("fundo") == "satelite" else None  # satélite: crédito na tela (kit_fundos.py)
            itens.append({"slug": slug, "foto": foto, "saida": sai / slug / f"{V.NOME}.mp4", "credito": credito, **V.roteiro(d["pedidos"], dd)})
        except Exception as e:  # noqa: BLE001
            print(f"  {slug}: entradas incompletas ({e})")
    if not itens:
        return 1
    return 0 if produzir(V, itens, ent, comum) == len(slugs) else 1


def subir(V) -> int:
    """Sobe ao R2 da fila os arquivos comuns (clipes, música, peças prontas), em comum/<trabalho>/."""
    import kit_fundos
    fila, token = os.environ.get("FILA_URL", kit_fundos.FILA_PADRAO).rstrip("/"), kit_fundos.segredo()
    for nome in COMUNS:
        kit_fundos.pedir(f"{fila}/kit/comum/{V.TRABALHO}/{nome}", "PUT", (V.PUB / nome).read_bytes(), "application/octet-stream", token)
        print("subiu", nome)
    return 0


def semear(V, args: list) -> int:
    """Cadastra e semeia o trabalho com todos os territórios do kit (todo município tem o vídeo: quem não tem número
    próprio fala o estado ou o Brasil). --simular só conta."""
    import kit_fundos
    terr = [t for t in kit_fundos.territorios([]) if not t.get("erro")]
    print(f"{len(terr)} territórios na fila de {V.TRABALHO}")
    fila = os.environ.get("FILA_URL", kit_fundos.FILA_PADRAO).rstrip("/")
    kit_fundos.TRABALHO = V.TRABALHO
    kit_fundos.DESCRICAO[V.TRABALHO] = V.DESCRICAO
    if "--simular" in args:
        return 0
    return kit_fundos.semear(terr, [], args, fila, kit_fundos.segredo())


def janelas(V, slugs: list) -> int:
    """Mede as falas variáveis nos territórios dados (para escolher JANELAS): duração de cada versão mais longa."""
    vozes, _, _ = pastas(V)
    dd = V.carregar()
    itens = [V.roteiro(json.loads((RAIZ / "saida" / "territorios" / s / "pedidos.json").read_text(encoding="utf-8")), dd) for s in slugs]
    gerar_vozes(vozes, [it["falas"][i][0] for it in itens for i in it["falas"]])
    for i in sorted(V.JANELAS):
        ds = sorted(fim_da_fala(legenda_de(it["falas"][i][0], vozes)) for it in itens)
        if ds:
            print(f"fala {i + 1}: {len(ds)} territórios, mediana {ds[len(ds) // 2]:.1f} s, p90 {ds[int(len(ds) * 0.9)]:.1f} s, "
                  f"máx {ds[-1]:.1f} s (janela atual {V.JANELAS[i]} s)")
    return 0


def main(V, doc: str) -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    a = sys.argv[1:]
    acoes = {"dados": lambda: V.dados(), "pecas": lambda: pecas(V), "subir": lambda: subir(V), "semear": lambda: semear(V, a[1:]),
             "montar": lambda: montar(V, a[1:]), "janelas": lambda: janelas(V, a[1:])}
    if a[:1] and a[0] in acoes and (a[0] not in ("montar", "janelas") or len(a) > 1):
        return acoes[a[0]]()
    print(doc)
    return 1
