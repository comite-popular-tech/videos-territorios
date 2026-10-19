// Dados do vídeo de Saúde de um território: texto da tela, falas da locução e imagem de fundo.
// Fonte: saida/territorios/<slug>/pedidos.json (mesmos números e nomes do card p1 do acervo), dados/fotos_cidades.json (só foto aprovada,
// como nos cards: status revisada ou enviada, com arquivo em dados/brutos/fotos_cidades/) e, sem foto, o mapa do
// município em dados/brutos/artes_mapa/<slug>-saude.svg. Nome falado da unidade: video/nomes_falados.json.
import fs from 'fs';
import path from 'path';

export const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
// Pasta dos dados (saida/territorios, dados/fotos_cidades.json, dados/brutos/...): a raiz do repo ou, com
// VIDEO_DADOS=video/exemplo (lote.mjs --exemplo), o kit pequeno que vai no git para quem quer testar sem os brutos.
export const dadosRel = () => (process.env.VIDEO_DADOS ? process.env.VIDEO_DADOS.replace(/\/?$/, '/') : '');
const D = (p) => path.join(RAIZ, dadosRel(), p);
const ler = (p) => JSON.parse(fs.readFileSync(D(p), 'utf8'));
let FOTOS, FALADOS;

const limpa = (s) => String(s ?? '').replace(/ /g, ' ');

// "21 milhões e 800 mil reais", coerente com o "21,8 milhões" da tela
export function falado(v, comReais = true) {
  const r = comReais ? ' reais' : '';
  if (v >= 1e6) {
    const dec = Math.round(v / 1e5);
    const m = Math.floor(dec / 10), resto = (dec % 10) * 100;
    const mil = m === 1 ? 'um milhão' : `${m} milhões`;
    return resto ? `${mil} e ${resto} mil${r}` : `${mil}${comReais ? ' de reais' : ''}`;
  }
  return `${Math.round(v / 1e3)} mil${r}`;
}

// "Foto: Fulano (CC BY-SA 4.0, Wikimedia Commons)", pulando o que estiver vazio
export function credito(f) {
  if (!f) return '';
  const ORIGEM = { Prefeitura: 'site da prefeitura', Enviada: '', IBGE: 'IBGE' };
  const origem = /wikimedia\.org/.test(f.url) ? 'Wikimedia Commons' : /flickr/.test(f.url) ? 'Flickr' : (ORIGEM[f.verbete] ?? '');
  const dentro = [f.licenca, origem].filter(Boolean).join(', ');
  const autor = limpa(f.autor).trim();
  if (!autor && !dentro) return '';
  return autor ? `Foto: ${autor}${dentro ? ` (${dentro})` : ''}` : `Foto: ${dentro}`;
}

