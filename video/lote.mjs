// Renderiza o vídeo de Saúde de muitos territórios (saida/territorios/, os mesmos do acervo de cards): prepara o projeto uma vez, gera as vozes em paralelo (vozes.py) e
// renderiza N cidades ao mesmo tempo num Chromium só. Retoma: pula a cidade cujo MP4 já existe com os mesmos dados.
//   node lote.mjs ce-iguatu sp-sao-paulo--capao-redondo [--frames]       só esses
//   node lote.mjs --todas [--fundo foto|mapa] [--limite 50] [--amostra 50]
//   node lote.mjs --exemplo --todas                   os 4 territórios do kit em video/exemplo/ (sem os brutos)
//   node lote.mjs --dados video/kit <slug ...>         outra pasta de dados (mesmo desenho do exemplo/; é o que o ajudar.mjs usa)
//   opções: --paralelo 1 (cidades ao mesmo tempo)  --conc 8 (abas por cidade)  --720  --pular N  --voz antonio|francisca|thalita
//           --gl angle (placa de vídeo; swangle = só CPU, para máquina sem placa ou GitHub Actions)
//           --sem-voz  --refazer  --frames (5 PNG de conferência por cidade)
// Saída: saida/territorios/<slug>/video/saude.mp4 (+ saude.props.json); relatório em video/lote-relatorio.csv.
// Precisa, uma vez: npm i (nesta pasta), pip install edge-tts, python trilha.py
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { execFileSync, spawn } from 'child_process';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { RAIZ, dadosCidade, dadosRel } from './cidade.mjs';

const args = process.argv.slice(2);
const opc = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
if (args.includes('--exemplo')) process.env.VIDEO_DADOS = 'video/exemplo'; // vale também para o mapas.mjs
if (opc('--dados')) process.env.VIDEO_DADOS = opc('--dados').split(path.sep).join('/');
const flag = (n) => args.includes(n);
const VOZES = { antonio: 'pt-BR-AntonioNeural', francisca: 'pt-BR-FranciscaNeural', thalita: 'pt-BR-ThalitaMultilingualNeural' };
const voz = VOZES[opc('--voz', 'antonio')];
const PARALELO = +opc('--paralelo', 1), CONC = Math.min(+opc('--conc', 8), os.cpus().length); // o Remotion recusa mais abas que núcleos
const ESCALA = flag('--720') ? 2 / 3 : 1; // 720x1280: ~40% mais rápido
const FPS = 30, ATRASO_VOZ = 8, FOLGA = 14, MINIMO = [75, 150, 120, 120, 120], FECHO_EXTRA = 30;
const VALOR = new Set(['--fundo', '--limite', '--amostra', '--paralelo', '--conc', '--voz', '--pular', '--dados', '--gl']);
const DIR_VOZ = path.join(RAIZ, 'video', 'vozes', 'territorios'); // separado das vozes do vídeo por cidade (saida/brasil)
const REL = path.join(RAIZ, 'video', 'lote-relatorio.csv');

// ---------------------------------------------------------------- escolha das cidades
let slugs = args.filter((a, i) => !a.startsWith('--') && !VALOR.has(args[i - 1]));
const TERR = path.join(RAIZ, dadosRel(), 'saida/territorios');
if (flag('--todas')) slugs = fs.readdirSync(TERR).filter((s) => fs.existsSync(path.join(TERR, s, 'pedidos.json'))).sort();
if (!slugs.length) { console.error('uso: node lote.mjs <slug ...> | --todas [opções]  (ver cabeçalho)'); process.exit(1); }
let cidades = slugs.map(dadosCidade);
const erros = cidades.filter((c) => c.erro);
cidades = cidades.filter((c) => !c.erro);
if (opc('--fundo')) cidades = cidades.filter((c) => c.fundo === opc('--fundo'));
if (opc('--amostra')) { // sorteio fixo (mesma amostra a cada rodada)
  let x = 7; const r = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  cidades = cidades.map((c) => [r(), c]).sort((a, b) => a[0] - b[0]).slice(0, +opc('--amostra')).map((p) => p[1]);
}
if (opc('--pular')) cidades = cidades.slice(+opc('--pular'));
if (opc('--limite')) cidades = cidades.slice(0, +opc('--limite'));
console.log(`${cidades.length} cidades (${cidades.filter((c) => c.fundo === 'foto').length} com foto, ${cidades.filter((c) => c.fundo === 'mapa').length} com mapa); ${erros.length} fora`);
for (const e of erros.slice(0, 5)) console.log(`  fora: ${e.slug} (${e.erro})`);

