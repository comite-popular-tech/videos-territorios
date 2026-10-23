"""Vídeo "O posto novo" (UBS começadas, roteiro 9 de video/roteiros-narracao.md), com a Dona Marta e a filha.

  python video/postonovo.py dados               # gera video/postonovo.json (vai no git)
  python video/postonovo.py pecas               # peças que não mudam (clipes do Flow, corte, compartilhe)
  python video/postonovo.py montar <slug ...>   # exemplos no PC, em E:/30000-cards/postonovo-exemplos/
  python video/postonovo.py janelas <slug ...>  # mede as falas que mudam (para as JANELAS)
  python video/postonovo.py subir               # sobe ao R2 da fila os comuns (clipes, música, peças prontas)
  python video/postonovo.py semear [--simular]  # cadastra e semeia o trabalho video-postonovo (só com o OK do Gui)
  pela fila: video/trabalhos/video-postonovo.sh -> video_postonovo.py

Montagem em historia_dados.py, no padrão de massa do Mais Médicos; infográficos no Remotion (src/InfoHistoria.tsx).
Entradas em video/public/posto-novo/: clip1-3.mp4 (Flow), musica.mp3 e a foto de cada cidade (<uf>-<cidade>.jpg, a
mesma do kit da fila em entradas/fundos/).

Dados: indicador ubs_construcao_iniciada de dados/comparacao_governos/comparacao_governos.csv (construções de UBS por
ano de início da obra no SISMOB), soma de 2019 a 2022 contra a soma de 2023 a out/2026. Regra da cena 4:
  cidade  começou obra com Lula e pelo menos o dobro de Bolsonaro;
  estado  as outras, onde o estado começou com Lula mais que com Bolsonaro;
  brasil  o estado não passa (Acre, Amapá e Distrito Federal).
"""
import collections
import csv
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import historia_dados as H  # noqa: E402
import lugar_falado  # noqa: E402
from maismedicos_comum import NOMES_UF  # noqa: E402
from pedemeia_comum import ESTADOS, VIDEO, limpa  # noqa: E402

NOME = "postonovo"
TRABALHO = "video-postonovo"
DESCRICAO = "Vídeo vertical O posto novo (UBS começadas), por território"
PUB = VIDEO / "public" / "posto-novo"
SAIDA = Path(os.environ.get("POSTONOVO_SAIDA", "E:/30000-cards/postonovo-exemplos"))
DADOS = VIDEO / "postonovo.json"
BASE = VIDEO.parent / "dados" / "comparacao_governos" / "comparacao_governos.csv"
BOLSONARO, LULA = {"2019", "2020", "2021", "2022"}, {"2023", "2024", "2025", "2026"}
JANELAS = {0: 8.4, 3: 9.0}       # segundos de render; piloto (ver `janelas`): fala 1 de 6,6 a 8,4 s, fala 4 de 8,2 a 8,9 s
FUNDO_CORTE = 0                  # o corte fica sobre o último quadro do clipe 1 (a fila de madrugada)
FIXAS = {
    1: "Agora o governo federal está construindo posto de saúde novo pelo Brasil todo.",
    2: "Mais médico, mais vacina, menos fila pra quem precisa.",
    4: "Lula já começou 2.876 postos de saúde novos no Brasil. Bolsonaro, em quatro anos, 713. Flávio Bolsonaro planeja cortar até 250 bilhões.",
    5: "Compartilhe com quem já pegou fila no posto de saúde.",
}
FRASE_FECHO = "Posto de saúde novo pelo Brasil todo"
SELO = ["A CONSTRUÇÃO DE POSTOS", "ESTÁ AMEAÇADA"]   # selo vermelho do cartão da abertura (a prévia do WhatsApp), em linhas
SELO_PALAVRA = "construção"                           # o selo entra quando a voz chega nesta palavra
FONTE_DADO = "Ministério da Saúde, SISMOB: construções de UBS iniciadas de 2019 a out/2026"
FONTE_CORTE = FONTE_DADO + " · Plano de até R$ 250 bi: Folha de S.Paulo, out/2026"


