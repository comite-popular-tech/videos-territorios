// O que o vídeo "Posto Fechado" (Rosângela e Dona Cida, aprovado em 20/10/2026, video/public/posto-curto/) tem em comum
// entre as peças prontas (posto_pecas.mjs) e a montagem por território (trabalhos/video-posto.mjs). Mesmo molde da
// insulina (insulina_comum.mjs, de onde vêm a voz, a legenda em ASS e a codificação): cena com duração fixa e a fala que
// se ajusta a ela (acelera até EXTRA_MAX ou troca por uma versão mais curta do texto).
//
// Nove cenas, nove clipes genéricos do Flow (8 s cada, sem cidade). As cenas 3 a 7 têm texto igual em todo lugar e
// ficam prontas com legenda; as 1, 2, 8 e 9 têm vídeo pronto e ganham a legenda e a voz do território. Nenhuma cena é
// desenhada por território: a montagem é só ffmpeg, sem Remotion nem Chrome. Saída 720x1280, 1,5x como o aprovado.
import fs from 'fs';
import path from 'path';
import * as I from './insulina_comum.mjs';

export { VIDEO, FPS, ATRASO, FOLGA, LARG, ALT, ESCALA, ENC, ffmpeg, gerarVozes, legendaDe, vozArquivo, fimDaFala, filtroAss } from './insulina_comum.mjs';
export const VEL = 1.5, MUSICA = 0.28; // como o historia.py final --vel 1.5 do aprovado
export const RESPIRO_FINAL = 60;
export const N = 9, CLIPE = 240; // frames de cada clipe (8 s)
export const TRABALHO = 'video-posto';
export const PUB = path.join(I.VIDEO, 'public', 'posto-curto');
export const FIXAS = {
  2: 'Sem remédio, Dona Cida passou a partir o comprimido ao meio.',
  3: 'Tentou o hospital. Passou o dia inteiro num corredor lotado e voltou pra casa sem consulta.',
  4: 'Rosângela ligava toda noite pra saber dela. Uma noite, Dona Cida não atendeu.',
  5: 'Preocupada, Rosângela foi ver a amiga. A porta estava aberta.',
  6: 'Dona Cida tinha morrido sozinha, com duas xícaras de café na mesa.',
};
// janela de fala das cenas variáveis, em segundos de render (antes do 1,5x); medidas em posto_janelas.mjs sobre os
// 400 territórios (21/10): perto do p90 da versão cheia; o resto acelera até 1,3x e, se nem assim couber, encurta
export const JANELAS = { 0: 12.8, 1: 7.0, 7: 10.5, 8: 7.8 };
export const EXTRA_MAX = 1.3;
export const VARIAVEIS = [0, 1, 7, 8];

export const ass = (leg, extra = 1) => I.ass(leg, { extra, vel: VEL });
export function duracoes(pastaVozes) {
  return [...Array(N).keys()].map((i) => {
    const fala = i in JANELAS ? JANELAS[i] : I.fimDaFala(I.legendaDe(FIXAS[i], pastaVozes));
    return I.ATRASO + Math.round(fala * I.FPS) + I.FOLGA + (i === N - 1 ? RESPIRO_FINAL : 0);
  });
}
export const inicioFinal = (dur, i) => dur.slice(0, i).reduce((a, b) => a + b, 0) / I.FPS / VEL; // segundos no vídeo final

// ---------------------------------------------------------------- roteiro por território
const FALADOS = JSON.parse(fs.readFileSync(path.join(I.VIDEO, 'nomes_falados.json'), 'utf8'));
const limpa = (s) => String(s ?? '').replace(/ /g, ' ').trim();

