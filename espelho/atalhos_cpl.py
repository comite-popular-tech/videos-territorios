# -*- coding: utf-8 -*-
"""Atalhos em "Conteúdo por cidade/<UF>/<Cidade>/" para o material por município da CPL que o site mostra (Gui, 22/10:
"já pode subir com as chaves ligadas"; 23/10: o máximo do site espelhado no Drive). Atalho não ocupa cota nem conta
nos 750 GB por dia. Origem: "CPL · Material por município" do Vinicius (CPL abaixo), UF/Cidade/<tema>/Card|Vídeo/.

Uma subpasta por linha do site, com o título de cada item no site (scripts/acervo.py, COLECOES e TIPOS_*):
  Tesoura do Flávio/Tesoura no Pé-de-Meia.mp4      1_Educação/Vídeo/<cidade>-<uf>-<ibge>-colagem.mp4
  Tesoura do Flávio/Tesoura na aposentadoria.mp4   3_Aposentados/Vídeo/<cidade>-<uf>-<ibge>-colagem-aposentado.mp4
  Tesoura do Flávio/Pé-de-Meia.png                 1_Educação/Card/<cidade>-<uf>-<ibge>-educacao.png
  Tesoura do Flávio/Aposentados.png                3_Aposentados/Card/<cidade>-<uf>-<ibge>-aposentado.png
  Alerta/Bolsa Família.mp4                         4_Bolsa Família/Vídeo/<slug>-bolsa-familia.mp4 (o nosso vídeo)
  Alerta/Bolsa Família.png                         4_Bolsa Família/Card/<cidade>-bolsa-familia.png
É material por município: um por cidade, também nas cidades com bairros (o site mostra o mesmo em todos).

Pela API do Drive (o rclone não faz atalho entre duas raízes numa chamada só), com o token do remoto do rclone
(rclone.conf ou RCLONE_CONFIG_ESPELHO_*). Pula o nome que já existe na subpasta, então pode rodar de novo.

  rclone lsjson -R --fast-list --files-only "espelho,root_folder_id=<CPL>:" > cpl.json
  rclone lsjson -R --fast-list --dirs-only "espelho,root_folder_id=<PASTA_RAIZ>:Conteúdo por cidade" > pastas.json
  python -I espelho/atalhos_cpl.py cpl.json pastas.json [--uf AC] [--simular] [--jobs 8]
"""
import argparse
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))          # python -I não põe a pasta do script no path
from espelho_drive import indice, slug_simples   # noqa: E402

CPL = "1UyNozgAI5MwHWHeMeD6bAVOTr_i80YzM"                        # "CPL · Material por município" (Vinicius)
DRIVE = "https://www.googleapis.com/drive/v3/files"
PASTA, ATALHO = "application/vnd.google-apps.folder", "application/vnd.google-apps.shortcut"
# (tema/mídia da CPL, fim do nome) -> (subpasta, nome do atalho)
ITENS = [
    (("1_Educação", "Vídeo"), "-colagem.mp4", ("Tesoura do Flávio", "Tesoura no Pé-de-Meia.mp4")),
    (("3_Aposentados", "Vídeo"), "-colagem-aposentado.mp4", ("Tesoura do Flávio", "Tesoura na aposentadoria.mp4")),
    (("1_Educação", "Card"), "-educacao.png", ("Tesoura do Flávio", "Pé-de-Meia.png")),
    (("3_Aposentados", "Card"), "-aposentado.png", ("Tesoura do Flávio", "Aposentados.png")),
    (("4_Bolsa Família", "Vídeo"), "-bolsa-familia.mp4", ("Alerta", "Bolsa Família.mp4")),
    (("4_Bolsa Família", "Card"), "-bolsa-familia.png", ("Alerta", "Bolsa Família.png")),
]
IBGE = re.compile(r"-(\d{7})-")


class Drive:
    def __init__(self, remoto="espelho"):
        env = f"RCLONE_CONFIG_{remoto.upper()}_"
        if os.environ.get(env + "TOKEN"):
            cfg = {"token": os.environ[env + "TOKEN"], "client_id": os.environ.get(env + "CLIENT_ID"),
                   "client_secret": os.environ.get(env + "CLIENT_SECRET")}
        else:
            cfg = json.loads(subprocess.check_output(["rclone", "config", "dump"]))[remoto]
        if not cfg.get("client_id"):     # remoto com o client padrão do rclone (público, está no código do rclone)
            cfg["client_id"], cfg["client_secret"] = "202264815644.apps.googleusercontent.com", "X4Z3ca8xfWDb1Voo-F9a7ZxJ"
        self.cfg, self.refresh = cfg, json.loads(cfg["token"])["refresh_token"]
        self.trava, self.acesso, self.vence = threading.Lock(), None, 0

    def token(self):
        with self.trava:
            if time.time() > self.vence - 300:
                corpo = urllib.parse.urlencode({"client_id": self.cfg["client_id"], "client_secret": self.cfg["client_secret"],
                                                "refresh_token": self.refresh, "grant_type": "refresh_token"}).encode()
                r = json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", corpo, timeout=60))
                self.acesso, self.vence = r["access_token"], time.time() + r["expires_in"]
            return self.acesso

    def api(self, metodo, url, corpo=None):
        for t in range(10):
            req = urllib.request.Request(url, data=json.dumps(corpo).encode() if corpo is not None else None, method=metodo,
                                         headers={"Authorization": "Bearer " + self.token(), "Content-Type": "application/json"})
            try:
                return json.load(urllib.request.urlopen(req, timeout=120))
            except urllib.error.HTTPError as e:
                txt = e.read().decode("utf-8", "replace")
                if e.code in (403, 429, 500, 502, 503):           # cota por minuto ("Total Query Cost") e afins
                    time.sleep(min(60, 2 ** t)); continue
                raise RuntimeError(f"{e.code} {txt[:300]}") from None
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                time.sleep(min(60, 2 ** t))
        raise RuntimeError(f"sem resposta da API: {metodo} {url[:120]}")

    def filhos(self, pasta) -> dict:
        q = urllib.parse.quote(f"'{pasta}' in parents and trashed = false")
        out, pagina = {}, None
        while True:
            r = self.api("GET", f"{DRIVE}?q={q}&pageSize=1000&fields=nextPageToken,files(id,name)"
                                + (f"&pageToken={pagina}" if pagina else ""))
            out.update({f["name"]: f["id"] for f in r.get("files", [])})
            pagina = r.get("nextPageToken")
            if not pagina: return out

    def criar(self, nome, pai, alvo=None) -> str:
        corpo = {"name": nome, "parents": [pai], "mimeType": ATALHO if alvo else PASTA}
        if alvo: corpo["shortcutDetails"] = {"targetId": alvo}
        return self.api("POST", f"{DRIVE}?fields=id", corpo)["id"]


