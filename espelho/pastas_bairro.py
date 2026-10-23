# -*- coding: utf-8 -*-
"""Uma pasta por bairro em "Conteúdo por cidade", só de atalhos (Gui, 23/10: a planilha de conteúdo leva o link do Drive
de cada cidade e de cada bairro). Nada é copiado: não ocupa cota nem mexe no que já subiu.

  <UF>/<Cidade>/Bairros/<Bairro>/     (o rótulo do nome dos vídeos: bairro repetido ganha número, como em Manaus)
    <título> - <Bairro>.mp4            atalho para o arquivo original de cada vídeo do bairro em <Cidade>/Vídeo/ (se lá
                                       ele já é atalho para a base, este aponta para o mesmo arquivo, nunca atalho de atalho)
    Aposentados.mp4                    o alerta municipal da cidade, quando houver
    Cards                              atalho para a pasta <Cidade>/Cards/<Bairro>/
    Tesoura do Flávio, Alerta          atalhos para as pastas da cidade (material da CPL, atalhos_cpl.py)
Cidade de um território só não ganha pasta Bairros.

Grava também o mapa {slug do site: id da pasta} (o bairro na pasta dele; a cidade de um território só na pasta da
cidade; "cidade:<UF>/<Cidade>" para todas), para a planilha. Pula o que já existe, então pode rodar de novo.

  R="espelho,root_folder_id=1zYnOUEpE5vmmRrcnwO7rgKE5rNkMZHVu:Conteúdo por cidade"
  rclone lsjson -R --fast-list --files-only --no-modtime "$R" > arquivos.json
  rclone lsjson -R --fast-list --dirs-only --no-modtime "$R" > pastas.json
  python -I espelho/pastas_bairro.py arquivos.json pastas.json --mapa drive_pastas.json [--uf SE] [--simular]
"""
import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))          # python -I não põe a pasta do script no path
from espelho_drive import indice, no_caminho, rotulos   # noqa: E402
from base_interna import MATERIAIS, MUNICIPAIS, nome_do_arquivo   # noqa: E402
from atalhos_cpl import Drive   # noqa: E402

SUBPASTAS_CIDADE = ("Tesoura do Flávio", "Alerta")


def alvo(i) -> str:
    """Id do arquivo de verdade: o lsjson do rclone dá "<alvo>\\t<atalho>" para atalho."""
    return i["ID"].split("\t")[0]


def planejar(cid, arquivos, pastas):
    """[(rótulo, slug, [(nome, id do alvo)])] dos bairros da cidade."""
    uf, nome, terrs = cid[2], cid[1], cid[5]
    p = f"{uf}/{nome}"
    nomes = rotulos(terrs)
    videos = {i["Name"]: alvo(i) for i in arquivos.get(f"{p}/Vídeo", [])}
    comuns = [(f"{nome_do_arquivo(m, '')}", videos[nome_do_arquivo(m, '')]) for m in MATERIAIS
              if m in MUNICIPAIS and nome_do_arquivo(m, "") in videos]
    comuns += [(s, pastas[f"{p}/{s}"]) for s in SUBPASTAS_CIDADE if f"{p}/{s}" in pastas]
    out = []
    for t in terrs:
        rot = nomes[t[0]] or t[0].split("--")[-1]
        itens = [(nome_do_arquivo(m, rot), videos[nome_do_arquivo(m, rot)]) for m in MATERIAIS
                 if m not in MUNICIPAIS and nome_do_arquivo(m, rot) in videos]
        if t[1] and f"{p}/Cards/{no_caminho(t[1])}" in pastas:
            itens.append(("Cards", pastas[f"{p}/Cards/{no_caminho(t[1])}"]))
        out.append((rot, t[0], itens + comuns))
    return out


