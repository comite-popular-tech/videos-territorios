# -*- coding: utf-8 -*-
"""Inventário site × Drive: o que cards.boralula.org mostra por território e por tipo contra o que existe nas duas
árvores do Drive ("Conteúdo por cidade" e "Base de conteúdos internos"). Imprime a tabela e grava a lista do que falta
(faltam.json, {item: [caminho, ...]}), para rodar de novo depois de cada subida até zerar.

O que o site mostra vem da própria página no ar (VIDEOS e CARDS_CPL, os mesmos objetos que a tela usa) e do
indice.json. O que existe vem de `rclone lsjson -R --fast-list --files-only` das duas árvores (atalho conta).

  R="espelho,root_folder_id=1zYnOUEpE5vmmRrcnwO7rgKE5rNkMZHVu:"
  rclone lsjson -R --fast-list --files-only --no-modtime "${R}Base de conteúdos internos" > base.json
  rclone lsjson -R --fast-list --files-only --no-modtime "${R}Conteúdo por cidade" > cidades.json
  python -I espelho/inventario.py base.json cidades.json [--faltam faltam.json]
"""
import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))          # python -I não põe a pasta do script no path
from espelho_drive import DESTINO as CIDADES, FORA_DO_AR, SITE, indice, no_caminho, rotulos   # noqa: E402
from base_interna import (DESTINO as BASE, MATERIAIS, MUNICIPAIS,  # noqa: E402
                          base_da_cidade, nome_do_arquivo)
from atalhos_cpl import ITENS as ITENS_CPL   # noqa: E402

# tipo do site (VIDEOS ou CARDS_CPL) -> (subpasta, nome) em Conteúdo por cidade/<UF>/<Cidade>/, do atalhos_cpl.py
CPL = {"v:cpl-educacao": ITENS_CPL[0][2], "v:cpl-aposentados": ITENS_CPL[1][2], "c:educacao": ITENS_CPL[2][2],
       "c:aposentados": ITENS_CPL[3][2], "v:bolsa-familia": ITENS_CPL[4][2], "c:bolsa-familia": ITENS_CPL[5][2]}


def do_site():
    req = urllib.request.Request(f"{SITE}/", headers={"User-Agent": "espelho-drive"})
    with urllib.request.urlopen(req, timeout=120) as r:
        h = r.read().decode("utf-8")
    out = {}
    for nome in ("VIDEOS", "CARDS_CPL"):
        m = re.search(r"(?:const|var|let)\s+" + nome + r"\s*=\s*(\{)", h)
        if not m:
            sys.exit(f"PARE: a página do site não tem {nome}")
        out[nome] = json.JSONDecoder().raw_decode(h[m.start(1):])[0]
    return out["VIDEOS"], out["CARDS_CPL"]


def esperado(cidades, videos, cards_cpl):
    """[(item, caminho)] de tudo que o site mostra, nas duas árvores."""
    out = []
    for c in cidades:
        uf, nome, terrs = c[2], c[1], c[5]
        pasta_cid, base, nomes, varios = f"{CIDADES}/{uf}/{nome}", base_da_cidade(c), rotulos(terrs), len(terrs) > 1
        slugs = [c[0]] + [t[0] for t in terrs]
        for m, (pasta, _rotulo, _chave) in MATERIAIS.items():
            mostra = videos.get(m, {})
            if m in MUNICIPAIS:
                if any(s in mostra for s in slugs):
                    arq = nome_do_arquivo(m, "")
                    out += [(f"{m} (base)", f"{base}/{pasta}/{arq}"), (f"{m} (cidade)", f"{pasta_cid}/Vídeo/{arq}")]
                continue
            for t in terrs:
                if mostra.get(t[0]) != 1 or t[0] in FORA_DO_AR.get(m, ()): continue
                arq = nome_do_arquivo(m, nomes[t[0]])
                out += [(f"{m} (base)", f"{base}/{pasta}/{arq}"), (f"{m} (cidade)", f"{pasta_cid}/Vídeo/{arq}")]
        for item, (sub, arq) in CPL.items():
            fonte = videos if item.startswith("v:") else cards_cpl
            if any(s in fonte.get(item[2:], {}) for s in slugs):
                out.append((item[2:] + (" (vídeo)" if item.startswith("v:") else " (card)"), f"{pasta_cid}/{sub}/{arq}"))
        for t in terrs:                                    # os 12 cards do território (espelho_drive.py)
            if t[0] in FORA_DO_AR.get("cards", ()): continue
            pasta = f"{pasta_cid}/Cards/{no_caminho(t[1]) + '/' if varios and t[1] else ''}"
            out += [("12 cards", f"{pasta}{e}/{t[0]}-{p}{n}.jpg") for e, p in (("Preto", "p"), ("Colorido", "k")) for n in range(1, 7)]
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("base", help="lsjson da Base de conteúdos internos")
    ap.add_argument("cidades", help="lsjson de Conteúdo por cidade")
    ap.add_argument("--faltam", default="faltam.json")
    a = ap.parse_args()
    existe = set()
    for raiz, arq in ((BASE, a.base), (CIDADES, a.cidades)):
        existe |= {f"{raiz}/{i['Path']}" for i in json.loads(Path(arq).read_text(encoding="utf-8"))}
    videos, cards_cpl = do_site()
    todos = esperado(indice(), videos, cards_cpl)
    tabela, faltam = {}, {}
    for item, cam in todos:
        n = tabela.setdefault(item, [0, 0])
        n[0] += 1
        if cam in existe:
            n[1] += 1
        else:
            faltam.setdefault(item, []).append(cam)
    print(f"{'item':34} {'site':>7} {'Drive':>7} {'faltam':>7}")
    for item in sorted(tabela):
        s, d = tabela[item]
        print(f"{item:34} {s:7} {d:7} {s - d:7}")
    s, d = sum(v[0] for v in tabela.values()), sum(v[1] for v in tabela.values())
    print(f"{'total':34} {s:7} {d:7} {s - d:7}")
    Path(a.faltam).write_text(json.dumps(faltam, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"lista do que falta: {a.faltam}")


if __name__ == "__main__":
    main()
