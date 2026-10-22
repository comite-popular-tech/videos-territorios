"""O que o vídeo "A doutora do posto" (Mais Médicos, roteiro 7 de video/roteiros-narracao.md) tem em comum entre as
peças prontas e a montagem por território (maismedicos.py): o roteiro, os tempos das cenas e os textos fixos.

Mesmo molde do Pé-de-Meia (pedemeia_comum.py, de onde vêm a voz, a legenda em ASS e os parâmetros de codificação), com
as três cenas de infográfico no Remotion como na insulina (src/InfoMaisMedicos.tsx; antes eram do HyperFrames).

Cenas (índice 0 a 5):            vídeo                                    fala
  0 consultório                   clipe 1 do Flow, peça sem legenda        muda (bairro e cidade)
  1 pressão e receita             clipe 2 do Flow, peça com legenda        fixa
  2 saída pelo corredor           clipe 3 do Flow, peça com legenda        fixa
  3 dado                          Remotion por território (mm_dado)        muda (cidade, estado ou Brasil)
  4 corte                         Remotion, peça com legenda               fixa (outra peça para quem fala o Brasil na 3)
  5 compartilhe                   Remotion, peça com legenda               fixa
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
JANELAS = {0: 8.0, 3: 8.0}                # janela das falas que mudam, em segundos de render (piloto: fala 1 de 7,0 a 8,8 s; fala 4 de 7,6 a 9,5 s)
EXTRA_MAX = 1.3
FIXAS = {
    1: "Ela veio pelo Mais Médicos. Mede a pressão, cuida da diabetes e faz a receita da insulina.",
    2: "Uma médica que conhece ele pelo nome. E a consulta é de graça, pelo SUS.",
    4: "No Brasil, o Mais Médicos quase dobrou com Lula. Flávio Bolsonaro planeja cortar até 250 bilhões, e o programa pode ficar ameaçado.",
    5: "Compartilhe com quem se consulta no posto de saúde aqui da região.",
}
# quem fala o Brasil na cena 4 (Goiás) não ouve o Brasil de novo na 5
CORTE_BRASIL = "Flávio Bolsonaro planeja cortar até 250 bilhões, e o Mais Médicos pode ficar ameaçado."
FONTE_DADO = "Ministério da Saúde, Mais Médicos: médicos em atividade em dez/2022 e out/2026"
FONTE_CORTE = FONTE_DADO + " · Plano de até R$ 250 bi: Folha de S.Paulo, out/2026"
PUB = VIDEO / "public" / "mais-medicos"
NOMES_UF = {uf: n[1] for uf, n in ESTADOS.items()}

_MIL = {100: "cem", 200: "duzentos", 300: "trezentos", 400: "quatrocentos", 500: "quinhentos", 600: "seiscentos",
        700: "setecentos", 800: "oitocentos", 900: "novecentos"}


def falado(n: int) -> str:
    """Médicos ditos na voz: inteiro abaixo de mil; de mil a 9.999, a centena mais próxima ("mil e quinhentos",
    "3 mil e 400"); de 10 mil em diante, o meio milhar mais próximo ("13 mil e 500", "26 mil")."""
    if n < 1000:
        return str(n)
    passo = 100 if n < 10000 else 500
    m, r = divmod(round(n / passo) * passo, 1000)
    if m == 1:
        return "mil" + (f" e {_MIL[r]}" if r else "")
    return f"{m} mil" + (f" e {r}" if r else "")


def medicos(n: int) -> str:
    return "1 médico" if n == 1 else f"{falado(n)} médicos"


def roteiro(ped: dict, mm: dict) -> dict:
    """As duas falas que mudam (com as versões mais curtas) e o dado da cena 4; None se o município fica sem o vídeo."""
    nomes = ped.get("nomes") or {}
    cidade, uf, ibge = limpa(ped["municipio"]["municipio"]), ped["municipio"]["uf"], str(ped["municipio"]["cod_ibge"])
    antes, agora, regra = mm["municipios"][ibge]
    if regra == "fora":
        return None
    bairro = limpa(nomes.get("bairro")) if nomes.get("regra") == "pares" else ""
    no_bairro, do_bairro = lugar_falado.no_lugar(bairro), lugar_falado.do_lugar(bairro)   # None: nome que não se fala
    longo, curto = "Todo mês ele se consulta no posto de saúde com a doutora Ana.", "Todo mês ele vê a doutora Ana no posto."
    if no_bairro:
        f0 = [f"Seu Raimundo mora {no_bairro}, aqui em {cidade}. {longo}",
              f"Seu Raimundo mora {no_bairro}, aqui em {cidade}. {curto}",
              f"Seu Raimundo mora aqui em {cidade}. {curto}"]
    else:
        f0 = [f"Seu Raimundo mora aqui em {cidade}. {longo}", f"Seu Raimundo mora aqui em {cidade}. {curto}"]

    if regra == "cidade":
        onde = f"Aqui na cidade de {cidade}" if cidade == NOMES_UF[uf] else f"Aqui em {cidade}"
        rotulo = f"{cidade} - {uf}"
    else:
        chave = uf if regra == "estado" else "BR"
        antes, agora = mm["ufs"][chave]["antes"], mm["ufs"][chave]["agora"]
        onde = ESTADOS[uf][0] if regra == "estado" else "No Brasil"
        rotulo = NOMES_UF[uf] if regra == "estado" else "Brasil"
    tinha = "não tinha nenhum médico" if antes == 0 else f"tinha {medicos(antes)}"
    hoje = f"Hoje são {falado(agora)}." if agora > 1 else "Hoje tem 1."
    f3 = [f"{onde}, no fim do governo Bolsonaro, o Mais Médicos {tinha}. {hoje}",
          f"{onde}, o Mais Médicos {tinha} com Bolsonaro. {hoje}"]
    abertura = f"Atenção, morador {do_bairro or 'de ' + cidade}: o Mais Médicos está ameaçado. Entenda por quê."
    for t in [*f0, *f3, abertura]:
        lugar_falado.confere(t)   # trava: nenhuma fala com "bairro X"
    return {
        "falas": {0: f0, 3: f3},
        "corte": CORTE_BRASIL if regra == "brasil" else FIXAS[4],
        "dado": {"rotulo": rotulo, "alcance": regra, "antes": antes, "agora": agora},
        # cartão da abertura: a prévia do WhatsApp traz a cidade; na animação, o morador da fala (bairro) e "Cidade - UF" no topo
        "morador": lugar_falado.de_cidade(cidade),
        "morador_fala": do_bairro or lugar_falado.de_cidade(cidade),
        "local": f"{cidade} - {uf}",
        "abertura": abertura,   # antes da história (aprovada em 21/10, ideia do Gabriel: a pessoa desengajava antes de esquentar)
    }


def duracoes(pasta_vozes: Path, corte: str = None) -> list:
    """Duração de cada cena, em frames de render: as fixas pelo tamanho da própria fala, as variáveis pela janela."""
    out = []
    for i in range(6):
        if i in JANELAS:
            fala = JANELAS[i]
        else:
            fala = fim_da_fala(legenda_de(corte if (i == 4 and corte) else FIXAS[i], pasta_vozes))
        out.append(ATRASO + round(fala * FPS) + FOLGA + (RESPIRO_FINAL if i == 5 else 0))
    return out


def inicio_final(dur: list, i: int) -> float:
    """Segundos, no vídeo final, em que a cena i começa."""
    return sum(dur[:i]) / FPS / VEL


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
    for i, texto in FIXAS.items():
        it["texto"][i], it["extra"][i] = (it["corte"] if i == 4 else texto), 1.0


def tempo_palavra(leg: list, alvo: str, depois: float = 0.0, extra: float = 1.0) -> float:
    """Segundos de render, desde o começo da cena, em que a fala chega na primeira palavra que começa com alvo."""
    for t, _d, p in leg:
        if t >= depois and p.lower().strip(".,!?").startswith(alvo.lower()):
            return ATRASO / FPS + t / extra
    return ATRASO / FPS + fim_da_fala(leg) / extra


def carregar() -> dict:
    return json.loads((VIDEO / "maismedicos.json").read_text(encoding="utf-8"))
