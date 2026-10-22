// Cenas de infográfico do vídeo "A doutora do posto" (Mais Médicos), irmãs das do InfoFarmacia.tsx (antes no HyperFrames):
// 'mm_dado' (foto da cidade inteira com o alfinete, depois o cartão claro sobe com duas colunas, o fim do governo
// Bolsonaro em cinza e hoje em verde; até 30 médicos um boneco de jaleco por médico, acima disso barras) e 'mm_corte'
// (o consultório da história: o Brasil quase dobrou, depois perde a cor e escurece para o carimbo dos R$ 250 bi).
// O fecho é o 'fecho' do InfoFarmacia com a frase do programa. Desenho até ~1380 px: a legenda fica embaixo.
// No dado, a foto fica sozinha (aproximando) até a fala chegar nos números: aí sobe o cartão e cada coluna aparece
// junto da palavra (tAntes, tHoje: frames em que a fala diz o número de antes e o "Hoje").
import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COR } from './Saude';
import { Alfinete, ARCHIVO, CARTAO, claro, Fonte, Foto, MONT, VERDE } from './InfoFarmacia';

export type InfoMm =
  // local: rótulo do alfinete ("Recife - PE", o estado ou "Brasil", conforme a regra do roteiro)
  | { tipo: 'mm_dado'; local: string; antes: number; agora: number; tAntes: number; tHoje: number; fundo: string; fonte: string }
  // dobrou, flavio, ameaca: frames em que a fala chega nessas palavras; soCorte: quem já ouviu o Brasil na cena do dado
  | { tipo: 'mm_corte'; dobrou: number; flavio: number; ameaca: number; soCorte: boolean; fundo: string; fonte: string };

const CINZA = '#9AA1AB';
const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');
const BR = { antes: 13499, agora: 25868 }; // Brasil: dez/2022 e out/2026

// O que o selo diz além da fala, sem afirmar nada que os dois números não digam
function selo(antes: number, agora: number): string {
  if (antes === 0) return 'Antes, nenhum';
  const r = agora / antes;
  return r >= 3 ? `${Math.floor(r)} vezes mais` : r >= 2 ? 'Mais que o dobro' : `+${Math.round((r - 1) * 100)}%`;
}

// Boneco de jaleco (cabeça, tronco e a gola em V)
const Medico: React.FC<{ cor: string; tam: number }> = ({ cor, tam }) => (
  <svg width={tam} height={tam * 1.385} viewBox="0 0 26 36">
    <circle cx="13" cy="7" r="6" fill={cor} />
    <path d="M2 36V23a11 11 0 0 1 22 0v13z" fill={cor} />
    <path d="M9.5 13l3.5 8 3.5-8" fill="none" stroke={CARTAO} strokeWidth="2.2" />
  </svg>
);