def dados() -> int:
    serie = collections.defaultdict(lambda: [0, 0])
    with open(BASE, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f, delimiter=";"):
            if r["indicador"] != "ubs_construcao_iniciada" or r["ano"] not in BOLSONARO | LULA:
                continue
            chave = "BR" if r["cod_ibge"] == "0000000" else r["cod_ibge"]
            serie[chave][r["ano"] in LULA] += round(float(r["valor"] or 0))
            if chave != "BR":
                serie[r["uf"]][r["ano"] in LULA] += round(float(r["valor"] or 0))
    ufs = {k: v for k, v in serie.items() if not k.isdigit()}
    municipios = {k: v for k, v in sorted(serie.items()) if k.isdigit()}
    DADOS.write_text(json.dumps({"periodo": "2019-2022 contra 2023-out/2026", "ufs": ufs, "municipios": municipios},
                                ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    cidades = sum(1 for a, b in municipios.values() if b > 0 and b >= 2 * a)
    print(f"{DADOS.name}: {cidades} cidades com número próprio; Brasil {ufs['BR']}; "
          f"estados que não passam: {[u for u, (a, b) in ufs.items() if b <= a]}")
    return 0


def mil(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def roteiro(ped: dict, dd: dict) -> dict:
    nomes = ped.get("nomes") or {}
    cidade, uf, ibge = limpa(ped["municipio"]["municipio"]), ped["municipio"]["uf"], str(ped["municipio"]["cod_ibge"])
    bairro = limpa(nomes.get("bairro")) if nomes.get("regra") == "pares" else ""
    resto = "Quando a filha fica doente, é fila de madrugada no posto."
    no_bairro, do_bairro = lugar_falado.no_lugar(bairro), lugar_falado.do_lugar(bairro)   # None: nome que não se fala
    f0 = ([f"A Dona Marta mora {no_bairro}, aqui {lugar_falado.em_cidade(cidade)}. {resto}"] if no_bairro else []) + \
         [f"A Dona Marta mora aqui {lugar_falado.em_cidade(cidade)}. {resto}", f"A Dona Marta mora aqui {lugar_falado.em_cidade(cidade)}. Filha doente é fila de madrugada no posto."]
    antes, agora = dd["municipios"].get(ibge, [0, 0])
    if agora > 0 and agora >= 2 * antes:
        alcance, onde, rotulo = "cidade", (f"Aqui na cidade {lugar_falado.de_cidade(cidade)}" if cidade == NOMES_UF[uf] else f"Aqui {lugar_falado.em_cidade(cidade)}"), f"{cidade} - {uf}"
    elif dd["ufs"][uf][1] > dd["ufs"][uf][0]:
        alcance, onde, rotulo = "estado", ESTADOS[uf][0], NOMES_UF[uf]
        antes, agora = dd["ufs"][uf]
    else:
        alcance, onde, rotulo = "brasil", "No Brasil", "Brasil"
        antes, agora = dd["ufs"]["BR"]
    postos = "1 posto de saúde novo" if agora == 1 else f"{mil(agora)} postos de saúde novos"
    bolso = "nenhum" if antes == 0 else "foi 1" if antes == 1 else f"foram {mil(antes)}"
    if alcance == "brasil":
        f3 = [f"No Brasil, o governo Lula começou a construir {postos}."]
    else:
        f3 = [f"{onde}, o governo Lula começou a construir {postos}. No governo Bolsonaro, {bolso}.",
              f"{onde}, Lula começou a construir {postos}. Com Bolsonaro, {bolso}."]
    razao = agora / antes if antes else 0
    selo = ("Com Bolsonaro, nenhum" if antes == 0 else f"{int(razao)} vezes mais" if razao >= 4
            else "Mais que o triplo" if razao >= 3 else "Mais que o dobro" if razao >= 2 else f"+{round((razao - 1) * 100)}%")

    def info_dado(leg, extra):
        """A cena hd_dado (InfoHistoria.tsx), com os frames em que a fala diz o número de Lula e "Bolsonaro"."""
        t_lula = H.tempo_palavra(leg, "Lula", extra=extra) - H.ATRASO / H.FPS
        return {"tipo": "hd_dado", "local": rotulo, "titulo": "Postos de saúde novos", "sub": "construções de UBS começadas",
                "icone": "posto", "antes": antes, "agora": agora, "selo": selo,
                "tAgora": H.quadro(H.tempo_palavra(leg, mil(agora), depois=t_lula * extra, extra=extra)),
                "tAntes": H.quadro(H.tempo_palavra(leg, "Bolsonaro", extra=extra))}

    abertura = f"Atenção, morador {do_bairro or lugar_falado.de_cidade(cidade)}: a construção de posto de saúde está ameaçada. Entenda por quê."
    for t in [*f0, *f3, abertura]:
        lugar_falado.confere(t)   # trava: nenhuma fala com "bairro X"
    return {"falas": {0: f0, 3: f3}, "alcance": alcance, "info_dado": info_dado, "abertura": abertura,
            "morador": lugar_falado.de_cidade(cidade),   # o cartão da prévia traz a cidade, nunca o bairro (Gui, 21/10)
            "morador_fala": do_bairro or lugar_falado.de_cidade(cidade), "local": f"{cidade} - {uf}"}


def info_corte(leg) -> dict:
    """A cena hd_corte: Lula 2.876 quando a voz diz o número, Bolsonaro 713 no "713" e o selo logo depois."""
    return {"tipo": "hd_corte", "titulo": "Postos de saúde novos começados", "va": 713, "vb": 2876, "rotB": "Governo Lula, até out/2026",
            "selo": "4 vezes mais", "tA": H.quadro(H.tempo_palavra(leg, "713")), "tB": H.quadro(H.tempo_palavra(leg, "2.876")),
            "tSelo": H.quadro(H.fim_palavra(leg, "713") + 0.2), "flavio": H.quadro(H.tempo_palavra(leg, "Flávio")),
            "t250": H.quadro(H.tempo_palavra(leg, "250"))}


def carregar() -> dict:
    return json.loads(DADOS.read_text(encoding="utf-8"))


if __name__ == "__main__":
    sys.exit(H.main(sys.modules[__name__], __doc__))
