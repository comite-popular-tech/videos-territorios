// Trabalho "video-bolsa-familia" da fila: vídeo de alerta do Bolsa Família por município (piloto de Acrelândia, 21/10/2026).
//   node video/trabalhos/video-bolsa-familia.mjs <pasta-entradas> <pasta-saidas> <slug ...> [--conc N] [--workers N] [--um-a-um]
// Padrão: um render por 3 núcleos ao mesmo tempo (--conc), 2 navegadores em cada (--workers). Medido em 21/10 no PC
// do Gui (12 núcleos): 4 cidades em 48 s de render + 1,5 s de montagem cada (o vídeo inteiro em 1080p levava 55 s).
// Montagem, não render inteiro (ver bolsa_familia_comum.mjs): abertura (A), projeção (C) e a base do áudio são peças
// prontas (bolsa_familia_pecas.mjs; baixadas do R2 uma vez por máquina). Por cidade: render HyperFrames só do trecho
// que muda (19,1 s em 720x1280, sem áudio; o lote inteiro numa chamada só), corte em B e D, o último quadro de D parado
// até 36 s, colagem das quatro peças sem recodificar e mistura das duas falas e dos efeitos da cidade com a base.
// Entradas por cidade (bolsa_familia_vozes.mjs): dados.json, fala-2.mp3, fala-3.mp3. Saída: <saidas>/<slug>/bolsa-familia.mp4
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import * as C from '../bolsa_familia_comum.mjs';

const [ENT, SAI, ...resto] = process.argv.slice(2);
const opc = (n, d) => (resto.includes(n) ? resto[resto.indexOf(n) + 1] : d);
const slugs = resto.filter((a, i) => !a.startsWith('--') && !resto[i - 1]?.startsWith('--'));
if (!ENT || !SAI || !slugs.length) { console.error('uso: video-bolsa-familia.mjs <entradas> <saidas> <slug ...>'); process.exit(1); }
const FILA = (process.env.FILA_URL || 'https://fila-videos.boralula.workers.dev').replace(/\/$/, '');
const KIT = path.join(C.VIDEO, 'kit', 'video-bolsa-familia');
const TMP = path.join(KIT, 'render');
fs.mkdirSync(TMP, { recursive: true });

// ---------------------------------------------------------------- peças comuns (uma vez por máquina)
const LOCAL = path.join(C.PROJETO, 'renders', 'pecas'); // na máquina do Gui já estão aqui
let COMUM = LOCAL;
if (!['A.mp4', 'C.mp4', 'base.wav', 'projeto'].every((n) => fs.existsSync(path.join(LOCAL, n)))) {
  COMUM = path.join(KIT, 'comum');
  fs.mkdirSync(COMUM, { recursive: true });
  for (const nome of ['A.mp4', 'C.mp4', 'base.wav', 'projeto.tar', 'sfx.tar', ...(resto.includes('--pillow') ? ['fundo-base.mp4', 'fundo-pico.mp4'] : [])]) {
    const destino = path.join(COMUM, nome);
    if (fs.existsSync(destino)) continue;
    const r = await fetch(`${FILA}/entradas/comum/video-bolsa-familia/${nome}`);
    if (!r.ok) { console.error(`sem o arquivo comum ${nome} (${r.status})`); process.exit(1); }
    fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
    if (nome.endsWith('.tar')) spawnSync('tar', ['-xf', nome], { cwd: COMUM, stdio: 'inherit' });
  }
}
const SFX = COMUM === LOCAL ? C.SFX : path.join(COMUM, 'sfx');
const PROJ = path.join(COMUM, 'projeto');

// ---------------------------------------------------------------- dados das cidades
const itens = [];
for (const slug of slugs) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(ENT, slug, 'dados.json'), 'utf8'));
    for (const f of ['fala-2.mp3', 'fala-3.mp3']) if (!fs.existsSync(path.join(ENT, slug, f))) throw new Error(`sem ${f}`);
    itens.push(d);
  } catch (e) {
    console.log(`  ${slug}: entradas incompletas (${e.message})`);
  }
}
if (!itens.length) process.exit(1);

// ---------------------------------------------------------------- render do trecho que muda (HyperFrames)
const trecho = (slug) => path.join(TMP, `${slug}-trecho.mp4`);
// foto da cidade atrás da cena do dinheiro (sem ela com --sem-foto ou quando a cidade não tem fundo no kit). Na fila
// ela não é entrada do item: vem de fundos/<cidade>.jpg, que já está no R2 desde o kit dos vídeos de Saúde.
if (!resto.includes('--sem-foto')) {
  for (const it of itens) {
    const destino = it.foto && path.join(ENT, it.slug, it.foto.arquivo);
    if (!destino || fs.existsSync(destino)) continue;
    const r = await fetch(`${FILA}/entradas/fundos/${it.foto.arquivo}`).catch(() => null);
    if (r?.ok) fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  }
}
const FOTOS = path.join(PROJ, 'assets', 'cidades');
fs.mkdirSync(FOTOS, { recursive: true });
const variaveis = (it) => {
  const f = it.foto && !resto.includes('--sem-foto') && path.join(ENT, it.slug, it.foto.arquivo);
  if (!f || !fs.existsSync(f)) return { ...it.tela, ...it.tempos, foto: '', credito: '' };
  fs.copyFileSync(f, path.join(FOTOS, `${it.slug}.jpg`));
  return { ...it.tela, ...it.tempos, foto: `assets/cidades/${it.slug}.jpg`, credito: it.foto.credito };
};
// renders ao mesmo tempo: um por 3 núcleos (o --conc do workflow, pensado para o Remotion, só baixa esse teto)
const CONC = Math.max(1, Math.min(+opc('--conc', 99), Math.floor(os.cpus().length / 3)));
const hf = (...a) => spawnSync(process.execPath, [C.HYPERFRAMES, 'render', PROJ, '--crf', '14', '--quiet',
  '--workers', opc('--workers', '2'), ...(resto.includes('--rapida') ? ['--experimental-fast-capture'] : []), ...a], { stdio: 'inherit' });
