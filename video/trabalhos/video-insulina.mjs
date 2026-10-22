// Trabalho "video-insulina" da fila: "A insulina do Seu Raimundo" (Farmácia Popular, aprovado em 20/10/2026) por território.
//   node video/trabalhos/video-insulina.mjs <pasta-entradas> <pasta-saidas> <slug ...> [--gl angle|swangle] [--conc N]
// Montagem, não render: as cenas que não mudam já estão prontas (insulina_pecas.mjs, baixadas do R2 uma vez por
// máquina). Por território só se faz a voz, a legenda das cenas 1 e 2 (ffmpeg), a cena 4 (dado da cidade, Remotion,
// uns 7 s) e a mistura do áudio; as seis peças são coladas sem recodificar. Decisão do Gui em 21/10: cena com tempo
// fixo e a fala que se ajusta (acelera um pouco, ou encurta o texto, quando não cabe). Saída 720x1280.
// Muda por território: fala 1 (bairro e cidade), fala 2 (rua da farmácia credenciada perto, quando há) e fala 4
// (atendidos em ago/2026; cidade sem farmácia credenciada usa o número do estado).
// Entradas por item: <slug>.json (kit_fundos.py) e <cidade>.jpg. Saída: <pasta-saidas>/<slug>/insulina.mp4.
import { spawnSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import * as C from '../insulina_comum.mjs';

const [ENT, SAI, ...resto] = process.argv.slice(2);
const opc = (n, d) => (resto.includes(n) ? resto[resto.indexOf(n) + 1] : d);
const slugs = resto.filter((a, i) => !a.startsWith('--') && !resto[i - 1]?.startsWith('--'));
if (!ENT || !SAI || !slugs.length) { console.error('uso: video-insulina.mjs <entradas> <saidas> <slug ...>'); process.exit(1); }
const FILA = (process.env.FILA_URL || 'https://fila-videos.boralula.workers.dev').replace(/\/$/, '');
const KIT = path.join(C.VIDEO, 'kit', 'video-insulina');
const COMUM = path.join(KIT, 'comum'), VOZES = path.join(KIT, 'vozes'), TMP = path.join(KIT, 'render');
for (const d of [COMUM, VOZES, TMP, path.join(KIT, 'public-vazio')]) fs.mkdirSync(d, { recursive: true });

const FP = JSON.parse(fs.readFileSync(path.join(C.VIDEO, 'farmacia_popular.json'), 'utf8'));
// rua da farmácia credenciada perto (bairro com farmácia no mesmo bairro ou numa rua a até 1 km do posto; cidade com uma só): insulina_farmacias.py
const RUA = JSON.parse(fs.readFileSync(path.join(C.VIDEO, 'farmacia_rua.json'), 'utf8'));
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
const limpa = (s) => String(s ?? '').replace(/\u00a0/g, ' ').trim();

// "576", "550 mil", "1 milhão e 200 mil" (o cartão mostra "1,2 milhão": mesmo arredondamento)
function falado(v) {
  if (v < 1000) return String(v);
  if (v < 1e6) return `${Math.round(v / 1000)} mil`;
  const d = Math.round(v / 1e5), m = Math.floor(d / 10), r = (d % 10) * 100;
  return `${m} ${m === 1 ? 'milhão' : 'milhões'}${r ? ` e ${r} mil` : ''}`;
}

// O bairro com o artigo do povo ("no Capão Redondo", "na Vila Prudente"), nunca "no bairro X" (Gui, 21/10): a tabela sai
// do video/lugar_falado.py --json; bairro fora dela (nome que não se fala) usa a versão só com a cidade.
const LUGAR = JSON.parse(fs.readFileSync(path.join(C.VIDEO, 'lugar_falado.json'), 'utf8'));
const deCidade = (c) => LUGAR.cidades[c] ?? `de ${c}`;
const confere = (t) => { if (/\bbairro\s+[A-ZÀ-Ý]/.test(t)) throw new Error(`fala com "bairro X": ${t}`); return t; };

// Falas variáveis, cada uma com as versões mais curtas para quando a cheia não cabe na janela da cena
function roteiro(d, slug) {
  const ped = d.pedidos, nomes = ped.nomes ?? {};
  const cidade = limpa(ped.municipio.municipio), uf = ped.municipio.uf, ibge = String(ped.municipio.cod_ibge);
  const bairro = nomes.regra === 'pares' ? limpa(nomes.bairro).split(/\s+/).join(' ') : '';
  const [noBairro, doBairro] = LUGAR.bairros[bairro] ?? [null, null];
  const [atend, pop] = FP.municipios[ibge] ?? [0, 0];
  const doEstado = !atend;
  const [a, p] = doEstado ? FP.ufs[uf] : [atend, pop];
  const onde = doEstado ? ESTADOS[uf][0] : `Aqui em ${cidade}`;
  const quem = a === 1 ? '1 pessoa pegou' : `${falado(a)} pessoas pegaram`;
  const fim = ' Tem diabetes e usa insulina todo dia.';
  const abertura = `Atenção, morador ${doBairro ?? deCidade(cidade)}: a Farmácia Popular está ameaçada. Entenda por quê.`;
  const r = {
    falas: {
      0: noBairro ? [`Seu Raimundo mora ${noBairro}, aqui em ${cidade}.${fim}`, `Seu Raimundo mora aqui em ${cidade}.${fim}`]
        : [`Seu Raimundo mora aqui em ${cidade}.${fim}`, `Seu Raimundo mora aqui.${fim}`],
      1: [...(RUA[slug] ? [`Todo mês ele pega a insulina na farmácia ${RUA[slug]}. E não paga nada.`] : []), 'Todo mês ele pega a insulina na farmácia. E não paga nada.'],
      3: [`${onde}, ${quem} remédio de graça ${doEstado ? 'pela Farmácia Popular' : 'assim'} só em ${FP.mes}.`, `${onde}, ${quem} remédio de graça em ${FP.mes}.`],
    },
    dado: { local: doEstado ? ESTADOS[uf][1] : `${cidade} - ${uf}`, atendidos: a, populacao: p, mes: FP.mes },
    // abertura padrão (video/abertura.py): a prévia traz a cidade; a voz e a animação, o bairro
    abertura, morador: deCidade(cidade), morador_fala: doBairro ?? deCidade(cidade), local: `${cidade} - ${uf}`,
  };
  for (const t of [...Object.values(r.falas).flat(), abertura]) confere(t);
  return r;
}

// ---------------------------------------------------------------- arquivos comuns (uma vez por máquina)
const PECAS = ['pecas/peca1.mp4', 'pecas/peca2.mp4', 'pecas/peca3.mp4', 'pecas/peca5.mp4', 'pecas/peca6.mp4', 'pecas/duracoes.json'];
for (const nome of ['clip1.mp4', 'clip2.mp4', 'clip3.mp4', 'musica.mp3', ...PECAS]) {
  const destino = path.join(COMUM, nome);
  if (fs.existsSync(destino)) continue;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const local = path.join(C.VIDEO, 'public', 'insulina', nome); // na máquina do Gui já estão aqui
  if (fs.existsSync(local)) { fs.copyFileSync(local, destino); continue; }
  const r = await fetch(`${FILA}/entradas/comum/video-insulina/${nome}`);
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
    const fundo = path.join(ENT, slug, `${slug.split('--')[0]}.jpg`);
    if (!fs.existsSync(fundo)) throw new Error('sem o fundo');
    itens.push({ slug, fundo, credito: d.fundo === 'satelite' ? d.credito : '', ...roteiro(d, slug) }); // satélite: crédito na tela
  } catch (e) {
    console.log(`  ${slug}: entradas incompletas (${e.message})`);
  }
}
if (!itens.length) process.exit(1);
// gera as versões cheias; quem não couber gera a versão seguinte (poucos casos: a janela já tem folga)
const variaveis = [0, 1, 3];
let pendentes = itens.map((it) => ({ it, versao: Object.fromEntries(variaveis.map((i) => [i, 0])) }));
while (pendentes.length) {
  C.gerarVozes(VOZES, [...Object.values(C.FIXAS), ...pendentes.flatMap(({ it, versao }) => variaveis.map((i) => it.falas[i][versao[i]]))]);
  const ainda = [];
  for (const p of pendentes) {
    p.it.texto ??= {}; p.it.extra ??= {}; p.it.leg ??= {};
    let refaz = false;
    for (const i of variaveis) {
      if (p.it.texto[i]) continue;
      const texto = p.it.falas[i][p.versao[i]];
      const leg = C.legendaDe(texto, VOZES);
      const extra = Math.max(1, C.fimDaFala(leg) / C.JANELAS[i]); // quanto a fala precisa acelerar a mais para caber
      if (extra > C.EXTRA_MAX && p.versao[i] + 1 < p.it.falas[i].length) { p.versao[i]++; refaz = true; continue; }
      if (extra > C.EXTRA_MAX) console.log(`  ${p.it.slug}: fala ${i + 1} não cabe nem encurtada (${extra.toFixed(2)}x)`);
      Object.assign(p.it, { texto: { ...p.it.texto, [i]: texto }, extra: { ...p.it.extra, [i]: Math.min(extra, C.EXTRA_MAX) }, leg: { ...p.it.leg, [i]: leg } });
      if (p.versao[i]) console.log(`  ${p.it.slug}: fala ${i + 1} encurtada (${texto})`);
    }
    if (refaz) ainda.push(p);
  }
  pendentes = ainda;
}
for (const i of [2, 4, 5]) for (const it of itens) { it.texto[i] = C.FIXAS[i]; it.extra[i] = 1; }

