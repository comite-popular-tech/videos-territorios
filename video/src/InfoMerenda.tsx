// Cenas de infográfico do vídeo "A merenda da Júlia" (merenda escolar), irmãs das do InfoMaisMedicos.tsx:
// 'md_dado' (foto da cidade inteira com o alfinete, depois o cartão claro sobe com duas colunas, a média por ano do
// governo Bolsonaro em cinza e a do governo Lula em verde, cada uma junto do valor dito, e o selo do aumento) e
// 'md_corte' (o refeitório da
// história: a linha do valor por aluno, reta de 2017 a 2022 com o carimbo CONGELADO e os degraus de 2023 e 2026; depois
// perde a cor e escurece para o carimbo dos R$ 250 bi). O fecho é o 'fecho' do InfoFarmacia com a frase do programa.
// Desenho até ~1380 px: a legenda fica embaixo. Fica fora do Historia.tsx: entra pela composição "Merenda"
// (src/MerendaRoot.tsx, renderizada por merenda_render.mjs).
import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COR } from './Saude';
import { Alfinete, ARCHIVO, CARTAO, claro, Fonte, Foto, MONT, VERDE } from './InfoFarmacia';

export type InfoMd =
  // local: rótulo do alfinete ("Irajuba - BA", o estado ou "Brasil"); antes, agora: média por ano de Bolsonaro e de Lula,
  // em R$ de set/2026; tAntes, tAgora: frames em que a fala diz cada valor
  | { tipo: 'md_dado'; local: string; antes: number; agora: number; tAntes: number; tAgora: number; fundo: string; fonte: string }
  // congelado, lula, flavio, ameaca: frames em que a fala chega nessas palavras
  | { tipo: 'md_corte'; congelado: number; lula: number; flavio: number; ameaca: number; fundo: string; fonte: string };

const CINZA = '#9AA1AB';

// "R$ 318 mil", "R$ 212 mi", "R$ 4,7 bi": o rótulo de cada barra
function curto(v: number): string {
  if (v < 1e6) return `R$ ${Math.round(v / 1000)} mil`;
  if (v < 1e9) return `R$ ${Math.round(v / 1e6)} mi`;
  return `R$ ${(Math.round(v / 1e8) / 10).toLocaleString('pt-BR')} bi`;
}

