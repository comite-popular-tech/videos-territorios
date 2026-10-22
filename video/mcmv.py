"""Vídeo "Casa nova" (Minha Casa, Minha Vida faixa 1, roteiro 4 de video/roteiros-narracao.md), com a Dona Marta.

  python video/mcmv.py dados               # gera video/mcmv.json (vai no git)
  python video/mcmv.py pecas               # peças que não mudam (clipes do Flow, corte, compartilhe)
  python video/mcmv.py montar <slug ...>   # exemplos no PC, em E:/30000-cards/mcmv-exemplos/
  python video/mcmv.py janelas <slug ...>  # mede as falas que mudam (para as JANELAS)
  python video/mcmv.py subir               # sobe ao R2 da fila os comuns (clipes, música, peças prontas)
  python video/mcmv.py semear [--simular]  # cadastra e semeia o trabalho video-mcmv (só com o OK do Gui)
  pela fila: video/trabalhos/video-mcmv.sh -> video_mcmv.py

Montagem em historia_dados.py, no padrão de massa do Mais Médicos; infográficos no Remotion (src/InfoHistoria.tsx).
Entradas em video/public/mcmv/: clip1-3.mp4 (Flow), musica.mp3 e a foto de cada cidade (<uf>-<cidade>.jpg, a mesma do
kit da fila em entradas/fundos/).

Dados: indicador mcmv_faixa1_contratadas de dados/comparacao_governos/comparacao_governos.csv (moradias da faixa 1
contratadas por ano de assinatura: FAR, FDS e Rural), soma de 2019 a 2022 contra a soma de 2023 a jun/2026. Regra da
cena 4:
  cidade  contratou com Lula e nenhuma com Bolsonaro (inclui as 1 a 19 casas, que o roteiro deixa a critério do Gui);
  estado  a cidade não contratou com Lula: fala o estado, que não contratou nenhuma com Bolsonaro;
  brasil  o estado contratou com Bolsonaro (só o Amapá: 1.500 em Macapá em 2019).
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
from maismedicos_comum import NOMES_UF, falado as falado_mm  # noqa: E402
from pedemeia_comum import ESTADOS, VIDEO, limpa  # noqa: E402

NOME = "mcmv"
TRABALHO = "video-mcmv"
DESCRICAO = "Vídeo vertical Casa nova (Minha Casa, Minha Vida faixa 1), por território"
PUB = VIDEO / "public" / "mcmv"
SAIDA = Path(os.environ.get("MCMV_SAIDA", "E:/30000-cards/mcmv-exemplos"))
DADOS = VIDEO / "mcmv.json"
BASE = VIDEO.parent / "dados" / "comparacao_governos" / "comparacao_governos.csv"
BOLSONARO, LULA = {"2019", "2020", "2021", "2022"}, {"2023", "2024", "2025", "2026"}
JANELAS = {0: 8.0, 3: 9.4}       # segundos de render; piloto (ver `janelas`): fala 1 de 6,4 a 7,9 s, fala 4 de 8,6 a 9,3 s
FUNDO_CORTE = 1                  # o corte fica sobre o último quadro do clipe 2 (a porta da casa nova)
FIXAS = {
    1: "Pelo Minha Casa, Minha Vida, ela abriu a porta da casa própria.",
    2: "Agora cada filho tem sua cama. E a casa é dela.",
    4: "Com Bolsonaro, a faixa 1 parou: 1.500 casas em quatro anos, no Brasil inteiro. Flávio Bolsonaro planeja cortar até 250 bilhões.",
    5: "Compartilhe com quem sonha em sair do aluguel.",
}
FRASE_FECHO = "Minha Casa, Minha Vida: a casa própria"
SELO = ["O MINHA CASA, MINHA VIDA", "ESTÁ AMEAÇADO"]   # selo vermelho do cartão da abertura (a prévia do WhatsApp), em linhas
SELO_PALAVRA = "minha"                                 # o selo entra quando a voz chega nesta palavra
FONTE_DADO = "Ministério das Cidades, Minha Casa, Minha Vida faixa 1: moradias contratadas de 2019 a jun/2026"
FONTE_CORTE = FONTE_DADO + " · Plano de até R$ 250 bi: Folha de S.Paulo, out/2026"


def dados() -> int:
    serie = collections.defaultdict(lambda: [0, 0])
    with open(BASE, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f, delimiter=";"):
            if r["indicador"] != "mcmv_faixa1_contratadas" or r["ano"] not in BOLSONARO | LULA:
                continue
            chave = "BR" if r["cod_ibge"] == "0000000" else r["cod_ibge"]
            serie[chave][r["ano"] in LULA] += round(float(r["valor"] or 0))
            if chave != "BR":
                serie[r["uf"]][r["ano"] in LULA] += round(float(r["valor"] or 0))
    ufs = {k: v for k, v in serie.items() if not k.isdigit()}
    municipios = {k: v for k, v in sorted(serie.items()) if k.isdigit()}
    DADOS.write_text(json.dumps({"periodo": "2019-2022 contra 2023-jun/2026", "ufs": ufs, "municipios": municipios},
                                ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    cidades = sum(1 for a, b in municipios.values() if b > 0 and a == 0)
    print(f"{DADOS.name}: {cidades} cidades com número próprio; Brasil {ufs['BR']}; "
          f"estados com Bolsonaro > 0: {[u for u, (a, b) in ufs.items() if a and u != 'BR']}")
    return 0


def falado(n: int) -> str:
    """Casas ditas na voz: inteiro abaixo de mil, a centena de mil a 9.999 ("3 mil", "7 mil e 500"), o milhar acima."""
    return falado_mm(n) if n < 10000 else f"{round(n / 1000)} mil"


def casas(n: int) -> str:
    return "1 casa" if n == 1 else f"{falado(n)} casas"


def roteiro(ped: dict, dd: dict) -> dict:
    nomes = ped.get("nomes") or {}
    cidade, uf, ibge = limpa(ped["municipio"]["municipio"]), ped["municipio"]["uf"], str(ped["municipio"]["cod_ibge"])
    bairro = limpa(nomes.get("bairro")) if nomes.get("regra") == "pares" else ""
    resto = "Um cômodo só, com os dois filhos."
    no_bairro, do_bairro = lugar_falado.no_lugar(bairro), lugar_falado.do_lugar(bairro)   # None: nome que não se fala
    f0 = ([f"A Dona Marta morava de aluguel {no_bairro}, aqui em {cidade}. {resto}"] if no_bairro else []) + \
         [f"A Dona Marta morava de aluguel aqui em {cidade}. {resto}", f"A Dona Marta morava de aluguel aqui em {cidade}. Um cômodo só."]
    antes, agora = dd["municipios"].get(ibge, [0, 0])
    if agora > 0 and antes == 0:
        alcance, onde, rotulo = "cidade", (f"Aqui na cidade de {cidade}" if cidade == NOMES_UF[uf] else f"Aqui em {cidade}"), f"{cidade} - {uf}"
    elif dd["ufs"][uf][0] == 0:
        alcance, onde, rotulo = "estado", ESTADOS[uf][0], NOMES_UF[uf]
        antes, agora = dd["ufs"][uf]
    else:
        alcance, onde, rotulo = "brasil", "No Brasil", "Brasil"
        antes, agora = dd["ufs"]["BR"]
    if alcance == "brasil":
        f3 = [f"No Brasil, o governo Lula contratou {casas(agora)} para as famílias de renda mais baixa."]
    else:
        f3 = [f"{onde}, o governo Lula contratou {casas(agora)} para as famílias de renda mais baixa. Com Bolsonaro, nenhuma.",
              f"{onde}, o governo Lula contratou {casas(agora)} da faixa 1. Com Bolsonaro, nenhuma."]

    def info_dado(leg, extra):
        """A cena hd_dado (InfoHistoria.tsx), com os frames em que a fala diz o número de Lula e "Bolsonaro"."""
        t_lula = H.tempo_palavra(leg, "Lula", extra=extra) - H.ATRASO / H.FPS
        return {"tipo": "hd_dado", "local": rotulo, "titulo": "Minha Casa, Minha Vida · faixa 1", "sub": "casas para as famílias de renda mais baixa",
                "icone": "casa", "antes": antes, "agora": agora, "selo": "Com Bolsonaro, nenhuma" if antes == 0 else "",
                "tAgora": H.quadro(H.tempo_palavra(leg, falado(agora).split()[0], depois=t_lula * extra, extra=extra)),
                "tAntes": H.quadro(H.tempo_palavra(leg, "Bolsonaro", extra=extra))}

    abertura = f"Atenção, morador {do_bairro or lugar_falado.de_cidade(cidade)}: o Minha Casa, Minha Vida está ameaçado. Entenda por quê."
    for t in [*f0, *f3, abertura]:
        lugar_falado.confere(t)   # trava: nenhuma fala com "bairro X"
    return {"falas": {0: f0, 3: f3}, "alcance": alcance, "info_dado": info_dado, "abertura": abertura,
            "morador": lugar_falado.de_cidade(cidade),   # o cartão da prévia traz a cidade, nunca o bairro (Gui, 21/10)
            "morador_fala": do_bairro or lugar_falado.de_cidade(cidade), "local": f"{cidade} - {uf}"}


def info_corte(leg) -> dict:
    """A cena hd_corte: as barras do Brasil (1.500 contra 290.652) quando a voz diz "1.500", o selo no "parou"."""
    t_a = H.quadro(H.tempo_palavra(leg, "1.500"))
    return {"tipo": "hd_corte", "titulo": "Faixa 1 do Minha Casa, Minha Vida", "va": 1500, "vb": 290652, "rotB": "Governo Lula, até jun/2026",
            "selo": "A faixa 1 parou", "tA": t_a, "tB": t_a + 15, "tSelo": H.quadro(H.tempo_palavra(leg, "parou")),
            "flavio": H.quadro(H.tempo_palavra(leg, "Flávio")), "t250": H.quadro(H.tempo_palavra(leg, "250"))}


def carregar() -> dict:
    return json.loads(DADOS.read_text(encoding="utf-8"))


if __name__ == "__main__":
    sys.exit(H.main(sys.modules[__name__], __doc__))
