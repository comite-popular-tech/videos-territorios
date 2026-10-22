"""Cena do dado da cidade do vídeo "Escola ou bico" (Pé-de-Meia), desenhada em Pillow e encodada pelo ffmpeg, sem Chrome.
Replica o 'pdm_dado' de src/InfoPeDeMeia.tsx: a foto da cidade inteira com o alfinete e o nome, depois o cartão claro
sobe com o contador de estudantes e um cofrinho que enche até o dinheiro dos últimos 12 meses. As medidas são as do
Remotion (1080x1920) multiplicadas por S; desenha direto em 720x1280, no tempo de render (30 fps, antes do 1,25x).
Mesma técnica do video/prototipos/cena4_pillow.py (insulina), que saiu praticamente igual ao Remotion.

Uso pela montagem: desenhar(foto, dado, dur, saida, ass_arq) grava a peça já acelerada, com a legenda e os parâmetros
de codificação das outras peças. Teste solto:
  python video/pedemeia_cena4.py <foto.jpg> <saida.mp4> [--local "São Paulo - SP"] [--estudantes 140697] [--valor 329391750]
"""
import math
import os
import subprocess
import sys
from multiprocessing import Pool
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pedemeia_comum as C  # noqa: E402

S = C.LARG / 1080
W, H, FPS, FUSAO = C.LARG, C.ALT, C.FPS, 18
FUNDO, VERDE, VERMELHO, CARTAO, BRANCO, AMARELO = (11, 17, 32), (22, 163, 74), (220, 38, 38), (247, 244, 236), (255, 255, 255), (245, 179, 1)
ROSA, ROSA_ESC, ROSA_BORDA, OLHO, OURO = (244, 182, 196), (229, 143, 163), (201, 104, 127), (138, 58, 78), (176, 125, 0)
ARCHIVO = str(C.FONTES / "Archivo-Condensed-Black.ttf")
MONT_B, MONT_M = str(C.FONTES / "Montserrat-Bold.ttf"), str(C.FONTES / "Montserrat-Medium.ttf")
_fontes, _cache = {}, {}
FOTO = None


def px(v):
    return v * S


def fonte(arq, tam):
    k = (arq, tam)
    if k not in _fontes:
        _fontes[k] = ImageFont.truetype(arq, round(px(tam)))
    return _fontes[k]


def spring(frame, damping=10, stiffness=100, mass=1):
    """Igual ao spring() do Remotion (de 0 a 1, velocidade inicial 0), solução analítica."""
    if frame <= 0:
        return 0.0
    t = frame / FPS
    zeta = damping / (2 * math.sqrt(stiffness * mass))
    w0 = math.sqrt(stiffness / mass)
    if zeta < 1:
        w1 = w0 * math.sqrt(1 - zeta ** 2)
        return 1 - math.exp(-zeta * w0 * t) * (math.cos(w1 * t) + zeta * w0 / w1 * math.sin(w1 * t))
    return 1 - math.exp(-w0 * t) * (1 + w0 * t)


def lerp(f, a, b, ya, yb, ease=None):
    x = min(1, max(0, (f - a) / (b - a)))
    return ya + (yb - ya) * (ease(x) if ease else x)


ease_out_cubic = lambda x: 1 - (1 - x) ** 3
ease_in_out_cubic = lambda x: 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def numero(v):
    """'576', '141 mil', '1,2 milhão': o número do cartão no mesmo arredondamento da fala."""
    if v < 1000:
        return str(round(v)), ""
    if v < 1e6:
        return f"{round(v / 1000):,}".replace(",", "."), "mil"
    m = round(v / 1e5) / 10
    s = f"{m:.1f}".replace(".", ",").removesuffix(",0")
    return s, "milhão" if m < 2 else "milhões"


def dinheiro(v):
    """'R$ 642 mil', 'R$ 329 milhões', 'R$ 1,2 bilhão' (de R$ 1 bilhão para cima, sempre bilhões)."""
    if v < 1e6:
        return f"R$ {round(v / 1000):,} mil".replace(",", ".")
    if v < 1e9:
        return f"R$ {round(v / 1e6):,} {'milhão' if v < 2e6 else 'milhões'}".replace(",", ".")
    b = round(v / 1e8) / 10
    return f"R$ {b:.1f}".replace(".", ",").removesuffix(",0") + (" bilhão" if b < 2 else " bilhões")


def largura(d, s, fnt, esp=0):
    return d.textlength(s, font=fnt) + px(esp) * max(0, len(s) - 1)


