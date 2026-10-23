// Trabalho "teste-fila": não renderiza nada. Deixa um teste.json de cada item na saída, para conferir a fila de ponta a
// ponta (lote, upload, pronto, lista viva, atualização do código) sem gastar a máquina de ninguém. Segundos por lote.
//   node video/trabalhos/teste-fila.mjs <pasta-entradas> <pasta-saidas> <slug ...>
// Cadastrar e semear (repositório privado): python video/fila/fila.py semear teste-fila --criar --ativar <slug ...>
import fs from 'fs';
import os from 'os';
import path from 'path';

const [ENT, SAI, ...resto] = process.argv.slice(2);
const slugs = resto.filter((a) => !a.startsWith('--'));
if (!ENT || !SAI || !slugs.length) { console.error('uso: teste-fila.mjs <entradas> <saidas> <slug ...>'); process.exit(1); }
const VIDEO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
let codigo = '';
try { codigo = fs.readFileSync(path.join(VIDEO, '.codigo'), 'utf8').trim(); } catch { /* cópia que nunca se atualizou */ }
for (const slug of slugs) {
  const entradas = fs.existsSync(path.join(ENT, slug)) ? fs.readdirSync(path.join(ENT, slug)) : [];
  const relatorio = { slug, quando: new Date().toISOString(), maquina: os.hostname(), node: process.version, codigo, entradas,
    obs: 'teste da fila: este arquivo é a saída de um item do trabalho teste-fila' };
  fs.mkdirSync(path.join(SAI, slug), { recursive: true });
  // o Worker recusa arquivo com menos de 1000 bytes
  fs.writeFileSync(path.join(SAI, slug, 'teste.json'), JSON.stringify(relatorio, null, 2).padEnd(1200, ' ') + '\n');
  console.log(`  teste-fila: ${slug}`);
}
