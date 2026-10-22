"""O bairro do jeito que o povo fala, para toda narração por território (regra do Gui, 21/10/2026): "no Capão Redondo",
"na Vila Prudente", "em São Mateus", "nos Campos Elíseos", "na zona rural". Nunca "no bairro X".

  no_lugar("Vila Prudente")   -> "na Vila Prudente"     (onde a pessoa mora)
  do_lugar("Vila Prudente")   -> "da Vila Prudente"     ("morador da Vila Prudente")
  confere(texto)              -> erro se a fala tiver "bairro X" (trava: chamar em todo roteiro antes da voz)

Os dois devolvem None quando o nome não dá para falar (abreviação, número, "Setor 09"): aí o roteiro usa a versão sem
bairro. A preposição sai do primeiro termo; na dúvida "no", porque muito nome em -a é masculino ("no Ipiranga").

  python video/lugar_falado.py          # lista como sai cada bairro dos territórios, para conferir de olho
  python video/lugar_falado.py --json   # e grava video/lugar_falado.json ({bairros: {nome: [no, do]}, cidades}) para
                                        # os trabalhos em Node (insulina); rodar de novo quando o kit ganhar bairro
"""
import re
import unicodedata

NA = {"vila", "cidade", "comunidade", "colonia", "chacara", "fazenda", "granja", "quadra", "localidade", "aldeia", "santa",
      "nova", "boa", "bela", "barra", "praia", "ilha", "ponta", "serra", "lagoa", "vista", "varzea", "cachoeira", "agua",
      "linha", "cohab", "estancia", "freguesia", "zona", "baixada", "mata", "casa", "fonte", "colina", "pedra", "penha",
      "mooca", "lapa", "brasilandia", "pompeia", "cachoeirinha", "tijuca", "gavea", "urca", "gloria", "republica", "saude",
      "esplanada", "conquista", "independencia", "samambaia", "ceilandia", "asa", "rocinha", "mangueira", "mare", "areia",
      "vida", "queimadinha", "pitanguinha", "aparecida", "favela", "ladeira", "rua", "estrada", "esperanca", "floresta",
      "harmonia", "fortuna", "feitoria", "engenhoca", "estiva", "fazendinha", "castanheira", "gaivota", "igreja", "coroa",
      "costa", "enseada", "estaca", "morada", "caixa", "assistencia", "contenda", "dona", "gralha", "agrovila", "fazenda",
      "ponte", "pajucara", "prainha", "represa", "rocinha", "usina", "vargem", "volta", "fazendinha", "chapada", "cruz",
      "terra", "lagoinha", "olaria", "palmeira", "pedreira", "piedade", "planicie", "primavera", "ribeira", "rosa", "sede",
      "lomba", "matinha", "mangabeira", "padroeira", "promissao", "madre", "alvorada", "aurora", "cascata", "moradia",
      "se", "paz", "liberdade", "uniao", "vitoria", "gloria", "cohatrac", "terra", "varginha", "campina", "restinga", "invernada"}
# masculinos terminados em -a que o povo diz com "no" (o resto em -a sem artigo conhecido vai com "em", que não erra)
NO_A = {"ipiranga", "itaquera", "jurunas", "guajuviras", "janga", "jaguare", "tatuape", "jabaquara", "panorama",
        "planalto", "jacuecanga", "mathias", "canafistula", "cosmorama"}
EM = {"sao", "santo", "santos", "nossa", "tres", "santana", "nazare", "fatima", "brasilia", "copacabana", "cajazeiras",
      "itaporanga", "itapua", "paripe", "cumbuco", "papicu", "camacari", "valparaiso", "bonsucesso", "limoeiro"}
NOS = {"campos", "sitios", "altos", "jardins", "coqueiros", "bairros"}
NAS = {"aguas", "palmeiras", "mangabeiras", "dunas", "pedras", "flores", "chacaras", "colinas", "oficinas", "bananeiras",
       "forquilhas", "casas", "laranjeiras", "malvinas", "mercês", "merces", "quintas", "rocas", "torres", "vinhas"}
RURAL = re.compile(r"^(zona rural|rural|area rural|zona rural .*|.*rural)$")
# abreviações do levantamento (2026-10-21): "Dist de Jaguara", "V Castelo Branco", "Jad São Marcos"
ABREVIADO = {"dist": "Distrito", "distr": "Distrito", "v": "Vila", "vl": "Vila", "jd": "Jardim", "jad": "Jardim", "jard": "Jardim",
             "assent": "Assentamento", "comun": "Comunidade", "plan": "Planalto", "conj": "Conjunto", "pq": "Parque",
             "res": "Residencial", "sta": "Santa", "sto": "Santo", "nsa": "Nossa"}
