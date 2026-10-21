# Gera as locuções do lote com edge-tts (vozes neurais pt-BR da Microsoft, sem cadastro).
#   python vozes.py <tarefas.json> <voz> [paralelas] [taxa]   (taxa: ritmo do edge-tts, padrão +12%; a história usa -6%)
# tarefas.json: lista de {"arquivo": "caminho.mp3", "texto": "..."}. Pula arquivo que já existe com o mesmo texto
# (guarda o texto em .txt ao lado) e grava o tempo de cada palavra em .json ao lado (legenda palavra por palavra). Tenta de novo com espera crescente quando o serviço recusa ou cai.
# Imprime uma linha por arquivo pronto ("ok <arquivo>") ou com falha ("falha <arquivo> <erro>").
import asyncio
import json
import os
import random
import sys

import edge_tts

tarefas = json.load(open(sys.argv[1], encoding="utf-8"))
voz = sys.argv[2]
paralelas = int(sys.argv[3]) if len(sys.argv) > 3 else 4
TAXA = sys.argv[4] if len(sys.argv) > 4 else "+12%"


def pronto(t):
    txt = t["arquivo"][:-4] + ".txt"
    return (os.path.exists(t["arquivo"]) and os.path.getsize(t["arquivo"]) > 2000 and os.path.exists(txt)
            and os.path.exists(t["arquivo"][:-4] + ".json")
            and open(txt, encoding="utf-8").read() == voz + "|" + t["texto"])


async def uma(t, sem):
    async with sem:
        for tentativa in range(6):
            try:
                tmp = t["arquivo"] + ".tmp"
                palavras = []  # [início em s, duração em s, palavra]
                with open(tmp, "wb") as saida:
                    async for parte in edge_tts.Communicate(t["texto"], voz, rate=TAXA, boundary="WordBoundary").stream():
                        if parte["type"] == "audio":
                            saida.write(parte["data"])
                        elif parte["type"] == "WordBoundary":
                            palavras.append([round(parte["offset"] / 1e7, 3), round(parte["duration"] / 1e7, 3), parte["text"]])
                if os.path.getsize(tmp) < 2000 or not palavras:
                    raise RuntimeError("áudio vazio")
                os.replace(tmp, t["arquivo"])
                json.dump(palavras, open(t["arquivo"][:-4] + ".json", "w", encoding="utf-8"), ensure_ascii=False)
                open(t["arquivo"][:-4] + ".txt", "w", encoding="utf-8").write(voz + "|" + t["texto"])
                print("ok", t["arquivo"], flush=True)
                return True
            except Exception as e:  # noqa: BLE001 - serviço externo: qualquer falha vira nova tentativa
                erro = str(e).splitlines()[0][:120] if str(e) else type(e).__name__
                await asyncio.sleep(min(60, 2 ** tentativa + random.random() * 2))
        print("falha", t["arquivo"], erro, flush=True)
        return False


async def main():
    fila = [t for t in tarefas if not pronto(t)]
    for t in tarefas:
        os.makedirs(os.path.dirname(t["arquivo"]), exist_ok=True)
    print(f"{len(tarefas)} falas, {len(fila)} a gerar", flush=True)
    sem = asyncio.Semaphore(paralelas)
    r = await asyncio.gather(*(uma(t, sem) for t in fila))
    print(f"fim: {sum(r)} geradas, {len(r) - sum(r)} falhas", flush=True)


asyncio.run(main())