const Dado: React.FC<Extract<InfoMd, { tipo: 'md_dado' }>> = ({ local, antes, agora, tAntes, tAgora, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1º tempo: a foto inteira, colorida, e o alfinete caindo com o nome do lugar
  const pino = spring({ frame: f - 6, fps, config: { damping: 9, stiffness: 140 } });
  const rotulo = spring({ frame: f - 16, fps, config: { damping: 16 } });
  // 2º tempo: o cartão sobe pouco antes da média de Bolsonaro; cada coluna cresce junto do valor dito, e o selo
  const iSobe = Math.max(24, tAntes - 24);
  const sobe = spring({ frame: f - iSobe, fps, config: { damping: 18, stiffness: 90 } });
  const topoCartao = interpolate(sobe, [0, 1], [1920, 600]);
  const pinoY = interpolate(sobe, [0, 1], [760, 300]);
  const iA = Math.max(iSobe + 14, tAntes - 4), iB = Math.max(iA + 18, tAgora - 4);
  const tA = interpolate(f, [iA, iA + 16], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const tB = interpolate(f, [iB, iB + 22], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const pulo = spring({ frame: f - iB - 22, fps, config: { damping: 8, stiffness: 200 } });
  const carimbo = spring({ frame: f - iB - 28, fps, config: { damping: 10, stiffness: 170 } });
  const legenda = interpolate(sobe, [0.6, 1], [0, 1], claro);
  const topo = Math.max(antes, agora), ALTURA = 330;
  const coluna = (v: number, t: number, cor: string, corNum: string, tamNum: number) => (
    <div style={{ width: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
      <div style={{ ...ARCHIVO, fontSize: tamNum, color: corNum, marginBottom: 16, whiteSpace: 'nowrap', opacity: Math.min(1, t * 4) }}>{curto(v)}</div>
      <div style={{ width: 220, height: Math.max(t > 0 ? 6 : 0, ((ALTURA * v) / topo) * t), background: cor, borderRadius: '14px 14px 0 0' }} />
    </div>
  );
  return (
    <AbsoluteFill>
      <Foto arquivo={fundo} escuro={interpolate(sobe, [0, 1], [0, 0.25])} zoom={[1.0, 1.22]} dur={330} />
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
          <span style={{ ...MONT, fontSize: 40, color: '#fff', background: VERDE, padding: '8px 24px', borderRadius: 12, letterSpacing: 2 }}>MERENDA ESCOLAR</span>
          <div style={{ ...MONT, fontWeight: 500, fontSize: 34, color: '#3a4150', marginTop: 20 }}>média por ano, já descontada a inflação</div>
        </div>
        <div style={{ position: 'absolute', left: 50, right: 50, top: 170, height: 410, display: 'flex', justifyContent: 'space-between' }}>
          {coluna(antes, tA, CINZA, '#7d838d', 96)}
          <div style={{ transform: `scale(${1 + 0.1 * Math.sin(Math.PI * Math.min(1, pulo))})`, transformOrigin: '50% 100%' }}>
            {coluna(agora, tB, VERDE, COR.fundo, 120)}
          </div>
        </div>
        <div style={{ position: 'absolute', left: 60, right: 60, top: 582, height: 4, background: '#d9d4c7' }} />
        <div style={{ position: 'absolute', left: 50, right: 50, top: 600, display: 'flex', justifyContent: 'space-between', opacity: legenda }}>
          <div style={{ ...MONT, width: 440, textAlign: 'center', fontSize: 34, color: '#5f6672', letterSpacing: 1.5, lineHeight: 1.15 }}>BOLSONARO<div style={{ fontSize: 24, fontWeight: 600 }}>2019 a 2022</div></div>
          <div style={{ ...MONT, width: 440, textAlign: 'center', fontSize: 40, color: VERDE, letterSpacing: 1.5, lineHeight: 1.1, opacity: Math.min(1, tB * 3) }}>LULA<div style={{ fontSize: 24, fontWeight: 600 }}>2023 até set/2026</div></div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 700, textAlign: 'center' }}>
          <span style={{ ...ARCHIVO, display: 'inline-block', fontSize: 80, color: '#fff', background: VERDE, padding: '12px 30px 4px', borderRadius: 12, opacity: Math.min(1, carimbo * 2), transform: `rotate(-3deg) scale(${interpolate(carimbo, [0, 1], [1.6, 1])})` }}>
            {`+${Math.round((agora / Math.max(1, antes) - 1) * 100)}% NA MÉDIA`}
          </span>
        </div>
      </div>
      <AbsoluteFill style={{ opacity: legenda }}><Fonte texto={fonte} cor="rgba(11,17,32,.55)" /></AbsoluteFill>
    </AbsoluteFill>
  );
};

// Valor por aluno do ensino fundamental, por dia (R$ nominais): Res. FNDE 1/2017, 2/2023 e 1/2026
const PNAE: [number, number][] = [[2017, 0.36], [2018, 0.36], [2019, 0.36], [2020, 0.36], [2021, 0.36], [2022, 0.36], [2023, 0.5], [2024, 0.5], [2025, 0.5], [2026, 0.57]];
const centavos = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

const Corte: React.FC<Extract<InfoMd, { tipo: 'md_corte' }>> = ({ congelado, lula, flavio, ameaca, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1º tempo: o refeitório colorido escurece um pouco; a linha anda reta de 2017 a 2022 (CONGELADO) e sobe com Lula
  const entra = spring({ frame: f - 6, fps, config: { damping: 16 } });
  const reta = interpolate(f, [14, Math.max(40, congelado)], [0, 1], { ...claro, easing: Easing.inOut(Easing.cubic) });
  const gelo = spring({ frame: f - congelado, fps, config: { damping: 10, stiffness: 170 } });
  const sobe = interpolate(f, [lula, lula + 40], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const troca = flavio;
  const sai1 = interpolate(f, [troca - 8, troca + 4], [1, 0], claro);
  // 2º tempo: a cena perde a cor e escurece, o R$ 250 bi é carimbado e a merenda fica ameaçada
  const cinza = interpolate(f, [troca - 6, troca + 14], [0, 1], claro);
  const escuro = interpolate(f, [0, 12, troca - 6, troca + 10], [0, 0.62, 0.65, 0.8], claro);
  const plano = spring({ frame: f - troca - 2, fps, config: { damping: 16 } });
  const tc = Math.max(troca + 12, Math.round((troca + ameaca) / 2) - 30);
  const carimbo = spring({ frame: f - tc, fps, config: { damping: 9, stiffness: 160 } });
  const tremor = f >= tc + 6 && f < tc + 16 ? Math.sin(f * 3) * 10 * (1 - (f - tc - 6) / 10) : 0;
  const risco = spring({ frame: f - Math.max(tc + 20, ameaca - 4), fps, config: { damping: 14 } });
  // gráfico: x de 2017 a 2026 em 100..980, y de R$ 0,30 (embaixo) a R$ 0,60 (em cima)
  const X = (ano: number) => 100 + ((ano - 2017) / 9) * 860;
  const Y = (v: number) => 1010 - ((v - 0.3) / 0.3) * 420;
  // até 2022, em cinza, desenha com "reta"; de 2022 a 2026, em verde, com "sobe", em degraus
  const ateRet = 2017 + 5 * reta;
  const cinzaPts: [number, number][] = [[X(2017), Y(0.36)], [X(Math.min(2022, ateRet)), Y(0.36)]];
  const degraus: [number, number][] = [];
  if (sobe > 0) {
    const ateLula = 2022 + 4.6 * sobe;
    degraus.push([X(2022), Y(0.36)]);
    for (const [ano, v] of [[2023, 0.5], [2026, 0.57]] as [number, number][]) {
      if (ano > ateLula) break;
      degraus.push([X(ano), degraus[degraus.length - 1][1]], [X(ano), Y(v)]);
    }
    degraus.push([X(Math.min(2026.6, ateLula)), degraus[degraus.length - 1][1]]);
  }
  const traco = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const pontos = degraus.length ? degraus : cinzaPts;
  const corLinha = degraus.length ? VERDE : '#cbd5e1';
  return (
    <AbsoluteFill style={{ transform: `translateX(${tremor}px)` }}>
      <Foto arquivo={fundo} cinza={cinza} escuro={escuro} zoom={[1.0, 1.12]} dur={420} foco="50% 55%" />
      <AbsoluteFill style={{ opacity: sai1 }}>
        <div style={{ position: 'absolute', top: 200, left: 0, right: 0, textAlign: 'center', opacity: entra, transform: `translateY(${(1 - entra) * 40}px)` }}>
          <div style={{ ...MONT, fontSize: 42, letterSpacing: 5, color: COR.amarelo }}>NO BRASIL</div>
          <div style={{ ...ARCHIVO, fontSize: 104, color: COR.branco, marginTop: 10, textShadow: '0 6px 20px rgba(0,0,0,.5)' }}>MERENDA POR ALUNO</div>
          <div style={{ ...MONT, fontWeight: 600, fontSize: 32, color: '#e2e8f0', marginTop: 10 }}>ensino fundamental, por dia de aula</div>
        </div>
        <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: entra }}>
          <rect x={X(2019)} y={Y(0.6)} width={X(2023) - X(2019)} height={Y(0.3) - Y(0.6)} fill="rgba(148,163,184,.14)" />
          <line x1={80} x2={1000} y1={Y(0.3)} y2={Y(0.3)} stroke="rgba(255,255,255,.4)" strokeWidth={4} />
          <path d={traco(cinzaPts)} fill="none" stroke="#cbd5e1" strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" />
          {degraus.length ? <path d={traco(degraus)} fill="none" stroke={VERDE} strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {pontos.length ? <circle cx={pontos[pontos.length - 1][0]} cy={pontos[pontos.length - 1][1]} r={16} fill={corLinha} /> : null}
        </svg>
        <div style={{ position: 'absolute', left: X(2019), width: X(2023) - X(2019), top: Y(0.3) + 16, textAlign: 'center', ...MONT, fontSize: 26, color: '#cbd5e1', letterSpacing: 1.5, opacity: entra }}>GOVERNO BOLSONARO</div>
        {[2017, 2023, 2026].map((a) => (
          <div key={a} style={{ position: 'absolute', left: X(a) - 60, width: 120, top: Y(0.3) + 56, textAlign: 'center', ...MONT, fontSize: 30, color: '#e2e8f0', opacity: entra }}>{a}</div>
        ))}
        {/* valores: R$ 0,36 em cima da reta; R$ 0,50 e R$ 0,57 quando a linha chega neles */}
        <div style={{ position: 'absolute', left: X(2017) - 10, top: Y(0.36) - 90, ...ARCHIVO, fontSize: 62, color: '#e2e8f0', opacity: Math.min(1, reta * 3) }}>{centavos(0.36)}</div>
        {PNAE.filter(([a]) => a === 2023 || a === 2026).map(([a, v]) => {
          const op = interpolate(sobe, a === 2023 ? [0.15, 0.3] : [0.85, 1], [0, 1], claro);
          return (
            <div key={a} style={{ position: 'absolute', left: X(a) - (a === 2026 ? 230 : 120), top: Y(v) - 92, ...ARCHIVO, fontSize: a === 2026 ? 84 : 62, color: '#4ade80', opacity: op }}>{centavos(v)}</div>
          );
        })}
        <div style={{ position: 'absolute', left: X(2019) - 20, width: X(2023) - X(2019) + 40, top: Y(0.36) - 200, textAlign: 'center' }}>
          <span style={{ ...ARCHIVO, display: 'inline-block', fontSize: 92, color: '#0b1120', background: '#bae6fd', padding: '14px 30px 4px', borderRadius: 14, border: '6px solid #e0f2fe', opacity: Math.min(1, gelo * 2), transform: `rotate(-4deg) scale(${interpolate(gelo, [0, 1], [1.8, 1])})` }}>
            CONGELADO
          </span>
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
            MERENDA AMEAÇADA
          </div>
        </div>
      </AbsoluteFill>
      <Fonte texto={fonte} />
    </AbsoluteFill>
  );
};

export const InfoMerenda: React.FC<InfoMd> = (p) => (p.tipo === 'md_dado' ? <Dado {...p} /> : <Corte {...p} />);
