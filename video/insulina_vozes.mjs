// Prepara no R2 o que a página "ajudar pelo navegador" (navegador/) precisa para montar "A insulina do Seu Raimundo":
// o navegador não chama o edge-tts, então as vozes de todos os territórios são geradas aqui, uma vez, e sobem prontas.
//   node video/insulina_vozes.mjs [--so slug ...] [--paralelo 6] [--pasta DIR] [--sem-subir]
// Texto: roteiro() de trabalhos/insulina-roteiro.mjs (o mesmo do render em Node). Voz pt-BR-AntonioNeural a +18%:
// no navegador não há ffmpeg para acelerar 1,25x depois, então a fala já sai rápida e a composição usa tempos menores.
// No R2 (leitura pública em <fila>/entradas/<chave>), sob comum/video-insulina/web/:
//   vozes/<hash>.mp3 e vozes/<hash>.json (tempo de cada palavra); hash = sha1("voz|taxa|texto"), 16 letras: fala igual
//   em vários territórios existe uma vez só
//   roteiros/<slug>.json  {slug, voz, taxa, falas:[{texto, voz:<hash>}], dado}
// Sobe pelo PUT /kit/ de administração com FILA_SEGREDO (ambiente, Bitwarden `bws` ou ~/.config/boralula/fila-videos.env),
// pulando as vozes que já estão no R2 (os roteiros sobem sempre: são pequenos e mudam se o texto mudar). A lista de territórios é a de dados/ no R2 (a mesma que a fila usa).
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { roteiro } from './trabalhos/insulina-roteiro.mjs';

const VIDEO = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const args = process.argv.slice(2);
const opc = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const SO = args.includes('--so') ? args.slice(args.indexOf('--so') + 1).filter((a) => !a.startsWith('--')) : null;
const FILA = (process.env.FILA_URL || 'https://fila-videos.boralula.workers.dev').replace(/\/$/, '');
const PREFIXO = 'comum/video-insulina/web/';
const VOZ = 'pt-BR-AntonioNeural', TAXA = '+18%';
const PASTA = path.resolve(opc('--pasta', path.join(VIDEO, 'kit', 'video-insulina-web')));
const DADOS = path.join(PASTA, 'dados'), VOZES = path.join(PASTA, 'vozes');
for (const d of [DADOS, VOZES]) fs.mkdirSync(d, { recursive: true });

function segredo() {
  if (process.env.FILA_SEGREDO) return process.env.FILA_SEGREDO;
  const r = spawnSync('bws', ['secret', 'list', '-o', 'json'], { encoding: 'utf8' });
  if (r.status === 0) { const s = JSON.parse(r.stdout).find((x) => x.key === 'FILA_SEGREDO'); if (s) return s.value; }
  const arq = path.join(os.homedir(), '.config', 'boralula', 'fila-videos.env');
  const linha = fs.existsSync(arq) && fs.readFileSync(arq, 'utf8').split(/\r?\n/).find((l) => l.startsWith('FILA_SEGREDO='));
  if (linha) return linha.split('=').slice(1).join('=').trim();
  console.error('PARE: falta FILA_SEGREDO (ambiente, Bitwarden ou ~/.config/boralula/fila-videos.env).'); process.exit(1);
}
const TOKEN = segredo();

const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function pedir(url, metodo = 'GET', corpo, tipo, admin = false) {
  for (let t = 0; ; t++) {
    try {
      const h = {}; if (tipo) h['Content-Type'] = tipo; if (admin) h.Authorization = `Bearer ${TOKEN}`;
      const r = await fetch(url, { method: metodo, body: corpo, headers: h });
      if (r.status === 429 || r.status >= 500) throw new Error(String(r.status));
      if (!r.ok) throw Object.assign(new Error(`${r.status} ${(await r.text()).slice(0, 200)}`), { final: true });
      return r;
    } catch (e) {
      if (e.final || t >= 5) throw new Error(`${metodo} ${url.replace(FILA, '')}: ${e.message}`);
      await dormir(2000 * 2 ** t);
    }
  }
}
const listar = async (prefixo) => (await (await pedir(`${FILA}/kit/listar`, 'POST', JSON.stringify({ prefixo }), 'application/json', true)).json()).chaves;
async function emParalelo(lista, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < lista.length) { const x = lista[i++]; await fn(x); } }));
}

