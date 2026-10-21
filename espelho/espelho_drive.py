# -*- coding: utf-8 -*-
"""Espelho do acervo (cards.boralula.org) no Google Drive, uma pasta por cidade, para quem prefere pegar por lá.

Dentro da pasta compartilhada do Vinicius (PASTA_RAIZ), em "Conteúdo por cidade/" (decisão do Gui, 2026-10-20):

  SE/Aracaju/                 (uma pasta por estado e, dentro dela, a cidade sem a UF)
    Vídeo/                      Alerta Saúde SUS do território, do R2 da fila (um por bairro nas cidades grandes:
                                "Alerta Saúde SUS - Santa Maria.mp4"; nas outras, "Alerta Saúde SUS.mp4")
    Cards/                      os 12 cards do site, em JPEG, gerados pela própria página (scripts/espelho_cards.mjs):
      Santa Maria/Preto/ e Colorido/   (cidade de um território só: Cards/Preto e Cards/Colorido)
    Vídeos por tema/            vídeos em massa da CPL, onda 2 (Saúde, Aposentado, Educação; R2, massa/<tema>/<ibge>.mp4)
                                e atalho para a Colagem que já está em "Videos massa/<UF>/"
    Cards por tema/             atalhos para os PNG de "Cards massa/<UF>/<tema>/" (não ocupam cota)
    Links.txt                   endereço da cidade no site, vídeo por bairro e o jogo, quando houver

Pula o que já existe (pelo nome), então pode rodar de novo a qualquer hora: só sobe o que faltar. Nada passa pelo
disco além dos 12 cards de um território por vez (~3 MB, apagados em seguida): os vídeos vão do Worker fila-videos
direto para o Drive (rclone copyurl) e os atalhos são criados no próprio Drive.

Transporte: rclone (rcd, um processo só, com cache de pastas). O remoto do Drive vem do rclone.conf (--remote, padrão
"espelho") ou do ambiente, como no Actions (.github/workflows/espelho-drive.yml):
  RCLONE_CONFIG_ESPELHO_TYPE=drive  RCLONE_CONFIG_ESPELHO_SCOPE=drive  RCLONE_CONFIG_ESPELHO_TOKEN=<json do rclone authorize>
Tudo que sobe conta na cota de quem autorizou o token (desde 20/10, a conta do Gui, que tem espaço).

  python -I scripts/espelho_drive.py --cidade se-aracaju --simular   # mostra o que faria, sem escrever
  python -I scripts/espelho_drive.py --cidade se-aracaju             # uma cidade
  python -I scripts/espelho_drive.py --uf SE --jobs 4                # uma UF, 4 cidades por vez
  python -I scripts/espelho_drive.py --so video,cards,massa         # material (padrão: video,cards, o que o site tem;
                                                                    # massa, atalhos e links ficam de fora desde 20/10)
Os cards precisam do Node com playwright (npm i playwright; npx playwright install chromium) e de --node-modules
apontando para a pasta node_modules que o tem (padrão video/node_modules).
"""
import argparse
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unicodedata
import urllib.error
import urllib.request
import zipfile
from base64 import b64encode
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
PASTA_RAIZ = "1zYnOUEpE5vmmRrcnwO7rgKE5rNkMZHVu"     # pasta compartilhada do Vinicius
DESTINO = "Conteúdo por cidade"
CARDS_MASSA, VIDEOS_MASSA = "Cards massa", "Videos massa"
SITE = "https://cards.boralula.org"
FILA = "https://fila-videos.boralula.workers.dev/saida"
TEMAS = {"saude": "Saúde", "aposentado": "Aposentado", "educacao": "Educação"}          # vídeos em massa, onda 2
TEMAS_CARDS = {"saude": "Saúde", "aposentado": "Aposentado", "educacao": "Educação", "comerciante": "Comerciante"}
ESTILOS = {"preto": "Preto", "colorido": "Colorido"}
JOGO = {"1200138": "pmtqzh5wsk", "3549805:vila-toninho": "gjz6dpx5a3"}   # o mesmo de scripts/acervo.py
MATERIAIS = ("video", "cards", "massa", "atalhos", "links")
PADRAO = ("video", "cards")      # Gui, 2026-10-20: só o que está no cards.boralula.org (os 12 cards e o vídeo de Saúde)


