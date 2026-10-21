// Texto do vídeo "A insulina do Seu Raimundo" (Farmácia Popular) por território: as seis falas e o dado da cena 4.
// Usado pelo video-insulina.mjs (render em Node) e pelo insulina_vozes.mjs (vozes e roteiros no R2 para a página
// "ajudar pelo navegador"). Mudar o texto aqui muda os dois; as vozes ficam no cache pelo hash de "voz|taxa|texto".
import fs from 'fs';
import path from 'path';

const VIDEO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
export const FP = JSON.parse(fs.readFileSync(path.join(VIDEO, 'farmacia_popular.json'), 'utf8'));
// rua da farmácia credenciada perto (bairro com farmácia no mesmo bairro, cidade com uma só): insulina_farmacias.py
export const RUA = JSON.parse(fs.readFileSync(path.join(VIDEO, 'farmacia_rua.json'), 'utf8'));
export const ESTADOS = {
  AC: ['No Acre', 'Acre'], AL: ['Em Alagoas', 'Alagoas'], AP: ['No Amapá', 'Amapá'], AM: ['No Amazonas', 'Amazonas'], BA: ['Na Bahia', 'Bahia'],
  CE: ['No Ceará', 'Ceará'], DF: ['No Distrito Federal', 'Distrito Federal'], ES: ['No Espírito Santo', 'Espírito Santo'], GO: ['Em Goiás', 'Goiás'],
  MA: ['No Maranhão', 'Maranhão'], MT: ['Em Mato Grosso', 'Mato Grosso'], MS: ['Em Mato Grosso do Sul', 'Mato Grosso do Sul'], MG: ['Em Minas Gerais', 'Minas Gerais'],
  PA: ['No Pará', 'Pará'], PB: ['Na Paraíba', 'Paraíba'], PR: ['No Paraná', 'Paraná'], PE: ['Em Pernambuco', 'Pernambuco'], PI: ['No Piauí', 'Piauí'],
  RJ: ['No estado do Rio de Janeiro', 'Estado do Rio de Janeiro'], RN: ['No Rio Grande do Norte', 'Rio Grande do Norte'], RS: ['No Rio Grande do Sul', 'Rio Grande do Sul'],
  RO: ['Em Rondônia', 'Rondônia'], RR: ['Em Roraima', 'Roraima'], SC: ['Em Santa Catarina', 'Santa Catarina'], SP: ['No estado de São Paulo', 'Estado de São Paulo'],
  SE: ['Em Sergipe', 'Sergipe'], TO: ['No Tocantins', 'Tocantins'],
};
export const FONTE_DADO = 'Ministério da Saúde, Farmácia Popular: pessoas atendidas em ago/2026 · IBGE, Censo 2022';
export const FONTE_CORTE = 'Corte de 59%: proposta de Orçamento 2023 do governo Bolsonaro · Plano de até R$ 250 bi: Folha de S.Paulo, out/2026';
const limpa = (s) => String(s ?? '').replace(/ /g, ' ').trim();

// "576", "550 mil", "1 milhão e 200 mil" (o cartão mostra "1,2 milhão": mesmo arredondamento)
export function falado(v) {
  if (v < 1000) return String(v);
  if (v < 1e6) return `${Math.round(v / 1000)} mil`;
  const d = Math.round(v / 1e5), m = Math.floor(d / 10), r = (d % 10) * 100;
  return `${m} ${m === 1 ? 'milhão' : 'milhões'}${r ? ` e ${r} mil` : ''}`;
}

export function roteiro(d, slug) {
  const ped = d.pedidos, nomes = ped.nomes ?? {};
  const cidade = limpa(ped.municipio.municipio), uf = ped.municipio.uf, ibge = String(ped.municipio.cod_ibge);
  const bairro = nomes.regra === 'pares' ? limpa(nomes.bairro) : '';
  const [atend, pop] = FP.municipios[ibge] ?? [0, 0];
  const doEstado = !atend;
  const [a, p] = doEstado ? FP.ufs[uf] : [atend, pop];
  const onde = doEstado ? ESTADOS[uf][0] : `Aqui em ${cidade}`;
  const quem = a === 1 ? '1 pessoa pegou' : `${falado(a)} pessoas pegaram`;
  return {
    falas: [
      `Seu Raimundo mora ${bairro ? `no bairro ${bairro}, aqui em ${cidade}` : `aqui em ${cidade}`}. Tem diabetes e usa insulina todo dia.`,
      `Todo mês ele pega a insulina na farmácia${RUA[slug] ? ` ${RUA[slug]}` : ''}. E não paga nada.`,
      'São mais de cem reais que ficam no bolso, todo mês.',
      `${onde}, ${quem} remédio de graça ${doEstado ? 'pela Farmácia Popular' : 'assim'} só em ${FP.mes}.`,
      'Bolsonaro já tentou cortar 59 por cento da Farmácia Popular. Flávio Bolsonaro planeja cortar até 250 bilhões.',
      'Compartilhe com quem pega remédio aqui na farmácia da região.',
    ],
    dado: { local: doEstado ? ESTADOS[uf][1] : `${cidade} - ${uf}`, atendidos: a, populacao: p, mes: FP.mes },
  };
}

