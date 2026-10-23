// Ajuda a produzir materiais por território: pede um lote de itens à fila (fila/worker.js), baixa as entradas de cada
// item, chama o script do trabalho (video/trabalhos/<trabalho>.mjs ou .sh) e sobe o que ele deixou na pasta de saída de
// cada item, avisando que ficou pronto. Sem senha: só as URLs do lote.
//   node video/ajudar.mjs [--trabalho video-saude,video-mcmv] [--limite N] [--lote 10] [--quem nome] [--esperar MIN]
//                         [--sem-atualizar] [outras opções: vão para o script]
// Sem --trabalho (o normal): segue a lista viva da fila. A cada lote pergunta ao Worker qual é o trabalho ativo de maior
// prioridade com itens pendentes; esvaziou um, segue o próximo, e trabalho ou item novo que a coordenação puser na fila
// entra sem reiniciar nada (Gui, 22/10). Com a fila toda vazia, espera trabalho novo (confere a cada 2 min); --esperar MIN
// sai depois de MIN minutos parado (o Actions usa). Com --trabalho a,b: só esses, na ordem, e sai quando esvaziam.
// Código novo: o Worker diz qual commit do repositório público quem ajuda deve rodar. Entre um lote e outro, se for outro,
// esta cópia se atualiza sozinha (baixa o pacote do GitHub e troca só os arquivos que mudaram; num clone do git, git pull)
// e recomeça com o código novo. --sem-atualizar (ou AJUDAR_ATUALIZAR=0) desliga.
//   FILA_URL no ambiente troca a fila (padrão: o Worker publicado). Sai com 0 quando acabou ou o limite foi atingido; 1 se
//   nada funcionou. Normalmente se roda pelo ajudar.sh / ajudar.ps1, que preparam o ambiente.
// Contrato do script do trabalho: `<script> <pasta-entradas> <pasta-saidas> <slug ...>`; para cada slug, as entradas
// estão em <pasta-entradas>/<slug>/ e ele deve deixar os arquivos prontos em <pasta-saidas>/<slug>/ (pasta vazia = falhou).
// O script recebe o lote inteiro de uma vez (preparar o projeto do Remotion por item custaria mais que o render).
// Requisitos além do que o ajudar.sh / ajudar.ps1 instalam: video/trabalhos/<trabalho>.requer.json, opcional,
// {"node": 22, "python": ["modulo:pacote-do-pip"]}; sem o Node pedido, esta máquina não pega o trabalho.
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const VIDEO = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const RAIZ = path.dirname(VIDEO);
const args = process.argv.slice(2);
const opc = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const FILA = (process.env.FILA_URL || 'https://fila-videos.boralula.workers.dev').replace(/\/$/, '');
const FIXOS = opc('--trabalho', process.env.TRABALHO || '').split(',').map((t) => t.trim()).filter(Boolean);
const LIMITE = +opc('--limite', Infinity), LOTE = Math.min(50, +opc('--lote', 10));
const QUEM = opc('--quem', process.env.AJUDANTE || os.hostname());
const ESPERAR = +opc('--esperar', Infinity); // minutos parado, sem nada na fila, antes de sair
const PAUSA = 1000 * +(process.env.AJUDAR_PAUSA_S || 120); // de quanto em quanto tempo confere a fila parada
const PROPRIAS = new Set(['--trabalho', '--limite', '--lote', '--quem', '--esperar']);
const extras = args.filter((a, i) => !PROPRIAS.has(a) && !PROPRIAS.has(args[i - 1]) && a !== '--sem-atualizar'); // --gl, --paralelo... vão para o script
// os trabalhos em Python chamam o ffmpeg pelo PATH: num PC sem ffmpeg instalado, vale o do pacote ffmpeg-static (npm i)
try {
  const estatico = createRequire(import.meta.url)('ffmpeg-static');
  if (estatico && spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).error) process.env.PATH = path.dirname(estatico) + path.delimiter + process.env.PATH;
} catch { /* sem o pacote: o script avisa se faltar o ffmpeg */ }
// trabalho em Python (<trabalho>.sh ao lado de <trabalho com _>.py): no Windows sem Git Bash não há bash, então roda o
// .py direto com o Python que o ajudar.ps1 / ajudar.sh achou (PYTHON); fora do Windows segue pelo .sh
const pythonDireto = (script) => {
  const py = path.join(path.dirname(script), path.basename(script, '.sh').replace(/-/g, '_') + '.py');
  return script.endsWith('.sh') && fs.existsSync(py) && (process.platform === 'win32' || spawnSync('bash', ['--version'], { stdio: 'ignore' }).error) ? py : null;
};
const scriptDe = (t) => ['.mjs', '.sh'].map((e) => path.join(VIDEO, 'trabalhos', t + e)).find((p) => fs.existsSync(p));
for (const t of FIXOS) {
  if (!/^[a-z0-9-]+$/.test(t)) { console.error(`nome de trabalho inválido: ${t}`); process.exit(1); }
  if (!scriptDe(t)) { console.error(`não existe video/trabalhos/${t}.mjs nem .sh`); process.exit(1); }
}