const t0 = Date.now();
// --pillow: sem navegador; bolsa_familia_pillow.py desenha B e D por cima dos fundos prontos (teste de 21/10/2026)
const PILLOW = resto.includes('--pillow');
if (PILLOW) {
  // o ajudar.sh/ajudar.ps1 passa em PYTHON o Python que achou (no Windows pode ser o "py")
  const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  spawnSync(py, [path.join(C.VIDEO, 'bolsa_familia_pillow.py'), ENT, TMP, ...itens.map((it) => it.slug),
    ...(resto.includes('--sem-foto') ? ['--sem-foto'] : []), '--pecas', COMUM, '--paralelo', opc('--paralelo', String(Math.max(1, Math.floor(os.cpus().length / 2))))],
  { stdio: 'inherit', env: { ...process.env, FFMPEG: C.FFMPEG } });
} else if (resto.includes('--um-a-um')) {
  for (const it of itens) {
    const vars = path.join(TMP, `${it.slug}-vars.json`);
    fs.writeFileSync(vars, JSON.stringify(variaveis(it)));
    hf('--variables-file', vars, '-o', trecho(it.slug));
  }
} else {
  const linhas = path.join(TMP, `lote-${process.pid}.json`);
  fs.writeFileSync(linhas, JSON.stringify(itens.map((it) => ({ ...variaveis(it), slug: it.slug }))));
  hf('--batch', linhas, '--batch-concurrency', String(CONC), '-o', path.join(TMP, '{slug}-trecho.mp4'));
}
console.log(`  render dos trechos: ${((Date.now() - t0) / 1000).toFixed(0)} s para ${itens.length}`);

// ---------------------------------------------------------------- montagem
const q = (s) => Math.round(s * C.FPS);
const nB = q(C.CORTES.B[1] - C.CORTES.B[0]), nD = q(C.CORTES.D[1] - C.CORTES.D[0]), parado = C.TOTAL - C.CORTES.D[1];
let ok = 0;
for (const it of itens) {
  const t1 = Date.now();
  const tmp = (n) => path.join(TMP, `${it.slug}-${n}`);
  try {
    if (PILLOW) {
      if (!fs.existsSync(tmp('B.mp4')) || !fs.existsSync(tmp('D.mp4'))) throw new Error('sem B/D do Pillow');
    } else {
      if (!fs.existsSync(trecho(it.slug))) throw new Error('sem o trecho renderizado');
      // B e D (D com o último quadro parado até o fim)
      C.ffmpeg('-i', trecho(it.slug), '-filter_complex',
        `[0:v]split=2[x][y];[x]trim=start_frame=0:end_frame=${nB},setpts=PTS-STARTPTS[b];` +
        `[y]trim=start_frame=${nB}:end_frame=${nB + nD},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${parado}[d]`,
        '-map', '[b]', ...C.ENC, tmp('B.mp4'), '-map', '[d]', ...C.ENC, tmp('D.mp4'));
    }
    // as quatro peças, sem recodificar
    const pecas = [path.join(COMUM, 'A.mp4'), tmp('B.mp4'), path.join(COMUM, 'C.mp4'), tmp('D.mp4')];
    fs.writeFileSync(tmp('lista.txt'), pecas.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    C.ffmpeg('-f', 'concat', '-safe', '0', '-i', tmp('lista.txt'), '-c', 'copy', tmp('video.mp4'));
    // áudio: base pronta + as duas falas da cidade + os efeitos que seguem a narração dela
    const entradas = [
      [path.join(ENT, it.slug, 'fala-2.mp3'), C.FALAS[2].ini, 1, it.falas[2].extra],
      [path.join(ENT, it.slug, 'fala-3.mp3'), C.FALAS[3].ini, 1, it.falas[3].extra],
      ...C.sfxDaCidade(it.tempos).map(([a, t, v]) => [path.join(SFX, `${a}.mp3`), t, v]),
    ];
    C.ffmpeg(...C.mistura(entradas, ['-c:a', 'aac', '-b:a', '128k', tmp('audio.m4a')], { base: path.join(COMUM, 'base.wav') }));
    const fin = path.join(SAI, it.slug, 'bolsa-familia.mp4');
    fs.mkdirSync(path.dirname(fin), { recursive: true });
    C.ffmpeg('-i', tmp('video.mp4'), '-i', tmp('audio.m4a'), '-map', '0:v', '-map', '1:a', '-c', 'copy', '-t', String(C.TOTAL), '-movflags', '+faststart', fin);
    ok++;
    console.log(`  ${it.slug}: montagem ${((Date.now() - t1) / 1000).toFixed(1)} s`);
  } catch (e) {
    console.log(`  ${it.slug}: falhou (${e.message})`);
  } finally {
    for (const f of fs.readdirSync(TMP)) if (f.startsWith(it.slug + '-')) fs.rmSync(path.join(TMP, f), { force: true });
    fs.rmSync(path.join(FOTOS, `${it.slug}.jpg`), { force: true });
  }
}
process.exit(ok === slugs.length ? 0 : 1);
