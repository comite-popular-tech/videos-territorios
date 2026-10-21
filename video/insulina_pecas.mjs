// Peças prontas do vídeo "A insulina do Seu Raimundo": as cenas que não mudam de um território para outro, renderizadas
// uma vez só em 720x1280 e já no tempo final (1,25x), para a montagem por território (trabalhos/video-insulina.mjs)
// apenas colar. Cenas 1 e 2 (cozinha e farmácia): só o vídeo, a legenda do território entra depois. Cenas 3, 5 e 6
// (bolso, corte, compartilhe): texto igual em todo lugar, saem com legenda. Sem áudio: a mistura é por território.
//   node video/insulina_pecas.mjs [--gl angle|swangle]
// Saída: video/public/insulina/pecas/peca1.mp4 ... peca6.mp4 (sem a 4) e duracoes.json; insulina_dados.py --subir leva ao R2.
import fs from 'fs';
import http from 'http';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import * as C from './insulina_comum.mjs';

const args = process.argv.slice(2);
const opc = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const PUB = path.join(C.VIDEO, 'public', 'insulina'), PECAS = path.join(PUB, 'pecas'), VOZES = path.join(C.VIDEO, 'kit', 'video-insulina', 'vozes');
fs.mkdirSync(PECAS, { recursive: true });

C.gerarVozes(VOZES, Object.values(C.FIXAS));
const dur = C.duracoes(VOZES);
fs.writeFileSync(path.join(PECAS, 'duracoes.json'), JSON.stringify({ dur, vel: C.VEL, fps: C.FPS }));
console.log('durações (frames de render):', dur.join(' '), `= ${(dur.reduce((a, b) => a + b, 0) / C.FPS / C.VEL).toFixed(1)} s no final`);

// servidor local dos clipes e fundos, como no lote
const servidor = http.createServer((req, res) => {
  const arq = path.join(PUB, decodeURIComponent(req.url.split('?')[0]));
  if (!arq.startsWith(PUB) || !fs.existsSync(arq)) { res.writeHead(404); return res.end(); }
  const tam = fs.statSync(arq).size, tipo = { '.jpg': 'image/jpeg', '.mp4': 'video/mp4' }[path.extname(arq)] ?? 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (m) {
    const ini = m[1] ? +m[1] : tam - +m[2], fim = m[1] && m[2] ? +m[2] : tam - 1;
    res.writeHead(206, { 'Content-Type': tipo, 'Content-Range': `bytes ${ini}-${fim}/${tam}`, 'Content-Length': fim - ini + 1, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' });
    return fs.createReadStream(arq, { start: ini, end: fim }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': tam, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(arq).pipe(res);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${servidor.address().port}`;

const serveUrl = await bundle({ entryPoint: path.join(C.VIDEO, 'src/index.ts'), publicDir: path.join(C.VIDEO, 'kit', 'video-insulina', 'public-vazio') });
const browser = await openBrowser('chrome', { chromiumOptions: { gl: opc('--gl', 'angle') } });
const FONTE_CORTE = 'Corte de 59%: proposta de Orçamento 2023 do governo Bolsonaro · Plano de até R$ 250 bi: Folha de S.Paulo, out/2026';

for (const i of [0, 1, 2, 4, 5]) {
  const t0 = Date.now();
  const cena = { dur: dur[i], legenda: [] }; // legenda vazia: a do ffmpeg entra depois (ou nunca, nas cenas 1 e 2)
  if (i < 3) Object.assign(cena, { video: `${BASE}/clip${i + 1}.mp4`, velocidade: Math.min(1, C.CLIPES[i] / dur[i]), ambiente: 0 });
  else if (i === 4) cena.info = { tipo: 'corte', troca: 0, fundo: `${BASE}/farmacia.jpg`, fonte: FONTE_CORTE };
  else cena.info = { tipo: 'fecho', fundo: `${BASE}/rua.jpg` };
  if (i === 4) { // a troca para o carimbo dos R$ 250 bi acompanha a palavra "Flávio" da fala fixa
    const leg = C.legendaDe(C.FIXAS[4], VOZES);
    const flavio = leg.find((p) => p[2].replace(/[.,]/g, '') === 'Flávio');
    cena.info.troca = C.ATRASO + Math.round((flavio?.[0] ?? C.fimDaFala(leg) / 2) * C.FPS);
  }
  const props = { cenas: [cena], trilha: '', entraPrimeira: i > 0 };
  const bruto = path.join(PECAS, `bruto${i + 1}.mp4`);
  const composition = await selectComposition({ serveUrl, id: 'Historia', inputProps: props, puppeteerInstance: browser, logLevel: 'error' });
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: bruto, inputProps: props, concurrency: +opc('--conc', 4), scale: C.ESCALA, x264Preset: 'veryfast', crf: 16, imageFormat: 'jpeg', puppeteerInstance: browser, logLevel: 'error', timeoutInMilliseconds: 120000 });
  // tempo final e, nas cenas de texto fixo, a legenda
  const filtros = [`setpts=PTS/${C.VEL}`, `fps=${C.FPS}`];
  if (i in C.FIXAS) {
    const assArq = path.join(PECAS, `peca${i + 1}.ass`);
    fs.writeFileSync(assArq, C.ass(C.legendaDe(C.FIXAS[i], VOZES)));
    filtros.push(C.filtroAss(assArq));
  }
  C.ffmpeg('-i', bruto, '-vf', filtros.join(','), ...C.ENC, path.join(PECAS, `peca${i + 1}.mp4`));
  fs.rmSync(bruto, { force: true });
  console.log(`peça ${i + 1}: ${dur[i]} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close({ silent: true });
servidor.close();
