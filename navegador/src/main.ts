// Página "ajudar pelo navegador": o voluntário confere os 2 primeiros vídeos ao lado do aprovado e, com os dois
// aprovados, a aba segue sozinha (pede um item à fila, monta, envia, repete). A aprovação fica no localStorage.
// Modos de teste, sem fila e sem envio: ?teste=<slug> monta um território e mostra; ?padrao monta o Capão Redondo
// e oferece o MP4 para subir como vídeo padrão (comum/video-insulina/web/padrao.mp4 no R2).
import { canRenderMediaOnWeb } from '@remotion/web-renderer';
import { FILA, PADRAO, SLUG_PADRAO, avisarErro, enviar, montar, pedirLote, props, type Item } from './insulina';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const CHAVE = 'ajudar-insulina:';
const guardado = (k: string) => { try { return localStorage.getItem(CHAVE + k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(CHAVE + k, v); } catch { /* aba anônima */ } };
const nomeDe = (it: Item) => it.rotulo ?? it.slug;
const mostrar = (id: string, sim = true) => { $(id).hidden = !sim; };
const params = new URLSearchParams(location.search);
($('progresso') as HTMLAnchorElement).href = `${FILA}/`;

let aprovados = +(guardado('aprovados') ?? 0); // 2 = já revisou (não repete a revisão)
let feitos = +(guardado('feitos') ?? 0);
let quem = guardado('quem') ?? '';
($('quem') as HTMLInputElement).value = quem;

function mensagem(html: string, tipo: 'aviso' | 'erro' = 'aviso') {
  const m = $('mensagem');
  m.className = `${tipo} cartao`; m.innerHTML = html; m.hidden = false;
}

// ---------------------------------------------------------------- compatibilidade
const ehSafari = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
async function compativel(): Promise<string | null> {
  if (ehSafari) return 'O Safari monta o vídeo sem alguns efeitos (os filtros de imagem) e ele sai diferente do aprovado. Abra este link no Chrome ou no Edge.';
  if (/android|iphone|ipad|mobile/i.test(navigator.userAgent)) return 'No celular não dá: o vídeo é pesado demais. Abra este link no Chrome ou no Edge de um computador.';
  const r = await canRenderMediaOnWeb({ width: 1080, height: 1920, container: 'mp4', videoCodec: 'h264', audioCodec: 'aac' }).catch((e) => ({ canRender: false, issues: [{ message: String(e) }] }));
  if (!r.canRender) return `Este navegador não consegue montar o vídeo (${r.issues.map((i) => i.message).join('; ')}). Use o Chrome ou o Edge atualizado, no computador.`;
  return null;
}

// a tela não apaga enquanto a aba trabalha (o computador pode dormir mesmo assim, se a pessoa mandar)
let trava: WakeLockSentinel | null = null;
async function manterAcordado() {
  try { if (!trava && document.visibilityState === 'visible') { trava = await navigator.wakeLock.request('screen'); trava.addEventListener('release', () => { trava = null; }); } } catch { /* sem suporte */ }
}
document.addEventListener('visibilitychange', () => { if (rodando) manterAcordado(); });

// ---------------------------------------------------------------- montar um item
class SemRoteiro extends Error {}
const urls: string[] = [];
const urlDe = (b: Blob) => { const u = URL.createObjectURL(b); urls.push(u); while (urls.length > 3) URL.revokeObjectURL(urls.shift()!); return u; };

async function montarItem(slug: string, it: Item | undefined, barra: HTMLElement, detalhe: HTMLElement): Promise<Blob> {
  let p;
  try { p = await props(slug, it); } catch (e) { throw new SemRoteiro((e as Error).message); }
  const t0 = performance.now();
  barra.style.width = '0%';
  const blob = await montar(p, (f) => {
    barra.style.width = `${(f * 100).toFixed(1)}%`;
    const s = (performance.now() - t0) / 1000;
    detalhe.textContent = f > 0.03 ? `${Math.round(f * 100)}% · falta ~${Math.max(1, Math.round((s / f - s) / 10) * 10)} s` : `${Math.round(f * 100)}%`;
  });
  detalhe.textContent = `Montado em ${Math.round((performance.now() - t0) / 1000)} s (${(blob.size / 1e6).toFixed(1)} MB)`;
  return blob;
}

// ---------------------------------------------------------------- formulário de problema
function pedirProblema(video?: { url: string; onde: string }): Promise<string | null> {
  const caixas = [...$('formProblema').querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
  caixas.forEach((c) => { c.checked = false; });
  ($('problemaTexto') as HTMLTextAreaElement).value = '';
  mostrar('problemaVideoCaixa', !!video);
  if (video) { ($('problemaVideo') as HTMLVideoElement).src = video.url; $('problemaOnde').textContent = video.onde; }
  mostrar('formProblema');
  $('formProblema').scrollIntoView({ behavior: 'smooth' });
  return new Promise((ok) => {
    $('problemaEnviar').onclick = () => {
      const marcados = caixas.filter((c) => c.checked).map((c) => c.value);
      const texto = ($('problemaTexto') as HTMLTextAreaElement).value.trim();
      if (!marcados.length && !texto) { ($('problemaTexto') as HTMLTextAreaElement).focus(); return; }
      mostrar('formProblema', false); ($('problemaVideo') as HTMLVideoElement).pause();
      ok([marcados.join(', '), texto].filter(Boolean).join(': '));
    };
    $('problemaCancelar').onclick = () => { mostrar('formProblema', false); ($('problemaVideo') as HTMLVideoElement).pause(); ok(null); };
  });
}

// ---------------------------------------------------------------- 1: revisão dos 2 primeiros
async function revisar() {
  mostrar('revisao');
  const padrao = $('padrao') as HTMLVideoElement;
  if (!padrao.src) padrao.src = PADRAO + '#t=1.5'; // #t: mostra um quadro em vez da tela preta
  const seu = $('seu') as HTMLVideoElement;
  while (aprovados < 2) {
    $('passo1').className = aprovados === 0 ? 'agora' : ''; $('passo2').className = aprovados === 1 ? 'agora' : '';
    mostrar('decisao', false); mostrar('seu', false); mostrar('seuEspera'); seu.removeAttribute('src');
    $('seuTitulo').textContent = `O seu vídeo ${aprovados + 1}`;
    $('seuEstado').textContent = 'Pedindo um bairro para você...'; $('seuDetalhe').textContent = ''; $('seuOnde').textContent = '';
    const [it] = await pedirLote(quem || 'navegador', 1);
    if (!it) return fim();
    $('seuEstado').textContent = 'Montando o seu vídeo...'; $('seuOnde').textContent = nomeDe(it);
    let blob: Blob;
    try { blob = await montarItem(it.slug, it, $('seuBarra'), $('seuDetalhe')); } catch (e) { if (await falhou(it, e)) continue; return; }
    seu.src = urlDe(blob); mostrar('seuEspera', false); mostrar('seu'); mostrar('decisao');
    // "Tem problema" abre o formulário; "Voltar" devolve aos dois botões, sobre o mesmo vídeo
    let motivo: string | null = null;
    for (;;) {
      const escolha = await new Promise<'igual' | 'problema'>((ok) => { $('igual').onclick = () => ok('igual'); $('problema').onclick = () => ok('problema'); });
      if (escolha === 'igual') break;
      seu.pause(); padrao.pause(); mostrar('decisao', false);
      motivo = await pedirProblema();
      if (motivo !== null) break;
      mostrar('decisao');
    }
    seu.pause(); padrao.pause();
    if (motivo !== null) {
      await avisarErro(it, `revisão no navegador${quem ? ` (${quem})` : ''}: ${motivo}`);
      mensagem(`Obrigado! O aviso sobre <b>${nomeDe(it)}</b> foi para a equipe. Vamos montar outro para você conferir.`);
      continue;
    }
    mostrar('decisao', false);
    $('seuDetalhe').textContent = 'Enviando...';
    try { await enviar(it, blob); } catch (e) { if (await falhou(it, e)) continue; return; }
    aprovados++; feitos++; guardar('aprovados', String(aprovados)); guardar('feitos', String(feitos));
    mostrar('mensagem', false);
  }
  mostrar('revisao', false);
  return sozinho();
}

// ---------------------------------------------------------------- 2: sozinho
let rodando = false, pausado = false;
let ultimo: { it: Item; url: string } | null = null;
async function sozinho() {
  rodando = true; manterAcordado();
  mostrar('sozinho');
  const atualizar = () => { $('contador').textContent = String(feitos); $('contadorRotulo').textContent = feitos === 1 ? 'vídeo. Obrigado!' : 'vídeos. Obrigado!'; };
  atualizar();
  $('pausar').onclick = () => {
    pausado = !pausado;
    $('pausar').textContent = pausado ? 'Continuar' : 'Pausar';
    if (pausado) $('laco').textContent = 'Pausado depois deste vídeo.';
  };
  $('viProblema').onclick = async () => {
    if (!ultimo) { mensagem('Ainda não há vídeo enviado nesta visita para avisar.'); return; }
    const alvo = ultimo;
    const motivo = await pedirProblema({ url: alvo.url, onde: `Último enviado: ${nomeDe(alvo.it)}` });
    if (motivo) { await avisarErro(alvo.it, `voluntário no navegador${quem ? ` (${quem})` : ''}: ${motivo}`); mensagem(`Obrigado! O aviso sobre <b>${nomeDe(alvo.it)}</b> foi para a equipe.`); }
  };
  let seguidas = 0;
  for (;;) {
    while (pausado) { $('laco').textContent = 'Pausado.'; await new Promise((ok) => setTimeout(ok, 1000)); }
    $('laco').textContent = 'Pedindo o próximo bairro...'; $('lacoBarra').style.width = '0%'; $('lacoDetalhe').textContent = '';
    let it: Item | undefined;
    try { [it] = await pedirLote(quem || 'navegador', 1); } catch (e) { $('laco').textContent = `A fila não respondeu (${(e as Error).message}). Tento de novo em 1 minuto.`; await new Promise((ok) => setTimeout(ok, 60000)); continue; }
    if (!it) return fim();
    $('laco').textContent = `Montando: ${nomeDe(it)}`;
    try {
      const blob = await montarItem(it.slug, it, $('lacoBarra'), $('lacoDetalhe'));
      $('laco').textContent = `Enviando: ${nomeDe(it)}`;
      await enviar(it, blob);
      ultimo = { it, url: urlDe(blob) };
      feitos++; guardar('feitos', String(feitos)); atualizar(); seguidas = 0;
    } catch (e) {
      if (!(await falhou(it, e))) return;
      if (++seguidas >= 3) { rodando = false; mensagem(`Três vídeos seguidos falharam aqui (${(e as Error).message}). Parei para não atrapalhar. Recarregue a página para tentar de novo.`, 'erro'); return; }
    }
  }
}

// erro num item: avisa a fila (o item volta para outro ajudante) e diz se dá para seguir
async function falhou(it: Item, e: unknown): Promise<boolean> {
  const msg = (e as Error)?.message ?? String(e);
  console.error(it.slug, e);
  if (e instanceof SemRoteiro) { // falta preparar as vozes: não é culpa do item, não gasta tentativa dele
    mensagem('Os vídeos deste bairro ainda estão sendo preparados. Tente de novo daqui a pouco.', 'erro');
    rodando = false; return false;
  }
  await avisarErro(it, `navegador: ${msg.split('\n')[0]}`);
  mensagem(`Não deu certo com ${nomeDe(it)} (${msg.split('\n')[0]}). Vou tentar outro.`, 'erro');
  return true;
}

function fim() {
  rodando = false;
  mostrar('revisao', false); mostrar('sozinho', false);
  mensagem(`<b>A fila acabou!</b> Todos os vídeos já foram feitos ou estão sendo feitos agora. ${feitos ? `Você fez ${feitos}. ` : ''}Muito obrigado.`);
}

// ---------------------------------------------------------------- modos de teste (sem fila)
async function teste(slug: string, padrao: boolean) {
  mostrar('inicio', false); mostrar('revisao');
  ($('padrao') as HTMLVideoElement).src = PADRAO + '#t=1.5';
  $('seuTitulo').textContent = padrao ? 'Novo vídeo padrão' : `Teste: ${slug}`; $('seuOnde').textContent = slug;
  try {
    const blob = await montarItem(slug, undefined, $('seuBarra'), $('seuDetalhe'));
    ($('seu') as HTMLVideoElement).src = urlDe(blob); mostrar('seuEspera', false); mostrar('seu');
    (window as unknown as { __video: Blob }).__video = blob;
    if (padrao) { const a = document.createElement('a'); a.href = urlDe(blob); a.download = 'padrao.mp4'; a.textContent = 'Baixar padrao.mp4'; $('seuOnde').append(' · ', a); }
  } catch (e) { mensagem(`Falhou: ${(e as Error).message}`, 'erro'); (window as unknown as { __erro: string }).__erro = String(e); }
}

// ---------------------------------------------------------------- começo
(async () => {
  const problema = await compativel();
  if (problema) { $('incompativel').textContent = problema; mostrar('incompativel'); ($('comecar') as HTMLButtonElement).disabled = true; return; }
  if (params.has('teste') || params.has('padrao')) return teste(params.get('teste') || SLUG_PADRAO, params.has('padrao'));
  if (aprovados >= 2) $('comecar').textContent = 'Continuar ajudando';
  $('comecar').onclick = () => {
    quem = ($('quem') as HTMLInputElement).value.trim().slice(0, 40); guardar('quem', quem);
    mostrar('inicio', false); mostrar('mensagem', false);
    (aprovados >= 2 ? sozinho() : revisar()).catch((e) => mensagem(`Algo deu errado: ${(e as Error).message}. Recarregue a página para tentar de novo.`, 'erro'));
  };
})();
