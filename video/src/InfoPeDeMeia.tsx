// Cenas de infográfico do vídeo "Escola ou bico" (Pé-de-Meia), irmãs das do InfoFarmacia.tsx:
// 'pdm_dado' (foto da cidade inteira com o alfinete, depois o cartão claro sobe com o contador de estudantes e um
// cofrinho que enche até o dinheiro dos últimos 12 meses) e 'pdm_corte' (o portão da escola da história perde a cor
// enquanto entra o selo "criado em 2024 / com Bolsonaro não existia", depois escurece para o carimbo dos R$ 250 bi).
// O fecho é o mesmo do InfoFarmacia ('fecho' com a frase do programa). Desenho até ~1380 px: a legenda fica embaixo.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COR } from './Saude';
import { Alfinete, ARCHIVO, CARTAO, claro, Fonte, Foto, MONT, numero, VERDE } from './InfoFarmacia';

export type InfoPdm =
  // local: rótulo do alfinete ("São Paulo - SP", ou o estado nas cidades sem estudante pago no ano)
  | { tipo: 'pdm_dado'; local: string; estudantes: number; valor12m: number; ano: number; fundo: string; fonte: string }
  | { tipo: 'pdm_corte'; troca: number; fundo: string; fonte: string }; // troca = frame em que a fala chega em "Flávio"

const AMARELO = '#F5B301'; // o dourado do celular nos clipes

// "R$ 642 mil", "R$ 329 milhões", "R$ 1,2 bilhão" (de R$ 1 bilhão para cima, sempre bilhões)
function dinheiro(v: number): string {
  if (v < 1e6) return `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil`;
  if (v < 1e9) return `R$ ${Math.round(v / 1e6).toLocaleString('pt-BR')} ${v < 2e6 ? 'milhão' : 'milhões'}`;
  const b = Math.round(v / 1e8) / 10;
  return `R$ ${b.toLocaleString('pt-BR')} ${b < 2 ? 'bilhão' : 'bilhões'}`;
}

// Cofrinho de perfil: o corpo enche de baixo para cima (nivel 0 a 1) e a moeda cai na fenda
const Cofrinho: React.FC<{ nivel: number; moeda: number; tam: number }> = ({ nivel, moeda, tam }) => (
  <svg width={tam} height={tam * 0.8} viewBox="0 0 200 160">
    <defs>
      <clipPath id="corpo">
        <ellipse cx="100" cy="92" rx="78" ry="58" />
      </clipPath>
    </defs>
    <circle cx="100" cy={interpolate(moeda, [0, 1], [-30, 40])} r="16" fill={AMARELO} stroke="#B07D00" strokeWidth="4" opacity={moeda > 0 && moeda < 1 ? 1 : 0} />
    <rect x="52" y="138" width="22" height="20" rx="6" fill="#E58FA3" />
    <rect x="126" y="138" width="22" height="20" rx="6" fill="#E58FA3" />
    <path d="M150 62 L170 40 L166 70 Z" fill="#E58FA3" />
    <ellipse cx="100" cy="92" rx="78" ry="58" fill="#F4B6C4" />
    <rect x="0" y={150 - 116 * nivel} width="200" height="200" fill={AMARELO} clipPath="url(#corpo)" opacity={0.9} />
    <ellipse cx="100" cy="92" rx="78" ry="58" fill="none" stroke="#C9687F" strokeWidth="5" />
    <ellipse cx="178" cy="92" rx="16" ry="20" fill="#E58FA3" stroke="#C9687F" strokeWidth="4" />
    <circle cx="174" cy="88" r="3" fill="#8A3A4E" /><circle cx="182" cy="96" r="3" fill="#8A3A4E" />
    <circle cx="146" cy="74" r="6" fill="#2B1B20" />
    <rect x="80" y="30" width="40" height="8" rx="4" fill="#8A3A4E" />
  </svg>
);