// Devolve { slug, props (sem duracoes/vozes/legendas), falas[5], fundo, arquivoFundo } ou { slug, erro }
// slug = território de saida/territorios/ (cidade, ou cidade--bairro nas de 100 mil habitantes para cima). Foto e
// mapa são os da cidade. Cidade inteira fala de "postos de saúde" (genérico, como a manchete do card); par de bairro
// fala da unidade do bairro pelo nome, como o card.
export function dadosCidade(slug) {
  FOTOS ??= ler('dados/fotos_cidades.json');
  FALADOS ??= JSON.parse(fs.readFileSync(path.join(RAIZ, 'video/nomes_falados.json'), 'utf8'));
  const pj = D(`saida/territorios/${slug}/pedidos.json`);
  if (!fs.existsSync(pj)) return { slug, erro: 'sem pedidos.json' };
  const ped = JSON.parse(fs.readFileSync(pj, 'utf8'));
  const p1 = ped.pedidos.find((p) => p.template.assunto === 'saude' && p.template.layout === 'arte');
  if (!p1) return { slug, erro: 'sem card de saúde' };
  const { aps, ubs } = ped.numeros;
  if (!aps || !ubs) return { slug, erro: 'sem repasse ou UBS' };
  const nomes = ped.nomes ?? {};
  const generica = !!nomes.saude_generica;
  const corpo = limpa(p1.data.corpo);
  let artigo = 'o', unidade = '';
  if (!generica) {
    unidade = limpa(nomes.saude_completo);
    const m = ['o', 'a'].find((a) => corpo.includes(`como ${a} ${unidade}`));
    if (!m) return { slug, erro: 'sem unidade no texto do card' };
    artigo = m;
  }
  const unidadeFalada = FALADOS[unidade] ?? unidade;
  const bairro = generica ? '' : limpa(nomes.bairro);

  const cs = slug.split('--')[0]; // foto e mapa da cidade
  const f = FOTOS[cs];
  const temFoto = f && f.url && ['revisada', 'enviada'].includes(f.status) && fs.existsSync(D(`dados/brutos/fotos_cidades/${cs}.jpg`));
  // o mapa pode vir do SVG dos brutos (o lote rasteriza) ou já em JPEG em video/mapas/ (kit da fila, ajudar.mjs)
  const temMapa = fs.existsSync(D(`dados/brutos/artes_mapa/${cs}-saude.svg`)) || fs.existsSync(path.join(RAIZ, 'video/mapas', `${cs}.jpg`));
  if (!temFoto && !temMapa) return { slug, erro: 'sem foto aprovada e sem mapa' };
  const fundo = temFoto ? 'foto' : 'mapa';
  // mapa: JPEG feito pelo video/mapas.mjs a partir do SVG (o lote roda antes de renderizar)
  const arquivoFundo = temFoto ? `${dadosRel()}dados/brutos/fotos_cidades/${cs}.jpg` : `video/mapas/${cs}.jpg`;

  const cidade = limpa(ped.municipio.municipio);
  const Art = artigo === 'o' ? 'O' : 'A';
  const repasse = generica
    ? ubs === 1
      ? `${cidade} recebe ${falado(aps)} por ano do SUS federal para o seu posto de saúde.`
      : `${cidade} recebe ${falado(aps)} por ano do SUS federal para os seus ${ubs} postos de saúde. Em média, ${falado(aps / ubs, false)} para cada um.`
    : `${cidade} recebe ${falado(aps)} por ano do SUS federal para as suas ${ubs} UBS. Em média, ${falado(aps / ubs, false)} para cada uma, como ${artigo} ${unidadeFalada}.`;
  const emRisco = generica
    ? ubs === 1 ? `O posto de saúde de ${cidade} está em risco.` : `Os postos de saúde de ${cidade} estão em risco.`
    : `${Art} ${unidadeFalada} está em risco.`;
  const falas = [
    bairro ? `Alerta na saúde do bairro ${bairro}, em ${cidade}.` : `Alerta na saúde de ${cidade}.`,
    repasse,
    `Bolsonaro já tentou cortar 59 por cento da Farmácia Popular, que dá remédio de graça.`,
    `Flávio Bolsonaro planeja cortar até 250 bilhões de reais. ${emRisco}`,
    bairro ? `Compartilhe com quem usa o SUS no bairro ${bairro}.` : `Compartilhe com quem usa o SUS em ${cidade}.`,
  ];
  const props = {
    cidade,
    uf: ped.municipio.uf,
    bairro,
    generica,
    manchete: limpa(p1.data.manchete).split('\n'), // "AMA Capão Redondo / em risco", como no card
    foto: arquivoFundo, // o lote troca pelo endereço do servidor local
    fundo,
    fotoCredito: temFoto ? credito(f) : 'Mapa: malha municipal do IBGE',
    valorAno: aps,
    ubs,
    artigo,
    unidade,
    fonte: `${limpa(p1.data.fonte)} · Corte: plano de ajuste fiscal de Flávio Bolsonaro, até R$ 250 bi (Folha de S.Paulo, out/2026)`,
    trilha: 'trilha.wav',
  };
  return { slug, props, falas, fundo, arquivoFundo, cs };
}
