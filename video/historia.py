# Monta um vídeo de história narrada ("A Carteira Vazia" e parecidos) a partir de clipes gerados por IA.
# Entrada: uma pasta em video/public/<nome>/ com roteiro.json e os clipes clip1.mp4 ... clipN.mp4 (um por cena).
#   roteiro.json: {"cenas": ["texto narrado da cena 1", "...", ...], "musica": "musica.mp3" (opcional, na mesma pasta)}
# Etapas (cada uma pula o que já existe):
#   python historia.py <nome> contato        folha de contato das imagens cena1..N (jpg/png) em saida/<nome>/contato.jpg, para conferir a ordem
#   python historia.py <nome> vozes          narração edge-tts por cena (fala<i>.mp3 + tempos das palavras)
#   python historia.py <nome> preparar       clip<i>.mp4 -> cena<i>.mp4 na duração da fala (desacelera se faltar), 30 fps, 1080x1920; grava props.json
#   python historia.py <nome> render         Remotion (composição Historia): clipes + narração + legenda -> saida/<nome>/<nome>.mp4
#   python historia.py <nome> final [--vel 1.5] [--musica 0.28]   acelera (vídeo e voz, sem mudar o tom) e mixa a música -> saida/<nome>/<nome>-final.mp4 (+ cópia 720p)
#   python historia.py <nome> tudo [--vel 1.5]                    as quatro etapas em sequência
# Precisa: npm i (nesta pasta), pip install edge-tts, ffmpeg no PATH.
import json
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
FPS = 30
ATRASO = 8        # frames entre o início da cena e a fala (mesmo ATRASO_VOZ da composição)
FOLGA = 36        # frames depois da fala
MINIMO = 150      # cena nunca menor que 5 s
RESPIRO_FINAL = 60
CLIP = 8 * FPS    # clipes do Veo têm 8 s
VOZ = 'pt-BR-AntonioNeural'
TAXA = '-6%'      # ritmo da narração (mais lento que o lote de Saúde)

nome = sys.argv[1]
etapa = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else 'tudo'
opc = lambda n, d: sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d
pasta = os.path.join(AQUI, 'public', nome)
saida = os.path.join(AQUI, '..', 'saida', nome)
os.makedirs(saida, exist_ok=True)
roteiro = json.load(open(os.path.join(pasta, 'roteiro.json'), encoding='utf-8'))
cenas = roteiro['cenas']
N = len(cenas)


def sh(*cmd):
    subprocess.run(cmd, check=True, shell=(os.name == 'nt' and cmd[0] == 'npx'))


