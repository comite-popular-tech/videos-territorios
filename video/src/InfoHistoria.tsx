// Cenas de infográfico dos vídeos de história com a Dona Marta ("A chave", Minha Casa Minha Vida; "O posto novo", UBS),
// irmãs das do InfoMaisMedicos.tsx (antes no HyperFrames, em video/historia-dados/):
// 'hd_dado' (foto da cidade inteira com o alfinete, depois o cartão claro sobe com duas colunas, o governo Bolsonaro em
// cinza e o governo Lula em verde; até 30, um ícone por unidade, casa ou posto, acima disso barras) e 'hd_corte' (o
// último quadro de um clipe perde a cor; as barras do Brasil; depois escurece para o carimbo dos R$ 250 bi).
// A fala diz primeiro o número de Lula e depois o de Bolsonaro: cada coluna aparece junto da palavra (tAgora, tAntes:
// frames em que a fala chega nos números). O fecho é o 'fecho' do InfoFarmacia com a frase do programa.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COR } from './Saude';
import { Alfinete, ARCHIVO, CARTAO, claro, Fonte, Foto, MONT, VERDE } from './InfoFarmacia';

export type InfoHd =
  // local: rótulo do alfinete ("São Paulo - SP", o estado ou "Brasil"); selo vazio: sem selo
  | { tipo: 'hd_dado'; local: string; titulo: string; sub: string; icone: 'casa' | 'posto'; antes: number; agora: number; selo: string; tAgora: number; tAntes: number; fundo: string; fonte: string }
  // va, vb: Brasil com Bolsonaro e com Lula; tA, tB, tSelo, flavio, t250: frames em que a fala chega nessas palavras
  | { tipo: 'hd_corte'; titulo: string; va: number; vb: number; rotB: string; selo: string; tA: number; tB: number; tSelo: number; flavio: number; t250: number; fundo: string; fonte: string };

const CINZA = '#9AA1AB';
const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

const Icone: React.FC<{ tipo: 'casa' | 'posto'; cor: string; tam: number }> = ({ tipo, cor, tam }) => (
  <svg width={tam} height={tam} viewBox="0 0 30 30">
    {tipo === 'casa' ? (
      <path d="M15 2 1 14h4v14h8v-8h4v8h8V14h4z" fill={cor} />
    ) : (
      <>
        <path d="M15 2 1 13h3v15h22V13h3z" fill={cor} />
        <path d="M13 12h4v4h4v4h-4v4h-4v-4H9v-4h4z" fill={CARTAO} />
      </>
    )}
  </svg>
);

