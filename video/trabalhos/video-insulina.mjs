// Trabalho "video-insulina" da fila: "A insulina do Seu Raimundo" (Farmácia Popular, aprovado em 20/10/2026) por território.
//   node video/trabalhos/video-insulina.mjs <pasta-entradas> <pasta-saidas> <slug ...> [--gl angle|swangle] [--conc N]
// Seis cenas da composição Historia: três clipes do Flow (iguais em todos os vídeos), o dado da cidade (infográfico com a
// foto ou o mapa do kit), o corte e o fecho (src/InfoFarmacia.tsx). Muda por território a fala 1 (bairro ou cidade),
// a 2 (rua da farmácia credenciada perto, quando há; senão só "na farmácia") e a 4 (atendidos em ago/2026; cidade sem
// farmácia credenciada usa o número do estado). Depois do render, o ffmpeg
// acelera 1,25x e mistura a música, como o historia.py final. Saída: <pasta-saidas>/<slug>/insulina.mp4.
// Entradas por item: <slug>.json (kit_fundos.py) e <cidade>.jpg. Arquivos comuns: comum/video-insulina/ no R2
// (insulina_dados.py --subir), baixados uma vez por máquina para video/kit/video-insulina/comum/.
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawnSync } from 'child_process';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, selectComposition } from '@remotion/renderer';
// ffmpeg do sistema, se houver; senão o do pacote ffmpeg-static (vem com o npm i: quem ajuda não precisa instalar nada)
const FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0 ? 'ffmpeg' : (await import('ffmpeg-static')).default;

const VIDEO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const [ENT, SAI, ...resto] = process.argv.slice(2);
const opc = (n, d) => (resto.includes(n) ? resto[resto.indexOf(n) + 1] : d);
const slugs = resto.filter((a, i) => !a.startsWith('--') && !resto[i - 1]?.startsWith('--'));
if (!ENT || !SAI || !slugs.length) { console.error('uso: video-insulina.mjs <entradas> <saidas> <slug ...>'); process.exit(1); }
const FILA = (process.env.FILA_URL || 'https://fila-videos.boralula.workers.dev').replace(/\/$/, '');
const KIT = path.join(VIDEO, 'kit', 'video-insulina');
const COMUM = path.join(KIT, 'comum'), VOZES = path.join(KIT, 'vozes'), TMP = path.join(KIT, 'render');
for (const d of [COMUM, VOZES, TMP, path.join(KIT, 'public-vazio')]) fs.mkdirSync(d, { recursive: true });

const FPS = 30, ATRASO = 8, FOLGA = 36, MINIMO = 150, RESPIRO_FINAL = 60, FUSAO = 18; // como historia.py e Historia.tsx
const VOZ = 'pt-BR-AntonioNeural', TAXA = '-6%', VEL = 1.25, MUSICA = 0.25;
const CLIPES = [240, 240, 120]; // frames de clip1..3 (8 s, 8 s e 4 s)
const FP = JSON.parse(fs.readFileSync(path.join(VIDEO, 'farmacia_popular.json'), 'utf8'));
// rua da farmácia credenciada perto (bairro com farmácia no mesmo bairro, cidade com uma só): insulina_farmacias.py
const RUA = JSON.parse(fs.readFileSync(path.join(VIDEO, 'farmacia_rua.json'), 'utf8'));
const ESTADOS = {
  AC: ['No Acre', 'Acre'], AL: ['Em Alagoas', 'Alagoas'], AP: ['No Amapá', 'Amapá'], AM: ['No Amazonas', 'Amazonas'], BA: ['Na Bahia', 'Bahia'],
  CE: ['No Ceará', 'Ceará'], DF: ['No Distrito Federal', 'Distrito Federal'], ES: ['No Espírito Santo', 'Espírito Santo'], GO: ['Em Goiás', 'Goiás'],
  MA: ['No Maranhão', 'Maranhão'], MT: ['Em Mato Grosso', 'Mato Grosso'], MS: ['Em Mato Grosso do Sul', 'Mato Grosso do Sul'], MG: ['Em Minas Gerais', 'Minas Gerais'],
  PA: ['No Pará', 'Pará'], PB: ['Na Paraíba', 'Paraíba'], PR: ['No Paraná', 'Paraná'], PE: ['Em Pernambuco', 'Pernambuco'], PI: ['No Piauí', 'Piauí'],
  RJ: ['No estado do Rio de Janeiro', 'Estado do Rio de Janeiro'], RN: ['No Rio Grande do Norte', 'Rio Grande do Norte'], RS: ['No Rio Grande do Sul', 'Rio Grande do Sul'],
  RO: ['Em Rondônia', 'Rondônia'], RR: ['Em Roraima', 'Roraima'], SC: ['Em Santa Catarina', 'Santa Catarina'], SP: ['No estado de São Paulo', 'Estado de São Paulo'],
  SE: ['Em Sergipe', 'Sergipe'], TO: ['No Tocantins', 'Tocantins'],
};
const FONTE_DADO = 'Ministério da Saúde, Farmácia Popular: pessoas atendidas em ago/2026 · IBGE, Censo 2022';
const FONTE_CORTE = 'Corte de 59%: proposta de Orçamento 2023 do governo Bolsonaro · Plano de até R$ 250 bi: Folha de S.Paulo, out/2026';
const limpa = (s) => String(s ?? '').replace(/ /g, ' ').trim();

