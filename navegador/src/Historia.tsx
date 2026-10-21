// "A Carteira Vazia": história narrada em clipes gerados por IA (imagem → vídeo no Veo, estilo animação 3D), com
// narração, legenda palavra por palavra, som ambiente dos clipes e trilha de piano. Sem fala de personagem.
import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio, Video } from '@remotion/media';
import { carregarFontes } from './fontes';
import { ATRASO_VOZ, COR, FPS, Legenda, Palavra, src, trechos } from './Saude';
import { Info, InfoFarmacia } from './InfoFarmacia';

export type CenaHistoria = {
  video?: string; // mp4 em public/ (clipe do Veo); se faltar, usa a imagem
  imagem?: string; // arquivo em public/
  voz?: string; // mp3 em public/
  legenda?: Palavra[];
  dur: number; // frames
  velocidade?: number; // playbackRate do clipe (< 1 desacelera para cobrir a narração)
  zoom?: [number, number]; // escala no início e no fim
  foco?: string; // transform-origin
  ambiente?: number; // volume do som ambiente do clipe (0 = mudo)
  info?: Info; // cena de infográfico desenhada no lugar do clipe (InfoFarmacia.tsx)
};

export type HistoriaProps = { cenas: CenaHistoria[]; trilha?: string };

const FUSAO = 14; // 18 / 1,25 (no navegador o vídeo já sai acelerado) // frames de fusão entre cenas

const Cena: React.FC<CenaHistoria & { entra: boolean }> = ({ video, imagem, dur, velocidade = 1, zoom = [1, 1], foco = '50% 50%', ambiente = 0.35, info, entra }) => {
  const f = useCurrentFrame();
  const esc = interpolate(f, [0, dur], zoom);
  const sai = interpolate(f, [dur - FUSAO, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const op = entra ? Math.min(sai, interpolate(f, [0, FUSAO], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })) : sai;
  const estilo: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${esc})`, transformOrigin: foco };
  return (
    <AbsoluteFill style={{ opacity: op }}>
      {info ? (
        <InfoFarmacia {...info} />
      ) : video ? (
        <Video src={src(video)} style={estilo} playbackRate={velocidade} volume={(x) => ambiente * interpolate(x, [0, FUSAO, dur - FUSAO, dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      ) : (
        <Img src={src(imagem!)} style={estilo} />
      )}
      {info ? null : <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(5,10,20,.25) 0%, rgba(5,10,20,0) 30%, rgba(5,10,20,0) 65%, rgba(5,10,20,.45) 100%)' }} />}
    </AbsoluteFill>
  );
};

export const Historia: React.FC<HistoriaProps> = ({ cenas, trilha }) => {
  carregarFontes();
  const { durationInFrames } = useVideoConfig();
  const inicios = cenas.map((_, i) => cenas.slice(0, i).reduce((a, c) => a + c.dur, 0) - i * FUSAO);
  const lista = trechos(cenas.map((c) => c.legenda ?? []), inicios);
  return (
    <AbsoluteFill style={{ background: COR.fundo }}>
      {cenas.map((c, i) => (
        <Sequence key={i} from={inicios[i]} durationInFrames={c.dur}>
          <Cena {...c} entra={i > 0} />
        </Sequence>
      ))}
      <Legenda lista={lista} cor={COR.vermelho} />
      {cenas.map((c, i) =>
        c.voz ? (
          <Sequence key={'v' + i} from={inicios[i] + ATRASO_VOZ}>
            <Audio src={src(c.voz)} />
          </Sequence>
        ) : null,
      )}
      {trilha ? <Audio src={src(trilha)} volume={(f) => interpolate(f, [0, 60, durationInFrames - 120, durationInFrames], [0, 0.25, 0.25, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} /> : null}
    </AbsoluteFill>
  );
};

export const duracaoHistoria = (cenas: CenaHistoria[]) => cenas.reduce((a, c) => a + c.dur, 0) - FUSAO * (cenas.length - 1);
export { FPS };