// ---------------------------------------------------------------- requisitos por trabalho
const requer = (t) => { try { return JSON.parse(fs.readFileSync(path.join(VIDEO, 'trabalhos', t + '.requer.json'), 'utf8')); } catch { return {}; } };
const NODE = +process.versions.node.split('.')[0];
const incapazes = new Set(); // trabalhos que esta máquina tentou preparar e não conseguiu
// os trabalhos que esta cópia sabe fazer: tem o script e o Node que ele pede (a fila só manda desses)
const capazes = () => fs.readdirSync(path.join(VIDEO, 'trabalhos')).filter((a) => /^[a-z0-9-]+\.(mjs|sh)$/.test(a)).map((a) => a.replace(/\.(mjs|sh)$/, ''))
  .filter((t, i, l) => l.indexOf(t) === i && !incapazes.has(t) && (requer(t).node ?? 0) <= NODE);
const preparados = new Set();
// lotes seguidos sem nenhum pronto, por trabalho: no 2º a máquina larga o trabalho (em 22/10 uma cópia quebrada do INSS
// falhou 2.689 itens três vezes cada em uma hora, porque seguia pedindo lote atrás de lote)
const lotesSemPronto = {};
function preparar(t) {
  if (preparados.has(t)) return true;
  const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  for (const m of requer(t).python ?? []) {
    const [modulo, pacote] = m.split(':');
    if (spawnSync(py, ['-c', `import ${modulo}`], { stdio: 'ignore' }).status === 0) continue;
    console.log(`instalando ${pacote || modulo} para o ${t}...`);
    if (spawnSync(py, ['-m', 'pip', 'install', '-q', pacote || modulo], { stdio: 'inherit' }).status !== 0) return false;
  }
  preparados.add(t);
  return true;
}

// ---------------------------------------------------------------- rede
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

// ---------------------------------------------------------------- código novo
const ARQ_CODIGO = path.join(VIDEO, '.codigo'); // commit que esta cópia roda, gravado quando ela se atualiza sozinha
const git = (...a) => spawnSync('git', a, { cwd: RAIZ, encoding: 'utf8' });
let CODIGO = (() => {
  try { return fs.readFileSync(ARQ_CODIGO, 'utf8').trim(); } catch { /* nunca se atualizou */ }
  const g = fs.existsSync(path.join(RAIZ, '.git')) ? git('rev-parse', 'HEAD') : null;
  return g?.status === 0 ? g.stdout.trim() : '';
})();
// pacote: troca os arquivos pelo pacote do GitHub (cópia em ZIP e máquina do Actions, que é descartável); git: git pull num
// clone limpo do repositório público; null: não mexe (outro repositório, clone com mudanças, --sem-atualizar)
const MODO = args.includes('--sem-atualizar') || process.env.AJUDAR_ATUALIZAR === '0' ? null
  : process.env.GITHUB_ACTIONS ? 'pacote'
  : fs.existsSync(path.join(RAIZ, '.git')) ? 'git'
  : fs.existsSync(path.join(VIDEO, 'AJUDAR-windows.bat')) ? 'pacote' : null; // o .bat só existe no repositório público
