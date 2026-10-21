// Trabalho "video-posto" da fila: "Posto Fechado" (Rosângela e Dona Cida, aprovado em 20/10/2026) por território.
//   node video/trabalhos/video-posto.mjs <pasta-entradas> <pasta-saidas> <slug ...>
// Montagem, não render: as nove cenas já estão prontas (posto_pecas.mjs, baixadas do R2 uma vez por máquina). Por
// território só se faz a voz, a legenda das cenas 1, 2, 8 e 9 (ffmpeg) e a mistura do áudio; as nove peças são coladas
// sem recodificar. Não usa Remotion nem Chrome. Cena com tempo fixo e a fala que se ajusta (posto_comum.mjs).
// Muda por território: fala 1 (bairro e cidade), 2 (nome da unidade de saúde do par), 8 (repasse anual da atenção
// primária da cidade) e 9 (bairro e cidade). Entradas por item: <slug>.json (kit_fundos.py). Saída: <saidas>/<slug>/posto.mp4.
import fs from 'fs';
import path from 'path';
import * as C from '../posto_comum.mjs';

const [ENT, SAI, ...resto] = process.argv.slice(2);
const slugs = resto.filter((a, i) => !a.startsWith('--') && !resto[i - 1]?.startsWith('--'));
if (!ENT || !SAI || !slugs.length) { console.error('uso: video-posto.mjs <entradas> <saidas> <slug ...>'); process.exit(1); }
const FILA = (process.env.FILA_URL || 'https://fila-videos.boralula.workers.dev').replace(/\/$/, '');
const KIT = path.join(C.VIDEO, 'kit', C.TRABALHO);
const COMUM = path.join(KIT, 'comum'), VOZES = path.join(KIT, 'vozes'), TMP = path.join(KIT, 'render');
for (const d of [COMUM, VOZES, TMP]) fs.mkdirSync(d, { recursive: true });

// ---------------------------------------------------------------- arquivos comuns (uma vez por máquina)
const PECAS = [...Array(C.N).keys()].map((i) => `pecas/peca${i + 1}.mp4`);
for (const nome of ['musica.mp3', 'pecas/duracoes.json', ...PECAS]) {
  const destino = path.join(COMUM, nome);
  if (fs.existsSync(destino)) continue;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const local = path.join(C.PUB, nome); // na máquina do Gui já estão aqui
  if (fs.existsSync(local)) { fs.copyFileSync(local, destino); continue; }
  const r = await fetch(`${FILA}/entradas/comum/${C.TRABALHO}/${nome}`);
  if (!r.ok) { console.error(`sem o arquivo comum ${nome} (${r.status})`); process.exit(1); }
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
}
const DUR = JSON.parse(fs.readFileSync(path.join(COMUM, 'pecas/duracoes.json'), 'utf8')).dur; // frames de render de cada cena
const TOTAL = DUR.reduce((a, b) => a + b, 0) / C.FPS / C.VEL;

// ---------------------------------------------------------------- roteiros e vozes (fala igual é gerada uma vez)
const itens = [];
for (const slug of slugs) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(ENT, slug, `${slug}.json`), 'utf8'));
    itens.push({ slug, falas: C.roteiro(d.pedidos), texto: {}, extra: {}, leg: {} });
  } catch (e) {
    console.log(`  ${slug}: entradas incompletas (${e.message})`);
  }
}
if (!itens.length) process.exit(1);
// gera as versões cheias; quem não couber gera a versão seguinte (poucos casos: a janela já tem folga)
let pendentes = itens.map((it) => ({ it, versao: Object.fromEntries(C.VARIAVEIS.map((i) => [i, 0])) }));
while (pendentes.length) {
  C.gerarVozes(VOZES, [...Object.values(C.FIXAS), ...pendentes.flatMap(({ it, versao }) => C.VARIAVEIS.map((i) => it.falas[i][versao[i]]))]);
  const ainda = [];
  for (const p of pendentes) {
    let refaz = false;
    for (const i of C.VARIAVEIS) {
      if (p.it.texto[i]) continue;
      const texto = p.it.falas[i][p.versao[i]];
      const leg = C.legendaDe(texto, VOZES);
      const extra = Math.max(1, C.fimDaFala(leg) / C.JANELAS[i]); // quanto a fala precisa acelerar a mais para caber
      if (extra > C.EXTRA_MAX && p.versao[i] + 1 < p.it.falas[i].length) { p.versao[i]++; refaz = true; continue; }
      if (extra > C.EXTRA_MAX) console.log(`  ${p.it.slug}: fala ${i + 1} não cabe nem encurtada (${extra.toFixed(2)}x)`);
      p.it.texto[i] = texto; p.it.extra[i] = Math.min(extra, C.EXTRA_MAX); p.it.leg[i] = leg;
      if (p.versao[i]) console.log(`  ${p.it.slug}: fala ${i + 1} encurtada (${texto})`);
    }
    if (refaz) ainda.push(p);
  }
  pendentes = ainda;
}
for (const i of Object.keys(C.FIXAS)) for (const it of itens) { it.texto[i] = C.FIXAS[i]; it.extra[i] = 1; }

