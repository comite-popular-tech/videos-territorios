// Rasteriza o mapa de Saúde de cada cidade (dados/brutos/artes_mapa/<slug>-saude.svg, 1600x900) em JPEG,
// em video/mapas/<slug>.jpg. No vídeo o mapa tem zoom lento; com SVG o navegador redesenha todo quadro.
//   node video/mapas.mjs <slug ...>      (pula o que já existe e está mais novo que o SVG)
// Usa o playwright de video/node_modules (npm i nesta pasta).
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SAIDA = path.join(RAIZ, 'video', 'mapas');
const SVGS = path.join(RAIZ, process.env.VIDEO_DADOS ?? '', 'dados/brutos/artes_mapa'); // VIDEO_DADOS: kit de exemplo
fs.mkdirSync(SAIDA, { recursive: true });
const fila = process.argv.slice(2).filter((s) => {
  const svg = path.join(SVGS, `${s}-saude.svg`);
  const jpg = path.join(SAIDA, `${s}.jpg`);
  return fs.existsSync(svg) && (!fs.existsSync(jpg) || fs.statSync(jpg).mtimeMs < fs.statSync(svg).mtimeMs);
});
console.log(`mapas: ${fila.length} a rasterizar`);
if (fila.length) {
  const b = await chromium.launch();
  let n = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    for (let s; (s = fila.shift()); ) {
      const svg = fs.readFileSync(path.join(SVGS, `${s}-saude.svg`), 'utf8');
      await p.setContent('<style>html,body{margin:0}svg{display:block;width:1600px;height:900px}</style>' + svg);
      await p.screenshot({ path: path.join(SAIDA, `${s}.jpg`), type: 'jpeg', quality: 90 });
      if (++n % 500 === 0) console.log(`mapas: ${n}`);
    }
    await p.close();
  }));
  await b.close();
}