let atualizarDepois = 0; // tentou e não deu: segue com o código que tem e tenta de novo daqui a 30 min

// troca os arquivos desta cópia pelos do commit, sem apagar nada (node_modules, kit/ e o que o ajudar.sh gerou ficam)
async function atualizarPacote(sha, repo) {
  const url = (process.env.AJUDAR_PACOTE_URL || 'https://codeload.github.com/{repo}/tar.gz/{sha}').replace('{repo}', repo).replace('{sha}', sha);
  const r = await pedir(url);
  if (!r.ok) throw new Error(`${r.status} ao baixar ${url}`);
  const tar = zlib.gunzipSync(Buffer.from(await r.arrayBuffer()));
  const mudou = [];
  let longo = null;
  for (let p = 0; p + 512 <= tar.length;) {
    const h = tar.subarray(p, p + 512);
    if (h.every((b) => b === 0)) break;
    const campo = (i, n) => h.subarray(i, i + n).toString('utf8').replace(/\0[\s\S]*$/, '');
    const tam = parseInt(campo(124, 12).trim() || '0', 8), tipo = String.fromCharCode(h[156] || 48);
    const dados = tar.subarray(p + 512, p + 512 + tam);
    p += 512 + Math.ceil(tam / 512) * 512;
    if (tipo === 'x') { longo = dados.toString('utf8').match(/(?:^|\n)\d+ path=([^\n]*)/)?.[1] ?? null; continue; } // nome longo (pax)
    if (tipo === 'L') { longo = dados.toString('utf8').replace(/\0[\s\S]*$/, ''); continue; }
    if (tipo === 'g') continue;
    const nome = longo ?? (campo(345, 155) ? `${campo(345, 155)}/${campo(0, 100)}` : campo(0, 100));
    longo = null;
    if (tipo !== '0') continue; // só arquivos: pastas e links não
    const rel = nome.split('/').slice(1).join('/'); // tira o "<repo>-<sha>/" do começo
    if (!rel || rel.split('/').includes('..')) continue;
    const destino = path.join(RAIZ, ...rel.split('/'));
    if (fs.existsSync(destino) && fs.readFileSync(destino).equals(dados)) continue;
    // o Windows lê o .bat aos pedaços enquanto ele roda: trocar agora bagunçaria a janela aberta
    if (process.platform === 'win32' && rel.endsWith('.bat') && fs.existsSync(destino)) { console.log(`  ${rel} mudou: vale na próxima vez que abrir`); continue; }
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, dados);
    mudou.push(rel);
  }
  fs.writeFileSync(ARQ_CODIGO, sha + '\n');
  return mudou;
}
async function atualizarGit(sha, repo) {
  const tem = () => git('merge-base', '--is-ancestor', sha, 'HEAD').status === 0;
  if (tem()) return null; // já tem esse commit (e talvez mais): nada a fazer
  const origem = git('remote', 'get-url', 'origin').stdout?.trim().replace(/\.git$/, '') ?? '';
  const ramo = git('rev-parse', '--abbrev-ref', 'HEAD').stdout?.trim();
  if (!origem.endsWith(repo) || ramo !== 'master' || git('status', '--porcelain', '--untracked-files=no').stdout?.trim())
    throw new Error(`este clone não é um master limpo de ${repo}: rode git pull você mesmo e recomece`);
  const antes = git('rev-parse', 'HEAD').stdout.trim();
  if (git('pull', '--ff-only', '--quiet', 'origin', 'master').status !== 0 || !tem()) throw new Error('o git pull não trouxe o commit');
  return git('diff', '--name-only', antes, 'HEAD').stdout.split('\n').filter(Boolean);
}
// chamado entre lotes, quando a fila diz que o código é outro: atualiza e recomeça este programa com o código novo
// (devolve o código de saída dele; nada se não recomeçou)
async function atualizar(sha, repo, conta) {
  if (!MODO) { atualizarDepois = Infinity; return; }
  console.log(`código novo na fila (${sha.slice(0, 7)}): atualizando esta cópia...`);
  try {
    const mudou = MODO === 'pacote' ? await atualizarPacote(sha, repo) : await atualizarGit(sha, repo);
    if (!mudou?.length) { CODIGO = sha; console.log('  já estava igual'); return; } // nada mudou (ou o clone já está na frente)
    console.log(`  ${mudou.length} arquivos atualizados: ${mudou.slice(0, 6).join(', ')}${mudou.length > 6 ? ', ...' : ''}`);
    if (mudou.some((a) => /^video\/package(-lock)?\.json$/.test(a)))
      spawnSync('npm', ['i', '--no-audit', '--no-fund'], { cwd: VIDEO, stdio: 'inherit', shell: process.platform === 'win32' });
  } catch (e) {
    console.log(`  não consegui atualizar (${e.message.split('\n')[0]}); sigo com o código que tenho e tento de novo em 30 min`);
    atualizarDepois = Date.now() + 30 * 60000;
    return;
  }
  console.log('recomeçando com o código novo...');
  const r = spawnSync(process.execPath, [path.join(VIDEO, 'ajudar.mjs'), ...args], { stdio: 'inherit', env: { ...process.env, AJUDAR_CONTA: conta.join(',') } });
  return r.status ?? 1;
}

