"""Abertura padrão dos vídeos de história por território (aprovada em 21/10/2026; ideia do Gabriel, "Entenda por quê"
do chefe): uns 6 s antes da história, sobre o 1º quadro do clipe 1 escurecido, com voz: "Atenção, morador do Capão
Redondo: o <programa> está ameaçado. Entenda por quê." O 1º quadro (a prévia do WhatsApp) já traz o cartão inteiro com a
cidade; do 2º em diante as partes entram com a fala. Nasceu no maismedicos.py; serve a qualquer vídeo em Python e, pela
linha de comando, aos que montam em Node (insulina):

  python video/abertura.py <pedidos.json>
  pedidos.json: {"vozes": <pasta das vozes>, "selo": "A FARMÁCIA POPULAR ESTÁ AMEAÇADA", "palavra_selo": "farmácia",
                 "itens": [{"abertura", "morador", "morador_fala", "local", "primeiro": <mp4 da cena 1>, "saida": <mp4>}]}
  escreve cada saída e imprime {saida: duração em segundos} em JSON.

Item: abertura = texto da voz; morador = "de São Paulo" (o cartão da prévia, sempre a cidade); morador_fala = como a voz
diz ("do Capão Redondo"); local = "São Paulo - SP" (a etiqueta do topo, só quando a voz diz o bairro). Depois, na
mistura do áudio: a voz da abertura a 150 ms, as outras vozes e o som dos clipes deslocados pela duração, e a música
como 1ª entrada do amix com apad e duration=first (com longest o amix parava antes e o -shortest cortava o fim).
"""
import json
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pedemeia_comum as C  # noqa: E402  (voz, legenda ASS, codificação e tempos comuns)
from pedemeia_comum import _tempo  # noqa: E402


# ---------------------------------------------------------------- abertura (aprovada em 21/10; ideia do Gabriel: a
# pessoa desengajava antes da história esquentar): uns 6 s antes da história, no primeiro quadro do clipe 1 escurecido,
# com voz ("Atenção, morador do bairro X: o Mais Médicos está ameaçado. Entenda por quê.").
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


def abertura(it: dict, saida: Path, primeiro: Path, vozes: Path, selo: str, palavra_selo: str) -> float:
    """Abertura com voz sobre o primeiro quadro do clipe 1 escurecido. O cartão (ATENÇÃO, MORADOR DE <CIDADE>, O MAIS
    MÉDICOS ESTÁ AMEAÇADO) já está inteiro no 1º quadro, que é a prévia do WhatsApp (Gui, 21/10: a cidade, não o
    bairro, em toda prévia). Do 2º quadro em diante as partes entram de novo com a fala: o morador como a voz diz e,
    quando ela diz o bairro, a etiqueta "Cidade - UF" no topo; o "Entenda por quê" por último. Devolve a duração em segundos (tempo final)."""
    leg = C.legenda_de(it["abertura"], vozes)
    dur = round((0.15 + C.fim_da_fala(leg) / C.VEL + 0.45) * C.FPS) / C.FPS
    quando = lambda alvo, resto: 0.15 + next((t for t, _d, p in leg if p.lower().startswith(alvo)), C.fim_da_fala(leg) * resto) / C.VEL
    t_selo, t_entenda = quando(palavra_selo.lower(), 0.5), quando("entenda", 0.8)
    if _largura(selo, 60, 1) > 700:   # não cabe numa linha ("A FARMÁCIA POPULAR ESTÁ AMEAÇADA"): duas, quebrando perto do meio
        p = selo.split()
        k = min(range(1, len(p)), key=lambda k: abs(len(" ".join(p[:k])) - len(" ".join(p[k:]))))
        selo = " ".join(p[:k]) + "\\N" + " ".join(p[k:])
    q1 = 0.03   # o 1º quadro (1/30 s; o ASS conta em centésimos)
    quadro = saida.with_suffix(".jpg")
    C.ffmpeg("-i", primeiro, "-frames:v", "1", "-q:v", "2", quadro)
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
        f"Dialogue: 1,{_tempo(0)},{_tempo(q1)},Selo,,0,0,0,,{{\\pos(360,765)\\frz3}}{selo}",
        # quem dá o play vê as partes entrando com a fala
        f"Dialogue: 1,{_tempo(q1 + 0.05)},{fim},Grande,,0,0,0,,{{\\pos(360,470)\\fscx160\\fscy160\\t(0,180,\\fscx100\\fscy100)}}ATENÇÃO",
        *ev_local,
        f"Dialogue: 1,{_tempo(0.45)},{fim},Morador,,0,0,0,,{{\\pos(360,615)\\fad(150,0)}}{morador_fala}",
        f"Dialogue: 1,{_tempo(t_selo)},{fim},Selo,,0,0,0,,{{\\pos(360,765)\\frz3\\fscx140\\fscy140\\t(0,150,\\fscx100\\fscy100)}}{selo}",
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


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ped = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    vozes = Path(ped["vozes"])
    C.gerar_vozes(vozes, [it["abertura"] for it in ped["itens"]])
    out = {}
    for it in ped["itens"]:
        out[it["saida"]] = abertura(it, Path(it["saida"]), Path(it["primeiro"]), vozes, ped["selo"], ped["palavra_selo"])
    print(json.dumps(out))
