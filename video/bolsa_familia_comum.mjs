// O que o vídeo de alerta do Bolsa Família (video/alerta-bolsa-familia, HyperFrames) tem em comum entre as peças
// prontas (bolsa_familia_pecas.mjs), as vozes por cidade (bolsa_familia_vozes.mjs) e a montagem por cidade
// (trabalhos/video-bolsa-familia.mjs).
//
// Montagem (pedido do Gui, 21/10/2026: 720p, pré-renderizar o que der e o resto no ffmpeg). Em segundos do vídeo:
//   A  0 a 1,7     "Alerta!"                                 peça pronta
//   B  1,7 a 19,3  card (número de famílias) e dinheiro      render por cidade (HyperFrames, 720x1280, sem áudio)
//   C  19,3 a 31,6 a projeção (fala fixa)                    peça pronta
//   D  31,6 a 36   fecho com a nota da simulação             render por cidade de 31,6 a 33,1 e o último quadro
//                                                            parado pelo ffmpeg até 36 s
// O áudio é todo do ffmpeg: uma base pronta (trilha com a curva de volume e o recorte de frequências sob a voz, falas
// fixas e efeitos de tempo fixo) mais as duas falas da cidade e os efeitos que seguem a narração dela.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

export const VIDEO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
export const RAIZ = path.dirname(VIDEO);
export const PROJETO = path.join(VIDEO, 'alerta-bolsa-familia');
export const FPS = 30, LARG = 720, ALT = 1280, TOTAL = 36;
export const CORTES = { A: [0, 1.7], B: [1.7, 19.3], C: [19.3, 31.6], D: [31.6, 33.1] };
export const TRECHO = 19.1; // duração de modelos/cidade.html: B (17,6 s) seguido de D (1,5 s)
export const VOZ = 'pt-BR-AntonioNeural', TAXA = '+12%'; // voz aprovada pela coordenação em 19/10
// falas: começo no vídeo e, nas variáveis, até quando a fala pode ir (a cena seguinte entra logo depois)
export const FALAS = { 1: { ini: 0.35 }, 2: { ini: 1.7, ate: 9.35 }, 3: { ini: 9.7, ate: 18.95 }, 4: { ini: 19.4 } };
export const FIXAS = {
  1: 'Alerta!',
  4: 'A projeção tem como base os planos da própria campanha: um corte de duzentos e cinquenta bilhões de reais no orçamento, e a transição de dois anos para o Bolsa Família, proposta pela coordenadora econômica, Daniella Marques.',
};
export const EXTRA_MAX = 1.25; // fala que não cabe acelera até 25% a mais; se nem assim, o texto encurta
// mesmos parâmetros em toda peça: a colagem final é -c copy
export const ENC = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.0', '-r', String(FPS), '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-an'];
export const FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0 ? 'ffmpeg' : (await import('ffmpeg-static')).default;
export const HYPERFRAMES = path.join(VIDEO, 'node_modules', 'hyperframes', 'bin', 'hyperframes.mjs');

