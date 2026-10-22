"""O que o vídeo "A visita da Cida" (dinheiro do SUS para a cidade, roteiro 6 de video/roteiros-narracao.md) tem em
comum entre as peças prontas e a montagem por território (cida.py): o roteiro, os tempos das cenas e os textos fixos.

Molde do Mais Médicos (maismedicos_comum.py, copiado aqui: encaixe das falas e tempos); voz, legenda em ASS e
codificação vêm do pedemeia_comum.py. Infográficos no Remotion (src/InfoCida.tsx).

Cenas (índice 0 a 5):            vídeo                                    fala
  0 a Cida bate na porta          clipe 1 do Flow, peça sem legenda        muda (bairro e cidade)
  1 a pressão na sala             clipe 2 do Flow, peça com legenda        fixa
  2 o posto de saúde              clipe 3 do Flow, peça com legenda        fixa
  3 dado                          Remotion por território (cida_dado)      muda (cidade, estado ou Brasil)
  4 corte                         Remotion, peça com legenda               fixa (outra peça para quem fala o Brasil na 3)
  5 compartilhe                   Remotion, peça com legenda               fixa
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lugar_falado  # noqa: E402  ("no Capão Redondo", "na Vila Prudente": nunca "no bairro X")
# só o pedemeia_comum (voz, legenda ASS, codificação), que todos os vídeos de história usam; nada de maismedicos*.py,
# que muda com o Mais Médicos (o INSS quebrou em produção em 22/10 quando o maismedicos.py perdeu AMARELO e _estilos)
from pedemeia_comum import (ALT, ATRASO, ENC, ESTADOS, FOLGA, FPS, LARG, RESPIRO_FINAL, VEL, VIDEO,  # noqa: E402,F401
                            ass, ffmpeg, filtro_ass, fim_da_fala, gerar_vozes, legenda_de, limpa, voz_arquivo)

EXTRA_MAX = 1.3
NOMES_UF = {uf: n[1] for uf, n in ESTADOS.items()}

MUSICA, AMBIENTE = 0.25, 0.35
# frames (a 30 fps) dos clipes do Flow: o 2 perde o 1,6 s antes do corte de câmera que o Omni Flash fez (clip2-flow.mp4 é o original)
CLIPES = [240, 192, 240]
JANELAS = {0: 8.0, 3: 10.0}               # janela das falas que mudam, em segundos de render (piloto: fala 1 de 5,9 a 7,5 s; fala 4 de 11,9 a 12,3 s)
FIXAS = {
    1: "Mede a pressão, confere o remédio e marca a consulta no posto. Sem ele sair de casa.",
    2: "É o posto de saúde que chega até a porta. E quem paga isso é o dinheiro que a União manda para a cidade.",
    4: "No Brasil, o dinheiro do SUS para as cidades subiu de 90 para 123 bilhões por ano. Flávio Bolsonaro planeja cortar até 250 bilhões, e o SUS pode ficar ameaçado.",
    5: "Compartilhe com quem é atendido no posto de saúde aqui da região.",
}
# quem fala o Brasil na cena 4 não ouve o Brasil de novo na 5
CORTE_BRASIL = "Flávio Bolsonaro planeja cortar até 250 bilhões, e o SUS pode ficar ameaçado."
BR = {"antes": 89.9e9, "agora": 122.8e9}   # conferido por cida_dados.py (BR em cida.json)
FONTE_DADO = "CGU, Portal da Transparência: repasses do SUS ao município sem covid, jan/2019-set/2022 x jan/2023-set/2026, R$ de set/2026"
FONTE_CORTE = FONTE_DADO.split(":")[0] + ": repasses do SUS aos municípios · Plano de até R$ 250 bi: Folha de S.Paulo, out/2026"
PUB = VIDEO / "public" / "cida"
# "Em São Paulo" e "No Rio de Janeiro" soam como a cidade: na fala do estado, dizer o estado
NO_ESTADO = {**{uf: n[0] for uf, n in ESTADOS.items()}, "SP": "No estado de São Paulo", "RJ": "No estado do Rio de Janeiro"}


def dinheiro(v: float) -> tuple:
    """(fala, cartão): '17 bilhões' / 'R$ 17 BI', '3 bilhões e 500 milhões' / 'R$ 3,5 BI', '7 milhões e 500 mil' /
    'R$ 7,5 MI', '640 mil' / 'R$ 640 MIL'. De R$ 1 bilhão para cima sempre bilhões (nunca '1035 milhões')."""
    def par(n, unid, plural, sub, cartao):
        m, r = divmod(n, 10)
        fala = f"{m} {unid if m == 1 else plural}" + (f" e {r * 100} {sub}" if r else "")
        return fala, f"R$ {m}{',' + str(r) if r else ''} {cartao}"
    if v >= 1e9:
        return par(round(v / 1e8), "bilhão", "bilhões", "milhões", "BI")
    if v >= 1e8:
        n = round(v / 1e7) * 10
        return f"{n} milhões", f"R$ {n} MI"
    if v >= 1e7:
        n = round(v / 1e6)
        return f"{n} milhões", f"R$ {n} MI"
    if v >= 1e6:
        return par(round(v / 1e5), "milhão", "milhões", "mil", "MI")
    n = round(v / 1e4) * 10
    return f"{n} mil", f"R$ {n} MIL"


def comparado(antes: float, agora: float) -> tuple:
    """(fala, selo do cartão) do aumento com Lula."""
    r = agora / antes
    if r >= 3:
        return f"{int(r)} vezes o que mandava o governo Bolsonaro", f"{int(r)} vezes mais"
    if r >= 2:
        return "Mais que o dobro do governo Bolsonaro", "Mais que o dobro"
    p = round((r - 1) * 100)
    return f"{p} por cento a mais que o governo Bolsonaro", f"+{p}%"


def roteiro(ped: dict, dados: dict) -> dict:
    """As duas falas que mudam (com as versões mais curtas) e o dado da cena 4."""
    nomes = ped.get("nomes") or {}
    cidade, uf, ibge = limpa(ped["municipio"]["municipio"]), ped["municipio"]["uf"], str(ped["municipio"]["cod_ibge"])
    antes, agora, regra = dados["municipios"].get(ibge, [0, 0, "brasil"])
    bairro = limpa(nomes.get("bairro")) if nomes.get("regra") == "pares" else ""
    no_bairro, do_bairro = lugar_falado.no_lugar(bairro), lugar_falado.do_lugar(bairro)   # None: nome que não se fala
    longo, curto = "Todo mês ela bate na porta do Seu Raimundo.", "Todo mês ela visita o Seu Raimundo."
    if no_bairro:
        f0 = [f"A Cida é agente de saúde {no_bairro}, aqui em {cidade}. {longo}",
              f"A Cida é agente de saúde {no_bairro}, aqui em {cidade}. {curto}",
              f"A Cida é agente de saúde aqui em {cidade}. {curto}"]
    else:
        f0 = [f"A Cida é agente de saúde aqui em {cidade}. {longo}", f"A Cida é agente de saúde aqui em {cidade}. {curto}"]

    if regra == "cidade":
        onde = f"Aqui na cidade de {cidade}" if cidade == NOMES_UF[uf] else f"Aqui em {cidade}"
        rotulo, para = f"{cidade} - {uf}", "para a saúde da cidade"
    else:
        chave = uf if regra == "estado" else "BR"
        antes, agora = dados["ufs"][chave]["antes"], dados["ufs"][chave]["agora"]
        onde = NO_ESTADO[uf] if regra == "estado" else "No Brasil"
        rotulo, para = (NOMES_UF[uf] if regra == "estado" else "Brasil"), "para a saúde das cidades"
    fala_agora, cartao_agora = dinheiro(agora)
    _f, cartao_antes = dinheiro(antes)
    fala_comp, selo = comparado(antes, agora)
    subiu = "mais que dobrou" if agora >= 2 * antes else f"subiu {round((agora / antes - 1) * 100)} por cento"
    f3 = [f"{onde}, o governo Lula manda {fala_agora} de reais por ano {para}. {fala_comp}, já descontada a inflação.",
          f"{onde}, o dinheiro do SUS {subiu} com Lula, já descontada a inflação."]
    f3[0] = f3[0].replace("mil de reais", "mil reais")   # "640 mil reais", mas "17 bilhões de reais"
    abertura = f"Atenção, morador {do_bairro or 'de ' + cidade}: o SUS está ameaçado. Entenda por quê."
    for t in [*f0, *f3, abertura]:
        lugar_falado.confere(t)   # trava: nenhuma fala com "bairro X"
    return {
        "falas": {0: f0, 3: f3},
        "corte": CORTE_BRASIL if regra == "brasil" else FIXAS[4],
        "dado": {"rotulo": rotulo, "alcance": regra, "antes": antes, "agora": agora, "cartaoAntes": cartao_antes,
                 "cartaoAgora": cartao_agora, "selo": selo},
        "morador": lugar_falado.de_cidade(cidade),
        "morador_fala": do_bairro or lugar_falado.de_cidade(cidade),
        "local": f"{cidade} - {uf}",
        "abertura": abertura,
    }


def duracoes(pasta_vozes: Path, corte: str = None) -> list:
    """Duração de cada cena, em frames de render: as fixas pelo tamanho da própria fala, as variáveis pela janela."""
    out = []
    for i in range(6):
        fala = JANELAS[i] if i in JANELAS else fim_da_fala(legenda_de(corte if (i == 4 and corte) else FIXAS[i], pasta_vozes))
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
    for i, texto in FIXAS.items():
        it["texto"][i], it["extra"][i] = (it["corte"] if i == 4 else texto), 1.0


def carregar() -> dict:
    return json.loads((VIDEO / "cida.json").read_text(encoding="utf-8"))
