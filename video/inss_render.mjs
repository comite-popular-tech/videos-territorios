// Renderizador do Remotion em lote do vídeo "O dinheiro que gira" (INSS): cópia do maismedicos_render.mjs com a entrada
// própria (src/inss-index.ts, composição InssInfo), para não mexer na Historia/Root que os outros vídeos usam.
//   node video/inss_render.mjs <cenas.json> [--gl angle|swangle] [--conc N]
// cenas.json: {"raiz": <pasta servida>, "kit": "video-inss", "cenas": [{"saida": <mp4>, "dur": <frames>, "info": {...}}]};
//   em qualquer texto, "@/<arquivo>" vira o endereço do servidor local sobre a raiz.
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
const KIT = path.join(VIDEO, 'kit', lista.kit ?? 'video-inss'), vazio = path.join(KIT, 'public-vazio');
fs.mkdirSync(vazio, { recursive: true });
const assinatura = crypto.createHash('sha1');
for (const f of fs.readdirSync(path.join(VIDEO, 'src')).sort()) assinatura.update(f + fs.readFileSync(path.join(VIDEO, 'src', f)));
const pronto = path.join(KIT, `bundle-${assinatura.digest('hex').slice(0, 12)}`);
let serveUrl = pronto;
if (!fs.existsSync(path.join(pronto, 'index.html'))) {
  for (const d of fs.readdirSync(KIT)) if (d.startsWith('bundle-')) fs.rmSync(path.join(KIT, d), { recursive: true, force: true });
  serveUrl = await bundle({ entryPoint: path.join(VIDEO, 'src/inss-index.ts'), publicDir: vazio, outDir: pronto });
}
// porta própria para o servidor do bundle: com a porta padrão, outro render do Remotion na mesma máquina (a Merenda,
// 22/10) respondia no lugar deste e a composição InssInfo "não existia"
const PORTA = 20000 + Math.floor(Math.random() * 20000);
const browser = await openBrowser('chrome', { chromiumOptions: { gl: opc('--gl', 'angle') } });
let erros = 0;
for (const c of lista.cenas) {
  const t0 = Date.now();
  try {
    // "@/<arquivo>" em qualquer texto das props vira o endereço do servidor local sobre a raiz
    const local = (o) => JSON.parse(JSON.stringify(o).replace(/"@\//g, `"${BASE}/`));
    const props = { dur: c.dur, info: local(c.info) };
    const composition = await selectComposition({ serveUrl, id: 'InssInfo', inputProps: props, puppeteerInstance: browser, logLevel: 'error', port: PORTA });
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
