# Trecho por cidade do vídeo de alerta do Bolsa Família em Pillow + ffmpeg, sem navegador (teste de 21/10/2026).
#   python video/bolsa_familia_pillow.py <pasta-entradas> <pasta-saida> <slug ...> [--paralelo N] [--pecas <pasta>] [--sem-foto]
# Desenha os textos e números da cidade por cima dos fundos prontos (renders/pecas/fundo-base.mp4 e fundo-pico.mp4,
# HyperFrames, uma vez só: fotos, nomes, faixa do topo, brilho), com as mesmas posições, tempos e curvas das cenas de
# video/alerta-bolsa-familia/compositions (card, dinheiro, fecho). O brilho dos impactos da cidade é a mistura dos dois
# fundos. Grava <saida>/<slug>-B.mp4 (17,6 s) e <slug>-D.mp4 (1,5 s + o último quadro parado, 4,4 s), já com os
# parâmetros de codificação da colagem (ENC de bolsa_familia_comum.mjs).
# Entradas por cidade: <pasta-entradas>/<slug>/dados.json (bolsa_familia_vozes.mjs).
import json
import math
import os
import subprocess
import sys
import time
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

VIDEO = Path(__file__).resolve().parent
PROJETO = VIDEO / "alerta-bolsa-familia"
PECAS = Path(sys.argv[sys.argv.index("--pecas") + 1]) if "--pecas" in sys.argv else PROJETO / "renders" / "pecas"
# fontes: as do projeto baixado com as peças (projeto.tar) ou as do repositório
FONTES = PECAS / "projeto" / "assets" / "fonts" if (PECAS / "projeto" / "assets" / "fonts").exists() else PROJETO / "assets" / "fonts"
FFMPEG = os.environ.get("FFMPEG") or "ffmpeg"  # a montagem passa o ffmpeg dela (o do sistema ou o ffmpeg-static)
S = 2 / 3                      # desenho em 1080x1920, saída em 720x1280
LARG, ALT, FPS = 720, 1280, 30
JANELAS = [(1.7, 528), (31.6, 45)]  # (início no vídeo, quadros): B e D, como em modelos/cidade.html
PARADO = 2.9                   # o último quadro de D fica parado até 36 s
ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
       "-r", str(FPS), "-g", "60", "-keyint_min", "60", "-sc_threshold", "0", "-an"]
COR = {"fundo": "#141414", "painel": "#1b1b1b", "texto": "#f4f1ea", "texto2": "#a8a8a8", "ouro": "#c99a06",
       "vermelho": "#b3121b", "vermelho2": "#ff4d4d", "bloco": "#2c2c2c", "branco": "#ffffff", "credito": "#8f8f8f"}
# métricas tipográficas (OS/2, USE_TYPO_METRICS: as que o Chrome usa), em em
METRICA = {"anton": (2409 / 2048, 674 / 2048), "archivo": (0.878, 0.210)}


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


# ---------------------------------------------------------------- curvas do GSAP
def curva(nome):
    if nome == "none":
        return lambda p: p
    if nome.startswith("back.out"):
        s = float(nome[9:-1]) if "(" in nome else 1.70158
        return lambda p: (p - 1) * (p - 1) * ((s + 1) * (p - 1) + s) + 1
    tipo, modo = nome.split(".")
    n = {"power1": 2, "power2": 3, "power3": 4, "power4": 5}[tipo]
    if modo == "out":
        return lambda p: 1 - (1 - p) ** n
    if modo == "in":
        return lambda p: p ** n
    return lambda p: (2 * p) ** n / 2 if p < 0.5 else 1 - (2 * (1 - p)) ** n / 2


class Pista:
    """Um valor animado: trechos (início, duração, de, até, curva, mostra o "de" antes de começar)."""

    def __init__(self, base):
        self.base, self.trechos = base, []

    def de_ate(self, ini, dur, de, ate, ease, imediato=True):
        self.trechos.append((ini, dur, de, ate, curva(ease), imediato))
        self._ord = False
        return self

    def ate(self, ini, dur, ate, ease):
        return self.de_ate(ini, dur, None, ate, ease, False)

    def em(self, t):
        v = self.base
        primeiro = True
        if not getattr(self, "_ord", False):
            self.trechos.sort(key=lambda x: x[0])
            self._ord = True
        for ini, dur, de, ate, f, imediato in self.trechos:
            if t < ini:
                if primeiro and imediato and de is not None:
                    v = de
                break
            primeiro = False
            de = v if de is None else de
            p = 1 if dur <= 0 else min(1, (t - ini) / dur)
            if isinstance(de, tuple):
                v = tuple(a + (b - a) * f(p) for a, b in zip(de, ate))
            else:
                v = de + (ate - de) * f(p)
        return v


