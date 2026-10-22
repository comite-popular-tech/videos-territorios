// Ajuda a produzir materiais por território: pede um lote de itens de um trabalho à fila (fila/worker.js), baixa as
// entradas de cada item, chama o script do trabalho (video/trabalhos/<trabalho>.mjs ou .sh) e sobe o que ele deixou na
// pasta de saída de cada item, avisando que ficou pronto. Repete até a fila esvaziar. Sem senha: só as URLs do lote.
//   node video/ajudar.mjs [--trabalho video-saude,video-mcmv] [--limite N] [--lote 10] [--quem nome] [outras opções: vão para o script]
//   FILA_URL no ambiente troca a fila (padrão: o Worker publicado). Sai com 0 quando a fila está vazia ou o limite foi
//   atingido; 1 se nada funcionou. Normalmente se roda pelo ajudar.sh / ajudar.ps1, que preparam o ambiente.
// Contrato do script do trabalho: `<script> <pasta-entradas> <pasta-saidas> <slug ...>`; para cada slug, as entradas
// estão em <pasta-entradas>/<slug>/ e ele deve deixar os arquivos prontos em <pasta-saidas>/<slug>/ (pasta vazia = falhou).
// O script recebe o lote inteiro de uma vez (preparar o projeto do Remotion por item custaria mais que o render).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const VIDEO = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const args = process.argv.slice(2);
const opc = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const FILA = (process.env.FILA_URL || 'https://fila-videos.boralula.workers.dev').replace(/\/$/, '');
// um trabalho ou vários, separados por vírgula: esvaziada a fila de um, segue para o próximo (Gui, 22/10: quem ajuda
// dispara uma vez só). Padrão: o que a campanha está produzindo agora, na ordem.
const TRABALHOS = opc('--trabalho', process.env.TRABALHO || 'video-saude,video-mcmv,video-postonovo,video-aposentados,video-inss,video-mercadorose').split(',').map((t) => t.trim()).filter(Boolean);
const LIMITE = +opc('--limite', Infinity), LOTE = Math.min(50, +opc('--lote', 10));
const QUEM = opc('--quem', process.env.AJUDANTE || os.hostname());
const PROPRIAS = new Set(['--trabalho', '--limite', '--lote', '--quem']);
const extras = args.filter((a, i) => !PROPRIAS.has(a) && !PROPRIAS.has(args[i - 1])); // --gl, --paralelo... vão para o script
for (const t of TRABALHOS) {
  if (!/^[a-z0-9-]+$/.test(t)) { console.error(`nome de trabalho inválido: ${t}`); process.exit(1); }
  if (!['.mjs', '.sh'].some((e) => fs.existsSync(path.join(VIDEO, 'trabalhos', t + e)))) { console.error(`não existe video/trabalhos/${t}.mjs nem .sh`); process.exit(1); }
}