// Uma coluna: número em cima, ícones ou barra embaixo, crescendo de t = 0 a 1
const Coluna: React.FC<{ n: number; t: number; altura: number; cor: string; corNum: string; tamNum: number; icone: 'casa' | 'posto'; tamIcone: number; inicio: number }> = ({
  n, t, altura, cor, corNum, tamNum, icone, tamIcone, inicio,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const passo = Math.min(1.2, 18 / Math.max(1, n));
  return (
    <div style={{ width: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
      <div style={{ ...ARCHIVO, fontSize: tamNum, color: corNum, marginBottom: 16, opacity: Math.min(1, t * 4) }}>{fmt(n * t)}</div>
      {tamIcone ? (
        <div style={{ display: 'flex', flexWrap: 'wrap-reverse', justifyContent: 'center', gap: 8, width: 340 }}>
          {Array.from({ length: n }, (_, i) => {
            const s = spring({ frame: f - inicio - i * passo, fps, config: { damping: 13 } });
            return <div key={i} style={{ transform: `scale(${s})`, opacity: s }}><Icone tipo={icone} cor={cor} tam={tamIcone} /></div>;
          })}
        </div>
      ) : (
        <div style={{ width: 220, height: Math.max(t > 0 ? 6 : 0, altura * t), background: cor, borderRadius: '14px 14px 0 0' }} />
      )}
    </div>
  );
};

const Dado: React.FC<Extract<InfoHd, { tipo: 'hd_dado' }>> = ({ local, titulo, sub, icone, antes, agora, selo, tAgora, tAntes, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1º tempo: a foto inteira, colorida, e o alfinete caindo com o nome do lugar
  const pino = spring({ frame: f - 6, fps, config: { damping: 9, stiffness: 140 } });
  const rotulo = spring({ frame: f - 16, fps, config: { damping: 16 } });
  // 2º tempo: o cartão sobe pouco antes do número de Lula; depois a coluna de Bolsonaro e o selo
  const iSobe = Math.max(24, tAgora - 24);
  const sobe = spring({ frame: f - iSobe, fps, config: { damping: 18, stiffness: 90 } });
  const topoCartao = interpolate(sobe, [0, 1], [1920, 600]);
  const pinoY = interpolate(sobe, [0, 1], [760, 300]);
  const iB = Math.max(iSobe + 14, tAgora - 4), iA = Math.max(iB + 26, tAntes - 4);
  const tB = interpolate(f, [iB, iB + 24], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const tA = interpolate(f, [iA, iA + 16], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const pulo = spring({ frame: f - iB - 24, fps, config: { damping: 8, stiffness: 200 } });
  const carimbo = spring({ frame: f - iA - 12, fps, config: { damping: 10, stiffness: 170 } });
  const legenda = interpolate(sobe, [0.6, 1], [0, 1], claro);
  const tamIcone = agora <= 30 ? (agora <= 6 ? 84 : agora <= 15 ? 62 : 46) : 0;
  const ALTURA = 330;
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
          <span style={{ ...MONT, fontSize: 40, color: '#fff', background: VERDE, padding: '8px 24px', borderRadius: 12, letterSpacing: 2 }}>{titulo.toUpperCase()}</span>
          <div style={{ ...MONT, fontWeight: 500, fontSize: 36, color: '#3a4150', marginTop: 22 }}>{sub}</div>
        </div>
        <div style={{ position: 'absolute', left: 50, right: 50, top: 170, height: 410, display: 'flex', justifyContent: 'space-between' }}>
          <Coluna n={antes} t={tA} altura={agora ? (ALTURA * antes) / agora : 0} cor={CINZA} corNum="#7d838d" tamNum={120} icone={icone} tamIcone={tamIcone} inicio={iA} />
          <div style={{ transform: `scale(${1 + 0.1 * Math.sin(Math.PI * Math.min(1, pulo))})`, transformOrigin: '50% 100%' }}>
            <Coluna n={agora} t={tB} altura={ALTURA} cor={VERDE} corNum={COR.fundo} tamNum={180} icone={icone} tamIcone={tamIcone} inicio={iB} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 60, right: 60, top: 582, height: 4, background: '#d9d4c7' }} />
        <div style={{ position: 'absolute', left: 50, right: 50, top: 604, display: 'flex', justifyContent: 'space-between', opacity: legenda }}>
          <div style={{ ...MONT, width: 440, textAlign: 'center', fontSize: 30, color: '#5f6672', letterSpacing: 1.5, lineHeight: 1.2 }}>GOVERNO BOLSONARO<br />2019 A 2022</div>
          <div style={{ ...MONT, width: 440, textAlign: 'center', fontSize: 36, color: VERDE, letterSpacing: 1.5, lineHeight: 1.2 }}>GOVERNO LULA<br />DESDE 2023</div>
        </div>
        {selo ? (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 735, textAlign: 'center' }}>
            <span style={{ ...ARCHIVO, display: 'inline-block', fontSize: 70, color: '#fff', background: VERDE, padding: '12px 30px 4px', borderRadius: 12, opacity: Math.min(1, carimbo * 2), transform: `rotate(-3deg) scale(${interpolate(carimbo, [0, 1], [1.6, 1])})` }}>
              {selo.toUpperCase()}
            </span>
          </div>
        ) : null}
      </div>
      <AbsoluteFill style={{ opacity: legenda }}><Fonte texto={fonte} cor="rgba(11,17,32,.55)" /></AbsoluteFill>
    </AbsoluteFill>
  );
};

const Corte: React.FC<Extract<InfoHd, { tipo: 'hd_corte' }>> = ({ titulo, va, vb, rotB, selo, tA, tB, tSelo, flavio, t250, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1º tempo: a cena perde a cor e escurece; o Brasil, cada coluna quando a voz chega no número dela
  const entra = spring({ frame: f - 8, fps, config: { damping: 16 } });
  const iA = Math.max(16, tA - 4), iB = Math.max(16, tB - 4);
  const ta = interpolate(f, [iA, iA + 16], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const tb = interpolate(f, [iB, iB + 24], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const carSelo = spring({ frame: f - Math.max(28, tSelo), fps, config: { damping: 10, stiffness: 170 } });
  const troca = Math.max(Math.max(iA, iB) + 30, flavio - 6);
  const sai1 = interpolate(f, [troca - 8, troca + 4], [1, 0], claro);
  // 2º tempo: escurece mais, o R$ 250 bi é carimbado
  const cinza = interpolate(f, [4, 30], [0, 1], claro);
  const escuro = interpolate(f, [0, 30, troca - 6, troca + 10], [0.25, 0.72, 0.72, 0.86], claro);
  const plano = spring({ frame: f - troca - 2, fps, config: { damping: 16 } });
  const tc = Math.max(troca + 12, t250 - 4);
  const carimbo = spring({ frame: f - tc, fps, config: { damping: 9, stiffness: 160 } });
  const tremor = f >= tc + 6 && f < tc + 16 ? Math.sin(f * 3) * 10 * (1 - (f - tc - 6) / 10) : 0;
  const ALTURA = 340;
  return (
    <AbsoluteFill style={{ transform: `translateX(${tremor}px)` }}>
      <Foto arquivo={fundo} cinza={cinza} escuro={escuro} zoom={[1.0, 1.12]} dur={360} foco="55% 45%" />
      <AbsoluteFill style={{ opacity: sai1 }}>
        <div style={{ position: 'absolute', top: 200, left: 60, right: 60, textAlign: 'center', opacity: entra, transform: `translateY(${(1 - entra) * 40}px)` }}>
          <div style={{ ...MONT, fontSize: 44, letterSpacing: 5, color: COR.amarelo }}>NO BRASIL</div>
          <div style={{ ...ARCHIVO, fontSize: 104, color: COR.branco, marginTop: 10, textShadow: '0 6px 20px rgba(0,0,0,.5)' }}>{titulo.toUpperCase()}</div>
        </div>
        <div style={{ position: 'absolute', left: 90, right: 90, top: 520, height: 470, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {([[va, ta, '#8d939c', '#d5d8dd', 100], [vb, tb, VERDE, COR.branco, 140]] as const).map(([n, t, cor, corNum, tam], k) => (
            <div key={k} style={{ width: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ ...ARCHIVO, fontSize: tam, color: corNum, marginBottom: 14, opacity: Math.min(1, t * 4), textShadow: '0 4px 14px rgba(0,0,0,.55)' }}>{fmt(n * t)}</div>
              <div style={{ width: 220, height: Math.max(t > 0 ? 6 : 0, ((ALTURA * n) / vb) * t), background: cor, borderRadius: '14px 14px 0 0' }} />
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 90, right: 90, top: 990, height: 4, background: 'rgba(255,255,255,.4)', opacity: entra }} />
        <div style={{ position: 'absolute', left: 90, right: 90, top: 1010, display: 'flex', justifyContent: 'space-between', opacity: entra }}>
          <div style={{ ...MONT, width: 400, textAlign: 'center', fontSize: 28, color: '#d5d8dd', letterSpacing: 1.5, lineHeight: 1.2 }}>GOVERNO BOLSONARO<br />2019 A 2022</div>
          <div style={{ ...MONT, width: 400, textAlign: 'center', fontSize: 30, color: '#4ade80', letterSpacing: 1.5, lineHeight: 1.2 }}>{rotB.toUpperCase()}</div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1110, textAlign: 'center' }}>
          <span style={{ ...ARCHIVO, display: 'inline-block', fontSize: 90, color: '#fff', background: VERDE, padding: '14px 34px 4px', borderRadius: 14, opacity: Math.min(1, carSelo * 2), transform: `rotate(-3deg) scale(${interpolate(carSelo, [0, 1], [1.7, 1])})` }}>{selo.toUpperCase()}</span>
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

export const InfoHistoria: React.FC<InfoHd> = (p) => (p.tipo === 'hd_dado' ? <Dado {...p} /> : <Corte {...p} />);
