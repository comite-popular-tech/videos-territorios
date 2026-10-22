"""Pedaços da abertura padrão (aprovada em 21/10 no Mais Médicos) que o vídeo "O dinheiro que gira" (INSS) usa: cores,
estilos do ASS e a etiqueta "Cidade - UF" no topo. Cópia própria do que era do maismedicos.py (até 22/10), para o INSS
não quebrar quando o Mais Médicos muda (em 22/10 esses nomes foram para o abertura.py e o trabalho da fila parou).
"""
import unicodedata

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