def sem_acento(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def slug_simples(nome: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", sem_acento(nome).lower()).strip("-")


class Rclone:
    """Um rclone rcd local; cada chamada é um POST JSON. O rclone cuida de token, novas tentativas e ritmo do Drive."""

    def __init__(self, remoto: str):
        self.fs = f"{remoto},root_folder_id={PASTA_RAIZ}:"
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            self.porta = s.getsockname()[1]
        senha = secrets.token_hex(16)
        self.auth = "Basic " + b64encode(f"espelho:{senha}".encode()).decode()
        self.proc = subprocess.Popen(
            ["rclone", "rcd", f"--rc-addr=127.0.0.1:{self.porta}", "--rc-user=espelho", f"--rc-pass={senha}",
             "--drive-pacer-min-sleep=20ms", "--retries=5", "--low-level-retries=20", "-q"])
        for _ in range(100):
            try:
                self.chamar("rc/noop")
                return
            except (urllib.error.URLError, ConnectionError):
                time.sleep(0.2)
        sys.exit("PARE: o rclone rcd não subiu.")

    def chamar(self, rota: str, **corpo):
        req = urllib.request.Request(f"http://127.0.0.1:{self.porta}/{rota}", data=json.dumps(corpo).encode(),
                                     headers={"Content-Type": "application/json", "Authorization": self.auth})
        try:
            with urllib.request.urlopen(req, timeout=3600) as r:
                return json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{rota}: {e.read().decode(errors='replace')[:400]}") from None

    def listar(self, caminho: str, recursivo=True) -> list[dict]:
        try:
            return self.chamar("operations/list", fs=self.fs, remote=caminho,
                               opt={"recurse": recursivo, "noModTime": True, "noMimeType": True})["list"]
        except RuntimeError as e:
            if "directory not found" in str(e):
                return []
            raise

    def mkdir(self, caminho):
        self.chamar("operations/mkdir", fs=self.fs, remote=caminho)

    def copyurl(self, url, caminho):
        self.chamar("operations/copyurl", fs=self.fs, remote=caminho, url=url, autoFilename=False)

    def subir(self, local: Path, caminho):
        self.chamar("operations/copyfile", srcFs=str(local.parent), srcRemote=local.name, dstFs=self.fs, dstRemote=caminho)

    def atalho(self, origem, caminho):
        self.chamar("backend/command", command="shortcut", fs=self.fs, arg=[origem, caminho])

    def fechar(self):
        self.proc.terminate()


def existe_no_r2(url: str) -> bool:
    """O Worker não atende HEAD: um GET de 1 byte (206 = existe)."""
    for tentativa in range(4):
        try:
            req = urllib.request.Request(url, headers={"Range": "bytes=0-0", "User-Agent": "espelho-drive"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status in (200, 206)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(2 * (tentativa + 1))
    raise RuntimeError(f"sem resposta do Worker: {url}")


def indice() -> list:
    """[slug, município, UF, população, IBGE, [[território, bairro, lat, lon]]], de saida/acervo ou do site no ar."""
    local = RAIZ / "saida" / "acervo" / "indice.json"
    if local.exists():
        return json.loads(local.read_text(encoding="utf-8"))
    req = urllib.request.Request(f"{SITE}/indice.json", headers={"User-Agent": "espelho-drive"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


class Origens:
    """O que já está no Drive do Vinicius, por UF (lido uma vez por UF): Cards massa e Videos massa."""

    def __init__(self, rc: Rclone):
        self.rc, self.cache, self.trava = rc, {}, threading.Lock()

    def da_uf(self, uf: str) -> dict:
        with self.trava:
            if uf not in self.cache:
                cards, videos = {}, {}
                for item in self.rc.listar(f"{CARDS_MASSA}/{uf}"):       # <tema>/<slug>-<uf>-<tema>.png
                    if not item["IsDir"] and item["Name"].lower().endswith(".png"):
                        cards[item["Name"].lower()] = item["Path"]
                for item in self.rc.listar(f"{VIDEOS_MASSA}/{uf}"):      # <slug>-<uf>-<ibge>-colagem.mp4
                    m = re.search(r"-(\d{7})-colagem\.mp4$", item["Name"])
                    if not item["IsDir"] and m:
                        videos[m.group(1)] = item["Path"]
                self.cache[uf] = {"cards": cards, "colagem": videos}
            return self.cache[uf]


def gerar_cards(slug: str, pasta: Path, node_modules: Path) -> list[Path]:
    """Os 12 JPEG do território, pela página do site (o mesmo desenho e a mesma foto que a pessoa baixaria)."""
    r = subprocess.run(["node", str(Path(__file__).with_name("espelho_cards.mjs")), slug, str(pasta)], capture_output=True,
                       text=True, env={**os.environ, "NODE_PATH": str(node_modules)}, timeout=300)
    if r.returncode != 0:
        raise RuntimeError(f"cards de {slug}: {(r.stderr or r.stdout).strip()[-400:]}")
    with zipfile.ZipFile(pasta / r.stdout.strip().splitlines()[-1]) as z:
        z.extractall(pasta)
    return sorted(p for p in pasta.rglob("*.jpg"))


def plano_da_cidade(cid, rc, origens, so, ja):
    """Lista de (tipo, destino, origem) que faltam para a cidade. `ja` = caminhos que já existem no destino."""
    slug, nome, uf, _pop, ibge, terrs = cid
    base = f"{DESTINO}/{uf}/{nome}"             # "SE/Aracaju": uma pasta por estado (Gui, 20/10)
    varios = len(terrs) > 1
    passos = []

    def falta(caminho):
        return caminho not in ja

    if "video" in so:
        for t in terrs:
            arq = f"Vídeo/Alerta Saúde SUS{' - ' + t[1] if varios and t[1] else ''}.mp4"
            url = f"{FILA}/video-saude/{t[0]}/saude.mp4"
            if falta(arq) and existe_no_r2(url):
                passos.append(("url", arq, url))
    if "massa" in so:
        for tema, rotulo in TEMAS.items():
            arq, url = f"Vídeos por tema/{rotulo}.mp4", f"{FILA}/massa/{tema}/{ibge}.mp4"
            if falta(arq) and existe_no_r2(url):
                passos.append(("url", arq, url))
    if "atalhos" in so:
        o = origens.da_uf(uf)
        if ibge in o["colagem"] and falta("Vídeos por tema/Colagem.mp4"):
            passos.append(("atalho", "Vídeos por tema/Colagem.mp4", o["colagem"][ibge]))
        simples = slug.split("-", 1)[1]
        for tema, rotulo in TEMAS_CARDS.items():
            orig = o["cards"].get(f"{simples}-{uf.lower()}-{tema}.png")
            if orig and falta(f"Cards por tema/{rotulo}.png"):
                passos.append(("atalho", f"Cards por tema/{rotulo}.png", orig))
    if "cards" in so:
        for t in terrs:
            pasta = f"Cards/{t[1]}/" if varios and t[1] else "Cards/"
            if any(falta(f"{pasta}{e}/{t[0]}-{p}{n}.jpg") for e, p in (("Preto", "p"), ("Colorido", "k")) for n in range(1, 7)):
                passos.append(("cards", pasta, t[0]))
    if "links" in so and falta("Links.txt"):
        passos.append(("texto", "Links.txt", links_txt(cid)))
    return base, passos


def links_txt(cid) -> str:
    slug, nome, uf, _pop, ibge, terrs = cid
    linhas = [f"{nome} - {uf}", "", f"No site: {SITE}/#{slug}"]
    for t in terrs:
        if len(terrs) > 1 and t[1]:
            linhas.append(f"{t[1]}: {SITE}/#{t[0]}")
    jogos = {t[1]: JOGO.get(ibge + (":" + t[0].split("--")[1] if "--" in t[0] else "")) or JOGO.get(ibge) for t in terrs}
    jogos = {b: j for b, j in jogos.items() if j}
    for b, j in jogos.items():
        linhas.append(f"Jogo{', ' + b if b and len(jogos) > 1 else ''}: https://jogo.boralula.org/{j}/")
    return "\n".join(linhas) + "\n"


def executar(cid, rc, origens, so, simular, node_modules, tmp: Path):
    slug, nome, uf = cid[0], cid[1], cid[2]
    base = f"{DESTINO}/{uf}/{nome}"             # "SE/Aracaju": uma pasta por estado (Gui, 20/10)
    ja = {i["Path"][len(base) + 1:] for i in rc.listar(base) if not i["IsDir"]}   # o Path vem a partir da raiz
    base, passos = plano_da_cidade(cid, rc, origens, so, ja)
    if simular:
        for tipo, destino, origem in passos:
            print(f"  [simular] {tipo:6} {base}/{destino}  <-  {origem if tipo != 'texto' else '(texto)'}")
        return slug, len(passos), 0
    # pastas antes, uma de cada vez: o Drive aceita duas pastas com o mesmo nome, e duas escritas juntas numa pasta que
    # ainda não existe podem criar as duas
    pastas = set()
    for tipo, destino, _ in passos:
        if tipo == "cards":
            pastas |= {destino + e for e in ESTILOS.values()}
        elif "/" in destino:
            pastas.add(destino.rsplit("/", 1)[0])
    for pasta in sorted(pastas):
        rc.mkdir(f"{base}/{pasta}")

    def passo(p):
        tipo, destino, origem = p
        caminho = f"{base}/{destino}"
        if tipo == "url":
            rc.copyurl(origem, caminho)
        elif tipo == "atalho":
            rc.atalho(origem, caminho)
        elif tipo == "texto":
            arq = tmp / f"{slug}-links.txt"
            arq.write_text(origem, encoding="utf-8")
            rc.subir(arq, caminho)
            arq.unlink()
        elif tipo == "cards":
            pasta = tmp / origem
            pasta.mkdir(parents=True, exist_ok=True)
            try:
                faltam = [(jpg, f"{caminho}{ESTILOS[jpg.parent.name]}/{jpg.name}") for jpg in gerar_cards(origem, pasta, node_modules)]
                with ThreadPoolExecutor(4) as ex:
                    list(ex.map(lambda jd: rc.subir(*jd), [(j, d) for j, d in faltam if d[len(base) + 1:] not in ja]))
            finally:
                shutil.rmtree(pasta, ignore_errors=True)

    with ThreadPoolExecutor(6) as ex:                   # cada escrita no Drive leva segundos: várias juntas
        list(ex.map(passo, passos))
    return slug, len(passos), len(passos)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--cidade", nargs="*", help="slugs (ex.: se-aracaju)")
    ap.add_argument("--uf", nargs="*", help="UFs (ex.: SE AL)")
    ap.add_argument("--so", default=",".join(PADRAO), help="materiais, separados por vírgula: " + ",".join(MATERIAIS))
    ap.add_argument("--remote", default="espelho", help="remoto do rclone (rclone.conf ou RCLONE_CONFIG_<NOME>_*)")
    ap.add_argument("--jobs", type=int, default=2, help="cidades ao mesmo tempo")
    ap.add_argument("--limite", type=int, help="no máximo N cidades")
    ap.add_argument("--fatia", help="k/n: só a k-ésima de n partes (para dividir uma UF grande entre vários jobs)")
    ap.add_argument("--node-modules", default=str(RAIZ / "video" / "node_modules"))
    ap.add_argument("--tmp", help="pasta dos temporários (os 12 cards de um território por vez); padrão: a do sistema")
    ap.add_argument("--simular", action="store_true", help="só lista o que faria (lê o Drive e o R2, não escreve)")
    a = ap.parse_args()
    so = set(a.so.split(","))
    if so - set(MATERIAIS):
        sys.exit(f"PARE: material desconhecido: {', '.join(so - set(MATERIAIS))}")
    if not shutil.which("rclone"):
        sys.exit("PARE: falta o rclone no PATH (https://rclone.org/install/).")

    cidades = indice()
    if a.cidade:
        cidades = [c for c in cidades if c[0] in set(a.cidade)]
    if a.uf:
        cidades = [c for c in cidades if c[2] in {u.upper() for u in a.uf}]
    if a.fatia:
        k, n = (int(x) for x in a.fatia.split("/"))
        cidades = cidades[k - 1::n]
    cidades = cidades[:a.limite] if a.limite else cidades
    print(f"{len(cidades)} cidades, material: {', '.join(m for m in MATERIAIS if m in so)}{' (simulação)' if a.simular else ''}")

    rc = Rclone(a.remote)
    if not a.simular:
        rc.mkdir(DESTINO)                               # antes das cidades em paralelo (ver executar)
    origens = Origens(rc)
    tmp = Path(tempfile.mkdtemp(prefix="espelho-", dir=a.tmp))
    erros, t0 = [], time.time()
    try:
        with ThreadPoolExecutor(a.jobs) as ex:
            futuros = {ex.submit(executar, c, rc, origens, so, a.simular, Path(a.node_modules), tmp): c for c in cidades}
            for n, f in enumerate(as_completed(futuros), 1):
                c = futuros[f]
                try:
                    slug, faltavam, feitos = f.result()
                    print(f"[{n}/{len(cidades)}] {c[1]} - {c[2]}: {faltavam} faltavam, {feitos} feitos ({time.time() - t0:.0f} s)", flush=True)
                except Exception as e:                     # segue com as outras; rodar de novo refaz só o que faltou
                    erros.append((c[0], str(e)))
                    print(f"[{n}/{len(cidades)}] ERRO {c[1]} - {c[2]}: {e}", flush=True)
    finally:
        rc.fechar()
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"fim: {len(cidades) - len(erros)} cidades ok, {len(erros)} com erro, {time.time() - t0:.0f} s")
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main()