// "576", "550 mil", "1 milhão e 200 mil" (o cartão mostra "1,2 milhão": mesmo arredondamento)
function falado(v) {
  if (v < 1000) return String(v);
  if (v < 1e6) return `${Math.round(v / 1000)} mil`;
  const d = Math.round(v / 1e5), m = Math.floor(d / 10), r = (d % 10) * 100;
  return `${m} ${m === 1 ? 'milhão' : 'milhões'}${r ? ` e ${r} mil` : ''}`;
}

function roteiro(d, slug) {
  const ped = d.pedidos, nomes = ped.nomes ?? {};
  const cidade = limpa(ped.municipio.municipio), uf = ped.municipio.uf, ibge = String(ped.municipio.cod_ibge);
  const bairro = nomes.regra === 'pares' ? limpa(nomes.bairro) : '';
  const [atend, pop] = FP.municipios[ibge] ?? [0, 0];
  const doEstado = !atend;
  const [a, p] = doEstado ? FP.ufs[uf] : [atend, pop];
  const onde = doEstado ? ESTADOS[uf][0] : `Em ${cidade}`;
  const quem = a === 1 ? '1 pessoa pegou' : `${falado(a)} pessoas pegaram`;
  return {
    falas: [
      `Seu Raimundo mora ${bairro ? `no bairro ${bairro}` : `em ${cidade}`}. Tem diabetes e usa insulina todo dia.`,
      `Todo mês ele pega a insulina na farmácia${RUA[slug] ? ` ${RUA[slug]}` : ''}. E não paga nada.`,
      'São mais de cem reais que ficam no bolso, todo mês.',
      `${onde}, ${quem} remédio de graça ${doEstado ? 'pela Farmácia Popular' : 'assim'} só em ${FP.mes}.`,
      'Bolsonaro já tentou cortar 59 por cento da Farmácia Popular. Flávio Bolsonaro planeja cortar até 250 bilhões.',
      'Compartilhe com quem pega remédio aqui na farmácia da região.',
    ],
    dado: { local: doEstado ? ESTADOS[uf][1] : `${cidade} - ${uf}`, atendidos: a, populacao: p, mes: FP.mes },
  };
}

// ---------------------------------------------------------------- arquivos comuns (uma vez por máquina)
for (const nome of ['clip1.mp4', 'clip2.mp4', 'clip3.mp4', 'farmacia.jpg', 'rua.jpg', 'musica.mp3']) {
  const destino = path.join(COMUM, nome);
  if (fs.existsSync(destino)) continue;
  const local = path.join(VIDEO, 'public', 'insulina', nome); // na máquina do Gui já estão aqui
  if (fs.existsSync(local)) { fs.copyFileSync(local, destino); continue; }
  const r = await fetch(`${FILA}/entradas/comum/video-insulina/${nome}`);
  if (!r.ok) { console.error(`sem o arquivo comum ${nome} (${r.status})`); process.exit(1); }
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
}

// ---------------------------------------------------------------- roteiros e vozes
const itens = [];
for (const slug of slugs) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(ENT, slug, `${slug}.json`), 'utf8'));
    const fundo = path.join(ENT, slug, `${slug.split('--')[0]}.jpg`);
    if (!fs.existsSync(fundo)) throw new Error('sem o fundo');
    const r = roteiro(d, slug);
    // voz pelo texto: as falas iguais em todos os vídeos são geradas uma vez só
    r.vozes = r.falas.map((t) => path.join(VOZES, crypto.createHash('sha1').update(`${VOZ}|${TAXA}|${t}`).digest('hex').slice(0, 16) + '.mp3'));
    itens.push({ slug, fundo, ...r });
  } catch (e) {
    console.log(`  ${slug}: entradas incompletas (${e.message})`);
  }
}
if (!itens.length) process.exit(1);
const tarefas = [...new Map(itens.flatMap((it) => it.falas.map((texto, i) => [it.vozes[i], { arquivo: it.vozes[i], texto }]))).values()];
const tj = path.join(KIT, '_tarefas.json');
fs.writeFileSync(tj, JSON.stringify(tarefas));
spawnSync(process.platform === 'win32' ? 'python' : 'python3', [path.join(VIDEO, 'vozes.py'), tj, VOZ, '6', TAXA], { stdio: 'inherit' });

