"""O que o vídeo "O mercado da Dona Rose" (Bolsa Família, roteiro 5 de video/roteiros-narracao.md) tem em comum entre as
peças prontas e a montagem por território (mercadorose.py): o roteiro, os tempos das cenas e os textos fixos.

Mesmo molde do Mais Médicos (maismedicos_comum.py; voz, legenda em ASS e codificação do pedemeia_comum.py), com as
cenas de infográfico no Remotion (src/InfoMercadoRose.tsx e o fecho do InfoFarmacia.tsx).

Cenas (índice 0 a 5):            vídeo                                    fala
  0 cozinha, a lista              clipe 1 do Flow, peça sem legenda        muda (bairro e cidade)
  1 mercadinho, o cartão          clipe 2 do Flow, peça com legenda        fixa
  2 compras na prateleira         clipe 3 do Flow, peça com legenda        fixa
  3 dado                          Remotion por território (mr_dado)        muda (famílias e valor do mês da cidade)
  4 corte                         Remotion, peça com legenda (mr_corte)    fixa
  5 compartilhe                   Remotion, peça com legenda               fixa
Toda cidade tem Bolsa Família: não há fala do estado nem do Brasil na cena 3.
"""
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lugar_falado  # noqa: E402  ("no Capão Redondo", "na Vila Prudente": nunca "no bairro X")
from pedemeia_comum import (ALT, ATRASO, ENC, ESTADOS, FOLGA, FONTES, FPS, LARG, RESPIRO_FINAL, VEL, VIDEO,  # noqa: E402,F401
                            ass, falado, ffmpeg, filtro_ass, fim_da_fala, gerar_vozes, legenda_de, limpa, voz_arquivo)

MUSICA, AMBIENTE = 0.25, 0.35
CLIPES = [240, 240, 240]                  # frames dos clipes do Flow (8 s cada)
JANELAS = {0: 7.6, 3: 9.0}                # janela das falas que mudam, em segundos de render
EXTRA_MAX = 1.3
FIXAS = {
    1: "Todo mês o Bolsa Família cai na conta, e ela faz a compra do mês no mercadinho da esquina.",
    2: "Arroz, feijão, leite, fruta. Mais de seiscentos reais que viram comida na mesa, todo mês.",
    4: "Com Bolsonaro, o Bolsa Família ficou três anos sem reajuste. Hoje paga mais que o dobro do que pagava em 2018. "
       "Flávio Bolsonaro planeja cortar até 250 bilhões.",
    5: "Compartilhe com quem faz a compra do mês com o Bolsa Família.",
}
MES = "agosto"
FONTE_DADO = "Ministério do Desenvolvimento Social, folha do Bolsa Família de ago/2026"
FONTE_CORTE = ("MDS, benefício médio por família em R$ de set/2026 (IPCA): 2018, 2019 a 2021 e 2026"
               " · Plano de até R$ 250 bi: Folha de S.Paulo, out/2026")
BENEFICIO = {"2018": 280, "2019": 278, "2026": 700}   # dados/comparacao_governos/, R$ de set/2026 por família por mês
PUB = VIDEO / "public" / "mercadorose"
NOMES_UF = {uf: n[1].removeprefix("Estado de ").removeprefix("Estado do ") for uf, n in ESTADOS.items()}

# ---------------------------------------------------------------- número de famílias dito na voz, no feminino
_UNID = ["", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze",
         "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"]
_DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
_CEM = ["", "cento", "duzentas", "trezentas", "quatrocentas", "quinhentas", "seiscentas", "setecentas", "oitocentas", "novecentas"]