const Dado: React.FC<Extract<InfoPdm, { tipo: 'pdm_dado' }>> = ({ local, estudantes, valor12m, ano, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1º tempo (0-30): a foto inteira, colorida, e o alfinete caindo com o nome da cidade
  const pino = spring({ frame: f - 6, fps, config: { damping: 9, stiffness: 140 } });
  const rotulo = spring({ frame: f - 16, fps, config: { damping: 16 } });
  // 2º tempo: o cartão sobe e a cidade fica no terço de cima
  const sobe = spring({ frame: f - 30, fps, config: { damping: 18, stiffness: 90 } });
  const topoCartao = interpolate(sobe, [0, 1], [1920, 600]);
  const pinoY = interpolate(sobe, [0, 1], [760, 300]);
  const conta = interpolate(f, [42, 95], [0, estudantes], { ...claro, easing: Easing.out(Easing.cubic) });
  const [num, unidade] = numero(f >= 95 ? estudantes : conta);
  // 3º tempo: o cofrinho enche e o valor de 12 meses aparece
  const nivel = interpolate(f, [92, 150], [0.05, 0.92], { ...claro, easing: Easing.inOut(Easing.cubic) });
  const moeda = interpolate(f, [86, 104], [0, 1], claro);
  const valor = interpolate(f, [130, 146], [0, 1], claro);
  return (
    <AbsoluteFill>
      <Foto arquivo={fundo} escuro={interpolate(sobe, [0, 1], [0, 0.25])} zoom={[1.0, 1.1]} dur={220} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: pinoY - 120, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ transform: `translateY(${(1 - pino) * -260}px)`, opacity: Math.min(1, pino * 3), filter: 'drop-shadow(0 10px 12px rgba(0,0,0,.45))' }}>
          <Alfinete tam={84} cor={COR.vermelho} />
        </div>
        <div style={{ ...ARCHIVO, fontSize: 72, color: COR.branco, background: 'rgba(11,17,32,.82)', padding: '14px 30px 8px', borderRadius: 14, marginTop: 14, letterSpacing: 2, maxWidth: 960, textAlign: 'center', opacity: rotulo, transform: `scale(${interpolate(rotulo, [0, 1], [0.85, 1])})` }}>
          {local.toUpperCase()}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 30, right: 30, top: topoCartao, bottom: -40, background: CARTAO, borderRadius: 44, boxShadow: '0 -20px 50px rgba(0,0,0,.35)' }}>
        <div style={{ textAlign: 'center', marginTop: 34 }}>
          <div style={{ ...ARCHIVO, fontSize: 200, color: COR.fundo }}>
            {num}
            {unidade ? <span style={{ fontSize: 96, color: VERDE }}> {unidade}</span> : null}
          </div>
          <div style={{ ...MONT, fontSize: 44, color: COR.fundo, marginTop: 14, lineHeight: 1.25 }}>
            {estudantes === 1 ? 'estudante recebeu' : 'estudantes receberam'} o <span style={{ background: VERDE, color: '#fff', padding: '0 14px', borderRadius: 10 }}>Pé-de-Meia</span>
            <br />
            em {ano}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 30 }}>
          <Cofrinho nivel={nivel} moeda={moeda} tam={300} />
          <div style={{ ...MONT, fontSize: 46, color: COR.fundo, marginTop: 10, opacity: valor, transform: `translateY(${(1 - valor) * 20}px)`, textAlign: 'center', lineHeight: 1.25 }}>
            <span style={{ ...ARCHIVO, fontSize: 84, color: VERDE }}>{dinheiro(valor12m)}</span>
            <br />
            nos últimos 12 meses
          </div>
        </div>
      </div>
      <Fonte texto={fonte} cor="rgba(11,17,32,.55)" />
    </AbsoluteFill>
  );
};