def planejar(cpl_json, pastas_json, ufs=None):
    """{(uf, cidade): (id da pasta da cidade em Conteúdo por cidade, [(subpasta, nome, id da origem)])}."""
    cidades = indice()
    por_ibge = {c[4]: c for c in cidades}
    por_nome = {(c[2], slug_simples(c[1])): c for c in cidades}
    por_slug = {t[0]: c for c in cidades for t in c[5]} | {c[0]: c for c in cidades}
    pastas = {i["Path"]: i["ID"] for i in json.loads(Path(pastas_json).read_text(encoding="utf-8"))}
    plano, sem = {}, []
    for i in json.loads(Path(cpl_json).read_text(encoding="utf-8")):
        p = i["Path"].split("/")
        if len(p) != 5: continue
        uf, pasta_cid, tema, midia, nome = p
        for (t, m), fim, (sub, rotulo) in ITENS:
            if (tema, midia) != (t, m) or not nome.endswith(fim): continue
            ib = IBGE.search(nome)
            c = (por_ibge.get(ib.group(1)) if ib else None) or por_slug.get(nome[:-len(fim)]) \
                or por_nome.get((uf, slug_simples(pasta_cid)))
            if not c or c[2] != uf:
                sem.append(i["Path"]); break
            if ufs and uf not in ufs: break
            cid_id = pastas.get(f"{uf}/{c[1]}")
            if not cid_id:
                sem.append(i["Path"] + " (sem pasta em Conteúdo por cidade)"); break
            plano.setdefault((uf, c[1]), (cid_id, []))[1].append((sub, rotulo, i["ID"].split("\t")[0]))
            break
    return plano, sem


def executar(drive, cid_id, itens, simular):
    if simular:
        return len(itens)
    subs = {n: i for n, i in drive.filhos(cid_id).items() if n in {s for s, _, _ in itens}}
    feitos = 0
    for sub in sorted({s for s, _, _ in itens}):
        ja = drive.filhos(subs[sub]) if sub in subs else {}
        if sub not in subs:
            subs[sub] = drive.criar(sub, cid_id)
        vistos = set()
        for s, rotulo, origem in itens:
            if s != sub or rotulo in ja or rotulo in vistos: continue
            drive.criar(rotulo, subs[sub], origem)
            vistos.add(rotulo); feitos += 1
    return feitos


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cpl", help="rclone lsjson -R da pasta da CPL")
    ap.add_argument("pastas", help="rclone lsjson -R --dirs-only de Conteúdo por cidade")
    ap.add_argument("--uf", nargs="*")
    ap.add_argument("--jobs", type=int, default=8)
    ap.add_argument("--remote", default="espelho")
    ap.add_argument("--simular", action="store_true")
    a = ap.parse_args()
    plano, sem = planejar(a.cpl, a.pastas, {u.upper() for u in a.uf} if a.uf else None)
    print(f"{len(plano)} cidades, {sum(len(v[1]) for v in plano.values())} atalhos possíveis; {len(sem)} arquivos da CPL "
          f"sem cidade: {sem[:5]}")
    drive, erros, total, t0 = Drive(a.remote), [], 0, time.time()
    with ThreadPoolExecutor(a.jobs) as ex:
        futuros = {ex.submit(executar, drive, cid_id, itens, a.simular): k for k, (cid_id, itens) in plano.items()}
        for n, f in enumerate(as_completed(futuros), 1):
            uf, nome = futuros[f]
            try:
                total += f.result()
                if n % 100 == 0 or n == len(futuros):
                    print(f"[{n}/{len(futuros)}] {total} atalhos ({time.time() - t0:.0f} s)", flush=True)
            except Exception as e:
                erros.append((uf, nome, str(e)))
                print(f"[{n}/{len(futuros)}] ERRO {nome} - {uf}: {e}", flush=True)
    print(f"fim: {total} atalhos {'a criar' if a.simular else 'criados'}, {len(erros)} cidades com erro, {time.time() - t0:.0f} s")
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main()
