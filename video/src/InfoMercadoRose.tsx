// Cenas de infográfico do vídeo "O mercado da Dona Rose" (Bolsa Família), irmãs das do InfoMaisMedicos.tsx:
// 'mr_dado' (foto da cidade inteira com o alfinete, depois o cartão claro sobe com o contador de famílias e a sacola de
// compras enchendo até o valor do mês; onde mais da metade das casas recebe, dez casas com as que recebem em verde) e
// 'mr_corte' (o mercadinho da história perde a cor; três barras do benefício por família, 2018, 2019 a 2021 e hoje;
// depois escurece para o carimbo dos R$ 250 bi). O fecho é o 'fecho' do InfoFarmacia com a frase do programa.
// Desenho até ~1380 px: a legenda fica embaixo. tFam, tValor, tSem, tHoje, tDobro, flavio, t250: frames em que a fala
// chega nessas palavras.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COR } from './Saude';
import { Alfinete, ARCHIVO, CARTAO, claro, Fonte, Foto, MONT, VERDE } from './InfoFarmacia';

export type InfoMr =
  // local: rótulo do alfinete ("São Paulo - SP"); metade: a fala troca o valor por "mais da metade das casas"
  | { tipo: 'mr_dado'; local: string; familias: number; valorMes: number; metade: boolean; por100: number; tFam: number; tValor: number; fundo: string; fonte: string }
  // b2018, b2019, bHoje: benefício médio por família, em R$ de hoje
  | { tipo: 'mr_corte'; b2018: number; b2019: number; bHoje: number; tSem: number; tHoje: number; tDobro: number; flavio: number; t250: number; fundo: string; fonte: string };

const CINZA = '#9AA1AB';
const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

// "R$ 420,5 milhões", "R$ 842 mil": o valor do mês no cartão
function reais(v: number): string {
  if (v >= 1e9) return `R$ ${(v / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${v >= 2e9 ? 'bilhões' : 'bilhão'}`;
  if (v >= 1e7) return `R$ ${fmt(Math.floor(v / 1e6))} milhões`; // como a fala: "420 milhões"
  if (v >= 1e6) return `R$ ${(Math.round(v / 1e5) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${v >= 2e6 ? 'milhões' : 'milhão'}`;
  return `R$ ${fmt(Math.floor(v / 1000))} mil`;
}

// Sacola de papel que enche de baixo para cima (t de 0 a 1), com o pão e a verdura aparecendo no fim
const Sacola: React.FC<{ t: number; tam: number }> = ({ t, tam }) => (
  <svg width={tam} height={tam * 1.15} viewBox="0 0 100 115">
    <defs>
      <clipPath id="mr-sacola"><path d="M14 30h72l-6 82H20z" /></clipPath>
    </defs>
    <g opacity={interpolate(t, [0.75, 1], [0, 1], claro)}>
      <rect x="30" y={30 - 26 * t} width="14" height="34" rx="7" fill="#d9a35b" transform="rotate(-12 37 30)" />
      <circle cx="62" cy={26 - 10 * t} r="11" fill="#3fa34d" />
      <circle cx="54" cy={24 - 8 * t} r="8" fill="#56b85f" />
    </g>
    <path d="M14 30h72l-6 82H20z" fill="#e8dcc4" />
    <g clipPath="url(#mr-sacola)">
      <rect x="0" y={112 - 82 * t} width="100" height="90" fill={VERDE} />
    </g>
    <path d="M14 30h72l-6 82H20z" fill="none" stroke="#b8a888" strokeWidth="3" />
    <path d="M36 30c0-14 28-14 28 0" fill="none" stroke="#b8a888" strokeWidth="5" />
  </svg>
);

const Casa: React.FC<{ cor: string; tam: number }> = ({ cor, tam }) => (
  <svg width={tam} height={tam} viewBox="0 0 30 30"><path d="M15 2 1 14h4v14h8v-8h4v8h8V14h4z" fill={cor} /></svg>
);

