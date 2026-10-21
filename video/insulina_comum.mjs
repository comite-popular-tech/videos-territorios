// O que o vídeo "A insulina do Seu Raimundo" tem em comum entre as peças prontas (insulina_pecas.mjs) e a montagem
// por território (trabalhos/video-insulina.mjs): tempos fixos das cenas, voz, legenda em ASS para o ffmpeg e os
// parâmetros de codificação, que precisam ser iguais em todas as peças para a colagem sem recodificar (-c copy).
//
// Decisão do Gui (21/10/2026): a cena tem duração fixa e é a fala que se ajusta a ela. As cenas 3, 5 e 6 têm texto
// igual em todo lugar e ficam prontas com legenda e tudo; as cenas 1 e 2 têm vídeo pronto e ganham a legenda do
// território; a cena 4 (dado da cidade) é desenhada por território. Saída em 720x1280.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

export const VIDEO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
export const FPS = 30, ATRASO = 8, FOLGA = 30, RESPIRO_FINAL = 60; // frames, no tempo do render (antes do 1,25x)
export const VEL = 1.25; // o vídeo aprovado é o render acelerado 1,25x (vídeo e voz, sem mudar o tom)
export const LARG = 720, ALT = 1280, ESCALA = LARG / 1080;
export const VOZ = 'pt-BR-AntonioNeural', TAXA = '-6%';
export const MUSICA = 0.25, AMBIENTE = 0.35;
export const CLIPES = [240, 240, 120]; // frames dos clipes do Flow (8 s, 8 s e 4 s)
// janela de fala das cenas variáveis, em segundos de render: mediana das falas cabe folgada; a mais longa acelera um
// pouco (até EXTRA_MAX) e, se nem assim couber, o texto encurta (trabalhos/video-insulina.mjs)
export const JANELAS = { 0: 7.2, 1: 6.3, 3: 6.3 };
export const EXTRA_MAX = 1.3;
export const FIXAS = {
  2: 'São mais de cem reais que ficam no bolso, todo mês.',
  4: 'Bolsonaro já tentou cortar 59 por cento da Farmácia Popular. Flávio Bolsonaro planeja cortar até 250 bilhões.',
  5: 'Compartilhe com quem pega remédio aqui na farmácia da região.',
};
export const FONTES = path.join(VIDEO, 'fontes'); // Archivo Condensed Black (OFL), a letra da legenda
export const FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0 ? 'ffmpeg' : (await import('ffmpeg-static')).default;
// mesmos parâmetros em toda peça: a colagem final é -c copy
export const ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.0', '-r', String(FPS), '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-an'];