const Corte: React.FC<Extract<InfoPdm, { tipo: 'pdm_corte' }>> = ({ troca, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1º tempo: o portão da escola, colorido, perde a cor enquanto entram o selo de 2024 e o "não existia"
  const entra = spring({ frame: f - 8, fps, config: { damping: 14 } });
  const risca = interpolate(f, [30, 52], [0, 1], { ...claro, easing: Easing.inOut(Easing.cubic) });
  const cinza = interpolate(f, [20, 60], [0, 1], claro);
  const sai1 = interpolate(f, [troca - 8, troca + 4], [1, 0], claro);
  // 2º tempo: a cena escurece e o R$ 250 bi é carimbado
  const carimbo = spring({ frame: f - troca - 4, fps, config: { damping: 9, stiffness: 160 } });
  const escuro = interpolate(f, [0, 12, troca - 6, troca + 8], [0, 0.35, 0.5, 0.78], claro);
  const tremor = f >= troca && f < troca + 10 ? Math.sin(f * 3) * 10 * (1 - (f - troca) / 10) : 0;
  return (
    <AbsoluteFill style={{ transform: `translateX(${tremor}px)` }}>
      <Foto arquivo={fundo} cinza={cinza} escuro={escuro} zoom={[1.0, 1.15]} dur={330} foco="50% 40%" />
      <AbsoluteFill style={{ opacity: sai1 }}>
        <div style={{ position: 'absolute', top: 260, left: 40, right: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: entra, transform: `translateY(${(1 - entra) * 50}px)` }}>
          <div style={{ ...MONT, fontSize: 50, color: COR.branco, background: 'rgba(11,17,32,.8)', padding: '10px 26px', borderRadius: 12 }}>Pé-de-Meia</div>
          <div style={{ ...ARCHIVO, fontSize: 70, color: COR.branco, marginTop: 70, letterSpacing: 2 }}>GOVERNO BOLSONARO</div>
          <div style={{ position: 'relative', marginTop: 10 }}>
            <div style={{ ...ARCHIVO, fontSize: 150, color: 'rgba(255,255,255,.7)', whiteSpace: 'nowrap' }}>NÃO EXISTIA</div>
            <div style={{ position: 'absolute', left: -20, top: '46%', height: 16, width: `calc(${risca * 100}% + 40px)`, background: COR.vermelho, borderRadius: 8, transform: 'rotate(-4deg)' }} />
          </div>
          <div style={{ ...ARCHIVO, fontSize: 70, color: COR.branco, marginTop: 70, letterSpacing: 2, opacity: risca }}>GOVERNO LULA</div>
          <div style={{ ...ARCHIVO, fontSize: 110, color: COR.fundo, background: VERDE, padding: '20px 40px 6px', borderRadius: 20, marginTop: 14, whiteSpace: 'nowrap', opacity: risca, transform: `scale(${0.85 + 0.15 * risca})` }}>CRIADO EM 2024</div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: f >= troca - 4 ? 1 : 0 }}>
        <div style={{ position: 'absolute', top: 420, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ ...MONT, fontSize: 50, letterSpacing: 4, color: COR.amarelo, opacity: carimbo }}>PLANO DE FLÁVIO BOLSONARO</div>
          <div
            style={{
              ...ARCHIVO, fontSize: 250, color: COR.branco, display: 'inline-block', marginTop: 40, padding: '30px 50px 10px', background: 'rgba(127,20,20,.55)',
              border: `14px solid ${COR.vermelho}`, borderRadius: 24, transform: `rotate(-6deg) scale(${interpolate(carimbo, [0, 1], [2.2, 1])})`, opacity: Math.min(1, carimbo * 2),
            }}
          >
            R$ 250 BI
          </div>
          <div style={{ ...MONT, fontSize: 56, color: COR.branco, marginTop: 80, opacity: carimbo }}>em cortes</div>
        </div>
      </AbsoluteFill>
      <Fonte texto={fonte} />
    </AbsoluteFill>
  );
};

export const InfoPeDeMeia: React.FC<InfoPdm> = (p) => (p.tipo === 'pdm_dado' ? <Dado {...p} /> : <Corte {...p} />);
