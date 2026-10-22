// Cópia do maismedicos_render.mjs para "O mercado da Dona Rose", com porta própria. Renderizador do Remotion em lote, padrão da produção em massa (nasceu no Mais Médicos, serve a qualquer vídeo): um
// bundle e um navegador para uma lista de cenas, em 720x1280, sem legenda e sem áudio. O bundle fica pronto em
// kit/<kit>/bundle-<hash do src>/ para os lotes seguintes da mesma máquina.
//   node video/maismedicos_render.mjs <cenas.json> [--gl angle|swangle] [--conc N]
// cenas.json: {"raiz": <pasta servida>, "kit": "video-x" (padrão video-maismedicos), "cenas": [{"saida": <mp4>,
//   "dur": <frames>, "info": {...}} (uma cena de infográfico na composição Historia) ou {"saida", "id": <composição>,
//   "props": {...}}]}; em qualquer texto, "@/<arquivo>" vira o endereço do servidor local sobre a raiz.
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, selectComposition } from '@remotion/renderer';

const VIDEO = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const args = process.argv.slice(2);
const opc = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const lista = JSON.parse(fs.readFileSync(args[0], 'utf8'));
const RAIZ = path.resolve(lista.raiz);

const servidor = http.createServer((req, res) => {
  const arq = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(arq).pipe(res);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${servidor.address().port}`;

// o bundle fica pronto para os lotes seguintes da mesma máquina (uns 15 s a menos por lote); muda se o src/ mudar
const KIT = path.join(VIDEO, 'kit', lista.kit ?? 'video-maismedicos'), vazio = path.join(KIT, 'public-vazio');
fs.mkdirSync(vazio, { recursive: true });
const assinatura = crypto.createHash('sha1');
for (const f of fs.readdirSync(path.join(VIDEO, 'src')).sort()) assinatura.update(f + fs.readFileSync(path.join(VIDEO, 'src', f)));
const pronto = path.join(KIT, `bundle-${assinatura.digest('hex').slice(0, 12)}`);
let serveUrl = pronto;
if (!fs.existsSync(path.join(pronto, 'index.html'))) {
  for (const d of fs.readdirSync(KIT)) if (d.startsWith('bundle-')) fs.rmSync(path.join(KIT, d), { recursive: true, force: true });
  serveUrl = await bundle({ entryPoint: path.join(VIDEO, 'src/index.ts'), publicDir: vazio, outDir: pronto });
}
// porta própria para o servidor do bundle: com a porta padrão, outro render do Remotion na mesma máquina responde
// por este e devolve a composição de outro vídeo
const PORTA = 20000 + Math.floor(Math.random() * 20000);
const browser = await openBrowser('chrome', { chromiumOptions: { gl: opc('--gl', 'angle') } });
let erros = 0;
for (const c of lista.cenas) {
  const t0 = Date.now();
  try {
    // "@/<arquivo>" em qualquer texto das props vira o endereço do servidor local sobre a raiz
    const local = (o) => JSON.parse(JSON.stringify(o).replace(/"@\//g, `"${BASE}/`));
    const props = c.props ? local(c.props) : { cenas: [{ dur: c.dur, legenda: [], info: local(c.info) }], trilha: '', entraPrimeira: true };
    const composition = await selectComposition({ serveUrl, id: c.id ?? 'Historia', inputProps: props, puppeteerInstance: browser, logLevel: 'error', port: PORTA });
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: c.saida, inputProps: props, concurrency: +opc('--conc', 4), scale: 720 / 1080, x264Preset: 'veryfast', crf: 16, imageFormat: 'jpeg', puppeteerInstance: browser, logLevel: 'error', timeoutInMilliseconds: 120000, port: PORTA });
    console.log(`  ${path.basename(c.saida)}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } catch (e) {
    erros++;
    console.log(`  ${path.basename(c.saida)}: falhou (${e.message})`);
  }
}
await browser.close({ silent: true });
servidor.close();
process.exit(erros ? 1 : 0);