def _extenso(n: int) -> str:
    """1 a 999 por extenso, no feminino ("oitenta e duas", "duzentas e uma")."""
    if n == 100:
        return "cem"
    c, r = divmod(n, 100)
    partes = [_CEM[c]] if c else []
    if r:
        partes.append(_UNID[r] if r < 20 else _DEZ[r // 10] + (f" e {_UNID[r % 10]}" if r % 10 else ""))
    return " e ".join(partes)


def _fem(n: int) -> bool:
    """O número muda no feminino ("uma", "duas")? Só quando termina em 1 ou 2 fora de 11 e 12."""
    return n % 10 in (1, 2) and n % 100 not in (11, 12)


def familias_falado(n: int) -> str:
    """Famílias na voz: inteiro abaixo de mil (por extenso quando o feminino muda: "oitenta e duas"); de mil a 9.999, a
    centena de baixo ("mil e duzentas", "duas mil e trezentas", "3 mil e quinhentas"); de 10 mil em diante, o milhar de
    baixo ("23 mil", "49 mil"), com "mais de" quando o milhar terminaria em 1 ou 2 ("mais de 630 mil", não "631 mil")."""
    if n < 1000:
        return _extenso(n) if _fem(n) else str(n)
    if n < 10000:
        m, c = divmod(n // 100, 10)
        mil = {1: "mil", 2: "duas mil"}.get(m, f"{m} mil")
        return mil + (f" e {_extenso(c * 100)}" if c else "")
    k = n // 1000
    if _fem(k):
        return f"mais de {k - k % 10} mil"
    return f"{k} mil"


def reais_falado(v: float) -> str:
    """Valor do mês na voz: "842 mil", "33 milhões e 600 mil" (falado() do Pé-de-Meia); de R$ 1 bilhão para cima, "bilhões"."""
    if v >= 1e9:
        d = round(v / 1e8)
        return f"{d // 10}{',' + str(d % 10) if d % 10 else ''} {'bilhão' if d < 20 else 'bilhões'}"
    if v < 1e6:
        return f"{int(v // 1000)} mil"   # para baixo: não arredondar 842.644 para "843 mil"
    if v >= 1e7:
        return f"{int(v // 1e6)} milhões"   # "420 milhões", não "420 milhões e 500 mil": a fala da capital não cabe
    return falado(int(v))


def roteiro(ped: dict, bf: dict) -> dict:
    """As duas falas que mudam (com as versões mais curtas) e o dado da cena 4."""
    nomes = ped.get("nomes") or {}
    cidade, uf, ibge = limpa(ped["municipio"]["municipio"]), ped["municipio"]["uf"], str(ped["municipio"]["cod_ibge"])
    d = bf[ibge]
    bairro = limpa(nomes.get("bairro")) if nomes.get("regra") == "pares" else ""
    no_bairro, do_bairro = lugar_falado.no_lugar(bairro), lugar_falado.do_lugar(bairro)   # None: nome que não se fala
    homonima = cidade == NOMES_UF[uf]   # São Paulo, Rio de Janeiro: o número não pode parecer do estado
    aqui = "aqui na capital" if homonima else f"aqui {lugar_falado.em_cidade(cidade)}"
    resto = "Cria dois filhos sozinha, com faxina e bico."
    if no_bairro:
        f0 = [f"A Dona Rose mora {no_bairro}, {aqui}. {resto}", f"A Dona Rose mora {aqui}. {resto}"]
    else:
        f0 = [f"A Dona Rose mora {aqui}. {resto}"]

    onde = f"Na cidade {lugar_falado.de_cidade(cidade)}" if homonima else f"Aqui {lugar_falado.em_cidade(cidade)}"
    fam = f"{onde}, {familias_falado(d['familias'])} famílias receberam o Bolsa Família em {MES}."
    comercio = "no comércio da capital" if homonima else ("no comércio daqui" if d["familias"] < 5000 else "no comércio da cidade")
    if d["por_100_dom"] > 50:
        segunda = ["É mais da metade das casas da cidade."]
    elif d["familias"] < 100:
        segunda = []
    else:
        valor = f"São {reais_falado(d['valor_mes'])} de reais por mês".replace(" mil de reais", " mil reais")
        segunda = [f"{valor} girando {comercio}.", f"{valor} no comércio."]
    f3 = [f"{fam} {s}" for s in segunda] + [fam]
    abertura = f"Atenção, morador {do_bairro or lugar_falado.de_cidade(cidade)}: o Bolsa Família está ameaçado. Entenda por quê."
    for t in [*f0, *f3, abertura]:
        lugar_falado.confere(t)   # trava: nenhuma fala com "bairro X"
    return {
        "falas": {0: f0, 3: f3},
        "dado": {"rotulo": f"{cidade} - {uf}", "familias": d["familias"], "valor_mes": d["valor_mes"],
                 "metade": d["por_100_dom"] > 50, "por_100_dom": d["por_100_dom"]},
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


def tempo_palavra(leg: list, alvo: str, depois: float = 0.0, extra: float = 1.0) -> float:
    """Segundos de render, desde o começo da cena, em que a fala chega na primeira palavra que começa com alvo."""
    for t, _d, p in leg:
        if t >= depois and p.lower().strip(".,!?").startswith(alvo.lower()):
            return ATRASO / FPS + t / extra
    return ATRASO / FPS + fim_da_fala(leg) / extra


DADOS = VIDEO / "mercadorose.json"   # gerado por mercadorose_dados.py; vai no git (a fila não tem dados/)


def ler_csv() -> dict:
    """Bolsa Família de agosto por município (dados/indicadores_municipios.csv, a mesma base dos cards)."""
    with open(VIDEO.parent / "dados" / "indicadores_municipios.csv", encoding="utf-8-sig") as f:
        return {r["cod_ibge"]: {"familias": int(r["bf_familias"]), "valor_mes": float(r["bf_valor_mes"]),
                                "por_100_dom": float(r["bf_familias_por_100_dom"] or 0)}
                for r in csv.DictReader(f, delimiter=";") if r.get("bf_familias") and int(r["bf_familias"]) > 0}


def carregar() -> dict:
    """{cod_ibge: {familias, valor_mes, por_100_dom}} do mercadorose.json (o CSV quando o JSON não existe)."""
    if not DADOS.exists():
        return ler_csv()
    return {ibge: {"familias": f, "valor_mes": v, "por_100_dom": p}
            for ibge, (f, v, p) in json.loads(DADOS.read_text(encoding="utf-8"))["municipios"].items()}