export function ffmpeg(...args) {
  const r = spawnSync(FFMPEG, ['-y', '-v', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(r.error ? `ffmpeg não roda (${r.error.code})` : `ffmpeg falhou: ${args.slice(-1)[0]}`);
}

// ---------------------------------------------------------------- números
export const br = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const virgula = (n) => String(n).replace('.', ',');
const UNI = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CEN = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const unidade = (u, fem) => (fem && u === 1 ? 'uma' : fem && u === 2 ? 'duas' : UNI[u]);
function ate999(n, fem) {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100), r = n % 100, partes = [];
  if (c) partes.push(fem ? CEN[c].replace(/os$/, 'as') : CEN[c]);
  if (r) partes.push(r < 20 ? unidade(r, fem) : DEZ[Math.floor(r / 10)] + (r % 10 ? ` e ${unidade(r % 10, fem)}` : ''));
  return partes.join(' e ');
}
// por extenso, para a voz: extenso(2074, true) = "duas mil e setenta e quatro"
export function extenso(n, fem = false) {
  n = Math.round(n);
  if (!n) return 'zero';
  const bi = Math.floor(n / 1e9), mi = Math.floor((n % 1e9) / 1e6), mil = Math.floor((n % 1e6) / 1e3), r = n % 1e3;
  const g = [];
  if (bi) g.push([bi, bi === 1 ? 'um bilhão' : `${ate999(bi, false)} bilhões`]);
  if (mi) g.push([mi, mi === 1 ? 'um milhão' : `${ate999(mi, false)} milhões`]);
  if (mil) g.push([mil, mil === 1 ? 'mil' : `${ate999(mil, fem)} mil`]);
  if (r) g.push([r, ate999(r, fem)]);
  // "e" antes do último grupo quando ele é menor que cem ou centena redonda: "dois mil e setenta", "dois mil trezentos e um"
  return g.map(([v, t], i) => (i === 0 ? t : i === g.length - 1 && (v < 100 || v % 100 === 0) ? `e ${t}` : t)).join(' ');
}
// valor em reais para a tela e para a voz, arredondado como o card (de R$ 1 bilhão para cima, "bilhão")
export function reais(v) {
  let R, tela;
  if (v >= 1e9) { const n = v < 1e10 ? Math.round(v / 1e8) / 10 : Math.round(v / 1e9); R = n * 1e9; tela = `R$ ${virgula(n)} ${n < 2 ? 'bilhão' : 'bilhões'}`; }
  else if (v >= 1e6) { const n = v < 1e7 ? Math.round(v / 1e5) / 10 : Math.round(v / 1e6); R = n * 1e6; tela = n >= 1000 ? 'R$ 1 bilhão' : `R$ ${virgula(n)} ${n < 2 ? 'milhão' : 'milhões'}`; }
  else if (v >= 1e4) { const n = Math.round(v / 1e3); R = n * 1e3; tela = n >= 1000 ? 'R$ 1 milhão' : `R$ ${n} mil`; }
  else { R = Math.round(v); tela = `R$ ${br(R)}`; }
  const dif = (R - v) / v;
  const prefixo = Math.abs(dif) < 0.005 ? '' : dif > 0 ? 'quase ' : 'mais de ';
  const falado = extenso(R) + (R >= 1e6 && R % 1e6 === 0 ? ' de reais' : ' reais');
  return { tela, falado: prefixo + falado };
}

// ---------------------------------------------------------------- roteiro por cidade
// m: linha de dados/bolsa_familia_municipios.csv. As falas vêm em versões, da cheia à mais curta.
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export function roteiro(m) {
  const n = +m.familias, cidade = m.municipio, media = Math.floor(+m.beneficio_medio), total = reais(+m.valor_mes);
  const um = n === 1;
  const fam = um ? 'a única família' : n < 1e4 || n % 1000 === 0 ? `as ${extenso(n, true)} famílias` : `mais de ${extenso(Math.floor(n / 1000), true)} mil famílias`;
  const [recebem, podem] = um ? ['recebe', 'pode'] : ['recebem', 'podem'];
  const M = `${extenso(media)} reais`;
  return {
    falas: {
      2: [
        `Se Flávio Bolsonaro for eleito, ${fam} que ${recebem} o Bolsa Família aqui em ${cidade} ${podem} perder o benefício.`,
        `Se Flávio Bolsonaro for eleito, ${fam} aqui em ${cidade} ${podem} perder o Bolsa Família.`,
        `Com Flávio eleito, ${fam} daqui ${podem} perder o Bolsa Família.`,
      ],
      3: [
        `Cada família recebe, em média, ${M} por mês. São ${total.falado} por mês a menos na cidade.`,
        `Em média, ${M} por família. São ${total.falado} por mês a menos na cidade.`,
        `São ${total.falado} por mês a menos na cidade.`,
      ],
    },
    tela: {
      cidade, uf: m.uf, familias: br(n), familias_n: n, media: br(media), media_n: media, total: total.tela,
      mes: `${MESES[+m.anomes.slice(4) - 1]} de ${m.anomes.slice(0, 4)}`,
    },
  };
}

// ---------------------------------------------------------------- vozes (cache por texto: fala igual é gerada uma vez)
export const VOZES = path.join(VIDEO, 'vozes', 'bolsa-familia'); // video/vozes é junção para o disco E:
export const fimDaFala = (leg) => leg[leg.length - 1][0] + leg[leg.length - 1][1];
export function vozArquivo(texto, pasta = VOZES) {
  return path.join(pasta, crypto.createHash('sha1').update(`${VOZ}|${TAXA}|${texto}`).digest('hex').slice(0, 16) + '.mp3');
}
export function gerarVozes(textos, pasta = VOZES, paralelas = 8) {
  fs.mkdirSync(pasta, { recursive: true });
  const tarefas = [...new Map(textos.map((t) => [vozArquivo(t, pasta), { arquivo: vozArquivo(t, pasta), texto: t }])).values()]
    .filter((t) => !fs.existsSync(t.arquivo.replace(/\.mp3$/, '.json')));
  if (!tarefas.length) return;
  const tj = path.join(pasta, `_tarefas-${process.pid}.json`);
  fs.writeFileSync(tj, JSON.stringify(tarefas));
  const r = spawnSync(process.platform === 'win32' ? 'python' : 'python3', [path.join(VIDEO, 'vozes.py'), tj, VOZ, String(paralelas), TAXA], { stdio: 'inherit' });
  fs.rmSync(tj, { force: true });
  if (r.status !== 0) throw new Error('vozes.py falhou');
}
// A voz às vezes junta várias palavras num pedaço só ("Vila Bela da Santíssima Trindade podem perder o"): o pedaço é
// dividido em palavras, com o tempo repartido pelo tamanho de cada uma.
export function palavrasDe(texto, pasta = VOZES) {
  const w = JSON.parse(fs.readFileSync(vozArquivo(texto, pasta).replace(/\.mp3$/, '.json'), 'utf8'));
  return w.flatMap(([t, d, p]) => {
    const partes = p.split(/\s+/).filter(Boolean);
    if (partes.length < 2) return [[t, d, p]];
    const total = partes.reduce((a, q) => a + q.length + 1, 0);
    let acc = 0;
    return partes.map((q) => { const ini = t + (d * acc) / total; acc += q.length + 1; return [ini, (d * (q.length + 1)) / total, q]; });
  });
}

// tempos da narração (s do vídeo) que a animação segue; w = [[início, duração, palavra], ...] de cada fala
const sem = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const acha = (w, re, de = 0) => { for (let i = de; i < w.length; i++) if (re.test(sem(w[i][2]))) return i; return -1; };
export function tempos(w2, extra2, w3, extra3) {
  const t2 = (i) => FALAS[2].ini + w2[i][0] / extra2, t3 = (i) => FALAS[3].ini + w3[i][0] / extra3;
  const iEl = acha(w2, /^eleito$/);
  let iNum = iEl + 1;
  if (/^(as|a)$/.test(sem(w2[iNum][2]))) iNum++;
  const iFam = acha(w2, /^familias?$/, iNum), iPod = acha(w2, /^podem?$/, iFam), iPer = acha(w2, /^perder$/, iPod);
  const iMed = acha(w3, /^media$/), iSao = acha(w3, /^sao$/), iMenos = acha(w3, /^menos$/, iSao);
  let iMes = iMenos; while (iMes > iSao && sem(w3[iMes][2]) !== 'mes') iMes--;
  const t = {
    t_eleito: t2(iEl), t_num: t2(iNum), t_fam: t2(iFam), t_podem: t2(iPod), t_perder: t2(iPer),
    t_total: t3(iSao + 1), t_mes: t3(iMes), t_menos: t3(iMenos),
  };
  if (iMed >= 0) {
    t.t_valor = t3(iMed + 1);
    t.t_valor_fim = t3(acha(w3, /^reais$/, iMed + 1));
  } else { // versão curta, sem o valor médio falado: o número entra no começo da fala
    t.t_valor = FALAS[3].ini + 0.1;
    t.t_valor_fim = Math.min(t.t_total - 0.3, FALAS[3].ini + 0.9);
  }
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
}

// ---------------------------------------------------------------- áudio
export const SFX = path.join(PROJETO, 'assets', 'sfx');
// efeitos de tempo fixo (vão para a base pronta): [arquivo, segundo do vídeo, volume]
export const SFX_FIXOS = [
  ['glitch-1', 0, 0.4], ['impact-bass-1', 0.3, 0.55], ['whoosh', 1.6, 0.35], ['whoosh', 9.45, 0.35], ['whoosh', 19.2, 0.35],
  ['whoosh-short', 22.3, 0.3], ['impact-bass-1', 23.9, 0.4], ['whoosh-short', 25.65, 0.3], ['impact-bass-1', 27.0, 0.35],
  ['impact-bass-2', 31.2, 0.5], ['whoosh', 31.5, 0.35],
];
// efeitos que seguem a narração da cidade (mesmas contas de compositions/dinheiro.html para os blocos)
export function sfxDaCidade(t) {
  const ini = t.t_total + 0.75, passo = Math.max(0.06, (t.t_menos - 0.1 - ini - 0.12) / 9);
  return [
    ['impact-bass-1', t.t_fam - 0.03, 0.5], ['impact-bass-2', t.t_perder - 0.25, 0.4], ['ping', t.t_valor_fim - 0.2, 0.3],
    ['impact-bass-1', t.t_total + 0.38, 0.4], ['impact-bass-1', t.t_menos - 0.07, 0.5],
    ...Array.from({ length: 10 }, (_, k) => ['click-soft', ini + k * passo, 0.4]),
  ];
}
// curva de volume da trilha (a mesma do index.html) e o recorte de frequências sob a voz (o "carve" do HyperFrames)
const CURVA = [[0, 0.5], [1.3, 0.5], [1.9, 0.16], [31.5, 0.16], [32.2, 0.42], [34.4, 0.42], [36, 0]];
const curva = () => {
  let e = String(CURVA[CURVA.length - 1][1]);
  for (let i = CURVA.length - 2; i >= 0; i--) {
    const [a, va] = CURVA[i], [b, vb] = CURVA[i + 1];
    e = `if(lt(t,${b}),${va}+(t-${a})*${((vb - va) / (b - a)).toFixed(5)},${e})`;
  }
  return e;
};
const EQ = [[250, -7.4], [400, -7.4], [630, -7.4], [1000, -7.4], [1600, -14.8], [2500, -7.4]]
  .map(([f, g]) => `equalizer=f=${f}:t=q:w=2.06:g=${g}:enable='between(t,1.8,31.6)'`).join(',');
export const filtroTrilha = (n) => `[${n}:a]atrim=0:${TOTAL},asetpts=PTS-STARTPTS,aresample=48000,volume='${curva()}':eval=frame,${EQ}[trilha]`;
// entradas: [[arquivo, segundo do vídeo, volume, atempo]]; devolve os argumentos do ffmpeg para misturar tudo
export function mistura(entradas, saida, { base = null } = {}) {
  const args = [], f = [], rot = [];
  entradas.forEach(([arq, t, vol, tempo = 1], i) => {
    args.push('-i', arq);
    const ms = Math.max(0, Math.round(t * 1000));
    f.push(`[${i}:a]aresample=48000,${tempo !== 1 ? `atempo=${tempo.toFixed(4)},` : ''}volume=${vol},adelay=${ms}|${ms}[e${i}]`);
    rot.push(`[e${i}]`);
  });
  if (base) {
    const n = entradas.length;
    args.push('-i', base);
    f.push(base.endsWith('.mp3') ? filtroTrilha(n) : `[${n}:a]aresample=48000[trilha]`);
    rot.push('[trilha]');
  }
  // limitador só na mistura final (a base fica em ponto flutuante, sem cortar picos)
  const lim = base && !base.endsWith('.mp3') ? ',alimiter=limit=0.85:level=0' : '';
  f.push(`${rot.join('')}amix=inputs=${rot.length}:duration=longest:normalize=0${lim},atrim=0:${TOTAL},apad=whole_dur=${TOTAL}[a]`);
  return [...args, '-filter_complex', f.join(';'), '-map', '[a]', ...saida];
}