const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
// tenta de novo em erro de rede, 429 e 5xx, com espera crescente (2 s, 4 s, ... até 1 min); o pedido de lote tenta mais
// vezes porque na largada de 20 máquinas do Actions todas batem no Worker no mesmo segundo
async function pedir(url, metodo = 'GET', corpo, tipo, tentativas = 5) {
  for (let tentativa = 0; ; tentativa++) {
    try {
      const r = await fetch(url, { method: metodo, body: corpo, headers: tipo ? { 'Content-Type': tipo } : {} });
      if (r.status === 429 || r.status >= 500) throw new Error(`${r.status}`);
      return r;
    } catch (e) {
      if (tentativa >= tentativas - 1) throw new Error(`${metodo} ${url.split('?')[0]}: ${e.message}`);
      await dormir(Math.min(60000, 2000 * 2 ** tentativa) * (0.75 + Math.random() / 2));
    }
  }
}
async function baixar(url, destino) {
  const r = await pedir(url);
  if (!r.ok) throw new Error(`${r.status} ao baixar ${url}`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
}

let feitos = 0, falhas = 0;
if (process.env.GITHUB_ACTIONS) await dormir(Math.random() * 30000); // espalha a largada das máquinas do Actions
for (const TRABALHO of TRABALHOS) {
const KIT = path.join(VIDEO, 'kit', TRABALHO); // entradas/<slug>/ e saidas/<slug>/ (pequeno: o pesado fica onde o script gravar)
const script = ['.mjs', '.sh'].map((e) => path.join(VIDEO, 'trabalhos', TRABALHO + e)).find((p) => fs.existsSync(p));
while (feitos + falhas < LIMITE) {
  const quantidade = Math.min(LOTE, LIMITE - feitos - falhas);
  const r = await pedir(`${FILA}/lote/${TRABALHO}`, 'POST', JSON.stringify({ quantidade, quem: QUEM }), 'application/json', 8);
  if (!r.ok) { console.error(`a fila respondeu ${r.status}: ${await r.text()}`); process.exit(1); }
  const lote = await r.json();
  if (!lote.itens.length) { console.log(`fila vazia (${TRABALHO}). Esta rodada: ${feitos} prontos, ${falhas} falhas. Progresso: ${FILA}/`); break; }
  console.log(`lote ${lote.lote} (${TRABALHO} v${lote.versao}): ${lote.itens.length} itens (${lote.itens.map((t) => t.rotulo ?? t.slug).slice(0, 4).join(', ')}${lote.itens.length > 4 ? ', ...' : ''})`);

  // entradas de cada item
  const ENT = path.join(KIT, 'entradas'), SAI = path.join(KIT, 'saidas');
  const prontos = [];
  for (const it of lote.itens) {
    try {
      fs.rmSync(path.join(SAI, it.slug), { recursive: true, force: true });
      for (const url of it.entradas) {
        const nome = decodeURIComponent(url.split('/').pop());
        const destino = path.join(ENT, it.slug, nome);
        if (!fs.existsSync(destino)) await baixar(url, destino);
      }
      prontos.push(it);
    } catch (e) {
      console.log(`  ${it.slug}: não consegui baixar as entradas (${e.message})`);
      await pedir(it.erro, 'POST', JSON.stringify({ erro: `entradas: ${e.message}` }), 'application/json').catch(() => {});
      falhas++;
    }
  }
  if (!prontos.length) continue;

  // produz o lote inteiro
  const t0 = Date.now();
  const cmd = script.endsWith('.mjs') ? [process.execPath, [script]] : ['bash', [script]];
  const res = spawnSync(cmd[0], [...cmd[1], ENT, SAI, ...prontos.map((t) => t.slug), ...extras], { cwd: VIDEO, stdio: 'inherit' });
  if (res.status !== 0) console.log(`${path.basename(script)} saiu com ${res.status ?? res.signal}; confiro item por item`);

  // sobe e marca
  for (const it of prontos) {
    const pasta = path.join(SAI, it.slug);
    try {
      const arquivos = fs.existsSync(pasta) ? fs.readdirSync(pasta).filter((a) => fs.statSync(path.join(pasta, a)).isFile()) : [];
      if (!arquivos.length) throw new Error('o script não deixou nada na pasta de saída (ver mensagens acima)');
      let total = 0;
      for (const a of arquivos) {
        const corpo = fs.readFileSync(path.join(pasta, a));
        total += corpo.length;
        const s = await pedir(it.subir + encodeURIComponent(a) + it.assinatura, 'PUT', corpo);
        if (!s.ok) throw new Error(`upload de ${a}: ${s.status} ${await s.text()}`);
      }
      const p = await pedir(it.pronto, 'POST', JSON.stringify({ arquivos }), 'application/json');
      const j = await p.json().catch(() => ({}));
      if (!p.ok) throw new Error(`pronto: ${p.status} ${j.erro ?? ''}`);
      feitos++;
      console.log(`  pronto: ${it.rotulo ?? it.slug} (${arquivos.join(', ')}, ${(total / 1e6).toFixed(1)} MB${j.duracao ? `, ${j.duracao.toFixed(1)} s` : ''})${j.obs ? ' · ' + j.obs : ''}`);
      fs.rmSync(pasta, { recursive: true, force: true });
      fs.rmSync(path.join(ENT, it.slug), { recursive: true, force: true });
    } catch (e) {
      falhas++;
      console.log(`  falhou: ${it.slug}: ${e.message.split('\n')[0]}`);
      await pedir(it.erro, 'POST', JSON.stringify({ erro: e.message.split('\n')[0] }), 'application/json').catch(() => {});
    }
  }
  console.log(`lote ${lote.lote}: ${prontos.length} em ${((Date.now() - t0) / 60000).toFixed(1)} min; total desta rodada: ${feitos} prontos, ${falhas} falhas`);
}
}
if (feitos + falhas >= LIMITE) console.log(`limite de ${LIMITE} atingido: ${feitos} prontos, ${falhas} falhas. Progresso: ${FILA}/`);
else console.log(`todas as filas vazias (${TRABALHOS.join(', ')}): ${feitos} prontos, ${falhas} falhas. Obrigado!`);
process.exit(feitos || !falhas ? 0 : 1);