FIM_NUMERO = re.compile(r"(\s+([ivx]+|\d+[a-z]?))+$", re.I)    # "Cidade Nova I", "Sol Nascente 2", "Cohab V"
GENERICO = {"setor", "zona", "conjunto", "distrito", "quadra", "lote", "bairro", "area", "etapa", "fase", "gleba", "nucleo"}


def _sem(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def no_lugar(bairro: str):
    """'no X' / 'na X' / 'em X' / 'nos X' / 'nas X' / 'na zona rural'; None se o nome não dá para falar."""
    b = " ".join(str(bairro or "").split())
    if len(b) >= 20:
        return None   # o CNES corta o bairro em 20 letras ("Distrito de Aparecid"): nome cortado não se fala
    if RURAL.match(_sem(b)):
        return "na zona rural"
    b = FIM_NUMERO.sub("", b).strip()
    palavras = b.split()
    if not palavras:
        return None
    if _sem(palavras[0]) in ABREVIADO:
        palavras[0] = ABREVIADO[_sem(palavras[0])]
        b = " ".join(palavras)
    n = _sem(b)
    if re.search(r"\d", n) or not re.search(r"[a-z]{2}", n) or (len(palavras) == 1 and n in GENERICO):
        return None
    if n == "centro":
        return "no Centro"
    p = _sem(palavras[0])
    if len(p) < 2 or p in GENERICO - {"conjunto", "distrito", "setor", "nucleo", "bairro"} and len(palavras) == 1:
        return None
    if p in EM:
        return f"em {b}"
    if p in NOS or p in NAS:
        return f"{'nos' if p in NOS else 'nas'} {b}"
    if p in NA or p.endswith(("cao", "dade", "gem")):
        return f"na {b}"
    if p.endswith(("a", "as")) and p not in NO_A:
        return f"em {b}"   # nome próprio em -a sem artigo conhecido ("em Goiânia", "em Campinas"): "no" ou "na" podiam errar
    return f"no {b}"


def do_lugar(bairro: str):
    """A mesma regra com 'de': 'do Capão Redondo', 'da Vila Prudente', 'de São Mateus'."""
    no = no_lugar(bairro)
    if no is None:
        return None
    prep, resto = no.split(" ", 1)
    return {"no": "do", "na": "da", "nos": "dos", "nas": "das", "em": "de"}[prep] + " " + resto


# cidades que o povo diz com artigo ("morador do Rio de Janeiro"); o resto vai com "de"
CIDADE_COM_ARTIGO = {"Rio de Janeiro": "o", "Recife": "o", "Crato": "o", "Cabo de Santo Agostinho": "o", "Guarujá": "o",
                     "Rio Grande": "o", "Gama": "o", "Lapa": "a"}


def de_cidade(cidade: str) -> str:
    """'de São Paulo', 'do Rio de Janeiro'."""
    art = CIDADE_COM_ARTIGO.get(cidade)
    return f"{'do' if art == 'o' else 'da'} {cidade}" if art else f"de {cidade}"


def confere(texto: str) -> str:
    """Trava: a fala não pode ter "bairro X" (nem "no bairro", "do bairro", "o bairro"). Devolve o texto."""
    if re.search(r"\bbairro\s+[A-ZÀ-Ý]", texto):
        raise ValueError(f'fala com "bairro X" (use video/lugar_falado.py): {texto}')
    return texto


if __name__ == "__main__":
    import collections
    import json
    import sys
    from pathlib import Path

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    terr = Path(__file__).resolve().parents[1] / "saida" / "territorios"
    vistos = collections.Counter()
    for f in terr.glob("*--*/pedidos.json"):
        nomes = json.loads(f.read_text(encoding="utf-8")).get("nomes") or {}
        if nomes.get("regra") == "pares" and nomes.get("bairro"):
            vistos[" ".join(str(nomes["bairro"]).replace(" ", " ").split())] += 1
    if "--json" in sys.argv:
        tabela = {"bairros": {b: [no_lugar(b), do_lugar(b)] for b in sorted(vistos) if no_lugar(b)},
                  "cidades": {c: de_cidade(c) for c in CIDADE_COM_ARTIGO}}
        destino = Path(__file__).resolve().parent / "lugar_falado.json"
        destino.write_text(json.dumps(tabela, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{destino.name}: {len(tabela['bairros'])} bairros")
    else:
        for b, _n in sorted(vistos.items()):
            print(f"{b:40} {no_lugar(b) or '(sem bairro)':45} {do_lugar(b) or ''}")