// ---------------------------------------------------------------- servidor local (comuns, vozes, fundos)
const TIPOS = { '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
const PASTAS = { comum: COMUM, vozes: VOZES, ent: path.resolve(ENT) };
const servidor = http.createServer((req, res) => {
  const [, raiz, ...resto] = decodeURIComponent(req.url.split('?')[0]).split('/');
  const arq = PASTAS[raiz] && path.join(PASTAS[raiz], ...resto);
  if (!arq || resto.includes('..') || !fs.existsSync(arq)) { res.writeHead(404); return res.end(); }
  const tam = fs.statSync(arq).size, tipo = TIPOS[path.extname(arq)] ?? 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (m) { // o OffthreadVideo pede pedaços do MP4
    const ini = m[1] ? +m[1] : tam - +m[2], fim = m[1] && m[2] ? +m[2] : tam - 1;
    res.writeHead(206, { 'Content-Type': tipo, 'Content-Range': `bytes ${ini}-${fim}/${tam}`, 'Content-Length': fim - ini + 1, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' });
    return fs.createReadStream(arq, { start: ini, end: fim }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': tam, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(arq).pipe(res);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${servidor.address().port}`;
const url = (pasta, arq) => `${BASE}/${pasta}/${path.relative(PASTAS[pasta], arq).split(path.sep).map(encodeURIComponent).join('/')}`;

// ---------------------------------------------------------------- render (um projeto para o lote todo)
const serveUrl = await bundle({ entryPoint: path.join(VIDEO, 'src/index.ts'), publicDir: path.join(KIT, 'public-vazio') });
const browser = await openBrowser('chrome', { chromiumOptions: { gl: opc('--gl', 'angle') } });
const CONC = +opc('--conc', 4);
let ok = 0;
for (const it of itens) {
  const t0 = Date.now();
  try {
    const cenas = it.falas.map((_, i) => {
      const leg = JSON.parse(fs.readFileSync(it.vozes[i].replace(/\.mp3$/, '.json'), 'utf8'));
      const fim = leg[leg.length - 1][0] + leg[leg.length - 1][1];
      const dur = Math.max(MINIMO, ATRASO + Math.round(fim * FPS) + FOLGA) + (i === 5 ? RESPIRO_FINAL : 0);
      const c = { voz: url('vozes', it.vozes[i]), legenda: leg, dur };
      if (i < 3) return { ...c, video: url('comum', path.join(COMUM, `clip${i + 1}.mp4`)), velocidade: Math.min(1, CLIPES[i] / dur), ambiente: 0.35 };
      if (i === 3) return { ...c, info: { tipo: 'dado', ...it.dado, fundo: url('ent', it.fundo), fonte: FONTE_DADO } };
      if (i === 4) {
        const flavio = leg.find((p) => p[2].replace(/[.,]/g, '') === 'Flávio');
        return { ...c, info: { tipo: 'corte', troca: ATRASO + Math.round((flavio?.[0] ?? fim / 2) * FPS), fundo: url('comum', path.join(COMUM, 'farmacia.jpg')), fonte: FONTE_CORTE } };
      }
      return { ...c, info: { tipo: 'fecho', fundo: url('comum', path.join(COMUM, 'rua.jpg')) } };
    });
    const props = { cenas, trilha: '' };
    const bruto = path.join(TMP, `${it.slug}.mp4`);
    const composition = await selectComposition({ serveUrl, id: 'Historia', inputProps: props, puppeteerInstance: browser, logLevel: 'error' });
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: bruto, inputProps: props, concurrency: CONC, x264Preset: 'veryfast', imageFormat: 'jpeg', puppeteerInstance: browser, logLevel: 'error', timeoutInMilliseconds: 120000 });
    // final: 1,25x (vídeo e voz, sem mudar o tom) e a música por baixo, entrando e saindo em fade
    const dur = (cenas.reduce((a, c) => a + c.dur, 0) - FUSAO * (cenas.length - 1)) / FPS / VEL;
    const fin = path.join(SAI, it.slug, 'insulina.mp4');
    fs.mkdirSync(path.dirname(fin), { recursive: true });
    const f = spawnSync(FFMPEG, ['-y', '-v', 'error', '-i', bruto, '-i', path.join(COMUM, 'musica.mp3'), '-filter_complex',
      `[0:v]setpts=PTS/${VEL}[v];[0:a]atempo=${VEL}[n];[1:a]atrim=0:${dur.toFixed(2)},afade=t=in:d=2,afade=t=out:st=${(dur - 4).toFixed(2)}:d=4,volume=${MUSICA}[m];[n][m]amix=inputs=2:duration=first:normalize=0[a]`,
      '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', fin], { stdio: 'inherit' });
    fs.rmSync(bruto, { force: true });
    if (f.status !== 0) throw new Error(f.error ? `ffmpeg não roda (${f.error.code})` : 'ffmpeg falhou');
    ok++;
    console.log(`  ${it.slug}: ${dur.toFixed(1)} s, render ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } catch (e) {
    console.log(`  ${it.slug}: falhou (${e.message})`);
  }
}
await browser.close({ silent: true });
servidor.close();
process.exit(ok === slugs.length ? 0 : 1);
