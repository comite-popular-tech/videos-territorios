# -*- coding: utf-8 -*-
"""Manda para a lixeira do Drive o que saiu do site (cards.boralula.org), nas duas árvores: "Conteúdo por cidade" e
"Base de conteúdos internos". Nunca apaga de vez: a lixeira guarda 30 dias.

A lista é a mesma que o espelho e a base usam para não subir (fora_do_ar.json): {"<tipo>": ["<slug>", ...]}, com o tipo
do vídeo (o da fila e do site: saude, insulina, merenda...) ou "cards" (os 12 cards do território).
  vídeo:  Base de conteúdos internos/<Região>/<UF>/<Intermediária>/<Cidade>/<tema>/Vídeo/<título>[ - bairro].mp4
          Conteúdo por cidade/<UF>/<Cidade>/Vídeo/<título>[ - bairro].mp4 (atalho ou arquivo)
  cards:  Conteúdo por cidade/<UF>/<Cidade>/Cards/[bairro/]Preto|Colorido/<slug>-p1.jpg ... -k6.jpg

  python -I espelho/retirar.py --simular                 # mostra o que iria para a lixeira
  python -I espelho/retirar.py --jobs 4
  python -I espelho/retirar.py --lista outra.json --indice-antigo indice-de-ontem.json
O nome do arquivo sai do índice do site (bairro e número do bairro repetido); território que já saiu do índice precisa
de --indice-antigo, um indice.json de quando ele estava lá.
"""
import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))          # python -I não põe a pasta do script no path
from espelho_drive import DESTINO as CIDADES, Rclone, indice, rotulos   # noqa: E402
from base_interna import DESTINO as BASE, MATERIAIS, base_da_cidade, nome_do_arquivo   # noqa: E402


def caminhos(cid, tipos_por_slug) -> list[str]:
    """Os caminhos possíveis (pode não existir nenhum) do que sai desta cidade."""
    slug_cid, nome, uf, terrs = cid[0], cid[1], cid[2], cid[5]
    nomes, varios, out = rotulos(terrs), len(terrs) > 1, []
    base = base_da_cidade(cid)
    for t in terrs:
        for tipo in sorted(tipos_por_slug.get(t[0], ())):
            if tipo == "cards":
                pasta = f"{CIDADES}/{uf}/{nome}/Cards/{t[1] + '/' if varios and t[1] else ''}"
                out += [f"{pasta}{e}/{t[0]}-{p}{n}.jpg" for e, p in (("Preto", "p"), ("Colorido", "k")) for n in range(1, 7)]
            else:
                arq = nome_do_arquivo(tipo, nomes[t[0]])
                out += [f"{base}/{MATERIAIS[tipo][0]}/{arq}", f"{CIDADES}/{uf}/{nome}/Vídeo/{arq}"]
    return out


def executar(cid, rc, tipos_por_slug, simular, existentes=None):
    alvo = caminhos(cid, tipos_por_slug)
    existem = existentes or set()
    if existentes is None:                         # sem --listagens: lista as pastas da cidade (lento com muitas cidades)
        for pasta in sorted({c.rsplit("/", 1)[0] for c in alvo}):
            existem |= {f"{pasta}/{i['Name']}" for i in rc.listar(pasta, recursivo=False) if not i["IsDir"]}
    fora = [c for c in alvo if c in existem]
    if simular:
        for c in fora:
            print(f"  [simular] lixeira: {c}")
        return len(fora)
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(rc.lixeira, fora))
    return len(fora)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--lista", default=str(Path(__file__).with_name("fora_do_ar.json")))
    ap.add_argument("--indice-antigo", help="indice.json com os territórios que já saíram do site")
    ap.add_argument("--listagens", nargs=2, metavar=("BASE", "CIDADES"),
                    help="saída de `rclone lsjson -R --fast-list --files-only` das duas árvores (base e Conteúdo por "
                         "cidade): em vez de listar pasta por pasta, só manda à lixeira o que aparece nelas")
    ap.add_argument("--remote", default="espelho")
    ap.add_argument("--jobs", type=int, default=3, help="cidades ao mesmo tempo")
    ap.add_argument("--simular", action="store_true")
    a = ap.parse_args()

    lista = {k: v for k, v in json.loads(Path(a.lista).read_text(encoding="utf-8")).items() if k != "_"}
    if set(lista) - set(MATERIAIS) - {"cards"}:
        sys.exit(f"PARE: tipo desconhecido: {', '.join(set(lista) - set(MATERIAIS) - {'cards'})}")
    tipos_por_slug = {}
    for tipo, slugs in lista.items():
        for s in slugs:
            tipos_por_slug.setdefault(s, set()).add(tipo)
    cidades = {c[0]: c for c in indice()}
    if a.indice_antigo:                                # a cidade como era, para quem já saiu do índice
        antigo = {c[0]: c for c in json.loads(Path(a.indice_antigo).read_text(encoding="utf-8"))}
        no_indice = {t[0] for c in cidades.values() for t in c[5]}
        for c in antigo.values():
            if any(t[0] in tipos_por_slug and t[0] not in no_indice for t in c[5]):
                cidades[c[0] + " (antigo)"] = c
    alvo = [c for c in cidades.values() if any(t[0] in tipos_por_slug for t in c[5])]
    achados = {t[0] for c in alvo for t in c[5]}
    sem = sorted(set(tipos_por_slug) - achados)
    if sem:
        print(f"AVISO: {len(sem)} slugs fora do índice (passe --indice-antigo): {', '.join(sem[:20])}")
    print(f"{len(alvo)} cidades, {sum(len(v) for v in lista.values())} itens na lista{' (simulação)' if a.simular else ''}")

    existentes = None
    if a.listagens:
        existentes = set()
        for raiz, arq in zip((BASE, CIDADES), a.listagens):
            existentes |= {f"{raiz}/{i['Path']}" for i in json.loads(Path(arq).read_text(encoding="utf-8"))}
    rc = Rclone(a.remote)
    erros, total, t0 = [], 0, time.time()
    try:
        with ThreadPoolExecutor(a.jobs) as ex:
            futuros = {ex.submit(executar, c, rc, tipos_por_slug, a.simular, existentes): c for c in alvo}
            for n, f in enumerate(as_completed(futuros), 1):
                c = futuros[f]
                try:
                    total += f.result()
                    print(f"[{n}/{len(alvo)}] {c[1]} - {c[2]}: {f.result()} {'a mandar' if a.simular else 'na lixeira'}", flush=True)
                except Exception as e:
                    erros.append((c[0], str(e)))
                    print(f"[{n}/{len(alvo)}] ERRO {c[1]} - {c[2]}: {e}", flush=True)
    finally:
        rc.fechar()
    print(f"fim: {total} arquivos {'a mandar para a' if a.simular else 'na'} lixeira, {len(erros)} cidades com erro, "
          f"{time.time() - t0:.0f} s")
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main()