# ---------------------------------------------------------------- texto
_fontes = {}


def fonte(familia, px, peso=400, largura=100):
    chave = (familia, round(px * S, 2), peso, largura)
    if chave not in _fontes:
        if familia == "anton":
            f = ImageFont.truetype(str(FONTES / "Anton-Regular.ttf"), px * S)
        else:
            f = ImageFont.truetype(str(FONTES / "Archivo.ttf"), px * S)
            f.set_variation_by_axes([peso, largura])
        _fontes[chave] = f
    return _fontes[chave]


def largura_txt(txt, f, espaco=0):
    return f.getlength(txt) + espaco * S * len(txt)


def linha_base(familia, px, alt_linha):
    """Distância do topo da caixa de linha até a linha de base, como o Chrome (meio-entrelinha)."""
    a, d = METRICA[familia]
    return (alt_linha - (a + d) * px) / 2 + a * px


class Sprite:
    """Imagem com a origem da caixa (canto de cima à esquerda, em px de saída) dentro dela."""

    def __init__(self, img, ox, oy, larg, alt):
        self.img, self.ox, self.oy, self.larg, self.alt = img, ox, oy, larg, alt


def sprite_texto(pedacos, familia, px, alt_linha=None, espaco=0, caixa=None, pad=(0, 0, 0, 0)):
    """pedacos: [(texto, cor, peso)]; uma linha. caixa: cor de fundo (tarja/etiqueta); pad em px de desenho (cima, dir, baixo, esq)."""
    alt_linha = px if alt_linha is None else alt_linha
    fs = [fonte(familia, px, peso) for _, _, peso in pedacos]
    larg = sum(largura_txt(t, f, espaco) for (t, _, _), f in zip(pedacos, fs))
    w, h = larg + (pad[1] + pad[3]) * S, (alt_linha + pad[0] + pad[2]) * S
    m = int(px * S * 0.7) + 4
    img = Image.new("RGBA", (int(math.ceil(w)) + 2 * m, int(math.ceil(h)) + 2 * m), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if caixa:
        d.rectangle([m, m, m + w - 1, m + h - 1], fill=rgb(caixa))
    x = m + pad[3] * S
    y = m + (pad[0] + linha_base(familia, px, alt_linha)) * S
    for (t, cor, _), f in zip(pedacos, fs):
        if espaco:
            for ch in t:
                d.text((x, y), ch, font=f, fill=rgb(cor), anchor="ls")
                x += f.getlength(ch) + espaco * S
        else:
            d.text((x, y), t, font=f, fill=rgb(cor), anchor="ls")
            x += f.getlength(t)
    return Sprite(img, m, m, w, h)


def quebrar(pedacos, familia, px, larg_max):
    """Quebra de linha por palavra (como o navegador) mantendo a cor/peso de cada pedaço."""
    palavras = []
    for t, cor, peso in pedacos:
        for i, p in enumerate(t.split(" ")):
            palavras.append((p, cor, peso, i > 0 or (palavras and t.startswith(" "))))
    linhas, atual, w = [], [], 0
    for p, cor, peso, _ in palavras:
        if not p:
            continue
        f = fonte(familia, px, peso)
        wp, esp = f.getlength(p), f.getlength(" ")
        if atual and w + esp + wp > larg_max * S:
            linhas.append(atual)
            atual, w = [], 0
        if atual:
            atual.append((" ", cor, peso))
            w += esp
        atual.append((p, cor, peso))
        w += wp
    if atual:
        linhas.append(atual)
    return linhas


def sprite_paragrafos(paragrafos, familia, larg, pad, fundo, raio):
    """Painel com parágrafos [(pedacos, px, alt_linha, margem_cima)], fundo arredondado."""
    blocos = [(quebrar(p, familia, px, larg - pad[1] - pad[3]), px, al, mt) for p, px, al, mt in paragrafos]
    alt = pad[0] + pad[2] + sum(len(l) * al + mt for l, px, al, mt in blocos)
    img = Image.new("RGBA", (int(math.ceil(larg * S)), int(math.ceil(alt * S))), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=raio * S, fill=rgb(fundo))
    y = pad[0]
    for linhas, px, al, mt in blocos:
        y += mt
        for linha in linhas:
            x = pad[3] * S
            yb = (y + linha_base(familia, px, al)) * S
            for t, cor, peso in linha:
                f = fonte(familia, px, peso)
                d.text((x, yb), t, font=f, fill=rgb(cor), anchor="ls")
                x += f.getlength(t)
            y += al
    return Sprite(img, 0, 0, img.width, img.height)


def fmt(n):
    return f"{round(n):,}".replace(",", ".")


# ---------------------------------------------------------------- elementos
class El:
    """Elemento na tela: caixa em (x, y) px de desenho, origem da transformação relativa à caixa, pistas animadas."""

    def __init__(self, sprite, x, y, origem=(0, 0), pai=None, janela=(0, 99), girar=0):
        self.sprite, self.x, self.y, self.origem, self.pai, self.janela = sprite, x, y, origem, pai, janela
        self.p = {k: Pista(v) for k, v in dict(x=0, y=0, s=1, sx=1, sy=1, op=1).items()}
        self.texto = None   # função t -> sprite (contadores)
        if girar:
            self.sprite = girado(sprite, girar)

    def afim(self, t):
        """Transformação até a tela: (a, c, b, d) com X = a*x + c, Y = b*y + d (x, y em px de saída da caixa)."""
        sx = self.p["s"].em(t) * self.p["sx"].em(t)
        sy = self.p["s"].em(t) * self.p["sy"].em(t)
        ox, oy = self.x * S + self.origem[0] * S, self.y * S + self.origem[1] * S
        dx, dy = self.p["x"].em(t) * S, self.p["y"].em(t) * S
        a, c = sx, ox - sx * ox + dx
        b, d = sy, oy - sy * oy + dy
        if self.pai:
            pa, pc, pb, pd = self.pai.afim(t)
            a, c, b, d = pa * a, pa * c + pc, pb * b, pb * d + pd
        return a, c, b, d

    def opacidade(self, t):
        op = max(0.0, min(1.0, self.p["op"].em(t)))
        return op * (self.pai.opacidade(t) if self.pai else 1)


def girado(sp, graus):
    img = sp.img.rotate(graus, resample=Image.BICUBIC, expand=False)
    return Sprite(img, sp.ox, sp.oy, sp.larg, sp.alt)


class Grupo(El):
    def __init__(self, janela):
        super().__init__(None, 0, 0, janela=janela)


def visivel(el, t):
    while el is not None:
        if not (el.janela[0] <= t < el.janela[1]):
            return False
        el = el.pai
    return True


def colar(quadro, el, t):
    if (el.sprite is None and el.texto is None) or not visivel(el, t):
        return
    op = el.opacidade(t)
    if op <= 0.002:
        return
    sp = el.texto(t) if el.texto else el.sprite
    a, c, b, d = el.afim(t)
    if a <= 0.01 or b <= 0.01:
        return
    img = sp.img
    # canto do sprite na tela: a caixa começa em (x, y); o sprite tem a margem (ox, oy)
    X = a * (el.x * S - sp.ox) + c
    Y = b * (el.y * S - sp.oy) + d
    if abs(a - 1) > 0.002 or abs(b - 1) > 0.002:
        img = img.resize((max(1, round(img.width * a)), max(1, round(img.height * b))), Image.BICUBIC)
        cor, mascara = img.convert("RGB"), img.getchannel("A")
    else:
        if getattr(sp, "_rgb", None) is None or sp._versao != id(sp.img) or getattr(sp, "_suja", False):
            sp._rgb, sp._a, sp._versao, sp._suja = sp.img.convert("RGB"), sp.img.getchannel("A"), id(sp.img), False
        cor, mascara = sp._rgb, sp._a
    if op < 0.998:
        mascara = mascara.point(lambda v: int(v * op))
    quadro.paste(cor, (round(X), round(Y)), mascara)


# ---------------------------------------------------------------- a cidade
def montar(dados):
    tela, T = dados["tela"], dados["tempos"]
    els = []
    um = tela["familias_n"] == 1

    # card (compositions/card.html), visível de 1,7 s em diante; some de 9,45 a 31,65 s
    gh = Grupo((1.7, 99))
    gh.p["y"].ate(9.45, 0.4, -60, "power2.in").de_ate(31.65, 0.5, 60, 0, "power3.out", False)
    gh.p["op"].ate(9.45, 0.4, 0, "power2.in").de_ate(31.65, 0.5, 0, 1, "power3.out", False)
    tag = f"{tela['cidade']} - {tela['uf']}".upper()
    larg_tag = lambda px: largura_txt(tag, fonte("anton", px)) / S + 44
    larg_eleito = largura_txt("COM FLÁVIO ELEITO", fonte("anton", 70)) / S
    tam_tag, duas = 56, larg_tag(56) + 26 + larg_eleito > 936
    if duas:
        while larg_tag(tam_tag) > 936 and tam_tag > 30:
            tam_tag -= 2
    sp_tag = sprite_texto([(tag, COR["fundo"], 400)], "anton", tam_tag, caixa=COR["ouro"], pad=(8, 22, 4, 22))
    alt_tag = tam_tag + 12
    if duas:
        y_tag, x_el, y_el = 716, 72, 716 + alt_tag + 14
    else:
        linha = max(alt_tag, 70)
        y_tag, x_el, y_el = 830 + (linha - alt_tag) / 2, 72 + larg_tag(tam_tag) + 26, 830 + (linha - 70) / 2
    e = El(sp_tag, 72, y_tag, origem=(larg_tag(tam_tag) / 2, alt_tag / 2), pai=gh, girar=2)
    e.p["s"].de_ate(2.5, 0.4, 0, 1, "back.out(2)")
    e.p["op"].de_ate(2.5, 0.4, 0, 1, "back.out(2)")
    els.append(e)
    e = El(sprite_texto([("COM FLÁVIO ELEITO", COR["texto"], 400)], "anton", 70), x_el, y_el, pai=gh)
    e.p["x"].de_ate(T["t_eleito"] - 0.04, 0.35, 80, 0, "power4.out")
    e.p["op"].de_ate(T["t_eleito"] - 0.04, 0.35, 0, 1, "power4.out")
    els.append(e)
    tam_num = 280
    while largura_txt(tela["familias"], fonte("anton", tam_num)) / S > 940 and tam_num > 120:
        tam_num -= 4
    alt_num = 0.92 * tam_num
    conta = max(0.6, T["t_fam"] - T["t_num"])
    e = El(None, 66, 924, origem=(0, alt_num), pai=gh)
    e.p["op"].de_ate(T["t_num"] - 0.1, 0.2, 0, 1, "none")
    e.p["s"].de_ate(T["t_num"] - 0.1, conta, 0.55, 1, "power3.out").de_ate(31.75, 0.5, 1.12, 1, "power3.out", False)
    els.append(contador(e, Pista(0).de_ate(T["t_num"] - 0.1, conta, 0, tela["familias_n"], "power3.out", False),
                        lambda v: fmt(v), "anton", tam_num, alt_num, COR["ouro"]))
    fam, podem = ("FAMÍLIA", "PODE PERDER O") if um else ("FAMÍLIAS", "PODEM PERDER O")
    f86 = fonte("anton", 86)
    w_fam = largura_txt(fam, f86) / S
    e = El(sprite_texto([(fam, COR["texto"], 400)], "anton", 86), 72, 1194, origem=(w_fam / 2, 43), pai=gh)
    e.p["s"].de_ate(T["t_fam"], 0.3, 1.35, 1, "power4.out")
    e.p["op"].de_ate(T["t_fam"], 0.3, 0, 1, "power4.out")
    els.append(e)
    e = El(sprite_texto([(podem, COR["texto"], 400)], "anton", 86), 72 + w_fam + largura_txt(" ", f86) / S, 1194, pai=gh)
    e.p["y"].de_ate(T["t_podem"] - 0.1, 0.4, 50, 0, "power3.out")
    e.p["op"].de_ate(T["t_podem"] - 0.1, 0.4, 0, 1, "power3.out")
    els.append(e)
    els += tarja("BOLSA FAMÍLIA", 104, (8, 28, 4, 28), 72, 1294, T["t_perder"] + 0.08, T["t_perder"] + 0.23, 30, gh)

    # dinheiro (compositions/dinheiro.html), de 9,6 a 19,3 s
    gd = Grupo((9.6, 19.3))
    gd.p["y"].ate(19.0, 0.3, -60, "power2.in")
    gd.p["op"].ate(19.0, 0.3, 0, "power2.in")
    rot = f"HOJE EM {tela['cidade']} - {tela['uf']}".upper()
    tam_rot = 34
    while largura_rotulo(rot, tam_rot) > 930 and tam_rot > 20:
        tam_rot -= 1
    e = El(sprite_rotulo(rot, tam_rot), 72, 250, pai=gd)
    e.p["x"].de_ate(9.75, 0.45, -60, 0, "power3.out")
    e.p["op"].de_ate(9.75, 0.45, 0, 1, "power3.out")
    els.append(e)
    fam_txt = "1 família" if um else f"{tela['familias']} famílias"
    verbo = " recebe o Bolsa Família" if um else " recebem o Bolsa Família"
    linhas = quebrar([(fam_txt, COR["ouro"], 700), (verbo, COR["texto"], 700)], "archivo", 52, 936)
    for i, l in enumerate(linhas):
        e = El(sprite_texto(l, "archivo", 52, alt_linha=52 * 1.18), 72, 306 + i * 52 * 1.18, pai=gd)
        e.p["y"].de_ate(9.95, 0.5, 30, 0, "power2.out")
        e.p["op"].de_ate(9.95, 0.5, 0, 1, "power2.out")
        els.append(e)
    # R$ + valor médio, alinhados pela linha de base (flex baseline), escala a partir do canto de baixo à esquerda
    lb_num, lb_rs = linha_base("anton", 300, 276), linha_base("anton", 120, 120)
    dv = max(0.6, T["t_valor_fim"] - T["t_valor"])
    gv = Grupo((9.6, 19.3))
    gv.x, gv.y, gv.origem, gv.pai = 66, 476, (0, 276), gd
    gv.p["op"].de_ate(T["t_valor"] - 0.08, 0.2, 0, 1, "none")
    gv.p["s"].de_ate(T["t_valor"] - 0.08, dv, 0.6, 1, "power3.out")
    w_rs = largura_txt("R$", fonte("anton", 120)) / S
    e = El(sprite_texto([("R$", COR["ouro"], 400)], "anton", 120), 66, 476 + lb_num - lb_rs, pai=gv)
    els.append(e)
    e = El(None, 66 + w_rs + 22, 476, pai=gv)
    els.append(contador(e, Pista(0).de_ate(T["t_valor"] - 0.08, dv, 0, tela["media_n"], "power3.out", False),
                        lambda v: fmt(v), "anton", 300, 276, COR["ouro"]))
    e = El(sprite_texto([("por mês, em média, para cada família", COR["texto2"], 600)], "archivo", 44, alt_linha=44 * 1.088), 72, 794, pai=gd)
    e.p["y"].de_ate(T["t_valor_fim"] + 0.15, 0.45, 20, 0, "power2.out")
    e.p["op"].de_ate(T["t_valor_fim"] + 0.15, 0.45, 0, 1, "power2.out")
    els.append(e)
    ini = T["t_total"] + 0.75
    passo = max(0.06, (T["t_menos"] - 0.1 - ini - 0.12) / 9)
    els += barra(906, 64, gd, lambda i: T["t_total"] - 0.3 + 0.04 * i, lambda i: ini + passo * i, COR["bloco"])
    leg_alt = 30 * 1.088
    e = El(sprite_texto([("todas as famílias atendidas", COR["texto2"], 600)], "archivo", 30, alt_linha=leg_alt), 72, 988 + (76 - leg_alt) / 2, pai=gd)
    e.p["op"].de_ate(T["t_total"] - 0.1, 0.4, 0, 1, "none")
    els.append(e)
    e = El(None, 0, 988, pai=gd)
    e.p["op"].de_ate(T["t_total"] - 0.1, 0.4, 0, 1, "none")
    els.append(contador(e, Pista(0).de_ate(ini, passo * 9 + 0.12, 0, tela["familias_n"], "none", False),
                        lambda v: "-" + fmt(v), "anton", 76, 76, COR["vermelho2"], direita=1008))
    foto = dados.get("foto") or {}
    if foto.get("credito"):
        els.append(El(sprite_texto([(foto["credito"], "#9a9a9a", 500)], "archivo", 22, alt_linha=22 * 1.088), 72, 1424, pai=gd))
    tam_tot = 160
    while largura_txt(tela["total"].upper(), fonte("anton", tam_tot)) / S > 940 and tam_tot > 80:
        tam_tot -= 4
    e = El(sprite_texto([(tela["total"].upper(), COR["texto"], 400)], "anton", tam_tot), 66, 1104, origem=(0, tam_tot / 2), pai=gd)
    e.p["s"].de_ate(T["t_total"] + 0.43, 0.35, 1.4, 1, "power4.out")
    e.p["op"].de_ate(T["t_total"] + 0.43, 0.35, 0, 1, "power4.out")
    els.append(e)
    w_mes = largura_txt("POR MÊS", fonte("anton", 72)) / S
    e = El(sprite_texto([("POR MÊS", COR["ouro"], 400)], "anton", 72), 72, 1296 + 5, pai=gd)
    e.p["y"].de_ate(T["t_mes"] - 0.25, 0.35, 30, 0, "power3.out")
    e.p["op"].de_ate(T["t_mes"] - 0.25, 0.35, 0, 1, "power3.out")
    els.append(e)
    els += tarja("A MENOS NA CIDADE", 72, (8, 22, 2, 22), 72 + w_mes + 24, 1296, T["t_menos"] - 0.07, T["t_menos"] + 0.03, 20, gd)

    # fecho (compositions/fecho.html), de 31,6 s em diante
    els += barra(1452, 34, None, lambda i: 32.0 + 0.03 * i, None, COR["vermelho"], janela=(31.6, 99))
    fam_nota = "a única família atendida" if um else f"todas as {tela['familias']} famílias atendidas"
    nota = (f"Segundo a própria campanha, Flávio Bolsonaro fará um corte linear de R$ 250 bilhões no orçamento. "
            f"Somado ao plano de transição de 2 anos para o Bolsa Família proposto por Daniella Marques, a simulação "
            f"considera que {fam_nota} em {tela['cidade']} sejam afetadas. Famílias e valor médio: MDS (MI Social), "
            f"folha de {tela['mes']}.")
    sp = sprite_paragrafos([
        ([("Simulação.", COR["texto"], 700), (" " + nota, COR["texto2"], 500)], 25, 25 * 1.38, 0),
        ([("Trilha: “Suspense and Tension”, 3minutetunes (CC BY 3.0)", COR["credito"], 500)], 22, 22 * 1.38, 12),
    ], "archivo", 936, (26, 30, 26, 30), COR["painel"], 8)
    e = El(sp, 72, 1512, janela=(31.6, 99))
    e.p["y"].de_ate(32.3, 0.5, 30, 0, "power2.out")
    e.p["op"].de_ate(32.3, 0.5, 0, 1, "power2.out")
    els.append(e)
    claroes = [T["t_fam"], T["t_perder"] + 0.1, T["t_total"] + 0.45, T["t_menos"], 31.7]
    return els, claroes


def largura_rotulo(txt, px):
    return largura_txt(txt, fonte("archivo", px, 800, 112.5), 0.1 * px) / S


def sprite_rotulo(txt, px):
    return sprite_texto([(txt, COR["ouro"], 800)], "archivo_rot", px, alt_linha=px * 1.088, espaco=0.1 * px)


def contador(el, pista, formato, familia, px, alt_linha, cor, direita=None):
    cache = {}

    def sprite(t):
        txt = formato(pista.em(t))
        if txt not in cache:
            cache[txt] = sprite_texto([(txt, cor, 400)], familia, px, alt_linha=alt_linha)
        return cache[txt]

    if direita is not None:  # alinhado à direita (contador negativo da barra)
        base = el

        def sprite_dir(t):
            sp = sprite(t)
            base.x = direita - sp.larg / S
            return sp
        el.texto = sprite_dir
    else:
        el.texto = sprite
    return el


def tarja(txt, px, pad, x, y, t_caixa, t_texto, desce, pai):
    caixa_larg = largura_txt(txt, fonte("anton", px)) / S + pad[1] + pad[3]
    caixa_alt = px + pad[0] + pad[2]
    img = Image.new("RGBA", (int(math.ceil(caixa_larg * S)), int(math.ceil(caixa_alt * S))), rgb(COR["vermelho"]) + (255,))
    caixa = El(Sprite(img, 0, 0, img.width, img.height), x, y, origem=(0, caixa_alt / 2), pai=pai)
    caixa.p["sx"].de_ate(t_caixa, 0.3, 0, 1, "power4.out")
    sp = sprite_texto([(txt, COR["branco"], 400)], "anton", px)
    texto = El(sp, x + pad[3], y + pad[0], pai=caixa)
    texto.p["y"].de_ate(t_texto, 0.25 if desce == 20 else 0.3, desce, 0, "power3.out")
    texto.p["op"].de_ate(t_texto, 0.25 if desce == 20 else 0.3, 0, 1, "power3.out")
    return [caixa, texto]


def barra(y, alt, pai, t_entra, t_cor, cor, janela=(9.6, 19.3)):
    cw = (936 - 90) / 10
    els = []
    for i in range(10):
        img = Image.new("RGBA", (max(1, round(cw * S)), max(1, round(alt * S))), rgb(cor) + (255,))
        e = El(Sprite(img, 0, 0, img.width, img.height), 72 + i * (cw + 10), y, origem=(cw / 2, alt), pai=pai, janela=janela)
        e.p["sy"].de_ate(t_entra(i), 0.3, 0, 1, "back.out(1.6)")
        if t_cor:
            e.cor = Pista(rgb(COR["bloco"])).de_ate(t_cor(i), 0.12, rgb(COR["bloco"]), rgb(COR["vermelho"]), "none", False)
        els.append(e)
    return els


# fonte do rótulo: Archivo 800, largura 112,5% (semi-expanded do CSS)
_fonte_orig = fonte


def fonte(familia, px, peso=400, largura=100):  # noqa: F811
    if familia == "archivo_rot":
        return _fonte_orig("archivo", px, 800, 112.5)
    return _fonte_orig(familia, px, peso, largura)


_linha_base_orig = linha_base


def linha_base(familia, px, alt_linha):  # noqa: F811
    return _linha_base_orig("archivo" if familia == "archivo_rot" else familia, px, alt_linha)


# ---------------------------------------------------------------- render de uma cidade
def ler_quadros(arq, quais=None):
    filtro = []
    if quais:  # faixas de quadros seguidos: between(n,a,b)+...
        faixas, ini = [], quais[0]
        for a_, b_ in zip(quais, quais[1:] + [None]):
            if b_ != a_ + 1:
                faixas.append(f"between(n\,{ini}\,{a_})")
                ini = b_
        filtro = ["-vf", "select='" + "+".join(faixas) + "'", "-fps_mode", "passthrough"]
    p = subprocess.Popen([FFMPEG, "-v", "error", "-i", str(arq), *filtro, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    n = LARG * ALT * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        yield Image.frombytes("RGB", (LARG, ALT), b)
    p.wait()


def gravador(arq, extra=()):
    return subprocess.Popen([FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{LARG}x{ALT}",
                             "-r", str(FPS), "-i", "-", *extra, *ENC, str(arq)], stdin=subprocess.PIPE)


def brilho(t, claroes):
    """Quanto do fundo "pico" entra (0 a 1): sobe em 0,08 s e cai em 0,9 s (power2.out), como fundo.html."""
    k = 0.0
    for f in sorted(claroes):
        if t < f:
            break
        if t < f + 0.08:
            k = k + (1 - k) * (t - f) / 0.08
        elif t < f + 0.98:
            k = (1 - (t - f - 0.08) / 0.9) ** 3
        else:
            k = 0.0
    return k


class Foto:
    """Foto da cidade atrás da cena do dinheiro (como #s3-fundo em dinheiro.html): opacidade 0,42, véu escuro em
    degradê, zoom lento de 1,04 a 1,12 a partir do centro; entra em 9,55 s e sai em 19,0 s. Tudo em operações do
    Pillow (C), sem contas por pixel em Python."""

    def __init__(self, arq):
        img = Image.open(arq).convert("RGB")
        w, h = img.size  # cobre o quadro (object-fit: cover), já 1,12x maior para o zoom máximo
        self.Z = 1.12
        W, H = round(LARG * self.Z), round(ALT * self.Z)
        esc = max(W / w, H / h)
        img = img.resize((round(w * esc), round(h * esc)), Image.LANCZOS)
        l, t = (img.width - W) // 2, (img.height - H) // 2
        self.img = img.crop((l, t, l + W, t + H))
        a = np.interp(np.linspace(0, 1, H), [0, 0.30, 0.62, 1.0], [0.92, 0.55, 0.55, 0.95])
        veu = np.zeros((H, W, 4), np.uint8)
        veu[..., :3] = 20
        veu[..., 3] = (a * 255 + 0.5).astype(np.uint8)[:, None]
        camada = self.img.convert("RGBA")
        camada.putalpha(107)  # 0,42
        self.camada = Image.alpha_composite(camada, Image.fromarray(veu, "RGBA"))
        self.op = Pista(0).de_ate(9.55, 0.7, 0, 1, "power2.out").ate(19.0, 0.3, 0, "power2.in")
        self.zoom = Pista(1.04).de_ate(9.55, 9.75, 1.04, 1.12, "none")
        self.ultima = (None, None)

    def aplicar(self, quadro, t):
        if not (9.6 <= t < 19.3):
            return
        o = self.op.em(t)
        if o <= 0.002:
            return
        q = round(t * FPS) // 3  # o zoom anda 0,03% por quadro: a camada é refeita a cada 3 quadros
        if self.ultima[0] != q:
            z = self.zoom.em(q * 3 / FPS)
            W, H = self.camada.size
            w, h = LARG * self.Z / z, ALT * self.Z / z  # região visível, em px da imagem já ampliada 1,12x
            c = self.camada.resize((LARG, ALT), Image.BILINEAR, box=((W - w) / 2, (H - h) / 2, (W + w) / 2, (H + h) / 2))
            self.ultima = (q, (c.convert("RGB"), c.getchannel("A")))
        cor, mascara = self.ultima[1]
        if o < 0.998:
            mascara = mascara.point(lambda v: int(v * o))
        quadro.paste(cor, (0, 0), mascara)


def cidade(args):
    ent, saida, slug = args
    t0 = time.time()
    dados = json.loads((Path(ent) / slug / "dados.json").read_text(encoding="utf-8"))
    els, claroes = montar(dados)
    foto = dados.get("foto") or {}
    arq_foto = Path(ent) / slug / foto["arquivo"] if foto.get("arquivo") else None
    camada = Foto(arq_foto) if arq_foto and arq_foto.exists() and "--sem-foto" not in sys.argv else None
    tempos = [ini + q / FPS for ini, n in JANELAS for q in range(n)]
    com_pico = [i for i, t in enumerate(tempos) if brilho(t, claroes) >= 0.003]
    base = ler_quadros(PECAS / "fundo-base.mp4")
    pico = ler_quadros(PECAS / "fundo-pico.mp4", com_pico) if com_pico else iter(())
    i_quadro = 0
    for (ini, n), nome in zip(JANELAS, ["B", "D"]):
        g = gravador(Path(saida) / f"{slug}-{nome}.mp4", ["-vf", f"tpad=stop_mode=clone:stop_duration={PARADO}"] if nome == "D" else [])
        for q in range(n):
            t = ini + q / FPS
            fb = next(base)
            k = brilho(t, claroes)
            quadro = fb if k < 0.003 else Image.blend(fb, next(pico, fb), k)
            i_quadro += 1
            if camada:
                camada.aplicar(quadro, t)
            for el in els:
                if hasattr(el, "cor"):
                    c = tuple(int(round(v)) for v in el.cor.em(t))
                    if getattr(el, "cor_atual", None) != c:
                        el.sprite.img.paste(c + (255,), (0, 0, *el.sprite.img.size))
                        el.sprite._suja = True
                        el.cor_atual = c
                colar(quadro, el, t)
            g.stdin.write(quadro.tobytes())
        g.stdin.close()
        if g.wait() != 0:
            raise RuntimeError(f"ffmpeg falhou em {slug}-{nome}")
    return slug, time.time() - t0


def main():
    a = sys.argv[1:]
    par = int(a[a.index("--paralelo") + 1]) if "--paralelo" in a else max(1, (os.cpu_count() or 4) // 2)
    pos = [x for i, x in enumerate(a) if not x.startswith("--") and not (i and a[i - 1] in ("--paralelo", "--pecas"))]
    ent, saida, slugs = pos[0], pos[1], pos[2:]
    Path(saida).mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    with Pool(min(par, len(slugs))) as pool:
        for slug, dt in pool.imap_unordered(cidade, [(ent, saida, s) for s in slugs]):
            print(f"  {slug}: {dt:.1f} s", flush=True)
    print(f"{len(slugs)} cidades em {time.time() - t0:.1f} s")


if __name__ == "__main__":
    main()