def executar(drive, cid, plano, pastas, simular):
    """Cria o que falta; devolve ({slug: id da pasta do bairro}, atalhos criados)."""
    p = f"{cid[2]}/{cid[1]}"
    if simular:
        return {}, sum(len(itens) for _, _, itens in plano)
    raiz = pastas.get(f"{p}/Bairros")
    filhos = drive.filhos(raiz) if raiz else {}
    if not raiz:
        raiz = drive.criar("Bairros", pastas[p])
    mapa, feitos = {}, 0
    for rot, slug, itens in plano:
        pasta = filhos.get(rot.replace("／", "/"))
        ja = drive.filhos(pasta) if pasta else {}
        if not pasta:
            pasta = drive.criar(rot.replace("／", "/"), raiz)      # pela API vai a barra de verdade
            filhos[rot.replace("／", "/")] = pasta
        mapa[slug] = pasta
        for nome, origem in itens:
            nome = nome.replace("／", "/")
            if nome not in ja:
                drive.criar(nome, pasta, origem)
                ja[nome] = origem
                feitos += 1
    return mapa, feitos


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("arquivos", help="rclone lsjson -R --files-only de Conteúdo por cidade")
    ap.add_argument("pastas", help="rclone lsjson -R --dirs-only de Conteúdo por cidade")
    ap.add_argument("--mapa", required=True, help="JSON {slug: id da pasta}, atualizado (o que já tinha fica)")
    ap.add_argument("--uf", nargs="*")
    ap.add_argument("--jobs", type=int, default=8)
    ap.add_argument("--remote", default="espelho")
    ap.add_argument("--simular", action="store_true")
    a = ap.parse_args()
    arquivos = {}
    for i in json.loads(Path(a.arquivos).read_text(encoding="utf-8")):
        arquivos.setdefault(i["Path"].rsplit("/", 1)[0], []).append(i)
    pastas = {i["Path"]: i["ID"].split("\t")[0] for i in json.loads(Path(a.pastas).read_text(encoding="utf-8"))}
    cidades = indice()
    mapa = json.loads(Path(a.mapa).read_text(encoding="utf-8")) if Path(a.mapa).exists() else {}
    for c in cidades:                                  # cidade e cidade de um território só: a pasta da cidade
        if f"{c[2]}/{c[1]}" in pastas:
            mapa[f"cidade:{c[2]}/{c[1]}"] = pastas[f"{c[2]}/{c[1]}"]
            if len(c[5]) == 1:
                mapa[c[5][0][0]] = pastas[f"{c[2]}/{c[1]}"]
    alvo_cid = [c for c in cidades if len(c[5]) > 1 and (not a.uf or c[2] in {u.upper() for u in a.uf})]
    planos = {c[0]: planejar(c, arquivos, pastas) for c in alvo_cid}
    n_b = sum(len(v) for v in planos.values())
    print(f"{len(alvo_cid)} cidades com bairros, {n_b} bairros, {sum(len(i) for v in planos.values() for _, _, i in v)} "
          f"atalhos possíveis{' (simulação)' if a.simular else ''}")
    drive, erros, total, t0 = Drive(a.remote), [], 0, time.time()
    with ThreadPoolExecutor(a.jobs) as ex:
        futuros = {ex.submit(executar, drive, c, planos[c[0]], pastas, a.simular): c for c in alvo_cid}
        for n, f in enumerate(as_completed(futuros), 1):
            c = futuros[f]
            try:
                m, feitos = f.result()
                mapa.update(m); total += feitos
                print(f"[{n}/{len(futuros)}] {c[1]} - {c[2]}: {len(planos[c[0]])} bairros, {feitos} atalhos ({time.time() - t0:.0f} s)", flush=True)
            except Exception as e:
                erros.append((c[0], str(e)))
                print(f"[{n}/{len(futuros)}] ERRO {c[1]} - {c[2]}: {e}", flush=True)
    if not a.simular:
        Path(a.mapa).write_text(json.dumps(mapa, ensure_ascii=False, indent=0, sort_keys=True), encoding="utf-8")
    print(f"fim: {total} atalhos {'a criar' if a.simular else 'criados'}, {len(erros)} cidades com erro, "
          f"mapa com {len(mapa)} chaves, {time.time() - t0:.0f} s")
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main()