// ---------------------------------------------------------------- servidor local (fundos para a cena do dado)
const servidor = http.createServer((req, res) => {
  const arq = path.join(path.resolve(ENT), decodeURIComponent(req.url.split('?')[0]));
  if (!arq.startsWith(path.resolve(ENT)) || !fs.existsSync(arq)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(arq).pipe(res);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${servidor.address().port}`;

// ---------------------------------------------------------------- abertura padrão do lote (video/abertura.py, uma chamada)
const AB = {};
{
  const pedidos = path.join(TMP, 'abertura.json');
  fs.writeFileSync(pedidos, JSON.stringify({ vozes: VOZES, selo: 'A FARMÁCIA POPULAR ESTÁ AMEAÇADA', palavra_selo: 'farmácia',
    itens: itens.map((it) => ({ abertura: it.abertura, morador: it.morador, morador_fala: it.morador_fala, local: it.local,
      primeiro: path.join(COMUM, 'pecas/peca1.mp4'), saida: path.join(TMP, `${it.slug}-p0.mp4`) })) }));
  const r = spawnSync(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [path.join(C.VIDEO, 'abertura.py'), pedidos], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (r.status !== 0) { console.error('a abertura falhou'); process.exit(1); }
  Object.assign(AB, JSON.parse(r.stdout.trim().split('\n').pop()));
}

// ---------------------------------------------------------------- montagem
const serveUrl = await bundle({ entryPoint: path.join(C.VIDEO, 'src/index.ts'), publicDir: path.join(KIT, 'public-vazio') });
const browser = await openBrowser('chrome', { chromiumOptions: { gl: opc('--gl', 'angle') } });
const CONC = +opc('--conc', 4);
let ok = 0;
for (const it of itens) {
  const t0 = Date.now();
  const tmp = (n) => path.join(TMP, `${it.slug}-${n}`);
  try {
    // cena 4: a única desenhada por território (uns 7 s), sem legenda, depois acelerada
    const props = { cenas: [{ dur: DUR[3], legenda: [], info: { tipo: 'dado', ...it.dado, fundo: `${BASE}/${it.slug}/${path.basename(it.fundo)}`, fonte: it.credito ? `${FONTE_DADO} · ${it.credito}` : FONTE_DADO } }], trilha: '', entraPrimeira: true };
    const composition = await selectComposition({ serveUrl, id: 'Historia', inputProps: props, puppeteerInstance: browser, logLevel: 'error' });
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: tmp('bruto4.mp4'), inputProps: props, concurrency: CONC, scale: C.ESCALA, x264Preset: 'veryfast', crf: 16, imageFormat: 'jpeg', puppeteerInstance: browser, logLevel: 'error', timeoutInMilliseconds: 120000 });
    // legendas das cenas variáveis (tempos relativos ao começo de cada peça, já no tempo final)
    const pecas = [];
    for (const i of [0, 1, 2, 3, 4, 5]) {
      if (i in C.FIXAS) { pecas.push(path.join(COMUM, `pecas/peca${i + 1}.mp4`)); continue; }
      const assArq = tmp(`${i + 1}.ass`);
      fs.writeFileSync(assArq, C.ass(it.leg[i], { extra: it.extra[i] }));
      const entrada = i === 3 ? tmp('bruto4.mp4') : path.join(COMUM, `pecas/peca${i + 1}.mp4`);
      const filtros = [...(i === 3 ? [`setpts=PTS/${C.VEL}`, `fps=${C.FPS}`] : []), C.filtroAss(assArq)];
      C.ffmpeg('-i', entrada, '-vf', filtros.join(','), ...C.ENC, tmp(`p${i + 1}.mp4`));
      pecas.push(tmp(`p${i + 1}.mp4`));
    }
    // a abertura na frente (~6 s): tudo que vem depois desloca
    const ab = AB[tmp('p0.mp4')], total = TOTAL + ab;
    pecas.unshift(tmp('p0.mp4'));
    // cola as peças sem recodificar
    fs.writeFileSync(tmp('lista.txt'), pecas.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    C.ffmpeg('-f', 'concat', '-safe', '0', '-i', tmp('lista.txt'), '-c', 'copy', tmp('video.mp4'));
    // áudio: vozes no começo de cada cena (aceleradas 1,25x e, se preciso, um pouco mais), som ambiente dos três clipes e a música
    const entradas = [], filtros = [], mix = [];
    const add = (arq) => { entradas.push('-i', arq); return entradas.length / 2 - 1; };
    for (const i of [0, 1, 2, 3, 4, 5]) {
      const n = add(C.vozArquivo(VOZES, it.texto[i]));
      const atraso = Math.round((ab + C.inicioFinal(DUR, i) + C.ATRASO / C.FPS / C.VEL) * 1000);
      filtros.push(`[${n}:a]atempo=${(C.VEL * it.extra[i]).toFixed(4)},adelay=${atraso}|${atraso}[v${i}]`);
      mix.push(`[v${i}]`);
    }
    const nab = add(C.vozArquivo(VOZES, it.abertura));
    filtros.push(`[${nab}:a]atempo=${C.VEL.toFixed(4)},adelay=150|150[vab]`);
    mix.push('[vab]');
    for (const i of [0, 1, 2]) {
      const n = add(path.join(COMUM, `clip${i + 1}.mp4`));
      const vel = Math.min(1, C.CLIPES[i] / DUR[i]), seg = DUR[i] / C.FPS / C.VEL, atraso = Math.round((ab + C.inicioFinal(DUR, i)) * 1000);
      filtros.push(`[${n}:a]atempo=${(C.VEL * vel).toFixed(4)},atrim=0:${seg.toFixed(3)},afade=t=in:d=0.5,afade=t=out:st=${(seg - 0.6).toFixed(3)}:d=0.6,volume=${C.AMBIENTE},adelay=${atraso}|${atraso}[a${i}]`);
      mix.push(`[a${i}]`);
    }
    const m = add(path.join(COMUM, 'musica.mp3'));
    filtros.push(`[${m}:a]apad,atrim=0:${total.toFixed(2)},afade=t=in:d=2,afade=t=out:st=${(total - 4).toFixed(2)}:d=4,volume=${C.MUSICA}[mu]`);
    // a música (que vai até o fim) primeiro e duration=first: com longest o amix parava antes e o -shortest cortava o fim
    filtros.push(`[mu]${mix.join('')}amix=inputs=${mix.length + 1}:duration=first:normalize=0,atrim=0:${total.toFixed(3)}[a]`);
    C.ffmpeg(...entradas, '-filter_complex', filtros.join(';'), '-map', '[a]', '-c:a', 'aac', '-b:a', '160k', tmp('audio.m4a'));
    const fin = path.join(SAI, it.slug, 'insulina.mp4');
    fs.mkdirSync(path.dirname(fin), { recursive: true });
    C.ffmpeg('-i', tmp('video.mp4'), '-i', tmp('audio.m4a'), '-c', 'copy', '-shortest', '-movflags', '+faststart', fin);
    ok++;
    console.log(`  ${it.slug}: ${total.toFixed(1)} s, montagem ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } catch (e) {
    console.log(`  ${it.slug}: falhou (${e.message})`);
  } finally {
    for (const f of fs.readdirSync(TMP)) if (f.startsWith(it.slug + '-')) fs.rmSync(path.join(TMP, f), { force: true });
  }
}
await browser.close({ silent: true });
servidor.close();
process.exit(ok === slugs.length ? 0 : 1);