def contato():
    from PIL import Image
    W, H = 240, 430
    arquivos = []
    for i in range(1, N + 1):
        for ext in ('jpg', 'png', 'jpeg'):
            f = os.path.join(pasta, f'cena{i}.{ext}')
            if os.path.exists(f):
                arquivos.append(f)
                break
    cols = 6
    linhas = (len(arquivos) + cols - 1) // cols
    folha = Image.new('RGB', (W * cols, H * linhas), 'black')
    for k, f in enumerate(arquivos):
        im = Image.open(f).convert('RGB')
        im.thumbnail((W, H))
        folha.paste(im, ((k % cols) * W, (k // cols) * H))
    destino = os.path.join(saida, 'contato.jpg')
    folha.save(destino, quality=80)
    print(len(arquivos), 'imagens em', destino)


def vozes():
    import asyncio
    import edge_tts
    tarefas = [(i, t) for i, t in enumerate(cenas, 1) if not os.path.exists(os.path.join(pasta, f'fala{i}.json'))]

    async def uma(i, texto):
        palavras = []
        mp3 = os.path.join(pasta, f'fala{i}.mp3')
        with open(mp3, 'wb') as f:
            async for parte in edge_tts.Communicate(texto, VOZ, rate=TAXA, boundary='WordBoundary').stream():
                if parte['type'] == 'audio':
                    f.write(parte['data'])
                elif parte['type'] == 'WordBoundary':
                    palavras.append([round(parte['offset'] / 1e7, 3), round(parte['duration'] / 1e7, 3), parte['text']])
        json.dump(palavras, open(os.path.join(pasta, f'fala{i}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        print('voz', i, round(palavras[-1][0] + palavras[-1][1], 2), 's')

    async def todas():
        for i, t in tarefas:
            await uma(i, t)
    asyncio.run(todas())


def preparar():
    props = []
    for i in range(1, N + 1):
        leg = json.load(open(os.path.join(pasta, f'fala{i}.json'), encoding='utf-8'))
        fim = leg[-1][0] + leg[-1][1]
        dur = max(MINIMO, ATRASO + round(fim * FPS) + FOLGA) + (RESPIRO_FINAL if i == N else 0)
        vel = min(1.0, CLIP / dur)
        destino = os.path.join(pasta, f'cena{i}.mp4')
        if not os.path.exists(destino):
            seg = dur / FPS
            sh('ffmpeg', '-y', '-v', 'error', '-i', os.path.join(pasta, f'clip{i}.mp4'),
               '-filter_complex', f'[0:v]setpts={1 / vel:.4f}*PTS,fps={FPS},scale=1080:1920:flags=lanczos,trim=duration={seg:.3f}[v];'
                                  f'[0:a]atempo={max(vel, 0.5):.4f},atrim=duration={seg:.3f}[a]',
               '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-pix_fmt', 'yuv420p',
               '-c:a', 'aac', '-b:a', '128k', destino)
            print('cena', i, dur, 'frames, velocidade', round(vel, 3))
        props.append({'video': f'{nome}/cena{i}.mp4', 'voz': f'{nome}/fala{i}.mp3', 'legenda': leg, 'dur': dur, 'velocidade': 1,
                      'ambiente': 0.35})
    json.dump({'cenas': props, 'trilha': ''}, open(os.path.join(pasta, 'props.json'), 'w', encoding='utf-8'), ensure_ascii=False)


def render():
    sh('npx', 'remotion', 'render', 'src/index.ts', 'Historia', os.path.join(saida, f'{nome}.mp4'),
       f'--props={os.path.join(pasta, "props.json")}', '--gl=angle', '--concurrency=4', '--timeout=120000', '--log=error')


def final():
    vel = float(opc('--vel', '1.5'))
    vol = float(opc('--musica', '0.28'))
    bruto = os.path.join(saida, f'{nome}.mp4')
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', bruto])) / vel
    musica = roteiro.get('musica')
    fin = os.path.join(saida, f'{nome}-final.mp4')
    filtros = f'[0:v]setpts=PTS/{vel}[v];[0:a]atempo={vel}[n]'
    entradas = ['-i', bruto]
    if musica:
        entradas += ['-i', os.path.join(pasta, musica)]
        filtros += f';[1:a]atrim=0:{dur:.2f},afade=t=in:d=2,afade=t=out:st={dur - 4:.2f}:d=4,volume={vol}[m];[n][m]amix=inputs=2:duration=first:normalize=0[a]'
    else:
        filtros += ';[n]acopy[a]'
    sh('ffmpeg', '-y', '-v', 'error', *entradas, '-filter_complex', filtros, '-map', '[v]', '-map', '[a]',
       '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', fin)
    sh('ffmpeg', '-y', '-v', 'error', '-i', fin, '-vf', 'scale=720:1280', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27',
       '-c:a', 'copy', '-movflags', '+faststart', fin.replace('-final.mp4', '-final-720.mp4'))
    print('pronto', fin, round(dur, 1), 's')


os.chdir(AQUI)
{'contato': contato, 'vozes': vozes, 'preparar': preparar, 'render': render, 'final': final,
 'tudo': lambda: (vozes(), preparar(), render(), final())}[etapa]()
