import React from 'react';
import { Composition } from 'remotion';
import { FPS, PADRAO, Saude, SaudeProps } from './Saude';
import { Historia, HistoriaProps, duracaoHistoria } from './Historia';
import historiaExemplo from '../public/carteira-vazia/props.json';

// Valores de exemplo (Iguatu, CE); o montar.mjs passa os dados reais de cada cidade por --props.
const exemplo: SaudeProps = {
  cidade: 'Iguatu',
  uf: 'CE',
  foto: 'ce-iguatu.jpg',
  fotoCredito: 'Foto: GLandovsky (CC BY-SA 4.0, Wikimedia Commons)',
  valorAno: 21808524.95,
  ubs: 32,
  artigo: 'o',
  unidade: 'PSF Cajas',
  fonte: 'Repasse federal da atenção primária, set/2025 a ago/2026 (Portal da Transparência e CNES) · Farmácia Popular: proposta de Orçamento 2023 do governo Bolsonaro, R$ 2,04 bi para R$ 842 mi · Corte: plano de ajuste fiscal de Flávio Bolsonaro, até R$ 250 bi (Folha de S.Paulo, out/2026)',
  duracoes: PADRAO,
  vozes: [],
  trilha: 'trilha.wav',
};

export const Root: React.FC = () => (
  <>
  <Composition
    id="Historia"
    component={Historia}
    durationInFrames={duracaoHistoria((historiaExemplo as HistoriaProps).cenas)}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={historiaExemplo as HistoriaProps}
    calculateMetadata={({ props }) => ({ durationInFrames: duracaoHistoria(props.cenas) })}
  />
  <Composition
    id="Saude"
    component={Saude}
    durationInFrames={PADRAO.reduce((a, b) => a + b, 0)}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={exemplo}
    calculateMetadata={({ props }) => ({
      durationInFrames: (props.duracoes?.length === PADRAO.length ? props.duracoes : PADRAO).reduce((a, b) => a + b, 0),
    })}
  />
  </>
);