// repasse anual da atenção primária: "788 milhões de reais", "2,5 bilhões de reais" (nunca "1035 milhões")
export function reais(v) {
  if (v >= 1e9) return `${(Math.round(v / 1e8) / 10).toString().replace('.', ',')} ${v < 2e9 ? 'bilhão' : 'bilhões'} de reais`;
  if (v >= 1e7) return `${Math.round(v / 1e6)} milhões de reais`;
  if (v >= 1e6) {
    const d = Math.round(v / 1e5), m = Math.floor(d / 10), r = (d % 10) * 100;
    return `${m === 1 ? 'um milhão' : `${m} milhões`}${r ? ` e ${r} mil reais` : ' de reais'}`;
  }
  return `${Math.round(v / 1e3)} mil reais`;
}

// Falas variáveis (índice da cena, 0 a 8), cada uma com versões mais curtas para quando a cheia não cabe na janela.
// Lugar sempre com "aqui em <cidade>" (bairro acompanhado da cidade), como o Gui pediu em 21/10. Bairro e cidade com o artigo
// do povo pela tabela do video/lugar_falado.py --json ("Na Maré, aqui no Rio de Janeiro"; nunca "No bairro Maré", 22/10);
// bairro fora da tabela (nome que não se fala) fica só com a cidade.
let LUGAR;
const emCidade = (c) => (LUGAR.cidades[c] ?? `de ${c}`).replace(/^de /, 'em ').replace(/^d([oa]) /, 'n$1 ');
const maiuscula = (s) => s[0].toUpperCase() + s.slice(1);
export function roteiro(ped) {
  LUGAR ??= JSON.parse(fs.readFileSync(path.join(I.VIDEO, 'lugar_falado.json'), 'utf8'));
  const nomes = ped.nomes ?? {};
  const cidade = limpa(ped.municipio.municipio);
  const aps = +ped.numeros?.aps;
  if (!aps) throw new Error('sem repasse da atenção primária');
  const bairro = nomes.regra === 'pares' ? limpa(nomes.bairro).split(/\s+/).join(' ') : '';
  const [noBairro] = (bairro && LUGAR.bairros[bairro]) || [];
  const aqui = `aqui ${emCidade(cidade)}`, Aqui = `Aqui ${emCidade(cidade)}`;
  let unidade = nomes.saude_generica ? '' : limpa(nomes.saude_completo);
  unidade = FALADOS[unidade] ?? unidade;
  // UBS, AMA, USF, Unidade, Clínica... femininas; Posto, Centro, PA, Ambulatório masculinos
  const art = /^(posto|centro|pa|ambulatório|cs|cms|psf|caps|cais)(\s|$)/i.test(unidade) ? 'o' : 'a';
  const ano = '2027, primeiro ano do governo Flávio Bolsonaro.';
  const cafe = 'toda terça, a agente de saúde Rosângela tomava café com a Dona Cida.';
  const corte = 'Até que o governo cortou o dinheiro dos postos de saúde.';
  const nao = 'Essa história ainda não aconteceu.';
  return {
    0: noBairro
      ? [`${ano} ${maiuscula(noBairro)}, ${aqui}, ${cafe}`, `${ano} ${Aqui}, ${cafe}`]
      : [`${ano} ${Aqui}, ${cafe}`, `${ano} Aqui, ${cafe}`],
    1: [...(unidade ? [`${corte} E ${art} ${unidade} fechou.`] : []), `${corte} E o posto de saúde fechou.`],
    7: [`Quem cortou o dinheiro tem nome: Flávio Bolsonaro. ${Aqui}, os postos de saúde podem perder ${reais(aps)} por ano.`,
      `Quem cortou tem nome: Flávio Bolsonaro. ${Aqui}, os postos podem perder ${reais(aps)} por ano.`,
      `Quem cortou tem nome: Flávio Bolsonaro. Aqui, os postos podem perder ${reais(aps)} por ano.`],
    8: noBairro
      ? [`${nao} ${maiuscula(noBairro)}, ${aqui}, ela ainda pode ter outro final.`, `${nao} ${Aqui}, ela ainda pode ter outro final.`]
      : [`${nao} ${Aqui}, ela ainda pode ter outro final.`, `${nao} Aqui, ela ainda pode ter outro final.`],
  };
}