// ---------------------------------------------------------------- um lote
const kitDe = (t) => path.join(VIDEO, 'kit', t); // entradas/<slug>/ e saidas/<slug>/ (pequeno: o pesado fica onde o script gravar)
async function fazer(lote) {
  const TRABALHO = lote.trabalho, KIT = kitDe(TRABALHO), script = scriptDe(TRABALHO);
  console.log(`lote ${lote.lote} (${TRABALHO} v${lote.versao}): ${lote.itens.length} itens (${lote.itens.map((t) => t.rotulo ?? t.slug).slice(0, 4).join(', ')}${lote.itens.length > 4 ? ', ...' : ''})`);
  const devolver = async (it, msg) => { await pedir(it.erro, 'POST', JSON.stringify({ erro: msg }), 'application/json').catch(() => {}); falhas++; };
  if (!script || !preparar(TRABALHO)) {
    console.log(`  esta máquina não consegue fazer o ${TRABALHO}${script ? ' (faltou instalar o que ele pede)' : ' (sem o script)'}: devolvo o lote`);
    incapazes.add(TRABALHO);
    for (const it of lote.itens) await devolver(it, `ajudante ${QUEM} sem o necessário para o ${TRABALHO}`);
    return;
  }

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
      await devolver(it, `entradas: ${e.message}`);
    }
  }
  if (!prontos.length) return;

  // produz o lote inteiro
  const t0 = Date.now(), antes = feitos;
  const py = pythonDireto(script);
  const cmd = script.endsWith('.mjs') ? [process.execPath, [script]] : py ? [process.env.PYTHON || 'python', [py]] : ['bash', [script]];
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
      console.log(`  falhou: ${it.slug}: ${e.message.split('\n')[0]}`);
      await devolver(it, e.message.split('\n')[0]);
    }
  }
  console.log(`lote ${lote.lote}: ${prontos.length} em ${((Date.now() - t0) / 60000).toFixed(1)} min; total desta rodada: ${feitos} prontos, ${falhas} falhas`);
  lotesSemPronto[TRABALHO] = feitos > antes ? 0 : (lotesSemPronto[TRABALHO] ?? 0) + 1;
  if (lotesSemPronto[TRABALHO] >= 2) {
    incapazes.add(TRABALHO);
    console.log(`PARE: esta máquina não conseguiu fazer nenhum ${TRABALHO} em 2 lotes seguidos; não pego mais esse trabalho (os outros seguem).`);
    console.log(`  Mande as mensagens de erro acima para quem te chamou para ajudar. Código novo chega sozinho e libera o trabalho de novo.`);
  }
}

