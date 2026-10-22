"""O que o vídeo "O dinheiro que gira" (INSS, roteiro 3 de video/roteiros-narracao.md) tem em comum entre as peças
prontas e a montagem por território (inss.py): o roteiro, os tempos das cenas e os textos fixos.

Molde do Mais Médicos (maismedicos_comum.py): voz, legenda em ASS e parâmetros de codificação do pedemeia_comum.py; os
infográficos no Remotion (src/InfoInss.tsx, renderizados por inss_render.mjs com um bundle só).

Cenas (índice 0 a 5):            vídeo                                    fala
  0 padaria do Beto               clipe 1 do Flow, peça sem legenda        muda (bairro e cidade)
  1 feira: a nota passa adiante   clipe 2 do Flow, peça com legenda        fixa
  2 rua comercial cheia           clipe 3 do Flow, peça com legenda        fixa ("o bairro inteiro" ou "a cidade inteira")
  3 dado                          Remotion por território (inss_dado)      muda (aposentados e R$ por mês da cidade)
  4 salário mínimo e corte        Remotion, peça com legenda               fixa
  5 compartilhe                   Remotion, peça com legenda               fixa

O dado é sempre da cidade (todo município tem aposentado do INSS): o vídeo de um bairro fala da cidade, como o card p5.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lugar_falado  # noqa: E402  ("no Capão Redondo", "na Vila Prudente": nunca "no bairro X")
from pedemeia_comum import (ALT, ATRASO, ENC, ESTADOS, FOLGA, FONTES, FPS, LARG, RESPIRO_FINAL, VEL, VIDEO,  # noqa: E402,F401
                            ass, ffmpeg, filtro_ass, fim_da_fala, gerar_vozes, legenda_de, limpa, voz_arquivo)

MUSICA, AMBIENTE = 0.25, 0.35
CLIPES = [240, 240, 240]                  # frames dos clipes do Flow (8 s cada)
JANELAS = {0: 8.0, 3: 9.5}                # janela das falas que mudam, em segundos de render (piloto: fala 1 de 7,2 a 8,3 s; fala 4 de 10,0 a 10,7 s)
EXTRA_MAX = 1.3
FIXAS = {
    1: "O Beto paga o queijo da produtora, que paga a costureira, que compra caderno na papelaria.",
    2: "É o mesmo dinheiro girando o bairro inteiro.",
    # 1ª frase pedida no grupo (Felipe, Jane e Gui, 22/10): ligar a aposentadoria ao salário mínimo, "ajustada junto com"
    4: "A aposentadoria é ajustada junto com o salário mínimo. Com Lula, ele subiu quase 12 por cento acima da inflação. "
       "Com Bolsonaro, pouco mais de 1. Flávio Bolsonaro planeja cortar até 250 bilhões, e os aposentados ficam em risco.",
    5: "Compartilhe com os aposentados da sua família.",
}
CENA3_CIDADE = "É o mesmo dinheiro girando a cidade inteira."   # cidade sem bairro na fala 1
FONTE_DADO = "Aposentadorias e valor mensal do INSS em dez/2025 (Ministério da Previdência)"
FONTE_CORTE = "Salário mínimo: decretos de 2019 a 2026 e INPC (IBGE) · Plano de até R$ 250 bi: Folha de S.Paulo, out/2026"
PUB = VIDEO / "public" / "inss"
NOMES_UF = {uf: n[1] for uf, n in ESTADOS.items()}


def reais_falado(v: float) -> str:
    """'388 mil reais', '1 milhão e 400 mil reais', '5 bilhões e 700 milhões de reais' (de 1 bilhão para cima é
    sempre bilhão; mesmo arredondamento do card: R$ 1,4 milhão, R$ 5,7 bi)."""
    if v < 1e6:
        return f"{round(v / 1000)} mil reais"
    if v < 1e7:
        m, r = divmod(round(v / 1e5), 10)
        return f"{m} {'milhão' if m == 1 else 'milhões'}" + (f" e {r}00 mil reais" if r else " de reais")
    if v < 1e9 - 5e7:
        return f"{round(v / 1e6)} milhões de reais"
    d = round(v / 1e8)
    b, r = divmod(d, 10)
    return f"{'1 bilhão' if b == 1 else f'{b} bilhões'}" + (f" e {r}00 milhões" if r else "") + " de reais"


def reais_cartao(v: float) -> str:
    """'R$ 388 mil', 'R$ 1,4 milhão', 'R$ 5,7 bilhões'."""
    if v < 1e6:
        return f"R$ {round(v / 1000)} mil"
    if v < 1e9 - 5e7:
        x = round(v / 1e6, 1) if v < 1e7 else round(v / 1e6)
        return f"R$ {str(x).replace('.', ',').removesuffix(',0')} {'milhão' if x < 2 else 'milhões'}"
    x = round(v / 1e9, 1)
    return f"R$ {str(x).replace('.', ',').removesuffix(',0')} {'bilhão' if x < 2 else 'bilhões'}"


def aposentados_falado(n: int) -> str:
    """'154', '1.033' (a voz lê 'mil e trinta e três'), '26 mil', '1 milhão e 500 mil'. Até 9.999 vai o número exato,
    o mesmo do cartão (InfoInss.tsx, aposentadosCartao)."""
    if n < 10000:
        return f"{n:,}".replace(",", ".")
    # arredonda meio para cima, como o Math.round do cartão (o round do Python leva 10.500 para "10 mil")
    if n < 1e6:
        return f"{int(n / 1000 + 0.5)} mil"
    m, r = divmod(int(n / 1e5 + 0.5), 10)
    return f"{m} {'milhão' if m == 1 else 'milhões'}" + (f" e {r}00 mil" if r else "")


def roteiro(ped: dict) -> dict:
    """As duas falas que mudam (com as versões mais curtas), a cena 3 do bairro ou da cidade e o dado da cena 4; None
    se o município não tem o número de aposentados."""
    nomes = ped.get("nomes") or {}
    mun = ped["municipio"]
    cidade, uf = limpa(mun["municipio"]), mun["uf"]
    apos, mes = int(float(mun.get("inss_aposentadorias") or 0)), float(mun.get("inss_valor_mensal") or 0)
    if not apos or not mes:
        return None
    bairro = limpa(nomes.get("bairro")) if nomes.get("regra") == "pares" else ""
    no_bairro, do_bairro = lugar_falado.no_lugar(bairro), lugar_falado.do_lugar(bairro)   # None: nome que não se fala
    ini = "Dia de pagamento do INSS."
    if no_bairro:
        f0 = [f"{ini} Seu Raimundo compra pão na padaria do Beto, {no_bairro}, aqui em {cidade}.",
              f"{ini} Seu Raimundo compra pão {no_bairro}, aqui em {cidade}.",
              f"{ini} Seu Raimundo compra pão na padaria do Beto, aqui em {cidade}."]
    else:
        f0 = [f"{ini} Seu Raimundo compra pão na padaria do Beto, aqui em {cidade}.",
              f"{ini} Seu Raimundo compra pão aqui em {cidade}."]
    onde = f"Aqui na cidade de {cidade}" if cidade == NOMES_UF[uf] else f"Aqui em {cidade}"
    quem = "1 aposentado vive" if apos == 1 else f"{aposentados_falado(apos)} aposentados vivem"
    f3 = [f"{onde}, {quem} do INSS. Todo mês, {reais_falado(mes)} entram na cidade.",
          f"{onde}, {quem} do INSS. Todo mês, são {reais_falado(mes)}."]
    abertura = f"Atenção, morador {do_bairro or lugar_falado.de_cidade(cidade)}: os aposentados estão em risco. Entenda por quê."
    for t in [*f0, *f3, abertura]:
        lugar_falado.confere(t)   # trava: nenhuma fala com "bairro X"
    return {
        "falas": {0: f0, 3: f3},
        "cena3": "bairro" if no_bairro else "cidade",
        "dado": {"rotulo": f"{cidade} - {uf}", "aposentados": apos, "mes": mes, "mes_cartao": reais_cartao(mes)},
        # cartão da abertura: a prévia do WhatsApp traz a cidade; na animação, o morador da fala (bairro) e "Cidade - UF" no topo
        "morador": lugar_falado.de_cidade(cidade),
        "morador_fala": do_bairro or lugar_falado.de_cidade(cidade),
        "local": f"{cidade} - {uf}",
        "abertura": abertura,
    }


def texto_fixo(i: int, cena3: str = "bairro") -> str:
    return CENA3_CIDADE if (i == 2 and cena3 == "cidade") else FIXAS[i]


def duracoes(pasta_vozes: Path) -> list:
    """Duração de cada cena, em frames de render: as fixas pelo tamanho da própria fala (a cena 3 pela mais longa das
    duas versões, para o bairro e a cidade colarem nas mesmas durações), as variáveis pela janela."""
    out = []
    for i in range(6):
        if i in JANELAS:
            fala = JANELAS[i]
        elif i == 2:
            fala = max(fim_da_fala(legenda_de(t, pasta_vozes)) for t in (FIXAS[2], CENA3_CIDADE))
        else:
            fala = fim_da_fala(legenda_de(FIXAS[i], pasta_vozes))
        out.append(ATRASO + round(fala * FPS) + FOLGA + (RESPIRO_FINAL if i == 5 else 0))
    return out


def inicio_final(dur: list, i: int) -> float:
    """Segundos, no vídeo final, em que a cena i começa."""
    return sum(dur[:i]) / FPS / VEL


def tempo_palavra(leg: list, alvo: str, depois: float = 0.0, extra: float = 1.0) -> float:
    """Segundos de render, desde o começo da cena, em que a fala chega na primeira palavra que começa com alvo."""
    for t, _d, p in leg:
        if t >= depois and p.lower().strip(".,!?").startswith(alvo.lower()):
            return ATRASO / FPS + t / extra
    return ATRASO / FPS + fim_da_fala(leg) / extra


def encaixa(it: dict, pasta_vozes: Path) -> None:
    """Escolhe, para cada fala variável, a versão mais longa que cabe na janela (acelerando até EXTRA_MAX)."""
    it["texto"], it["extra"], it["leg"] = {}, {}, {}
    for i, versoes in it["falas"].items():
        for k, texto in enumerate(versoes):
            leg = legenda_de(texto, pasta_vozes)
            extra = max(1.0, fim_da_fala(leg) / JANELAS[i])
            if extra <= EXTRA_MAX or k == len(versoes) - 1:
                it["texto"][i], it["extra"][i], it["leg"][i] = texto, min(extra, EXTRA_MAX), leg
                break
    for i in FIXAS:
        it["texto"][i], it["extra"][i] = texto_fixo(i, it["cena3"]), 1.0