// ---------------------------------------------------------------- montagem
let ok = 0;
for (const it of itens) {
  const t0 = Date.now();
  const tmp = (n) => path.join(TMP, `${it.slug}-${n}`);
  try {
    const pecas = [];
    for (let i = 0; i < C.N; i++) {
      const pronta = path.join(COMUM, `pecas/peca${i + 1}.mp4`);
      if (i in C.FIXAS) { pecas.push(pronta); continue; }
      const assArq = tmp(`${i + 1}.ass`);
      fs.writeFileSync(assArq, C.ass(it.leg[i], it.extra[i]));
      C.ffmpeg('-i', pronta, '-vf', C.filtroAss(assArq), ...C.ENC, tmp(`p${i + 1}.mp4`));
      pecas.push(tmp(`p${i + 1}.mp4`));
    }
    fs.writeFileSync(tmp('lista.txt'), pecas.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    C.ffmpeg('-f', 'concat', '-safe', '0', '-i', tmp('lista.txt'), '-c', 'copy', tmp('video.mp4'));
    // áudio: vozes no começo de cada cena (aceleradas 1,5x e, se preciso, um pouco mais) e a música em tempo normal
    const entradas = [], filtros = [], mix = [];
    const add = (arq) => { entradas.push('-i', arq); return entradas.length / 2 - 1; };
    for (let i = 0; i < C.N; i++) {
      const n = add(C.vozArquivo(VOZES, it.texto[i]));
      const atraso = Math.round((C.inicioFinal(DUR, i) + C.ATRASO / C.FPS / C.VEL) * 1000);
      filtros.push(`[${n}:a]atempo=${(C.VEL * it.extra[i]).toFixed(4)},adelay=${atraso}|${atraso}[v${i}]`);
      mix.push(`[v${i}]`);
    }
    const m = add(path.join(COMUM, 'musica.mp3'));
    filtros.push(`[${m}:a]atrim=0:${TOTAL.toFixed(2)},afade=t=in:d=2,afade=t=out:st=${(TOTAL - 4).toFixed(2)}:d=4,volume=${C.MUSICA}[mu]`);
    mix.push('[mu]');
    filtros.push(`${mix.join('')}amix=inputs=${mix.length}:duration=longest:normalize=0,atrim=0:${TOTAL.toFixed(3)}[a]`);
    C.ffmpeg(...entradas, '-filter_complex', filtros.join(';'), '-map', '[a]', '-c:a', 'aac', '-b:a', '160k', tmp('audio.m4a'));
    const fin = path.join(SAI, it.slug, 'posto.mp4');
    fs.mkdirSync(path.dirname(fin), { recursive: true });
    C.ffmpeg('-i', tmp('video.mp4'), '-i', tmp('audio.m4a'), '-c', 'copy', '-shortest', '-movflags', '+faststart', fin);
    ok++;
    console.log(`  ${it.slug}: ${TOTAL.toFixed(1)} s, montagem ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } catch (e) {
    console.log(`  ${it.slug}: falhou (${e.message})`);
  } finally {
    for (const f of fs.readdirSync(TMP)) if (f.startsWith(it.slug + '-')) fs.rmSync(path.join(TMP, f), { force: true });
  }
}
process.exit(ok === slugs.length ? 0 : 1);
