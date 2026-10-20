// Os 12 cards de um território em .zip, gerados pela própria página do acervo (cards.boralula.org): abre
// #<slug>/cards/preto e clica em "ou os 12, dos dois estilos", que monta o zip no navegador (preto/ e colorido/).
// Usado por scripts/espelho_drive.py; precisa do playwright (NODE_PATH aponta para o node_modules que o tem).
//   node scripts/espelho_cards.mjs se-aracaju--santa-maria <pasta>   # imprime o nome do .zip salvo na pasta
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.env.NODE_PATH || 'node_modules', '..', 'x.js'));
const { chromium } = require('playwright');
const [slug, pasta] = process.argv.slice(2);
if (!slug || !pasta) { console.error('uso: node scripts/espelho_cards.mjs <slug> <pasta>'); process.exit(2); }

const site = process.env.ACERVO_URL || 'https://cards.boralula.org';
const navegador = await chromium.launch();
try {
  const pagina = await navegador.newPage({ acceptDownloads: true });
  await pagina.goto(`${site}/#${slug}/cards/preto`);
  await pagina.locator('#todos12').waitFor({ timeout: 60000 });
  await pagina.waitForLoadState('networkidle');      // a foto da votação chega depois da tela
  const [download] = await Promise.all([pagina.waitForEvent('download', { timeout: 120000 }), pagina.click('#todos12')]);
  await download.saveAs(path.join(pasta, download.suggestedFilename()));
  console.log(download.suggestedFilename());
} finally {
  await navegador.close();
}
