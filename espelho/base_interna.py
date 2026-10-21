# -*- coding: utf-8 -*-
"""Base de conteúdos internos no Google Drive: os vídeos novos por território, numa árvore por região do IBGE.

Fica na pasta compartilhada do Vinicius, ao lado de "Conteúdo por cidade" (decisão do Gui, 2026-10-21). É a base
interna: as pastas que as cidades recebem ("Conteúdo por cidade/UF/Cidade") vão ganhar depois atalhos para cá.
Mesma árvore da "CPL · Material por município" do Vinicius:

  Base de conteúdos internos/
    Sul/SC/Blumenau/Brusque/2_Saúde/Vídeo/Farmácia Popular.mp4
    Sudeste/SP/São Paulo/São Paulo/2_Saúde/Vídeo/Farmácia Popular - Capão Redondo.mp4   (um por bairro)
    Centro-Oeste/DF/Brasília/...                                                         (o DF vai direto)

  Região / UF / Região intermediária (IBGE 2017, regioes_ibge.json) / Município / Tema / Vídeo / arquivo

Material (--so, padrão todos):
  insulina   "A insulina do Seu Raimundo" (Farmácia Popular), R2 da fila: video-insulina/<slug>/insulina.mp4

Pula o que já existe (pelo nome). Os vídeos vão do Worker fila-videos direto para o Drive (rclone copyurl).
O transporte (rclone rcd) é o mesmo do espelho_drive.py.

--atalhos: em vez de subir, põe em "Conteúdo por cidade/<UF>/<Cidade>/Vídeo/" um atalho (não ocupa cota) para cada
vídeo que a cidade já tem na base, com o mesmo nome ("Vídeo/Farmácia Popular.mp4"; Gui, 2026-10-21).

  python -I espelho/base_interna.py --cidade sc-brusque --simular
  python -I espelho/base_interna.py --uf SC --jobs 3
  python -I espelho/base_interna.py --uf SC --jobs 3 --atalhos
"""
import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))          # python -I não põe a pasta do script no path
from espelho_drive import DESTINO as CIDADES, FILA, Rclone, existe_no_r2, indice   # noqa: E402

DESTINO = "Base de conteúdos internos"
REGIOES = json.loads((Path(__file__).resolve().parent / "regioes_ibge.json").read_text(encoding="utf-8"))
# material -> (pasta do tema, nome do arquivo, chave no R2)
MATERIAIS = {
    "insulina": ("2_Saúde/Vídeo", "Farmácia Popular", "video-insulina/{slug}/insulina.mp4"),
}


def base_da_cidade(cid) -> str:
    _slug, nome, uf, _pop, ibge = cid[:5]
    regiao, uf_ibge, intermediaria = REGIOES[str(ibge)]
    if uf_ibge != uf:
        raise RuntimeError(f"UF do índice ({uf}) diferente da do IBGE ({uf_ibge}) para {ibge}")
    if uf == "DF":
        return f"{DESTINO}/{regiao}/DF/{nome}"
    return f"{DESTINO}/{regiao}/{uf}/{intermediaria}/{nome}"


def executar(cid, rc, so, simular):
    terrs = cid[5]
    base = base_da_cidade(cid)
    ja = {i["Path"][len(base) + 1:] for i in rc.listar(base) if not i["IsDir"]}
    varios = len(terrs) > 1
    passos = []
    for m in so:
        pasta, rotulo, chave = MATERIAIS[m]
        for t in terrs:
            arq = f"{pasta}/{rotulo}{' - ' + t[1] if varios and t[1] else ''}.mp4"
            url = f"{FILA}/{chave.format(slug=t[0])}"
            if arq not in ja and existe_no_r2(url):
                passos.append((arq, url))
    if simular:
        for arq, url in passos:
            print(f"  [simular] {base}/{arq}  <-  {url}")
        return len(passos)
    for pasta in sorted({a.rsplit("/", 1)[0] for a, _ in passos}):   # pastas antes, uma de cada vez (sem duplicar)
        rc.mkdir(f"{base}/{pasta}")
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(lambda p: rc.copyurl(p[1], f"{base}/{p[0]}"), passos))
    return len(passos)