const Dado: React.FC<Extract<InfoMr, { tipo: 'mr_dado' }>> = ({ local, familias, valorMes, metade, por100, tFam, tValor, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1º tempo: a foto inteira, colorida, e o alfinete caindo com o nome do lugar
  const pino = spring({ frame: f - 6, fps, config: { damping: 9, stiffness: 140 } });
  const rotulo = spring({ frame: f - 16, fps, config: { damping: 16 } });
  // 2º tempo: o cartão sobe pouco antes do número de famílias; o contador corre junto da fala, depois a sacola (ou as casas)
  const iSobe = Math.max(24, tFam - 24);
  const sobe = spring({ frame: f - iSobe, fps, config: { damping: 18, stiffness: 90 } });
  const topoCartao = interpolate(sobe, [0, 1], [1920, 560]);
  const pinoY = interpolate(sobe, [0, 1], [760, 290]);
  const iF = Math.max(iSobe + 14, tFam - 4);
  const tf = interpolate(f, [iF, iF + 26], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const iV = Math.max(iF + 30, tValor - 6);
  const tv = interpolate(f, [iV, iV + 34], [0, 1], { ...claro, easing: Easing.inOut(Easing.cubic) });
  const carimbo = spring({ frame: f - iV - 34, fps, config: { damping: 10, stiffness: 170 } });
  const legenda = interpolate(sobe, [0.6, 1], [0, 1], claro);
  const cheias = Math.round(por100 / 10);
  return (
    <AbsoluteFill>
      <Foto arquivo={fundo} escuro={interpolate(sobe, [0, 1], [0, 0.25])} zoom={[1.0, 1.22]} dur={300} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: pinoY - 120, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ transform: `translateY(${(1 - pino) * -260}px)`, opacity: Math.min(1, pino * 3), filter: 'drop-shadow(0 10px 12px rgba(0,0,0,.45))' }}>
          <Alfinete tam={84} cor={COR.vermelho} />
        </div>
        <div style={{ ...ARCHIVO, fontSize: 72, color: COR.branco, background: 'rgba(11,17,32,.82)', padding: '14px 30px 8px', borderRadius: 14, marginTop: 14, letterSpacing: 2, maxWidth: 960, textAlign: 'center', opacity: rotulo, transform: `scale(${interpolate(rotulo, [0, 1], [0.85, 1])})` }}>
          {local.toUpperCase()}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 30, right: 30, top: topoCartao, bottom: -40, background: CARTAO, borderRadius: 44, boxShadow: '0 -20px 50px rgba(0,0,0,.35)' }}>
        <div style={{ textAlign: 'center', marginTop: 36 }}>
          <span style={{ ...MONT, fontSize: 40, color: '#fff', background: VERDE, padding: '8px 24px', borderRadius: 12, letterSpacing: 2 }}>BOLSA FAMÍLIA</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: 26, opacity: Math.min(1, tf * 4) }}>
          <div style={{ ...ARCHIVO, fontSize: 190, color: COR.fundo }}>{fmt(familias * tf)}</div>
          <div style={{ ...MONT, fontWeight: 500, fontSize: 38, color: '#3a4150', marginTop: 8 }}>famílias receberam em agosto</div>
        </div>
        {metade ? (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 420, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 14 }}>
              {Array.from({ length: 10 }, (_, i) => {
                const s = spring({ frame: f - iV - i * 3, fps, config: { damping: 13 } });
                return <div key={i} style={{ transform: `scale(${s})`, opacity: s }}><Casa cor={i < cheias ? VERDE : CINZA} tam={78} /></div>;
              })}
            </div>
            <div style={{ ...MONT, fontSize: 40, color: VERDE, marginTop: 24, opacity: tv }}>{cheias} em cada 10 casas</div>
            <div style={{ ...MONT, fontWeight: 500, fontSize: 32, color: '#5f6672', marginTop: 14, opacity: tv }}>{reais(valorMes)} por mês no comércio</div>
          </div>
        ) : (
          <div style={{ position: 'absolute', left: 60, right: 60, top: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, opacity: Math.min(1, tv * 3) }}>
            <Sacola t={tv} tam={210} />
            <div>
              <div style={{ ...ARCHIVO, fontSize: 96, color: VERDE }}>{reais(valorMes)}</div>
              <div style={{ ...MONT, fontWeight: 500, fontSize: 34, color: '#3a4150', marginTop: 10 }}>por mês no comércio</div>
            </div>
          </div>
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 715, textAlign: 'center' }}>
          <span style={{ ...ARCHIVO, display: 'inline-block', fontSize: 64, color: '#fff', background: VERDE, padding: '12px 30px 4px', borderRadius: 12, opacity: Math.min(1, carimbo * 2), transform: `rotate(-3deg) scale(${interpolate(carimbo, [0, 1], [1.6, 1])})` }}>
            {metade ? 'MAIS DA METADE DA CIDADE' : 'VIRA COMIDA NA MESA'}
          </span>
        </div>
      </div>
      <AbsoluteFill style={{ opacity: legenda }}><Fonte texto={fonte} cor="rgba(11,17,32,.55)" /></AbsoluteFill>
    </AbsoluteFill>
  );
};

