// Trabalho "video-saude" da fila: renderiza o vídeo de Saúde de um lote de territórios a partir das entradas baixadas
// pelo ajudar.mjs e deixa saude.mp4 na pasta de saída de cada um. Só depende de video/ (nada de dados/, scripts/ ou saida/).
//   node video/trabalhos/video-saude.mjs <pasta-entradas> <pasta-saidas> <slug ...> [--gl angle|swangle] [--paralelo N] [--conc N]
// Entradas por item (<pasta-entradas>/<slug>/): <slug>.json (pedidos.json + ficha da foto, do kit_fundos.py) e
// <cidade>.jpg (foto 1080x1920 ou mapa 1600x900). Monta video/kit/video-saude/dados/ no desenho do video/exemplo/ e chama
// o lote.mjs com --dados; o MP4 sai em saida/territorios/<slug>/video/ (como sempre) e é copiado para a saída.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const VIDEO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const RAIZ = path.resolve(VIDEO, '..');
const [ENT, SAI, ...resto] = process.argv.slice(2);
const slugs = resto.filter((a, i) => !a.startsWith('--') && !resto[i - 1]?.startsWith('--'));
const opcoes = resto.filter((a) => !slugs.includes(a));
if (!ENT || !SAI || !slugs.length) { console.error('uso: video-saude.mjs <entradas> <saidas> <slug ...>'); process.exit(1); }

// pasta de dados no desenho do exemplo/: saida/territorios/<slug>/pedidos.json, dados/fotos_cidades.json, dados/brutos/fotos_cidades/<cidade>.jpg
const DADOS = path.join(VIDEO, 'kit', 'video-saude', 'dados');
const dadosRel = path.relative(RAIZ, DADOS).split(path.sep).join('/');
const fotosJson = path.join(DADOS, 'dados/fotos_cidades.json');
const FOTOS = fs.existsSync(fotosJson) ? JSON.parse(fs.readFileSync(fotosJson, 'utf8')) : {};
const prontos = [];
for (const slug of slugs) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(ENT, slug, `${slug}.json`), 'utf8'));
    const cs = slug.split('--')[0], fundo = path.join(ENT, slug, `${cs}.jpg`);
    if (!fs.existsSync(fundo)) throw new Error('sem o fundo');
    fs.mkdirSync(path.join(DADOS, 'saida/territorios', slug), { recursive: true });
    fs.writeFileSync(path.join(DADOS, 'saida/territorios', slug, 'pedidos.json'), JSON.stringify(d.pedidos));
    if (d.fundo === 'foto') {
      FOTOS[cs] = d.foto;
      fs.mkdirSync(path.join(DADOS, 'dados/brutos/fotos_cidades'), { recursive: true });
      fs.copyFileSync(fundo, path.join(DADOS, 'dados/brutos/fotos_cidades', `${cs}.jpg`));
    } else {
      delete FOTOS[cs];
      fs.mkdirSync(path.join(VIDEO, 'mapas'), { recursive: true });
      fs.copyFileSync(fundo, path.join(VIDEO, 'mapas', `${cs}.jpg`)); // mapa já em JPEG: o cidade.mjs aceita sem o SVG
    }
    prontos.push(slug);
  } catch (e) {
    console.log(`  ${slug}: entradas incompletas (${e.message})`);
  }
}
fs.mkdirSync(path.dirname(fotosJson), { recursive: true });
fs.writeFileSync(fotosJson, JSON.stringify(FOTOS));
if (!prontos.length) process.exit(1);

const r = spawnSync(process.execPath, [path.join(VIDEO, 'lote.mjs'), ...prontos, '--dados', dadosRel, ...opcoes], { cwd: VIDEO, stdio: 'inherit' });
let ok = 0;
for (const slug of prontos) {
  const mp4 = path.join(RAIZ, 'saida/territorios', slug, 'video/saude.mp4');
  if (!fs.existsSync(mp4)) continue;
  fs.mkdirSync(path.join(SAI, slug), { recursive: true });
  fs.copyFileSync(mp4, path.join(SAI, slug, 'saude.mp4'));
  ok++;
}
process.exit(ok === slugs.length && r.status === 0 ? 0 : 1);