def atalhos(cid, rc, simular):
    """Atalho em Conteúdo por cidade/<UF>/<Cidade>/Vídeo/ para cada <tema>/Vídeo/<arquivo> da cidade na base."""
    base, pasta = base_da_cidade(cid), f"{CIDADES}/{cid[2]}/{cid[1]}/Vídeo"
    videos = [i["Path"] for i in rc.listar(base) if not i["IsDir"] and i["Path"].rsplit("/", 2)[-2] == "Vídeo"]
    if not videos:
        return 0
    lista = rc.listar(pasta, recursivo=False)
    ja = {i["Name"] for i in lista if not i["IsDir"]}
    passos = [(v, f"{pasta}/{v.rsplit('/', 1)[1]}") for v in videos if v.rsplit("/", 1)[1] not in ja]
    if simular:
        for v, d in passos:
            print(f"  [simular] {d}  ->  {v}")
        return len(passos)
    if passos and not lista:
        rc.mkdir(pasta)
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(lambda p: rc.atalho(*p), passos))
    return len(passos)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--cidade", nargs="*", help="slugs (ex.: sc-brusque)")
    ap.add_argument("--uf", nargs="*", help="UFs (ex.: SE AL)")
    ap.add_argument("--so", default=",".join(MATERIAIS), help="materiais: " + ",".join(MATERIAIS))
    ap.add_argument("--remote", default="espelho", help="remoto do rclone (rclone.conf ou RCLONE_CONFIG_<NOME>_*)")
    ap.add_argument("--jobs", type=int, default=2, help="cidades ao mesmo tempo")
    ap.add_argument("--limite", type=int)
    ap.add_argument("--fatia", help="k/n: só a k-ésima de n partes")
    ap.add_argument("--atalhos", action="store_true", help="atalhos em Conteúdo por cidade para o que já está na base")
    ap.add_argument("--simular", action="store_true")
    a = ap.parse_args()
    so = [m for m in a.so.split(",") if m]
    if set(so) - set(MATERIAIS):
        sys.exit(f"PARE: material desconhecido: {', '.join(set(so) - set(MATERIAIS))}")

    cidades = indice()
    if a.cidade:
        cidades = [c for c in cidades if c[0] in set(a.cidade)]
    if a.uf:
        cidades = [c for c in cidades if c[2] in {u.upper() for u in a.uf}]
    if a.fatia:
        k, n = (int(x) for x in a.fatia.split("/"))
        cidades = cidades[k - 1::n]
    cidades = cidades[:a.limite] if a.limite else cidades
    print(f"{len(cidades)} cidades, material: {', '.join(so)}{' (simulação)' if a.simular else ''}")

    rc = Rclone(a.remote)
    if not a.simular and not a.atalhos:                       # os níveis de cima antes das cidades em paralelo (o Drive aceita nomes repetidos)
        for b in sorted({base_da_cidade(c).rsplit("/", 1)[0] for c in cidades}):
            partes = b.split("/")
            for i in range(1, len(partes) + 1):
                rc.mkdir("/".join(partes[:i]))
    erros, t0 = [], time.time()
    try:
        with ThreadPoolExecutor(a.jobs) as ex:
            futuros = {(ex.submit(atalhos, c, rc, a.simular) if a.atalhos else ex.submit(executar, c, rc, so, a.simular)): c
                       for c in cidades}
            for n, f in enumerate(as_completed(futuros), 1):
                c = futuros[f]
                try:
                    print(f"[{n}/{len(cidades)}] {c[1]} - {c[2]}: {f.result()} {('a criar' if a.simular else 'atalhos') if a.atalhos else ('a subir' if a.simular else 'subidos')} ({time.time() - t0:.0f} s)", flush=True)
                except Exception as e:
                    erros.append((c[0], str(e)))
                    print(f"[{n}/{len(cidades)}] ERRO {c[1]} - {c[2]}: {e}", flush=True)
    finally:
        rc.fechar()
    print(f"fim: {len(cidades) - len(erros)} cidades ok, {len(erros)} com erro, {time.time() - t0:.0f} s")
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main()
