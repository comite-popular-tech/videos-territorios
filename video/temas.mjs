// Dados dos vídeos de Escola e Aposentados de um território, no mesmo formato do dadosCidade (cidade.mjs) do vídeo de
// Saúde: { slug, props, falas[5], fundo, arquivoFundo, cs } ou { slug, erro }. Mesmos números e nomes dos cards p3
// (educação infantil) e p5 (aposentados) do acervo. Aposentados é dado da cidade: o vídeo de um bairro fala da cidade.
import fs from 'fs';
import { RAIZ, dadosRel, falado, fechoFalado, fundoCidade, limpa, lugarFalado } from './cidade.mjs';
import path from 'path';

const CORTE = 'Corte: plano de ajuste fiscal de Flávio Bolsonaro, até R$ 250 bi (Folha de S.Paulo, out/2026)';

function base(slug, assunto) {
  const pj = path.join(RAIZ, dadosRel(), `saida/territorios/${slug}/pedidos.json`);
  if (!fs.existsSync(pj)) return { erro: 'sem pedidos.json' };
  const ped = JSON.parse(fs.readFileSync(pj, 'utf8'));
  const card = ped.pedidos.find((p) => p.template.assunto === assunto && p.template.layout === 'arte');
  if (!card) return { erro: `sem card de ${assunto}` };
  const cs = slug.split('--')[0];
  const fc = fundoCidade(cs);
  if (fc.erro) return fc;
  return { ped, card, cs, ...fc, cidade: limpa(ped.municipio.municipio), uf: ped.municipio.uf };
}

// "1,2 mil" -> "1.200" (a voz lê "mil e duzentos"); "1,5 milhão" -> "1 milhão e 500 mil"; "850" fica
export function quantidadeFalada(s) {
  const m = s.match(/^([\d.]+)(?:,(\d))?\s*(mil|milhão|milhões)?$/);
  if (!m) return s;
  const [, int, dec, un] = m;
  if (un === 'mil') return dec ? `${int}.${dec}00` : `${int} mil`;
  if (un) return dec ? `${int} ${+int === 1 ? 'milhão' : 'milhões'} e ${dec}00 mil` : `${int} ${un}`;
  return int;
}

// falado() do vídeo de Saúde, com bilhões (capitais)
function reais(v) {
  if (v < 1e9) return falado(v);
  const dec = Math.round(v / 1e8);
  const b = Math.floor(dec / 10), resto = (dec % 10) * 100;
  const bi = b === 1 ? 'um bilhão' : `${b} bilhões`;
  return resto ? `${bi} e ${resto} milhões de reais` : `${bi} de reais`;
}

export function dadosEscola(slug) {
  const b = base(slug, 'emei');
  if (b.erro) return { slug, erro: b.erro };
  const { ped, card, cidade } = b;
  const nomes = ped.nomes ?? {};
  const escola = limpa(nomes.escola_completo || nomes.escola_card);
  const { crian, turmas, docentes } = ped.numeros;
  if (!escola || !crian) return { slug, erro: 'sem escola ou matrículas' };
  // "no bairro Parque Regina", "no Centro": o mesmo trecho do card
  const onde = limpa(card.data.corpo).replace(/\*\*/g, '').match(new RegExp(`${escola.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, ((?:n[oa]s?|em) [^,]+), está na mira`))?.[1] ?? '';
  const bairro = nomes.regra === 'pares' ? limpa(nomes.bairro) : '';
  const lf = lugarFalado(bairro, cidade);   // "da Maré, no Rio de Janeiro", nunca "do bairro Maré" (Gui, 21/10)
  const falas = [
    lf.do ? `Alerta na educação infantil ${lf.do}, ${lf.em}.` : `Alerta na educação infantil ${lf.de}.`,
    `Na ${escola}${onde ? `, ${onde}` : ''}, são ${crian} crianças na pré-escola${turmas ? `, em ${turmas} ${turmas === 1 ? 'turma' : 'turmas'}` : ''}.`,
    'Bolsonaro já vetou o reajuste da merenda escolar em 2022.',
    `Flávio Bolsonaro planeja cortar até 250 bilhões de reais. A merenda da ${escola} está em risco.`,
    `Compartilhe com quem tem filho na escola ${lf.no || lf.em}.`,
  ];
  const props = {
    cidade, uf: b.uf, bairro, foto: b.arquivoFundo, fundo: b.fundo, fotoCredito: b.fotoCredito,
    valorAno: 0, ubs: 0, artigo: 'a', unidade: '',
    alerta: 'ALERTA · EDUCAÇÃO',
    ...fechoFalado(lf, 'COMPARTILHE COM QUEM TEM FILHO NA ESCOLA', bairro, cidade),
    manchete: limpa(card.data.manchete).split('\n'),
    escola, escolaOnde: onde, criancas: crian, turmas, docentes,
    fonte: `${limpa(card.data.fonte)} · ${CORTE}`,
    trilha: 'trilha.wav',
  };
  return { slug, props, falas, fundo: b.fundo, arquivoFundo: b.arquivoFundo, cs: b.cs };
}

export function dadosAposentados(slug) {
  const b = base(slug, 'aposentados');
  if (b.erro) return { slug, erro: b.erro };
  const { ped, card, cidade } = b;
  const { apos, apos_frase, apos_real, inss_mes } = ped.numeros;
  if (!apos || !apos_real) return { slug, erro: 'sem número de aposentados' };
  const aposentados = limpa(apos);
  const resto = limpa(apos_frase).slice(aposentados.length).trim(); // "aposentados" ou "de aposentados"
  const qf = quantidadeFalada(aposentados); // "1 milhão e 500 mil aposentados", sem o "de"
  const falas = [
    `Alerta para os aposentados de ${cidade}.`,
    `Em ${cidade}, ${qf} ${/mil$/.test(qf) ? resto.replace(/^de /, '') : resto} vivem do INSS.` +
      (inss_mes ? ` Todo mês, ${reais(inss_mes)} entram na cidade e giram na farmácia e no mercado.` : ''),
    'Com Lula, o salário mínimo subiu quase 12 por cento acima da inflação. Nos quatro anos de Bolsonaro, pouco mais de 1 por cento.',
    `Flávio Bolsonaro planeja cortar até 250 bilhões de reais. Os aposentados de ${cidade} estão em risco.`,
    `Compartilhe com os aposentados de ${cidade}.`,
  ];
  const props = {
    cidade, uf: b.uf, bairro: '', foto: b.arquivoFundo, fundo: b.fundo, fotoCredito: b.fotoCredito,
    valorAno: 0, ubs: 0, artigo: 'o', unidade: '',
    alerta: 'ALERTA · APOSENTADOS',
    fecho: 'COMPARTILHE COM OS APOSENTADOS DE',
    manchete: limpa(card.data.manchete).split('\n'),
    aposentados, aposResto: resto, inssMes: inss_mes ?? 0,
    fonte: `${limpa(card.data.fonte)} · ${CORTE}`,
    trilha: 'trilha.wav',
  };
  return { slug, props, falas, fundo: b.fundo, arquivoFundo: b.arquivoFundo, cs: b.cs };
}