const Corte: React.FC<Extract<InfoMr, { tipo: 'mr_corte' }>> = ({ b2018, b2019, bHoje, tSem, tHoje, tDobro, flavio, t250, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1º tempo: o mercadinho perde a cor e escurece; 2018 e 2019-2021 lado a lado (parados), depois a barra de hoje
  const entra = spring({ frame: f - 8, fps, config: { damping: 16 } });
  const iA = 14, iB = Math.max(iA + 12, tSem - 10), iC = Math.max(iB + 20, tHoje - 4);
  const ta = interpolate(f, [iA, iA + 16], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const tb = interpolate(f, [iB, iB + 16], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const tc = interpolate(f, [iC, iC + 26], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const carSelo = spring({ frame: f - Math.max(iC + 20, tDobro), fps, config: { damping: 10, stiffness: 170 } });
  const troca = Math.max(iC + 50, flavio - 6);
  const sai1 = interpolate(f, [troca - 8, troca + 4], [1, 0], claro);
  // 2º tempo: escurece mais, o R$ 250 bi é carimbado
  const cinza = interpolate(f, [4, 30], [0, 1], claro);
  const escuro = interpolate(f, [0, 30, troca - 6, troca + 10], [0.25, 0.72, 0.72, 0.86], claro);
  const plano = spring({ frame: f - troca - 2, fps, config: { damping: 16 } });
  const tcar = Math.max(troca + 12, t250 - 4);
  const carimbo = spring({ frame: f - tcar, fps, config: { damping: 9, stiffness: 160 } });
  const tremor = f >= tcar + 6 && f < tcar + 16 ? Math.sin(f * 3) * 10 * (1 - (f - tcar - 6) / 10) : 0;
  const ALTURA = 360;
  const barras = [
    [b2018, ta, '#8d939c', '#d5d8dd', 76, '2018'],
    [b2019, tb, '#8d939c', '#d5d8dd', 76, '2019 A 2021\nSEM REAJUSTE'],
    [bHoje, tc, VERDE, COR.branco, 100, 'HOJE'],
  ] as const;
  return (
    <AbsoluteFill style={{ transform: `translateX(${tremor}px)` }}>
      <Foto arquivo={fundo} cinza={cinza} escuro={escuro} zoom={[1.0, 1.12]} dur={360} foco="55% 45%" />
      <AbsoluteFill style={{ opacity: sai1 }}>
        <div style={{ position: 'absolute', top: 190, left: 60, right: 60, textAlign: 'center', opacity: entra, transform: `translateY(${(1 - entra) * 40}px)` }}>
          <div style={{ ...MONT, fontSize: 40, letterSpacing: 4, color: COR.amarelo }}>BOLSA FAMÍLIA POR FAMÍLIA</div>
          <div style={{ ...ARCHIVO, fontSize: 92, color: COR.branco, marginTop: 10, textShadow: '0 6px 20px rgba(0,0,0,.5)' }}>R$ POR MÊS</div>
        </div>
        <div style={{ position: 'absolute', left: 50, right: 50, top: 470, height: 520, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {barras.map(([n, t, cor, corNum, tam], k) => (
            <div key={k} style={{ width: 300, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ ...ARCHIVO, fontSize: tam, color: corNum, marginBottom: 14, opacity: Math.min(1, t * 4), textShadow: '0 4px 14px rgba(0,0,0,.55)', whiteSpace: 'nowrap' }}>R$ {fmt(n * t)}</div>
              <div style={{ width: 190, height: Math.max(t > 0 ? 6 : 0, ((ALTURA * n) / bHoje) * t), background: cor, borderRadius: '14px 14px 0 0' }} />
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 50, right: 50, top: 990, height: 4, background: 'rgba(255,255,255,.4)', opacity: entra }} />
        <div style={{ position: 'absolute', left: 50, right: 50, top: 1010, display: 'flex', justifyContent: 'space-between', opacity: entra }}>
          {barras.map(([, t, , , , rot], k) => (
            <div key={k} style={{ ...MONT, width: 300, textAlign: 'center', fontSize: k === 2 ? 40 : 28, color: k === 2 ? '#4ade80' : '#d5d8dd', letterSpacing: 1.5, lineHeight: 1.2, whiteSpace: 'pre-line', opacity: k === 2 ? Math.min(1, t * 3) : 1 }}>{rot}</div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1120, textAlign: 'center' }}>
          <span style={{ ...ARCHIVO, display: 'inline-block', fontSize: 84, color: '#fff', background: VERDE, padding: '14px 34px 4px', borderRadius: 14, opacity: Math.min(1, carSelo * 2), transform: `rotate(-3deg) scale(${interpolate(carSelo, [0, 1], [1.7, 1])})` }}>MAIS QUE O DOBRO</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: f >= troca - 4 ? 1 : 0 }}>
        <div style={{ position: 'absolute', top: 420, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ ...MONT, fontSize: 50, letterSpacing: 4, color: COR.amarelo, opacity: plano, transform: `translateY(${(1 - plano) * 30}px)` }}>PLANO DE FLÁVIO BOLSONARO</div>
          <div
            style={{
              ...ARCHIVO, fontSize: 250, color: COR.branco, display: 'inline-block', marginTop: 40, padding: '30px 50px 10px', background: 'rgba(127,20,20,.55)',
              border: `14px solid ${COR.vermelho}`, borderRadius: 24, transform: `rotate(-6deg) scale(${interpolate(carimbo, [0, 1], [2.2, 1])})`, opacity: Math.min(1, carimbo * 2),
            }}
          >
            R$ 250 BI
          </div>
          <div style={{ ...MONT, fontSize: 56, color: COR.branco, marginTop: 60, opacity: carimbo }}>em cortes</div>
        </div>
      </AbsoluteFill>
      <Fonte texto={fonte} />
    </AbsoluteFill>
  );
};

export const InfoMercadoRose: React.FC<InfoMr> = (p) => (p.tipo === 'mr_dado' ? <Dado {...p} /> : <Corte {...p} />);
