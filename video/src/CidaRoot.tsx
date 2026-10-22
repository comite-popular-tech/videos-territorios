// Entrada própria do vídeo "A visita da Cida" (src/cida-index.ts, usada só por cida_render.mjs): a composição "Cida"
// desenha as cenas cida_ do InfoCida.tsx com a mesma entrada e saída em fusão das cenas da Historia, e repassa à
// Historia as outras (o fecho do InfoFarmacia). Assim o Historia.tsx e o Root.tsx, de todos os vídeos, ficam como estão
// (mesmo molde do MerendaRoot.tsx).
import React from 'react';
import { AbsoluteFill, Composition, interpolate, useCurrentFrame } from 'remotion';
import { carregarFontes } from './fontes';
import { COR, FPS } from './Saude';
import { Historia, HistoriaProps, duracaoHistoria } from './Historia';
import { InfoCida, InfoCidaT } from './InfoCida';

const FUSAO = 18; // o mesmo da Historia

const Cida: React.FC<HistoriaProps> = (p) => {
  carregarFontes();
  const f = useCurrentFrame();
  const c = p.cenas[0];
  const info = c?.info as unknown as InfoCidaT | undefined;
  if (p.cenas.length !== 1 || !info || !info.tipo.startsWith('cida_')) return <Historia {...p} />;
  const sai = interpolate(f, [c.dur - FUSAO, c.dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const op = p.entraPrimeira ? Math.min(sai, interpolate(f, [0, FUSAO], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })) : sai;
  return (
    <AbsoluteFill style={{ background: COR.fundo }}>
      <AbsoluteFill style={{ opacity: op }}><InfoCida {...info} /></AbsoluteFill>
    </AbsoluteFill>
  );
};

export const CidaRoot: React.FC = () => (
  <Composition
    id="Cida"
    component={Cida}
    durationInFrames={300}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={{ cenas: [{ dur: 300 }] } as HistoriaProps}
    calculateMetadata={({ props }) => ({ durationInFrames: duracaoHistoria(props.cenas) })}
  />
);