// ---------------------------------------------------------------- territórios e dados
const slugs = SO ?? (await listar('dados/')).filter((c) => c.endsWith('.json')).map((c) => c.slice(6, -5)).sort();
console.log(`${slugs.length} territórios`);
let baixados = 0;
await emParalelo(slugs.filter((s) => !fs.existsSync(path.join(DADOS, `${s}.json`))), 16, async (s) => {
  const r = await pedir(`${FILA}/entradas/dados/${s}.json`);
  fs.writeFileSync(path.join(DADOS, `${s}.json`), Buffer.from(await r.arrayBuffer()));
  if (++baixados % 500 === 0) console.log(`  dados: ${baixados}`);
});

// ---------------------------------------------------------------- roteiros e vozes
const hash = (texto) => crypto.createHash('sha1').update(`${VOZ}|${TAXA}|${texto}`).digest('hex').slice(0, 16);
const roteiros = [], falhas = [];
for (const slug of slugs) {
  try {
    const r = roteiro(JSON.parse(fs.readFileSync(path.join(DADOS, `${slug}.json`), 'utf8')), slug);
    roteiros.push({ slug, voz: VOZ, taxa: TAXA, falas: r.falas.map((texto) => ({ texto, voz: hash(texto) })), dado: r.dado });
  } catch (e) { falhas.push(`${slug}: ${e.message}`); }
}
if (falhas.length) console.log(`sem roteiro (${falhas.length}):\n  ${falhas.slice(0, 20).join('\n  ')}`);
const tarefas = [...new Map(roteiros.flatMap((r) => r.falas.map((f) => [f.voz, { arquivo: path.join(VOZES, `${f.voz}.mp3`), texto: f.texto }]))).values()];
console.log(`${roteiros.length} roteiros, ${tarefas.length} falas diferentes`);
const tj = path.join(PASTA, '_tarefas.json');
fs.writeFileSync(tj, JSON.stringify(tarefas));
const py = spawnSync(process.platform === 'win32' ? 'python' : 'python3', [path.join(VIDEO, 'vozes.py'), tj, VOZ, opc('--paralelo', '6'), TAXA], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', maxBuffer: 1 << 28 });
const falhasVoz = (py.stdout ?? '').split('\n').filter((l) => l.startsWith('falha'));
console.log((py.stdout ?? '').split('\n').filter((l) => l.startsWith('fim')).join('') || `vozes.py saiu com ${py.status}`);
const semVoz = new Set(tarefas.filter((t) => !fs.existsSync(t.arquivo) || !fs.existsSync(t.arquivo.replace(/\.mp3$/, '.json'))).map((t) => path.basename(t.arquivo, '.mp3')));
if (semVoz.size) console.log(`${semVoz.size} falas sem voz (${falhasVoz.slice(0, 3).join(' | ')}); os territórios delas ficam para a próxima rodada`);
if (args.includes('--sem-subir')) process.exit(semVoz.size ? 1 : 0);

// ---------------------------------------------------------------- sobe o que falta (vozes antes dos roteiros)
const noR2 = new Set(await listar(PREFIXO));
const subir = async (chave, corpo, tipo) => { await pedir(`${FILA}/kit/${chave}`, 'PUT', corpo, tipo, true); };
let n = 0;
const vozesFaltando = tarefas.map((t) => path.basename(t.arquivo, '.mp3')).filter((h) => !semVoz.has(h))
  .flatMap((h) => [['mp3', 'audio/mpeg'], ['json', 'application/json']].map(([e, tipo]) => ({ chave: `${PREFIXO}vozes/${h}.${e}`, arq: path.join(VOZES, `${h}.${e}`), tipo })))
  .filter((x) => !noR2.has(x.chave));
await emParalelo(vozesFaltando, 8, async (x) => { await subir(x.chave, fs.readFileSync(x.arq), x.tipo); if (++n % 1000 === 0) console.log(`  vozes no R2: ${n}/${vozesFaltando.length}`); });
console.log(`vozes: ${vozesFaltando.length} arquivos subidos`);
n = 0;
const roteirosFaltando = roteiros.filter((r) => !r.falas.some((f) => semVoz.has(f.voz)));
await emParalelo(roteirosFaltando, 8, async (r) => { await subir(`${PREFIXO}roteiros/${r.slug}.json`, JSON.stringify(r), 'application/json'); if (++n % 1000 === 0) console.log(`  roteiros no R2: ${n}/${roteirosFaltando.length}`); });
console.log(`roteiros: ${roteirosFaltando.length} subidos; ${roteiros.length - roteirosFaltando.length} esperam voz`);
process.exit(semVoz.size || falhas.length ? 1 : 0);
