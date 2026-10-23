"""O que o vídeo "Escola ou bico" (Pé-de-Meia) tem em comum entre as peças prontas (pedemeia_pecas.py) e a montagem por
território (trabalhos/video_pedemeia.py): o roteiro, os tempos fixos das cenas, a voz, a legenda em ASS e os parâmetros
de codificação, que precisam ser iguais em todas as peças para a colagem sem recodificar (-c copy).

Mesmo molde da insulina (insulina_comum.mjs), mas todo em Python: por território não roda Node nem Chrome, só edge-tts,
Pillow e ffmpeg (decisão do Gui em 21/10/2026, video/prototipos/README.md). A cena tem duração fixa e é a fala que se
ajusta a ela: acelera até EXTRA_MAX ou cai para uma versão mais curta do texto.

Cenas (índice 0 a 5):            vídeo                                   fala
  0 Lucas no quarto               clipe 1, peça pronta sem legenda        muda (bairro e cidade)
  1 portão da escola              clipe 2, peça pronta sem legenda        muda (nome da escola, quando há)
  2 jantar com a Dona Rose        clipe 3, peça pronta com legenda        fixa
  3 dado da cidade                desenhada por território (Pillow)       muda (estudantes da cidade)
  4 corte                         peça pronta com legenda                 fixa
  5 compartilhe                   peça pronta com legenda                 fixa
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

VIDEO = Path(__file__).resolve().parent
FPS, ATRASO, FOLGA, RESPIRO_FINAL = 30, 8, 30, 60     # frames, no tempo do render (antes do 1,25x)
VEL = 1.25                                            # o vídeo final é o render acelerado 1,25x (vídeo e voz, sem mudar o tom)
LARG, ALT = 720, 1280
ESCALA = LARG / 1080
VOZ, TAXA = "pt-BR-AntonioNeural", "-6%"
MUSICA, AMBIENTE = 0.25, 0.35
CLIPES = [240, 240, 240]                              # frames dos clipes do Flow (8 s cada)
# janela de fala das cenas variáveis, em segundos de render: medidas em 300 territórios em 21/10 (fala 1: mediana 8,1 s, p90 9,5; fala 2: 7,6 e 10,0; fala 4: 5,1 e 5,8)
JANELAS = {0: 8.6, 1: 8.4, 3: 5.4}
EXTRA_MAX = 1.3
FIXAS = {
    2: "São duzentos reais por mês e mais mil por ano guardados pra quando terminar o ensino médio.",
    4: "No governo Bolsonaro, esse programa não existia. Flávio Bolsonaro planeja cortar até 250 bilhões e benefícios como o Pé-de-Meia podem ficar ameaçados.",
    5: "Compartilhe com quem tem filho no ensino médio aqui da região.",
}
FONTES = VIDEO / "fontes"
FONTE_DADO = "Portal da Transparência, Pé-de-Meia: estudantes pagos no ano letivo de 2026 (até jun/2026)"
FONTE_CORTE = "Pé-de-Meia: Lei 14.818/2024 · Plano de até R$ 250 bi: Folha de S.Paulo, out/2026"
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
# mesmos parâmetros em toda peça: a colagem final é -c copy
ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
       "-r", str(FPS), "-g", "60", "-keyint_min", "60", "-sc_threshold", "0", "-an"]

ESTADOS = {
    "AC": ["No Acre", "Acre"], "AL": ["Em Alagoas", "Alagoas"], "AP": ["No Amapá", "Amapá"], "AM": ["No Amazonas", "Amazonas"],
    "BA": ["Na Bahia", "Bahia"], "CE": ["No Ceará", "Ceará"], "DF": ["No Distrito Federal", "Distrito Federal"],
    "ES": ["No Espírito Santo", "Espírito Santo"], "GO": ["Em Goiás", "Goiás"], "MA": ["No Maranhão", "Maranhão"],
    "MT": ["Em Mato Grosso", "Mato Grosso"], "MS": ["Em Mato Grosso do Sul", "Mato Grosso do Sul"], "MG": ["Em Minas Gerais", "Minas Gerais"],
    "PA": ["No Pará", "Pará"], "PB": ["Na Paraíba", "Paraíba"], "PR": ["No Paraná", "Paraná"], "PE": ["Em Pernambuco", "Pernambuco"],
    "PI": ["No Piauí", "Piauí"], "RJ": ["No estado do Rio de Janeiro", "Estado do Rio de Janeiro"],
    "RN": ["No Rio Grande do Norte", "Rio Grande do Norte"], "RS": ["No Rio Grande do Sul", "Rio Grande do Sul"],
    "RO": ["Em Rondônia", "Rondônia"], "RR": ["Em Roraima", "Roraima"], "SC": ["Em Santa Catarina", "Santa Catarina"],
    "SP": ["No estado de São Paulo", "Estado de São Paulo"], "SE": ["Em Sergipe", "Sergipe"], "TO": ["No Tocantins", "Tocantins"],
}


def ffmpeg(*args, entrada=None):
    r = subprocess.run([FFMPEG, "-y", "-v", "error", *map(str, args)], input=entrada)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg falhou: {args[-1]}")


# ---------------------------------------------------------------- roteiro por território
def falado(v: int) -> str:
    """'576', '141 mil', '1 milhão e 200 mil' (o cartão mostra '1,2 milhão': mesmo arredondamento)."""
    if v < 1000:
        return str(v)
    if v < 1e6:
        return f"{round(v / 1000)} mil"
    d = round(v / 1e5)
    m, r = d // 10, (d % 10) * 100
    return f"{m} {'milhão' if m == 1 else 'milhões'}" + (f" e {r} mil" if r else "")


def limpa(s) -> str:
    return str(s or "").replace(" ", " ").strip()


def roteiro(ped: dict, slug: str, pdm: dict, escolas: dict) -> dict:
    """As três falas que mudam, cada uma com as versões mais curtas para quando a cheia não cabe, e o dado da cena 3."""
    import lugar_falado   # "no Capão Redondo", "na Vila Prudente": nunca "no bairro X" (Gui, 21/10)
    nomes = ped.get("nomes") or {}
    cidade, uf, ibge = limpa(ped["municipio"]["municipio"]), ped["municipio"]["uf"], str(ped["municipio"]["cod_ibge"])
    bairro = limpa(nomes.get("bairro")) if nomes.get("regra") == "pares" else ""
    est, valor = pdm["municipios"].get(ibge, [0, 0])
    do_estado = not est
    if do_estado:
        est, valor = pdm["ufs"][uf]
    onde = ESTADOS[uf][0] if do_estado else f"Aqui {lugar_falado.em_cidade(cidade)}"
    quem = "1 estudante já recebeu" if est == 1 else f"{falado(est)} estudantes já receberam"
    quem_curto = "1 estudante recebe" if est == 1 else f"{falado(est)} estudantes recebem"
    escola = escolas.get(slug, "")
    fim_cheio, fim_curto = "e quase deixou a escola pra fazer uns bicos e ajudar em casa.", "e quase deixou a escola pra fazer bico."
    no_bairro, do_bairro = lugar_falado.no_lugar(bairro), lugar_falado.do_lugar(bairro)
    if no_bairro:
        f0 = [f"O Lucas tem 16 anos, mora {no_bairro}, aqui {lugar_falado.em_cidade(cidade)}, {fim_cheio}",
              f"O Lucas tem 16 anos, mora {no_bairro}, aqui {lugar_falado.em_cidade(cidade)}, {fim_curto}",
              f"O Lucas tem 16 anos, mora aqui {lugar_falado.em_cidade(cidade)}, {fim_curto}"]
    else:
        f0 = [f"O Lucas tem 16 anos, mora aqui {lugar_falado.em_cidade(cidade)}, {fim_cheio}",
              f"O Lucas tem 16 anos, mora aqui {lugar_falado.em_cidade(cidade)}, {fim_curto}",
              f"O Lucas tem 16 anos {fim_curto}"]
    generica = ["Mas continuou estudando. E agora, todo mês que mantém a frequência na escola, o Pé-de-Meia cai na conta.",
                "Mas continuou estudando. E todo mês que vai à aula, o Pé-de-Meia cai na conta."]
    f1 = ([f"Mas continuou estudando. E agora, todo mês que mantém a frequência {escola}, o Pé-de-Meia cai na conta.",
           f"Mas continuou estudando. E todo mês que vai à aula {escola}, o Pé-de-Meia cai na conta."] if escola else []) + generica
    f3 = [f"{onde}, {quem} o Pé-de-Meia este ano.", f"{onde}, {quem_curto} o Pé-de-Meia."]
    abertura = f"Atenção, morador {do_bairro or lugar_falado.de_cidade(cidade)}: o Pé-de-Meia está ameaçado. Entenda por quê."
    for t in [*f0, *f1, *f3, abertura]:
        lugar_falado.confere(t)   # trava: nenhuma fala com "bairro X"
    return {
        "falas": {0: f0, 1: f1, 3: f3},
        "dado": {"local": ESTADOS[uf][1] if do_estado else f"{cidade} - {uf}", "estudantes": est, "valor12m": valor, "ano": pdm["ano"]},
        # abertura padrão (video/abertura.py): a prévia traz a cidade; a voz e a animação, o bairro
        "abertura": abertura, "morador": lugar_falado.de_cidade(cidade),
        "morador_fala": do_bairro or lugar_falado.de_cidade(cidade), "local": f"{cidade} - {uf}",
    }


# ---------------------------------------------------------------- vozes (cache por texto: fala igual é gerada uma vez)
def voz_arquivo(pasta: Path, texto: str) -> Path:
    return Path(pasta) / (hashlib.sha1(f"{VOZ}|{TAXA}|{texto}".encode()).hexdigest()[:16] + ".mp3")


def gerar_vozes(pasta: Path, textos) -> None:
    pasta = Path(pasta)
    pasta.mkdir(parents=True, exist_ok=True)
    tarefas = {str(voz_arquivo(pasta, t)): t for t in textos}
    tarefas = [{"arquivo": a, "texto": t} for a, t in tarefas.items() if not Path(a).with_suffix(".json").exists()]
    if not tarefas:
        return
    tj = pasta / "_tarefas.json"
    tj.write_text(json.dumps(tarefas, ensure_ascii=False), encoding="utf-8")
    r = subprocess.run([sys.executable, str(VIDEO / "vozes.py"), str(tj), VOZ, "6", TAXA])
    if r.returncode != 0:
        raise RuntimeError("vozes.py falhou")


def legenda_de(texto: str, pasta: Path) -> list:
    return json.loads(voz_arquivo(pasta, texto).with_suffix(".json").read_text(encoding="utf-8"))


def fim_da_fala(leg: list) -> float:
    return leg[-1][0] + leg[-1][1]


def duracoes(pasta_vozes: Path) -> list:
    """Duração fixa de cada cena, em frames de render: as fixas pelo tamanho da própria fala, as variáveis pela janela."""
    out = []
    for i in range(6):
        fala = JANELAS[i] if i in JANELAS else fim_da_fala(legenda_de(FIXAS[i], pasta_vozes))
        out.append(ATRASO + round(fala * FPS) + FOLGA + (RESPIRO_FINAL if i == 5 else 0))
    return out


def inicio_final(dur: list, i: int) -> float:
    """Segundos, no vídeo final, em que a cena i começa."""
    return sum(dur[:i]) / FPS / VEL


def encaixa(it: dict, pasta_vozes: Path) -> None:
    """Escolhe, para cada fala variável, a versão mais longa que cabe na janela (acelerando até EXTRA_MAX)."""
    it["texto"], it["extra"], it["leg"] = {}, {}, {}
    for i, versoes in it["falas"].items():
        for k, texto in enumerate(versoes):
            leg = legenda_de(texto, pasta_vozes)
            extra = max(1.0, fim_da_fala(leg) / JANELAS[i])
            if extra <= EXTRA_MAX or k == len(versoes) - 1:
                it["texto"][i], it["extra"][i], it["leg"][i] = texto, min(extra, EXTRA_MAX), leg
                break
    for i, texto in FIXAS.items():
        it["texto"][i], it["extra"][i] = texto, 1.0


# ---------------------------------------------------------------- legenda palavra por palavra em ASS (libass no ffmpeg)
# Mesmo desenho da Legenda de src/Saude.tsx (e do insulina_comum.mjs): caixa escura embaixo, até 4 palavras por trecho
# (quebra também nas pausas), palavra ativa em vermelho, as já ditas em branco, as próximas apagadas.
def _sem(s: str) -> str:
    return s.lower().strip(".,!?;:")


def trechos(leg: list) -> list:
    palavras = []
    k = 0
    while k < len(leg):
        ant = palavras[-1] if palavras else None
        if ant and ant[2][-1:].isdigit() and _sem(leg[k][2]) == "por" and k + 1 < len(leg) and _sem(leg[k + 1][2]) == "cento":
            palavras[-1] = [ant[0], leg[k + 1][0] + leg[k + 1][1] - ant[0], ant[2] + "%"]
            k += 2
            continue
        palavras.append(list(leg[k]))
        k += 1
    out, atual = [], None
    for t, d, texto in palavras:
        ini, fim = ATRASO / FPS + t, ATRASO / FPS + t + d   # segundos de render desde o começo da cena
        if not atual or len(atual["palavras"]) >= 4 or ini - atual["fim"] > 6 / FPS:
            if atual:
                out.append(atual)
            atual = {"ini": ini, "fim": fim, "palavras": []}
        atual["palavras"].append({"ini": ini, "fim": fim, "texto": texto})
        atual["fim"] = fim
    if atual:
        out.append(atual)
    return out


def _tempo(s: float) -> str:
    h, m, seg = int(s // 3600), int(s % 3600 // 60), s % 60
    return f"{h}:{m:02d}:{seg:05.2f}"


def ass(leg: list, extra: float = 1.0, deslocamento: float = 0.0) -> str:
    """Legenda da cena no tempo final (já acelerado); extra = aceleração a mais da fala desta cena."""
    f = lambda s: deslocamento + s / VEL / extra
    tam, margem = round(76 * ESCALA), round(390 * ESCALA)
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {LARG}
PlayResY: {ALT}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Fala,Archivo Condensed Black,{tam},&H00FFFFFF,&H00FFFFFF,&H2E20110B,&H2E20110B,0,0,0,0,100,100,1,0,3,{round(14 * ESCALA)},0,2,40,40,{margem},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    linhas, ts = [], trechos(leg)
    for k, t in enumerate(ts):
        fim_trecho = min(t["fim"] + 12 / FPS, ts[k + 1]["ini"] if k + 1 < len(ts) else float("inf"))
        for j, p in enumerate(t["palavras"]):
            ini = p["ini"]
            fim = t["palavras"][j + 1]["ini"] if j + 1 < len(t["palavras"]) else fim_trecho
            if fim <= ini:
                continue
            partes = []
            for i, q in enumerate(t["palavras"]):
                # sem aumentar a palavra ativa: \fscx dentro da caixa opaca (BorderStyle 3) deixa fantasmas no libass
                cor = "{\\c&H2626DC&\\1a&H00&}" if i == j else "{\\c&HFFFFFF&\\1a&H00&}" if i < j else "{\\c&HFFFFFF&\\1a&H8C&}"
                partes.append(cor + q["texto"].upper().replace("{", "").replace("}", "").replace("\\", ""))
            linhas.append(f"Dialogue: 0,{_tempo(f(ini))},{_tempo(f(fim))},Fala,,0,0,0,,{' '.join(partes)}")
    return cab + "\n".join(linhas) + "\n"


def filtro_arq(p) -> str:
    """Caminho de arquivo dentro de um filtro do ffmpeg (Windows: C\\:/pasta)."""
    return str(p).replace("\\", "/").replace(":", "\\:")


def filtro_ass(arq) -> str:
    return f"subtitles='{filtro_arq(arq)}':fontsdir='{filtro_arq(FONTES)}'"