// ---------------------------------------------------------------- vozes
const durMp3 = (a) => (fs.statSync(a).size * 8) / 48000; // edge-tts: MP3 CBR 48 kbps
if (!flag('--sem-voz')) {
  const tarefas = cidades.flatMap((c) => c.falas.map((texto, i) => ({ arquivo: path.join(DIR_VOZ, `${c.slug}-${i + 1}.mp3`), texto })));
  const tj = path.join(DIR_VOZ, '_tarefas.json');
  fs.mkdirSync(DIR_VOZ, { recursive: true });
  fs.writeFileSync(tj, JSON.stringify(tarefas));
  const t0 = Date.now();
  await new Promise((ok) => {
    const p = spawn('python', [path.join(RAIZ, 'video', 'vozes.py'), tj, voz, '6'], { stdio: ['ignore', 'pipe', 'inherit'] });
    let n = 0;
    p.stdout.on('data', (b) => String(b).split('\n').filter(Boolean).forEach((l) => {
      if (l.startsWith('ok')) { if (++n % 200 === 0) console.log(`vozes: ${n} (${((Date.now() - t0) / 60000).toFixed(1)} min)`); }
      else console.log('vozes:', l);
    }));
    p.on('close', ok);
  });
}

// ---------------------------------------------------------------- mapas em JPEG (cidades sem foto)
const semFoto = [...new Set(cidades.filter((c) => c.fundo === 'mapa').map((c) => c.cs))];
for (let i = 0; i < semFoto.length; i += 400) // em partes, para a linha de comando não estourar
  execFileSync('node', [path.join(RAIZ, 'video', 'mapas.mjs'), ...semFoto.slice(i, i + 400)], { stdio: 'inherit', cwd: RAIZ });

// ---------------------------------------------------------------- servidor local (fotos, mapas, vozes)
const TIPOS = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const LIBERADOS = [`${dadosRel()}dados/brutos/fotos_cidades/`, 'video/mapas/', 'video/vozes/'];
const servidor = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const arq = path.join(RAIZ, rel);
  if (!LIBERADOS.some((p) => rel.startsWith(p)) || rel.includes('..') || !fs.existsSync(arq)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq).toLowerCase()] ?? 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(arq).pipe(res);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${servidor.address().port}/`;

// ---------------------------------------------------------------- render
console.log('preparando o projeto...');
const serveUrl = await bundle({ entryPoint: path.join(RAIZ, 'video/src/index.ts'), publicDir: path.join(RAIZ, 'video/public') });
// gl angle usa a placa de vídeo: 22 s por vídeo contra 43 s só na CPU (swangle), medido em 14/10
const browser = await openBrowser('chrome', { chromiumOptions: { gl: opc('--gl', 'angle') } });
if (!fs.existsSync(REL)) fs.writeFileSync(REL, 'em,slug,situacao,fundo,segundos_video,segundos_render,obs\n');
const registra = (c, sit, dur, seg, obs = '') =>
  fs.appendFileSync(REL, [new Date().toISOString(), c.slug, sit, c.fundo ?? '', dur ?? '', seg ?? '', `"${String(obs).replace(/"/g, "'")}"`].join(',') + '\n');
for (const e of erros) if (slugs.length < 50) registra(e, 'fora', '', '', e.erro);