export function ffmpeg(...args) {
  const r = spawnSync(FFMPEG, ['-y', '-v', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(r.error ? `ffmpeg não roda (${r.error.code})` : `ffmpeg falhou: ${args.slice(-1)[0]}`);
}

// ---------------------------------------------------------------- vozes (cache por texto: fala igual é gerada uma vez)
export const fimDaFala = (leg) => leg[leg.length - 1][0] + leg[leg.length - 1][1];
export function vozArquivo(pasta, texto) {
  return path.join(pasta, crypto.createHash('sha1').update(`${VOZ}|${TAXA}|${texto}`).digest('hex').slice(0, 16) + '.mp3');
}
export function gerarVozes(pasta, textos) {
  fs.mkdirSync(pasta, { recursive: true });
  const tarefas = [...new Map(textos.map((t) => [vozArquivo(pasta, t), { arquivo: vozArquivo(pasta, t), texto: t }])).values()]
    .filter((t) => !fs.existsSync(t.arquivo.replace(/\.mp3$/, '.json')));
  if (!tarefas.length) return;
  const tj = path.join(pasta, '_tarefas.json');
  fs.writeFileSync(tj, JSON.stringify(tarefas));
  const r = spawnSync(process.platform === 'win32' ? 'python' : 'python3', [path.join(VIDEO, 'vozes.py'), tj, VOZ, '6', TAXA], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('vozes.py falhou');
}
export const legendaDe = (texto, pasta) => JSON.parse(fs.readFileSync(vozArquivo(pasta, texto).replace(/\.mp3$/, '.json'), 'utf8'));

// duração fixa de cada cena, em frames de render: as fixas pelo tamanho da própria fala, as variáveis pela janela
export function duracoes(pastaVozes) {
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const fala = i in JANELAS ? JANELAS[i] : fimDaFala(legendaDe(FIXAS[i], pastaVozes));
    return ATRASO + Math.round(fala * FPS) + FOLGA + (i === 5 ? RESPIRO_FINAL : 0);
  });
}
export const inicioFinal = (dur, i) => dur.slice(0, i).reduce((a, b) => a + b, 0) / FPS / VEL; // segundos no vídeo final

// ---------------------------------------------------------------- legenda palavra por palavra em ASS (libass no ffmpeg)
// Mesmo desenho da Legenda de src/Saude.tsx: caixa escura embaixo, até 4 palavras por trecho (quebra também nas pausas),
// palavra ativa em vermelho e um pouco maior, as já ditas em branco, as próximas apagadas. "59 por cento" vira "59%".
const sem = (s) => s.toLowerCase().replace(/[.,!?;:]/g, '');
export function trechos(leg) {
  const palavras = [];
  for (let k = 0; k < leg.length; k++) {
    const ant = palavras[palavras.length - 1];
    if (ant && /\d$/.test(ant[2]) && sem(leg[k][2]) === 'por' && sem(leg[k + 1]?.[2] ?? '') === 'cento') {
      palavras[palavras.length - 1] = [ant[0], leg[k + 1][0] + leg[k + 1][1] - ant[0], ant[2] + '%'];
      k++;
    } else palavras.push(leg[k]);
  }
  const out = [];
  let atual = null;
  for (const [t, d, texto] of palavras) {
    const ini = ATRASO / FPS + t, fim = ATRASO / FPS + t + d; // segundos de render desde o começo da cena
    if (!atual || atual.palavras.length >= 4 || ini - atual.fim > 6 / FPS) {
      if (atual) out.push(atual);
      atual = { ini, fim, palavras: [] };
    }
    atual.palavras.push({ ini, fim, texto });
    atual.fim = fim;
  }
  if (atual) out.push(atual);
  return out;
}

const tempo = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60; return `${h}:${String(m).padStart(2, '0')}:${seg.toFixed(2).padStart(5, '0')}`; };
// extra: aceleração a mais da fala desta cena (os tempos da legenda encolhem junto); deslocamento em segundos finais
export function ass(leg, { extra = 1, deslocamento = 0 } = {}) {
  const f = (s) => deslocamento + s / VEL / extra;
  const tam = Math.round(76 * ESCALA), margem = Math.round(390 * ESCALA);
  const cab = `[Script Info]
ScriptType: v4.00+
PlayResX: ${LARG}
PlayResY: ${ALT}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Fala,Archivo Condensed Black,${tam},&H00FFFFFF,&H00FFFFFF,&H2E20110B,&H2E20110B,0,0,0,0,100,100,1,0,3,${Math.round(14 * ESCALA)},0,2,40,40,${margem},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const linhas = [];
  const ts = trechos(leg);
  ts.forEach((t, k) => {
    const fimTrecho = Math.min(t.fim + 12 / FPS, ts[k + 1]?.ini ?? Infinity);
    t.palavras.forEach((p, j) => {
      const ini = p.ini, fim = j + 1 < t.palavras.length ? t.palavras[j + 1].ini : fimTrecho;
      if (fim <= ini) return;
      const texto = t.palavras.map((q, i) => {
        // sem aumentar a palavra ativa: \fscx dentro da caixa opaca (BorderStyle 3) deixa fantasmas no libass
        const cor = i === j ? '{\\c&H2626DC&\\1a&H00&}' : i < j ? '{\\c&HFFFFFF&\\1a&H00&}' : '{\\c&HFFFFFF&\\1a&H8C&}';
        return cor + q.texto.toUpperCase().replace(/[{}\\]/g, '');
      }).join(' ');
      linhas.push(`Dialogue: 0,${tempo(f(ini))},${tempo(f(fim))},Fala,,0,0,0,,${texto}`);
    });
  });
  return cab + linhas.join('\n') + '\n';
}

// caminho de arquivo dentro de um filtro do ffmpeg (Windows: C\:/pasta)
export const filtroArq = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:');
export const filtroAss = (arq) => `subtitles='${filtroArq(arq)}':fontsdir='${filtroArq(FONTES)}'`;
