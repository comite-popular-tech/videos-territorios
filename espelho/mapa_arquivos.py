# -*- coding: utf-8 -*-
"""Mapa {slug do território: {material: id do arquivo no Drive}} para a planilha pública (Gui, 23/10: uma coluna por
material, com o link do Drive ao lado do link do site). O id é sempre do arquivo de verdade (na Base de conteúdos
internos, em Conteúdo por cidade ou na pasta oficial da CPL), nunca o de um atalho.

Chaves: as do VIDEOS do site (saude, insulina, ..., aposentados, bolsa-familia, cpl-educacao, cpl-aposentados), os
cards da CPL (card:educacao, card:aposentados, card:bolsa-familia) e "cards", a pasta dos 12 cards do território.
Material por município vai em todo slug em que o site o mostra, bairros incluídos. O que não está nas listagens fica
de fora (rodar de novo com listagens novas completa).

  python -I espelho/mapa_arquivos.py base.json cidades.json pastas.json cpl.json saida.json
    base.json, cidades.json   rclone lsjson -R --files-only das duas árvores
    pastas.json               rclone lsjson -R --dirs-only de Conteúdo por cidade
    cpl.json                  rclone lsjson -R --files-only da pasta da CPL (atalhos_cpl.py)
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))          # python -I não põe a pasta do script no path
from espelho_drive import DESTINO as CIDADES, indice, no_caminho, rotulos   # noqa: E402
from base_interna import DESTINO as BASE, MATERIAIS, MUNICIPAIS, base_da_cidade, nome_do_arquivo   # noqa: E402
from atalhos_cpl import ITENS as ITENS_CPL, planejar   # noqa: E402
from inventario import do_site   # noqa: E402

# item da CPL (subpasta, nome) -> chave no mapa
CHAVE_CPL = {ITENS_CPL[0][2]: "cpl-educacao", ITENS_CPL[1][2]: "cpl-aposentados", ITENS_CPL[2][2]: "card:educacao",
             ITENS_CPL[3][2]: "card:aposentados", ITENS_CPL[4][2]: "bolsa-familia", ITENS_CPL[5][2]: "card:bolsa-familia"}


def ids(arq, raiz) -> dict:
    """{caminho a partir da raiz do Drive: id do arquivo de verdade} ("<alvo>\\t<atalho>" no atalho)."""
    return {f"{raiz}/{i['Path']}": i["ID"].split("\t")[0] for i in json.loads(Path(arq).read_text(encoding="utf-8"))}


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    base_json, cidades_json, pastas_json, cpl_json, saida = sys.argv[1:6]
    existe = ids(base_json, BASE) | ids(cidades_json, CIDADES)
    pastas = ids(pastas_json, CIDADES)
    videos, cards_cpl = do_site()
    plano_cpl, _ = planejar(cpl_json, pastas_json)
    mapa = {}
    for c in indice():
        uf, nome, terrs = c[2], c[1], c[5]
        base, nomes, varios = base_da_cidade(c), rotulos(terrs), len(terrs) > 1
        cpl = {CHAVE_CPL[(sub, rot)]: origem for sub, rot, origem in plano_cpl.get((uf, nome), ("", []))[1]}
        for t in terrs:
            d = {}
            for m, (pasta, _r, _k) in MATERIAIS.items():
                if m in MUNICIPAIS:
                    if t[0] not in videos.get(m, {}): continue
                    arq = nome_do_arquivo(m, "")
                else:
                    if videos.get(m, {}).get(t[0]) != 1: continue
                    arq = nome_do_arquivo(m, nomes[t[0]])
                i = existe.get(f"{base}/{pasta}/{arq}") or existe.get(f"{CIDADES}/{uf}/{nome}/Vídeo/{arq}")
                if i: d[m] = i
            for k, i in cpl.items():
                fonte = cards_cpl.get(k[5:], {}) if k.startswith("card:") else videos.get(k, {})
                if t[0] in fonte: d[k] = i
            pasta = f"{CIDADES}/{uf}/{nome}/Cards" + (f"/{no_caminho(t[1])}" if varios and t[1] else "")
            if pasta in pastas: d["cards"] = pastas[pasta]
            if d: mapa[t[0]] = d
    Path(saida).write_text(json.dumps(mapa, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    cont = {}
    for d in mapa.values():
        for k in d: cont[k] = cont.get(k, 0) + 1
    print(f"{len(mapa)} territórios; por chave: {dict(sorted(cont.items()))}")


if __name__ == "__main__":
    main()
