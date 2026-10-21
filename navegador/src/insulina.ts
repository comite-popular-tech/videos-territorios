// Monta, envia e avisa erro de "A insulina do Seu Raimundo" no navegador. Mesmo vídeo do video/trabalhos/video-insulina.mjs,
// mas sem ffmpeg depois do render: a voz já vem rápida do R2 (+18%, video/insulina_vozes.mjs), os tempos da composição
// são os do Node divididos por 1,25 e a música entra na própria composição (Historia.tsx, trilha).
import { renderMediaOnWeb } from '@remotion/web-renderer';
import { Historia, duracaoHistoria, type CenaHistoria, type HistoriaProps } from './Historia';

export const FILA = (new URLSearchParams(location.search).get('fila') || 'https://fila-videos.boralula.workers.dev').replace(/\/$/, '');
export const TRABALHO = 'video-insulina';
const COMUM = `${FILA}/entradas/comum/video-insulina`;
const WEB = `${COMUM}/web`;
export const PADRAO = `${WEB}/padrao.mp4`; // Capão Redondo, aprovado (montado por esta página com ?padrao)
export const SLUG_PADRAO = 'sp-sao-paulo--capao-redondo';

// tempos em quadros: os do video-insulina.mjs / 1,25 (lá o vídeo é acelerado no ffmpeg depois)
const FPS = 30, ATRASO = 8, FOLGA = 29, MINIMO = 120, RESPIRO_FINAL = 48, RITMO = 1.25;
const CLIPES = [240, 240, 120]; // quadros de clip1..3 (8 s, 8 s e 4 s)
const FONTE_DADO = 'Ministério da Saúde, Farmácia Popular: pessoas atendidas em ago/2026 · IBGE, Censo 2022';
const FONTE_CORTE = 'Corte de 59%: proposta de Orçamento 2023 do governo Bolsonaro · Plano de até R$ 250 bi: Folha de S.Paulo, out/2026';

export type Item = { slug: string; rotulo?: string; entradas: string[]; subir: string; assinatura: string; pronto: string; erro: string };
type Roteiro = { slug: string; falas: { texto: string; voz: string }[]; dado: { local: string; atendidos: number; populacao: number; mes: string } };
type Palavra = [number, number, string];

const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
// tenta de novo em erro de rede, 429 e 5xx, com espera crescente (como o video/ajudar.mjs)
export async function pedir(url: string, init: RequestInit = {}, tentativas = 5): Promise<Response> {
  for (let t = 0; ; t++) {
    try {
      const r = await fetch(url, init);
      if (r.status === 429 || r.status >= 500) throw new Error(String(r.status));
      return r;
    } catch (e) {
      if (t >= tentativas - 1) throw new Error(`${init.method ?? 'GET'} ${url.split('?')[0]}: ${(e as Error).message}`);
      await dormir(Math.min(60000, 2000 * 2 ** t) * (0.75 + Math.random() / 2));
    }
  }
}
const json = async <T,>(url: string): Promise<T> => {
  const r = await pedir(url);
  if (!r.ok) throw new Error(`${r.status} em ${url.replace(FILA, '')}`);
  return r.json();
};
const postJson = (url: string, corpo: unknown) => pedir(url, { method: 'POST', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } });

export async function pedirLote(quem: string, quantidade = 1): Promise<Item[]> {
  const r = await postJson(`${FILA}/lote/${TRABALHO}`, { quantidade, quem });
  if (!r.ok) throw new Error(`a fila respondeu ${r.status}: ${await r.text()}`);
  return (await r.json()).itens;
}

const fundoDe = (slug: string, it?: Item) => it?.entradas.find((u) => u.endsWith('.jpg')) ?? `${FILA}/entradas/fundos/${slug.split('--')[0]}.jpg`;

export async function props(slug: string, it?: Item): Promise<HistoriaProps> {
  const r = await json<Roteiro>(`${WEB}/roteiros/${slug}.json`).catch((e) => {
    throw new Error(`sem o roteiro de ${slug} (${e.message}): as vozes deste território ainda não foram preparadas`);
  });
  const legendas = await Promise.all(r.falas.map((f) => json<Palavra[]>(`${WEB}/vozes/${f.voz}.json`)));
  const cenas: CenaHistoria[] = r.falas.map((f, i) => {
    const leg = legendas[i], fim = leg[leg.length - 1][0] + leg[leg.length - 1][1];
    const dur = Math.max(MINIMO, ATRASO + Math.round(fim * FPS) + FOLGA) + (i === 5 ? RESPIRO_FINAL : 0);
    const c = { voz: `${WEB}/vozes/${f.voz}.mp3`, legenda: leg, dur };
    if (i < 3) return { ...c, video: `${COMUM}/clip${i + 1}.mp4`, velocidade: Math.min(RITMO, CLIPES[i] / dur), ambiente: 0.35 };
    if (i === 3) return { ...c, info: { tipo: 'dado', ...r.dado, fundo: fundoDe(slug, it), fonte: FONTE_DADO } };
    if (i === 4) {
      const flavio = leg.find((p) => p[2].replace(/[.,]/g, '') === 'Flávio');
      // o infográfico anda a 1,25 quadro por quadro (InfoFarmacia.tsx, RITMO): a troca vai na mesma escala
      return { ...c, info: { tipo: 'corte', troca: Math.round((ATRASO + Math.round((flavio?.[0] ?? fim / 2) * FPS)) * RITMO), fundo: `${COMUM}/farmacia.jpg`, fonte: FONTE_CORTE } };
    }
    return { ...c, info: { tipo: 'fecho', fundo: `${COMUM}/rua.jpg` } };
  });
  return { cenas, trilha: `${COMUM}/musica.mp3` };
}

// ~2,2 Mbit/s: perto dos 11 MB do vídeo feito em Node (o 'high' dava 28 MB)
export async function montar(p: HistoriaProps, onProgress: (fracao: number) => void, signal?: AbortSignal): Promise<Blob> {
  const composition = { id: 'Historia', component: Historia, fps: FPS, width: 1080, height: 1920, durationInFrames: duracaoHistoria(p.cenas) };
  const { getBlob } = await renderMediaOnWeb({
    composition: composition as never, inputProps: p as never, container: 'mp4', videoCodec: 'h264', audioCodec: 'aac',
    videoBitrate: 2_200_000, audioBitrate: 128_000, pageResponsiveness: 'low', signal: signal ?? null,
    onProgress: ({ progress }) => onProgress(progress),
  });
  return getBlob();
}

export async function enviar(it: Item, video: Blob): Promise<{ duracao?: number; obs?: string }> {
  const s = await pedir(it.subir + 'insulina.mp4' + it.assinatura, { method: 'PUT', body: video });
  if (!s.ok) throw new Error(`upload: ${s.status} ${await s.text()}`);
  const p = await postJson(it.pronto, { arquivos: ['insulina.mp4'] });
  const j = await p.json().catch(() => ({}));
  if (!p.ok) throw new Error(`pronto: ${p.status} ${j.erro ?? ''}`);
  return j;
}

export async function avisarErro(it: Item, motivo: string) {
  await postJson(it.erro, { erro: motivo.slice(0, 500) }).catch(() => {});
}