def texto_espacado(d, xy, s, fnt, fill, esp=0):
    x, y = xy
    for ch in s:
        d.text((x, y), ch, font=fnt, fill=fill)
        x += d.textlength(ch, font=fnt) + px(esp)


def quebra(d, s, fnt, larg):
    linhas, atual = [], ""
    for p in s.split(" "):
        t = (atual + " " + p).strip()
        if atual and largura(d, t, fnt) > larg:
            linhas.append(atual)
            atual = p
        else:
            atual = t
    return linhas + [atual]


def alfinete(tam, cor):
    s = 4
    w, h = round(px(tam) * s), round(px(tam) * 1.33 * s)
    u = w / 24
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, 24 * u, 24 * u), fill=cor)
    d.polygon([(0.8 * u, 15 * u), (12 * u, 32 * u), (23.2 * u, 15 * u)], fill=cor)
    d.ellipse((7 * u, 7 * u, 17 * u, 17 * u), fill=BRANCO + (255,))
    return im.resize((w // s, h // s), Image.LANCZOS)


def com_alpha(im, k):
    im = im.copy()
    im.putalpha(im.split()[3].point(lambda a: int(a * k)))
    return im


def sombra(im, raio, dy, alpha):
    raio = round(px(raio))
    base = Image.new("RGBA", (im.width + 4 * raio, im.height + 4 * raio + abs(dy)), (0, 0, 0, 0))
    base.paste((0, 0, 0, 255), (2 * raio, 2 * raio + max(0, dy)), im.split()[3].point(lambda a: int(a * alpha)))
    return base.filter(ImageFilter.GaussianBlur(raio))


def cacheado(k, fazer):
    if k not in _cache:
        _cache[k] = fazer()
    return _cache[k]


def cofrinho(tam, nivel, moeda):
    """O cofrinho do InfoPeDeMeia.tsx (viewBox 200x160), desenhado em 3x e reduzido; nivel e moeda de 0 a 1."""
    s = 3
    w = round(px(tam) * s)
    u = w / 200
    im = Image.new("RGBA", (w, round(160 * u)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    b = lambda *v: [x * u for x in v]
    if 0 < moeda < 1:
        cy = -30 + 70 * moeda
        d.ellipse(b(84, cy - 16, 116, cy + 16), fill=AMARELO, outline=OURO, width=round(4 * u))
    d.rounded_rectangle(b(52, 138, 74, 158), radius=6 * u, fill=ROSA_ESC)
    d.rounded_rectangle(b(126, 138, 148, 158), radius=6 * u, fill=ROSA_ESC)
    d.polygon(b(150, 62, 170, 40, 166, 70), fill=ROSA_ESC)
    corpo = b(22, 34, 178, 150)
    d.ellipse(corpo, fill=ROSA)
    # o dourado enche o corpo de baixo para cima (recorte pela elipse)
    mascara = Image.new("L", im.size, 0)
    ImageDraw.Draw(mascara).ellipse(corpo, fill=255)
    topo = (150 - 116 * nivel) * u
    faixa = Image.new("L", im.size, 0)
    ImageDraw.Draw(faixa).rectangle((0, topo, im.width, im.height), fill=int(255 * 0.9))
    ouro = Image.new("RGBA", im.size, AMARELO + (255,))
    ouro.putalpha(ImageChops.darker(mascara, faixa))
    im.alpha_composite(ouro)
    d = ImageDraw.Draw(im)
    d.ellipse(corpo, outline=ROSA_BORDA, width=round(5 * u))
    d.ellipse(b(162, 72, 194, 112), fill=ROSA_ESC, outline=ROSA_BORDA, width=round(4 * u))
    d.ellipse(b(171, 85, 177, 91), fill=OLHO)
    d.ellipse(b(179, 93, 185, 99), fill=OLHO)
    d.ellipse(b(140, 68, 152, 80), fill=(43, 27, 32))
    d.rounded_rectangle(b(80, 30, 120, 38), radius=4 * u, fill=OLHO)
    return im.resize((im.width // s, im.height // s), Image.LANCZOS)


def preparar(foto_arq):
    """Cada processo carrega a foto já em 'cover' 720x1280 uma vez só."""
    global FOTO
    foto = Image.open(foto_arq).convert("RGB")
    r = max(W / foto.width, H / foto.height)
    FOTO = foto.resize((math.ceil(foto.width * r), math.ceil(foto.height * r)), Image.LANCZOS)


def quadro(args):
    f, dur, local, estudantes, valor12m, ano, fonte_txt = args
    foto = FOTO
    im = Image.new("RGBA", (W, H), FUNDO + (255,))
    z = lerp(f, 0, 220, 1.0, 1.1)
    cw, ch = W / z, H / z
    cx, cy = foto.width / 2, foto.height / 2
    im.paste(foto.crop((int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2))).resize((W, H), Image.BILINEAR))
    sobe = spring(f - 30, 18, 90)
    if sobe > 0:
        im.alpha_composite(Image.new("RGBA", (W, H), FUNDO + (int(255 * 0.25 * sobe),)))

    # cartão claro que sobe (a sombra é sempre a mesma: desenhada uma vez)
    topo = px(lerp(sobe, 0, 1, 1920, 600))
    if topo < H - 1:
        def faz_cartao():
            c = Image.new("RGBA", (W, round(px(200))), (0, 0, 0, 0))
            ImageDraw.Draw(c).rounded_rectangle((px(30), px(100), W - px(30), px(400)), radius=px(44), fill=(0, 0, 0, 255))
            return sombra(c, 25, round(px(-20)), 0.35)
        sb = cacheado("sombra-cartao", faz_cartao)
        desl = round(px(50)) + round(px(20))
        im.alpha_composite(sb, (-round(px(50)), int(topo) - round(px(100)) - desl))
        ImageDraw.Draw(im).rounded_rectangle((px(30), topo, W - px(30), H + px(40)), radius=px(44), fill=CARTAO + (255,))
    d = ImageDraw.Draw(im)

    # número e unidade
    conta = lerp(f, 42, 95, 0, estudantes, ease_out_cubic)
    num, unid = numero(estudantes if f >= 95 else conta)
    fA, fU = fonte(ARCHIVO, 200), fonte(ARCHIVO, 96)
    ln = largura(d, num, fA)
    lu = largura(d, " " + unid, fU) if unid else 0
    x0, y0 = (W - ln - lu) / 2, topo + px(34)
    d.text((x0, y0), num, font=fA, fill=FUNDO)
    if unid:
        d.text((x0 + ln, y0 + px((200 - 96) * 0.92)), " " + unid, font=fU, fill=VERDE)

    # "estudantes receberam o [Pé-de-Meia]" / "em 2026"
    fM = fonte(MONT_B, 44)
    lh = px(55)
    y1 = y0 + px(200 * 0.92 + 14)
    a, b = ("estudante recebeu o " if estudantes == 1 else "estudantes receberam o "), "Pé-de-Meia"
    la, lb = largura(d, a, fM), largura(d, b, fM)
    x1 = (W - la - lb - px(28)) / 2
    d.text((x1, y1), a, font=fM, fill=FUNDO)
    d.rounded_rectangle((x1 + la, y1 - px(2), x1 + la + lb + px(28), y1 + lh - px(2)), radius=px(10), fill=VERDE)
    d.text((x1 + la + px(14), y1), b, font=fM, fill=BRANCO)
    s2 = f"em {ano}"
    d.text(((W - largura(d, s2, fM)) / 2, y1 + lh), s2, font=fM, fill=FUNDO)

    # cofrinho que enche e o dinheiro de 12 meses
    nivel = lerp(f, 92, 150, 0.05, 0.92, ease_in_out_cubic)
    moeda = lerp(f, 86, 104, 0, 1)
    porco = cofrinho(300, round(nivel, 3), round(moeda, 3))
    y2 = y1 + 2 * lh + px(30)
    im.alpha_composite(porco, (int((W - porco.width) / 2), int(y2)))
    valor = lerp(f, 130, 146, 0, 1)
    if valor > 0:
        fV, fN = fonte(ARCHIVO, 84), fonte(MONT_B, 46)
        sv, sn = dinheiro(valor12m), "nos últimos 12 meses"
        y3 = y2 + porco.height + px(10) + (1 - valor) * px(20)
        cam = Image.new("RGBA", (W, round(px(160))), (0, 0, 0, 0))
        dd = ImageDraw.Draw(cam)
        dd.text(((W - largura(d, sv, fV)) / 2, 0), sv, font=fV, fill=VERDE + (int(255 * valor),))
        dd.text(((W - largura(d, sn, fN)) / 2, px(84 * 0.92 + 8)), sn, font=fN, fill=FUNDO + (int(255 * valor),))
        im.alpha_composite(cam, (0, int(y3)))

    # fonte do dado (até 960 px de largura, centrada, bottom 300)
    fF = fonte(MONT_M, 24)
    lns = quebra(d, fonte_txt, fF, px(960))
    alt = round(px(30) * len(lns))
    cam = Image.new("RGBA", (W, alt), (0, 0, 0, 0))
    dd = ImageDraw.Draw(cam)
    for i, ln_ in enumerate(lns):
        dd.text(((W - largura(d, ln_, fF)) / 2, i * px(30)), ln_, font=fF, fill=FUNDO + (int(255 * 0.55),))
    im.alpha_composite(cam, (0, int(H - px(300) - alt)))

    # alfinete e rótulo da cidade
    pinoY = px(lerp(sobe, 0, 1, 760, 300))
    pino, rotulo = spring(f - 6, 9, 140), spring(f - 16, 16)
    if pino > 0:
        alf = cacheado("alfinete", lambda: alfinete(84, VERMELHO + (255,)))
        sb = cacheado("sombra-alfinete", lambda: sombra(alf, 12, round(px(10)), 0.45))
        k = min(1, pino * 3)
        ax, ay = int(W / 2 - alf.width / 2), int(pinoY - px(120) + (1 - pino) * px(-260))
        m = round(px(12)) * 2
        im.alpha_composite(sb if k == 1 else com_alpha(sb, k), (ax - m, ay - m))
        im.alpha_composite(alf if k == 1 else com_alpha(alf, k), (ax, ay))
    if rotulo > 0:
        fR = fonte(ARCHIVO, 72)
        txt = local.upper()
        bw, bh = int(largura(d, txt, fR, 2) + px(60)), int(px(72 * 0.92 + 22))
        rot = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        dr = ImageDraw.Draw(rot)
        dr.rounded_rectangle((0, 0, bw - 1, bh - 1), radius=px(14), fill=FUNDO + (int(255 * 0.82),))
        texto_espacado(dr, (px(30), px(4)), txt, fR, BRANCO + (255,), 2)
        esc = lerp(rotulo, 0, 1, 0.85, 1)
        rw, rh = max(1, int(bw * esc)), max(1, int(bh * esc))
        if esc < 1:
            rot = rot.resize((rw, rh), Image.LANCZOS)
        if rotulo < 1:
            rot = com_alpha(rot, rotulo)
        im.alpha_composite(rot, (int(W / 2 - rw / 2), int(pinoY - px(120) + px(112 + 14) + (bh - rh) / 2)))

    # entrada e saída escurecendo, como nas outras peças
    op = min(lerp(f, 0, FUSAO, 0, 1), lerp(f, dur - FUSAO, dur, 1, 0))
    if op < 1:
        im = Image.blend(Image.new("RGBA", (W, H), FUNDO + (255,)), im, op)
    return im.convert("RGB").tobytes()


def desenhar(foto_arq, dado: dict, dur: int, saida, ass_arq=None, proc: int = 4, credito: str = None) -> None:
    """Grava a cena no tempo final (1,25x), com a legenda e os parâmetros de codificação das outras peças. credito: o do
    fundo de satélite, que vai na linha da fonte."""
    filtros = [f"setpts=PTS/{C.VEL}", f"fps={FPS}"] + ([C.filtro_ass(ass_arq)] if ass_arq else [])
    ff = subprocess.Popen([C.FFMPEG, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                           "-i", "-", "-vf", ",".join(filtros), *C.ENC, str(saida)], stdin=subprocess.PIPE)
    fonte_txt = C.FONTE_DADO + (f" · {credito}" if credito else "")
    tarefas = [(f, dur, dado["local"], dado["estudantes"], dado["valor12m"], dado["ano"], fonte_txt) for f in range(dur)]
    with Pool(proc, initializer=preparar, initargs=(str(foto_arq),)) as pool:
        for b in pool.imap(quadro, tarefas, chunksize=4):
            ff.stdin.write(b)
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError(f"ffmpeg falhou na cena do dado: {saida}")


if __name__ == "__main__":
    import time
    a = sys.argv[1:]
    opc = lambda n, d: a[a.index(n) + 1] if n in a else d
    t0 = time.time()
    desenhar(a[0], {"local": opc("--local", "São Paulo - SP"), "estudantes": int(opc("--estudantes", 140697)),
                    "valor12m": int(opc("--valor", 329391750)), "ano": 2026}, int(opc("--dur", 200)), a[1], proc=int(opc("--proc", os.cpu_count() or 4)))
    print(f"{time.time() - t0:.1f} s")
