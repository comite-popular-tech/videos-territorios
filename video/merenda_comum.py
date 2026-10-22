"""O que o vídeo "A merenda da Júlia" (merenda escolar, roteiro 8 de video/roteiros-narracao.md) tem em comum entre as
peças prontas e a montagem por território (merenda.py): o roteiro, os tempos das cenas e os textos fixos.

Mesmo molde do Mais Médicos (maismedicos_comum.py; voz, legenda em ASS e codificação do pedemeia_comum.py), com as cenas
de infográfico no Remotion (src/InfoMerenda.tsx).

Cenas (índice 0 a 5):            vídeo                                    fala
  0 portão da escola              clipe 1 do Flow, peça sem legenda        muda (bairro e cidade)
  1 prato servido no refeitório   clipe 2 do Flow, peça com legenda        fixa
  2 mesa com as crianças          clipe 3 do Flow, peça com legenda        fixa
  3 dado                          Remotion por território (md_dado)        muda (cidade, estado ou Brasil)
  4 corte                         Remotion, peça com legenda               fixa
  5 compartilhe                   Remotion, peça com legenda               fixa
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lugar_falado  # noqa: E402  ("no Capão Redondo", "na Vila Prudente": nunca "no bairro X")
from pedemeia_comum import (ALT, ATRASO, ENC, ESTADOS, FOLGA, FONTES, FPS, LARG, RESPIRO_FINAL, VEL, VIDEO,  # noqa: E402,F401
                            ass, ffmpeg, filtro_ass, fim_da_fala, gerar_vozes, legenda_de, limpa, voz_arquivo)
from maismedicos_comum import tempo_palavra  # noqa: E402,F401

MUSICA, AMBIENTE = 0.25, 0.35
CLIPES = [135, 240, 240]                  # frames dos clipes do Flow (8 s; do 1 só os 4,5 s antes do salto em que a Júlia troca de lado e vira para o portão)
JANELAS = {0: 5.0, 3: 11.0}               # janela das falas que mudam, em segundos de render (medidas em 299 territórios em 22/10: fala 1 mediana 5,2 s, p90 6,2, máx. 6,9; fala 4 mediana 11,3 s, p90 12,8, máx. 13,2)
EXTRA_MAX = 1.3
FIXAS = {
    1: "Na hora do recreio, o prato vem cheio: arroz, feijão, carne e fruta.",
    2: "Pra muita criança, é a refeição mais completa do dia. E é de graça.",
    4: "Com Bolsonaro, a merenda por aluno ficou quatro anos congelada. Lula reajustou duas vezes. "
       "Flávio Bolsonaro planeja cortar até 250 bilhões, e a merenda pode ficar ameaçada.",
    5: "Compartilhe com quem tem filho na escola pública.",
}
FONTE_DADO = ("Portal da Transparência, repasses do PNAE (alimentação escolar), média por ano em R$ de set/2026 (IPCA); "
              "2026 até setembro (79% do ano)")
FONTE_CORTE = ("Valor por aluno do ensino fundamental: Res. FNDE 1/2017, 2/2023 e 1/2026 · "
               "Plano de até R$ 250 bi: Folha de S.Paulo, out/2026")
PUB = VIDEO / "public" / "merenda"
NOMES_UF = {uf: n[1] for uf, n in ESTADOS.items()}


def reais(v: float) -> str:
    """Dinheiro dito na voz: "318 mil reais", "212 milhões de reais", "4 bilhões e 700 milhões de reais" (de R$ 1 bilhão
    para cima, sempre bilhões; nunca "mil milhões")."""
    if v < 1e6:
        return f"{round(v / 1000)} mil reais"
    if v < 1e9:
        m = round(v / 1e6)
        return f"{m} {'milhão' if m == 1 else 'milhões'} de reais"
    b, r = divmod(round(v / 1e8) * 100, 1000)
    return f"{b} {'bilhão' if b == 1 else 'bilhões'}" + (f" e {r} milhões" if r else "") + " de reais"


def roteiro(ped: dict, md: dict) -> dict:
    """As duas falas que mudam (com as versões mais curtas) e o dado da cena 4."""
    nomes = ped.get("nomes") or {}
    cidade, uf, ibge = limpa(ped["municipio"]["municipio"]), ped["municipio"]["uf"], str(ped["municipio"]["cod_ibge"])
    m = md["municipios"].get(ibge) or {"medias": [0, 0], "regra": "estado" if md["ufs"][uf]["passa"] else "brasil"}
    bairro = limpa(nomes.get("bairro")) if nomes.get("regra") == "pares" else ""
    no_bairro, do_bairro = lugar_falado.no_lugar(bairro), lugar_falado.do_lugar(bairro)   # None: nome que não se fala
    if no_bairro:
        f0 = [f"A Júlia tem sete anos e estuda numa escola municipal {no_bairro}, aqui em {cidade}.",
              f"A Júlia tem sete anos e estuda {no_bairro}, aqui em {cidade}.",
              f"A Júlia tem sete anos e estuda numa escola municipal aqui em {cidade}."]
    else:
        f0 = [f"A Júlia tem sete anos e estuda numa escola municipal aqui em {cidade}.",
              f"A Júlia tem sete anos e estuda aqui em {cidade}."]

    regra = m["regra"]
    if regra == "cidade":
        medias, onde = m["medias"], (f"Aqui na cidade de {cidade}" if cidade == NOMES_UF[uf] else f"Aqui em {cidade}")
        rotulo = f"{cidade} - {uf}"
    else:
        chave = uf if regra == "estado" else "BR"
        medias = md["ufs"][chave]["medias"]
        onde = ESTADOS[uf][0] if regra == "estado" else "No Brasil"
        rotulo = NOMES_UF[uf] if regra == "estado" else "Brasil"
    b, l = reais(medias[0]), reais(medias[1]).removesuffix(" de reais").removesuffix(" reais")   # "929 milhões", "331 mil"
    f3 = [f"{onde}, com Bolsonaro, a merenda recebia {b} por ano. Com Lula, são {l}, já descontada a inflação.",
          f"{onde}, a merenda recebia {b} por ano com Bolsonaro. Com Lula, {l}, já descontada a inflação.",
          f"{onde}, a merenda recebia {b} por ano com Bolsonaro. Com Lula, {l}."]
    abertura = f"Atenção, morador {do_bairro or 'de ' + cidade}: a merenda escolar está ameaçada. Entenda por quê."
    for t in [*f0, *f3, abertura]:
        lugar_falado.confere(t)   # trava: nenhuma fala com "bairro X"
    return {
        "falas": {0: f0, 3: f3},
        "dado": {"rotulo": rotulo, "alcance": regra, "medias": medias},
        # cartão da abertura: a prévia do WhatsApp traz a cidade; na animação, o morador da fala (bairro) e "Cidade - UF" no topo
        "morador": lugar_falado.de_cidade(cidade),
        "morador_fala": do_bairro or lugar_falado.de_cidade(cidade),
        "local": f"{cidade} - {uf}",
        "abertura": abertura,
    }


def duracoes(pasta_vozes: Path) -> list:
    """Duração de cada cena, em frames de render: as fixas pelo tamanho da própria fala, as variáveis pela janela."""
    out = []
    for i in range(6):
        fala = JANELAS[i] if i in JANELAS else fim_da_fala(legenda_de(FIXAS[i], pasta_vozes))
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
        it["texto"][i], it["extra"][i] = texto, 1.0


def carregar() -> dict:
    return json.loads((VIDEO / "merenda.json").read_text(encoding="utf-8"))