// Uma coluna: número em cima, bonecos ou barra embaixo, crescendo de t = 0 a 1
const Coluna: React.FC<{ n: number; t: number; altura: number; cor: string; corNum: string; tamNum: number; bonecos: number; inicio: number }> = ({
  n, t, altura, cor, corNum, tamNum, bonecos, inicio,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const passo = Math.min(1.2, 18 / Math.max(1, n));
  return (
    <div style={{ width: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
      <div style={{ ...ARCHIVO, fontSize: tamNum, color: corNum, marginBottom: 16, opacity: Math.min(1, t * 4) }}>{fmt(n * t)}</div>
      {bonecos ? (
        <div style={{ display: 'flex', flexWrap: 'wrap-reverse', justifyContent: 'center', gap: 8, width: 320 }}>
          {Array.from({ length: n }, (_, i) => {
            const s = spring({ frame: f - inicio - i * passo, fps, config: { damping: 13 } });
            return <div key={i} style={{ transform: `scale(${s})`, opacity: s }}><Medico cor={cor} tam={bonecos} /></div>;
          })}
        </div>
      ) : (
        <div style={{ width: 220, height: Math.max(n ? 6 : 0, altura * t), background: cor, borderRadius: '14px 14px 0 0' }} />
      )}
    </div>
  );
};

const Dado: React.FC<Extract<InfoMm, { tipo: 'mm_dado' }>> = ({ local, antes, agora, tAntes, tHoje, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1º tempo (0-30): a foto inteira, colorida, e o alfinete caindo com o nome do lugar
  const pino = spring({ frame: f - 6, fps, config: { damping: 9, stiffness: 140 } });
  const rotulo = spring({ frame: f - 16, fps, config: { damping: 16 } });
  // 2º tempo: o cartão sobe pouco antes do primeiro número; cada coluna junto da palavra, e o selo
  const iSobe = Math.max(24, tAntes - 24);
  const sobe = spring({ frame: f - iSobe, fps, config: { damping: 18, stiffness: 90 } });
  const topoCartao = interpolate(sobe, [0, 1], [1920, 600]);
  const pinoY = interpolate(sobe, [0, 1], [760, 300]);
  const iA = Math.max(iSobe + 14, tAntes - 4), iB = Math.max(iA + 18, tHoje - 4);
  const tA = interpolate(f, [iA, iA + 16], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const tB = interpolate(f, [iB, iB + 22], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const pulo = spring({ frame: f - iB - 22, fps, config: { damping: 8, stiffness: 200 } });
  const carimbo = spring({ frame: f - iB - 28, fps, config: { damping: 10, stiffness: 170 } });
  const legenda = interpolate(sobe, [0.6, 1], [0, 1], claro);
  const bonecos = agora <= 30 ? (agora <= 6 ? 72 : agora <= 15 ? 54 : 40) : 0;
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
          <span style={{ ...MONT, fontSize: 40, color: '#fff', background: VERDE, padding: '8px 24px', borderRadius: 12, letterSpacing: 2 }}>MAIS MÉDICOS</span>
          <div style={{ ...MONT, fontWeight: 500, fontSize: 36, color: '#3a4150', marginTop: 22 }}>médicos atendendo pelo programa</div>
        </div>
        <div style={{ position: 'absolute', left: 50, right: 50, top: 170, height: 410, display: 'flex', justifyContent: 'space-between' }}>
          <Coluna n={antes} t={tA} altura={agora ? (ALTURA * antes) / agora : 0} cor={CINZA} corNum="#7d838d" tamNum={120} bonecos={bonecos} inicio={iA} />
          <div style={{ transform: `scale(${1 + 0.1 * Math.sin(Math.PI * Math.min(1, pulo))})`, transformOrigin: '50% 100%' }}>
            <Coluna n={agora} t={tB} altura={ALTURA} cor={VERDE} corNum={COR.fundo} tamNum={180} bonecos={bonecos} inicio={iB} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 60, right: 60, top: 582, height: 4, background: '#d9d4c7' }} />
        <div style={{ position: 'absolute', left: 50, right: 50, top: 604, display: 'flex', justifyContent: 'space-between', opacity: legenda }}>
          <div style={{ ...MONT, width: 440, textAlign: 'center', fontSize: 30, color: '#5f6672', letterSpacing: 1.5, lineHeight: 1.2 }}>FIM DO GOVERNO<br />BOLSONARO</div>
          <div style={{ ...MONT, width: 440, textAlign: 'center', fontSize: 44, color: VERDE, letterSpacing: 1.5, opacity: Math.min(1, tB * 3) }}>HOJE</div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 672, textAlign: 'center' }}>
          <span style={{ ...ARCHIVO, display: 'inline-block', fontSize: 70, color: '#fff', background: VERDE, padding: '12px 30px 4px', borderRadius: 12, opacity: Math.min(1, carimbo * 2), transform: `rotate(-3deg) scale(${interpolate(carimbo, [0, 1], [1.6, 1])})` }}>
            {selo(antes, agora).toUpperCase()}
          </span>
        </div>
      </div>
      <AbsoluteFill style={{ opacity: legenda }}><Fonte texto={fonte} cor="rgba(11,17,32,.55)" /></AbsoluteFill>
    </AbsoluteFill>
  );
};

const Corte: React.FC<Extract<InfoMm, { tipo: 'mm_corte' }>> = ({ dobrou, flavio, ameaca, soCorte, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1º tempo (quem não ouviu o Brasil antes): o consultório colorido e o Brasil quase dobrando
  const entra = spring({ frame: f - 8, fps, config: { damping: 16 } });
  const tA = interpolate(f, [16, 30], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const tB = interpolate(f, [28, Math.max(50, dobrou - 4)], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const dobro = spring({ frame: f - dobrou, fps, config: { damping: 10, stiffness: 170 } });
  const troca = soCorte ? 0 : flavio;
  const sai1 = soCorte ? 0 : interpolate(f, [troca - 8, troca + 4], [1, 0], claro);
  // 2º tempo: a cena perde a cor e escurece, o R$ 250 bi é carimbado e o programa fica ameaçado
  const cinza = interpolate(f, [troca - 6, troca + 14], [0, 1], claro);
  const escuro = soCorte ? interpolate(f, [0, 16], [0.3, 0.8], claro) : interpolate(f, [0, 12, troca - 6, troca + 10], [0, 0.55, 0.6, 0.8], claro);
  const plano = spring({ frame: f - troca - 2, fps, config: { damping: 16 } });
  const tc = Math.max(troca + 12, Math.round((troca + ameaca) / 2) - 30);
  const carimbo = spring({ frame: f - tc, fps, config: { damping: 9, stiffness: 160 } });
  const tremor = f >= tc + 6 && f < tc + 16 ? Math.sin(f * 3) * 10 * (1 - (f - tc - 6) / 10) : 0;
  const risco = spring({ frame: f - Math.max(tc + 20, ameaca - 4), fps, config: { damping: 14 } });
  const larg = 860, ALTURA = 380;
  return (
    <AbsoluteFill style={{ transform: `translateX(${tremor}px)` }}>
      <Foto arquivo={fundo} cinza={cinza} escuro={escuro} zoom={[1.0, 1.12]} dur={360} foco="55% 45%" />
      <AbsoluteFill style={{ opacity: sai1 }}>
        <div style={{ position: 'absolute', top: 220, left: 0, right: 0, textAlign: 'center', opacity: entra, transform: `translateY(${(1 - entra) * 40}px)` }}>
          <div style={{ ...MONT, fontSize: 44, letterSpacing: 5, color: COR.amarelo }}>NO BRASIL</div>
          <div style={{ ...ARCHIVO, fontSize: 130, color: COR.branco, marginTop: 10, textShadow: '0 6px 20px rgba(0,0,0,.5)' }}>MAIS MÉDICOS</div>
        </div>
        <div style={{ position: 'absolute', left: 90, right: 90, top: 470, height: 520, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {[[BR.antes, tA, '#8d939c', '#d5d8dd', 100], [BR.agora, tB, VERDE, COR.branco, 150]].map(([n, t, cor, corNum, tam], k) => (
            <div key={k} style={{ width: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ ...ARCHIVO, fontSize: tam as number, color: corNum as string, marginBottom: 14, opacity: Math.min(1, (t as number) * 4), textShadow: '0 4px 14px rgba(0,0,0,.55)' }}>{fmt((n as number) * (t as number))}</div>
              <div style={{ width: 220, height: ((ALTURA * (n as number)) / BR.agora) * (t as number), background: cor as string, borderRadius: '14px 14px 0 0' }} />
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 90, right: 90, top: 990, height: 4, background: 'rgba(255,255,255,.4)', opacity: entra }} />
        <div style={{ position: 'absolute', left: 90, right: 90, top: 1010, display: 'flex', justifyContent: 'space-between', opacity: entra }}>
          <div style={{ ...MONT, width: 400, textAlign: 'center', fontSize: 28, color: '#d5d8dd', letterSpacing: 1.5, lineHeight: 1.2 }}>FIM DO GOVERNO<br />BOLSONARO</div>
          <div style={{ ...MONT, width: 400, textAlign: 'center', fontSize: 40, color: '#4ade80', letterSpacing: 1.5, opacity: Math.min(1, tB * 3) }}>HOJE</div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1110, textAlign: 'center' }}>
          <span style={{ ...ARCHIVO, display: 'inline-block', fontSize: 90, color: '#fff', background: VERDE, padding: '14px 34px 4px', borderRadius: 14, opacity: Math.min(1, dobro * 2), transform: `rotate(-3deg) scale(${interpolate(dobro, [0, 1], [1.7, 1])})` }}>QUASE O DOBRO</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: f >= troca - 4 ? 1 : 0 }}>
        <div style={{ position: 'absolute', top: 400, left: 0, right: 0, textAlign: 'center' }}>
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
          <div style={{ display: 'inline-block', ...ARCHIVO, fontSize: 84, color: COR.branco, background: COR.vermelho, padding: '14px 30px 4px', borderRadius: 12, marginTop: 50, opacity: risco, transform: `scaleX(${risco})` }}>
            MAIS MÉDICOS AMEAÇADO
          </div>
        </div>
      </AbsoluteFill>
      <Fonte texto={fonte} />
    </AbsoluteFill>
  );
};

export const InfoMaisMedicos: React.FC<InfoMm> = (p) => (p.tipo === 'mm_dado' ? <Dado {...p} /> : <Corte {...p} />);