let feitas = 0, puladas = 0, falhas = 0; const t0 = Date.now();
async function uma(c) {
  const dir = path.join(RAIZ, 'saida/territorios', c.slug, 'video');
  const vozes = [], duracoes = [], legendas = [];
  for (let i = 0; i < c.falas.length; i++) {
    const a = path.join(DIR_VOZ, `${c.slug}-${i + 1}.mp3`);
    if (flag('--sem-voz')) { duracoes.push(MINIMO[i]); continue; }
    if (!fs.existsSync(a)) throw new Error(`sem voz ${i + 1}`);
    vozes.push(BASE + `video/vozes/territorios/${c.slug}-${i + 1}.mp3`);
    legendas.push(JSON.parse(fs.readFileSync(a.replace(/\.mp3$/, '.json'), 'utf8')));
    duracoes.push(Math.max(MINIMO[i], ATRASO_VOZ + Math.ceil(durMp3(a) * FPS) + FOLGA));
  }
  duracoes[duracoes.length - 1] += FECHO_EXTRA;
  const props = { ...c.props, foto: BASE + c.arquivoFundo, vozes, duracoes, legendas };
  const assinatura = JSON.stringify({ ...props, foto: c.arquivoFundo, vozes: vozes.map((v) => v.replace(BASE, '')), falas: c.falas });
  const mp4 = path.join(dir, 'saude.mp4'), pj = path.join(dir, 'saude.props.json');
  const total = duracoes.reduce((a, b) => a + b, 0) / FPS;
  if (!flag('--refazer') && fs.existsSync(mp4) && fs.existsSync(pj) && fs.readFileSync(pj, 'utf8') === assinatura) { puladas++; return; }
  fs.mkdirSync(dir, { recursive: true });
  const t = Date.now();
  const composition = await selectComposition({ serveUrl, id: 'Saude', inputProps: props, puppeteerInstance: browser, logLevel: 'error' });
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: mp4 + '.tmp.mp4', inputProps: props, concurrency: CONC, scale: ESCALA, x264Preset: 'veryfast', imageFormat: 'jpeg', puppeteerInstance: browser, logLevel: 'error' });
  fs.renameSync(mp4 + '.tmp.mp4', mp4);
  fs.writeFileSync(pj, assinatura);
  if (flag('--frames')) {
    const ini = duracoes.map((_, i) => duracoes.slice(0, i).reduce((a, b) => a + b, 0));
    for (const [nome, f] of [['abertura', ini[1] - 15], ['numero', ini[2] - 15], ['farmacia', ini[3] - 15], ['corte', ini[4] - 15], ['fecho', ini[4] + duracoes[4] - 35]])
      await renderStill({ composition, serveUrl, output: path.join(dir, `saude-${nome}.png`), frame: f, inputProps: props, puppeteerInstance: browser, logLevel: 'error' });
  }
  const obs = total < 20 || total > 45 ? `duração fora do normal (${total.toFixed(1)} s)` : '';
  registra(c, obs ? 'conferir' : 'ok', total.toFixed(1), ((Date.now() - t) / 1000).toFixed(0), obs);
  feitas++;
}

const fila = [...cidades];
await Promise.all(Array.from({ length: PARALELO }, async () => {
  for (let c; (c = fila.shift()); ) {
    // a página do Remotion às vezes não responde sob carga ("got no response"): tenta de novo uma vez
    try { await uma(c).catch(async (e) => { console.log(`nova tentativa ${c.slug}: ${e.message.split('\n')[0]}`); await uma(c); }); } catch (e) { falhas++; registra(c, 'erro', '', '', e.message.split('\n')[0]); console.log(`ERRO ${c.slug}: ${e.message.split('\n')[0]}`); }
    const n = feitas + puladas + falhas;
    if (n % 25 === 0 || !fila.length) {
      const min = (Date.now() - t0) / 60000;
      console.log(`${n}/${cidades.length}: ${feitas} feitas, ${puladas} já prontas, ${falhas} erros; ${min.toFixed(1)} min${feitas ? `, ${((min * 60) / feitas).toFixed(0)} s por vídeo` : ''}`);
    }
  }
}));
await browser.close({ silent: true });
servidor.close();
console.log(`fim: ${feitas} feitas, ${puladas} já prontas, ${falhas} erros. Relatório: ${REL}`);
if (falhas && !feitas) process.exitCode = 1; // nada saiu: avisa quem chamou