// ---------------------------------------------------------------- laço principal
let [feitos, falhas] = (process.env.AJUDAR_CONTA || '0,0').split(',').map(Number); // continua a conta depois de se atualizar
if (process.env.GITHUB_ACTIONS && !process.env.AJUDAR_CONTA) await dormir(Math.random() * 30000); // espalha a largada das máquinas do Actions
let fixo = 0, parado = null, aviso = '', avisoEm = 0, recomecou;
while (feitos + falhas < LIMITE) {
  while (FIXOS.length && incapazes.has(FIXOS[fixo])) fixo++;
  const corpo = { quantidade: Math.min(LOTE, LIMITE - feitos - falhas), quem: QUEM, codigo: CODIGO, atualizar: !!MODO && Date.now() > atualizarDepois };
  if (FIXOS.length && fixo >= FIXOS.length) break;
  const url = FIXOS.length ? `${FILA}/lote/${FIXOS[fixo]}` : `${FILA}/proximo`;
  const r = await pedir(url, 'POST', JSON.stringify(FIXOS.length ? corpo : { ...corpo, capaz: capazes() }), 'application/json', 8);
  // Worker sem a lista viva (publicado de uma cópia antiga): espera ele voltar, em vez de largar a máquina parada
  if (r.status === 404 && !FIXOS.length) { console.log(`a fila não tem a lista viva agora (${FILA}/proximo: 404); confiro de novo em ${PAUSA / 1000} s`); await dormir(PAUSA); continue; }
  if (!r.ok) { console.error(`a fila respondeu ${r.status}: ${await r.text()}`); process.exit(1); }
  const lote = await r.json();
  if (lote.atualizar) { if ((recomecou = await atualizar(lote.atualizar, lote.repo, [feitos, falhas])) !== undefined) break; continue; }
  if (lote.itens.length) { parado = null; aviso = ''; await fazer({ ...lote, trabalho: lote.trabalho ?? FIXOS[fixo] }); continue; }
  if (FIXOS.length) { console.log(`fila vazia (${FIXOS[fixo]}). Esta rodada: ${feitos} prontos, ${falhas} falhas. Progresso: ${FILA}/`); fixo++; continue; }

  // lista viva sem nada que esta máquina saiba fazer: espera trabalho novo
  parado ??= Date.now();
  if ((Date.now() - parado) / 60000 >= ESPERAR) { console.log(`${ESPERAR} min sem nada na fila: parando.`); break; }
  const outros = (lote.ativos ?? []).filter((t) => t.pendente).map((t) => `${t.nome} (${t.pendente})`);
  const msg = outros.length ? `nada que esta máquina saiba fazer agora; na fila: ${outros.join(', ')}` : 'a fila está vazia agora';
  if (msg !== aviso || Date.now() - avisoEm > 30 * 60000) {
    const cada = PAUSA >= 60000 ? `${Math.round(PAUSA / 60000)} min` : `${PAUSA / 1000} s`;
    console.log(`${msg}. Esta rodada: ${feitos} prontos, ${falhas} falhas. Espero trabalho novo (confiro a cada ${cada}); para parar: Ctrl+C.`);
    aviso = msg; avisoEm = Date.now();
  }
  await dormir(PAUSA);
}
// sem process.exit: no Windows ele às vezes derruba o Node (asserção do libuv) com as conexões do fetch ainda fechando
if (recomecou !== undefined) process.exitCode = recomecou; // a cópia com o código novo já contou tudo
else {
  if (feitos + falhas >= LIMITE) console.log(`limite de ${LIMITE} atingido: ${feitos} prontos, ${falhas} falhas. Progresso: ${FILA}/`);
  else console.log(`acabou${FIXOS.length ? ` (${FIXOS.join(', ')})` : ''}: ${feitos} prontos, ${falhas} falhas. Obrigado!`);
  process.exitCode = feitos || !falhas ? 0 : 1;
}
