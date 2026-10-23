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

Material (--so, padrão todos, nesta ordem): os vídeos por território do site, um trabalho da fila cada, em
<prefixo>/<slug>/<tipo>.mp4 no R2 (MATERIAIS). O arquivo leva o título do vídeo no site, e o tema é a pasta da CPL
(1_Educação, 2_Saúde, 3_Aposentados, 4_Bolsa Família; Moradia ganhou a 6). Os vídeos por município (Aposentados e
Bolsa Família) ficam de fora: estão nas pastas da CPL.

Pula o que já existe com o mesmo tamanho do R2. Com tamanho diferente (a fila refez o vídeo, como a v2 da insulina),
troca o conteúdo no mesmo arquivo: o atalho em Conteúdo por cidade segue apontando para ele, sem duplicar. O que está em
fora_do_ar.json não sobe. Os vídeos vão do Worker fila-videos direto para o Drive (rclone copyurl). O transporte
(rclone rcd) é o mesmo do espelho_drive.py.

--atalhos: em vez de subir, põe em "Conteúdo por cidade/<UF>/<Cidade>/Vídeo/" um atalho (não ocupa cota) para cada
vídeo que a cidade já tem na base, com o mesmo nome ("Vídeo/Farmácia Popular.mp4"; Gui, 2026-10-21).
O que sai do site sai das duas árvores pelo espelho/retirar.py (lixeira).

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
from espelho_drive import DESTINO as CIDADES, FILA, FORA_DO_AR, Rclone, indice, rotulos, tamanho_no_r2   # noqa: E402

DESTINO = "Base de conteúdos internos"
REGIOES = json.loads((Path(__file__).resolve().parent / "regioes_ibge.json").read_text(encoding="utf-8"))
# tipo do vídeo (o do site e da fila) -> (pasta do tema, nome do arquivo, chave no R2). A ordem é a da subida: os novos
# primeiro (o Drive aceita 750 GB por conta por dia, e tudo junto passa disso).
MATERIAIS = {
    "inss": ("3_Aposentados/Vídeo", "O dinheiro que gira", "video-inss/{slug}/inss.mp4"),
    "mercadorose": ("4_Bolsa Família/Vídeo", "O mercado da Dona Rose", "video-mercadorose/{slug}/mercadorose.mp4"),
    "merenda": ("1_Educação/Vídeo", "A merenda da Júlia", "video-merenda/{slug}/merenda.mp4"),
    "cida": ("2_Saúde/Vídeo", "A visita da Cida", "video-cida/{slug}/cida.mp4"),
    "insulina": ("2_Saúde/Vídeo", "Farmácia Popular", "video-insulina/{slug}/insulina.mp4"),
    "pedemeia": ("1_Educação/Vídeo", "Pé-de-Meia", "video-pedemeia/{slug}/pedemeia.mp4"),
    "maismedicos": ("2_Saúde/Vídeo", "Mais Médicos", "video-maismedicos/{slug}/maismedicos.mp4"),
    "posto": ("2_Saúde/Vídeo", "Posto Fechado", "video-posto/{slug}/posto.mp4"),
    "postonovo": ("2_Saúde/Vídeo", "O posto novo", "video-postonovo/{slug}/postonovo.mp4"),
    "mcmv": ("6_Moradia/Vídeo", "Casa nova", "video-mcmv/{slug}/mcmv.mp4"),
    "escola": ("1_Educação/Vídeo", "Merenda da Pré-escola", "video-escola/{slug}/escola.mp4"),
    "saude": ("2_Saúde/Vídeo", "Alerta Saúde SUS", "video-saude/{slug}/saude.mp4"),   # o mesmo do espelho_drive.py
}


def nome_do_arquivo(material, bairro) -> str:
    """"Farmácia Popular.mp4" ou "Farmácia Popular - Capão Redondo.mp4" (bairro de rotulos)."""
    return f"{MATERIAIS[material][1]}{' - ' + bairro if bairro else ''}.mp4"


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
    ja = {i["Path"][len(base) + 1:]: i["Size"] for i in rc.listar(base) if not i["IsDir"]}
    nomes = rotulos(terrs)
    pedidos = [(f"{MATERIAIS[m][0]}/{nome_do_arquivo(m, nomes[t[0]])}", f"{FILA}/{MATERIAIS[m][2].format(slug=t[0])}")
               for m in so for t in terrs if t[0] not in FORA_DO_AR.get(m, ())]
    with ThreadPoolExecutor(8) as ex:                      # um GET por vídeo: São Paulo tem mais de mil
        tamanhos = list(ex.map(lambda p: tamanho_no_r2(p[1]), pedidos))
    passos = [(arq, url, "troca" if arq in ja else "novo") for (arq, url), tam in zip(pedidos, tamanhos)
              if tam is not None and ja.get(arq) != tam]       # falta, ou a fila refez (troca no mesmo arquivo)
    if simular:
        for arq, url, tipo in passos:
            print(f"  [simular] {tipo:5} {base}/{arq}  <-  {url}")
        return f"{len(passos)} a subir"
    for pasta in sorted({a.rsplit("/", 1)[0] for a, _, _ in passos}):   # pastas antes, uma de cada vez (sem duplicar)
        rc.mkdir(f"{base}/{pasta}")
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(lambda p: rc.copyurl(p[1], f"{base}/{p[0]}"), passos))
    trocas = sum(1 for p in passos if p[2] == "troca")
    return f"{len(passos) - trocas} novos, {trocas} trocados"


def atalhos(cid, rc, simular, so=tuple(MATERIAIS)):
    """Atalho em Conteúdo por cidade/<UF>/<Cidade>/Vídeo/ para cada <tema>/Vídeo/<arquivo> da cidade na base, só dos
    materiais pedidos (--so). Nome que já existe lá (o Alerta Saúde SUS do espelho, um atalho de antes) fica como está."""
    base, pasta = base_da_cidade(cid), f"{CIDADES}/{cid[2]}/{cid[1]}/Vídeo"
    nomes = tuple(MATERIAIS[m][1] for m in so)
    videos = [i["Path"] for i in rc.listar(base) if not i["IsDir"] and i["Path"].rsplit("/", 2)[-2] == "Vídeo"
              and i["Path"].rsplit("/", 1)[1].startswith(tuple(n + e for n in nomes for e in (".mp4", " - ")))]
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
            futuros = {(ex.submit(atalhos, c, rc, a.simular, so) if a.atalhos else ex.submit(executar, c, rc, so, a.simular)): c
                       for c in cidades}
            for n, f in enumerate(as_completed(futuros), 1):
                c = futuros[f]
                try:
                    r = f"{f.result()} {'atalhos a criar' if a.simular else 'atalhos'}" if a.atalhos else f.result()
                    print(f"[{n}/{len(cidades)}] {c[1]} - {c[2]}: {r} ({time.time() - t0:.0f} s)", flush=True)
                except Exception as e:
                    erros.append((c[0], str(e)))
                    print(f"[{n}/{len(cidades)}] ERRO {c[1]} - {c[2]}: {e}", flush=True)
    finally:
        rc.fechar()
    print(f"fim: {len(cidades) - len(erros)} cidades ok, {len(erros)} com erro, {time.time() - t0:.0f} s")
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main()
