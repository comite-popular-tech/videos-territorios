// Entrada própria do vídeo "A merenda da Júlia" (src/merenda-index.ts, usada só por merenda_render.mjs): a composição
// "Merenda" desenha as cenas md_ do InfoMerenda.tsx com a mesma entrada e saída em fusão das cenas da Historia, e
// repassa à Historia as outras (o fecho do InfoFarmacia). Assim o Historia.tsx e o Root.tsx, de todos os vídeos,
// ficam como estão.
import React from 'react';
import { AbsoluteFill, Composition, interpolate, useCurrentFrame } from 'remotion';
import { carregarFontes } from './fontes';
import { COR, FPS } from './Saude';
import { Historia, HistoriaProps, duracaoHistoria } from './Historia';
import { InfoMd, InfoMerenda } from './InfoMerenda';

const FUSAO = 18; // o mesmo da Historia

const Merenda: React.FC<HistoriaProps> = (p) => {
  carregarFontes();
  const f = useCurrentFrame();
  const c = p.cenas[0];
  const info = c?.info as unknown as InfoMd | undefined;
  if (p.cenas.length !== 1 || !info || !info.tipo.startsWith('md_')) return <Historia {...p} />;
  const sai = interpolate(f, [c.dur - FUSAO, c.dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const op = p.entraPrimeira ? Math.min(sai, interpolate(f, [0, FUSAO], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })) : sai;
  return (
    <AbsoluteFill style={{ background: COR.fundo }}>
      <AbsoluteFill style={{ opacity: op }}><InfoMerenda {...info} /></AbsoluteFill>
    </AbsoluteFill>
  );
};

export const MerendaRoot: React.FC = () => (
  <Composition
    id="Merenda"
    component={Merenda}
    durationInFrames={300}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={{ cenas: [{ dur: 300 }] } as HistoriaProps}
    calculateMetadata={({ props }) => ({ durationInFrames: duracaoHistoria(props.cenas) })}
  />
);
