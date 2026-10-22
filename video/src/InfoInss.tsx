// Cenas de infográfico do vídeo "O dinheiro que gira" (INSS, roteiro 3), irmãs das do InfoMaisMedicos.tsx:
// 'inss_dado' (foto da cidade inteira com o alfinete; o cartão claro sobe com o contador de aposentados e, quando a fala
// chega no dinheiro, a nota dourada enche a barra do mês com o valor) e 'inss_corte' (a feira da história perde a cor:
// barras do aumento real do salário mínimo, Lula e Bolsonaro, cada uma junto da palavra; depois escurece para o carimbo
// dos R$ 250 bi). O fecho é o 'fecho' do InfoFarmacia. Desenho até ~1380 px: a legenda fica embaixo.
// Composição própria (InssInfo, src/inss-index.ts), para não mexer na Historia que as outras sessões usam.
import React from 'react';
import { AbsoluteFill, Composition, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { carregarFontes } from './fontes';
import { COR, FPS } from './Saude';
import { Alfinete, ARCHIVO, CARTAO, claro, Fonte, Foto, Info, InfoFarmacia, MONT, numero, VERDE } from './InfoFarmacia';

export type InfoInss =
  // local: "São Paulo - SP"; mesCartao: "R$ 5,7 bilhões"; tApos, tMes: frames em que a fala chega nesses números
  | { tipo: 'inss_dado'; local: string; aposentados: number; mesCartao: string; tApos: number; tMes: number; fundo: string; fonte: string }
  // tLula, tBols, flavio, risco: frames em que a fala chega nessas palavras
  | { tipo: 'inss_corte'; tLula: number; tBols: number; flavio: number; risco: number; fundo: string; fonte: string };

const OURO = '#F2B705';

// Como a fala (inss_comum.aposentados_falado): exato até 9.999 ("1.033"), depois "26 mil" e "1,5 milhão"
const aposentadosCartao = (v: number): [string, string] => (v < 10000 ? [Math.round(v).toLocaleString('pt-BR'), ''] : numero(v));
const CINZA = '#9AA1AB';

// A nota dourada (retângulo com o círculo do meio)
const Nota: React.FC<{ tam: number; brilho: number }> = ({ tam, brilho }) => (
  <svg width={tam} height={tam * 0.52} viewBox="0 0 50 26" style={{ filter: `drop-shadow(0 0 ${8 + 14 * brilho}px rgba(242,183,5,${0.35 + 0.5 * brilho}))` }}>
    <rect x="1" y="1" width="48" height="24" rx="3" fill={OURO} stroke="#b88600" strokeWidth="1.5" />
    <rect x="5" y="5" width="40" height="16" rx="2" fill="none" stroke="#fff3c4" strokeWidth="1" opacity="0.8" />
    <circle cx="25" cy="13" r="5.5" fill="#fff3c4" opacity="0.85" />
  </svg>
);

const Dado: React.FC<Extract<InfoInss, { tipo: 'inss_dado' }>> = ({ local, aposentados, mesCartao, tApos, tMes, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1º tempo: a foto inteira, colorida, e o alfinete caindo com o nome da cidade
  const pino = spring({ frame: f - 6, fps, config: { damping: 9, stiffness: 140 } });
  const rotulo = spring({ frame: f - 16, fps, config: { damping: 16 } });
  // 2º tempo: o cartão sobe pouco antes do número; o contador corre até ele
  const iSobe = Math.max(24, tApos - 22);
  const sobe = spring({ frame: f - iSobe, fps, config: { damping: 18, stiffness: 90 } });
  const topoCartao = interpolate(sobe, [0, 1], [1920, 600]);
  const pinoY = interpolate(sobe, [0, 1], [760, 300]);
  const iConta = Math.max(iSobe + 10, tApos - 4);
  const conta = interpolate(f, [iConta, iConta + 30], [0, aposentados], { ...claro, easing: Easing.out(Easing.cubic) });
  const [num, unidade] = aposentadosCartao(f >= iConta + 30 ? aposentados : conta);
  // 3º tempo: a nota dourada desce e enche a barra do mês; o valor carimba no fim
  const iMes = Math.max(iConta + 26, tMes - 6);
  const nota = spring({ frame: f - iMes, fps, config: { damping: 12, stiffness: 120 } });
  const enche = interpolate(f, [iMes + 6, iMes + 34], [0, 1], { ...claro, easing: Easing.inOut(Easing.cubic) });
  const carimbo = spring({ frame: f - iMes - 30, fps, config: { damping: 10, stiffness: 170 } });
  const brilho = 0.5 + 0.5 * Math.sin(f / 5);
  const legenda = interpolate(sobe, [0.6, 1], [0, 1], claro);
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
          <span style={{ ...MONT, fontSize: 40, color: '#fff', background: VERDE, padding: '8px 24px', borderRadius: 12, letterSpacing: 2 }}>INSS</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <span style={{ ...ARCHIVO, fontSize: 190, color: COR.fundo }}>{num}</span>
          {unidade ? <span style={{ ...ARCHIVO, fontSize: 96, color: COR.fundo, marginLeft: 18 }}>{unidade}</span> : null}
          <div style={{ ...MONT, fontWeight: 600, fontSize: 40, color: '#3a4150', marginTop: 6 }}>{aposentados === 1 ? 'aposentado vive' : 'aposentados vivem'} do INSS</div>
        </div>
        {/* a barra do mês: a nota dourada cai e a barra enche */}
        <div style={{ position: 'absolute', left: 90, right: 90, top: 440, opacity: Math.min(1, nota * 2) }}>
          <div style={{ display: 'flex', justifyContent: 'center', transform: `translateY(${(1 - nota) * -120}px) rotate(${(1 - nota) * -18}deg)` }}>
            <Nota tam={150} brilho={brilho * enche} />
          </div>
          <div style={{ marginTop: 22, height: 54, borderRadius: 27, background: '#e4ddcc', overflow: 'hidden', boxShadow: 'inset 0 3px 8px rgba(0,0,0,.12)' }}>
            <div style={{ width: `${enche * 100}%`, height: '100%', background: `linear-gradient(90deg, #d99a00, ${OURO} 60%, #ffe27a)`, borderRadius: 27 }} />
          </div>
          <div style={{ ...MONT, fontWeight: 600, fontSize: 32, color: '#5f6672', textAlign: 'center', marginTop: 14, letterSpacing: 1.5 }}>TODO MÊS, NA CIDADE</div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 690, textAlign: 'center' }}>
          <span style={{ ...ARCHIVO, display: 'inline-block', fontSize: 92, color: COR.fundo, background: OURO, padding: '14px 34px 4px', borderRadius: 14, opacity: Math.min(1, carimbo * 2), transform: `rotate(-3deg) scale(${interpolate(carimbo, [0, 1], [1.6, 1])})` }}>
            {mesCartao.toUpperCase()}
          </span>
        </div>
      </div>
      <AbsoluteFill style={{ opacity: legenda }}><Fonte texto={fonte} cor="rgba(11,17,32,.55)" /></AbsoluteFill>
    </AbsoluteFill>
  );
};

// Aumento real do salário mínimo nos dois mandatos (decretos e INPC; a fala e o card dizem "quase 12" e "pouco mais de 1")
const LULA = 12, BOLS = 1;

const Corte: React.FC<Extract<InfoInss, { tipo: 'inss_corte' }>> = ({ tLula, tBols, flavio, risco, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame: f - 8, fps, config: { damping: 16 } });
  const iL = Math.max(16, tLula - 4), iB = Math.max(iL + 20, tBols - 4);
  const tl = interpolate(f, [iL, iL + 24], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const tb = interpolate(f, [iB, iB + 16], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const troca = Math.max(iB + 30, flavio - 6);
  const sai1 = interpolate(f, [troca - 8, troca + 4], [1, 0], claro);
  const cinza = interpolate(f, [4, 30], [0, 1], claro);
  const escuro = interpolate(f, [0, 30, troca - 6, troca + 10], [0.25, 0.72, 0.72, 0.86], claro);
  const plano = spring({ frame: f - troca - 2, fps, config: { damping: 16 } });
  const tc = troca + 14;
  const carimbo = spring({ frame: f - tc, fps, config: { damping: 9, stiffness: 160 } });
  const tremor = f >= tc + 6 && f < tc + 16 ? Math.sin(f * 3) * 10 * (1 - (f - tc - 6) / 10) : 0;
  const emRisco = spring({ frame: f - Math.max(tc + 12, risco - 4), fps, config: { damping: 12, stiffness: 150 } });
  const ALTURA = 360;
  const colunas = [
    [BOLS, tb, '#8d939c', '#d5d8dd', 110, 'GOVERNO BOLSONARO', '2019 A 2022', 'POUCO MAIS DE'],
    [LULA, tl, VERDE, COR.branco, 150, 'GOVERNO LULA', '2023 A 2026', 'QUASE'],
  ] as const;
  return (
    <AbsoluteFill style={{ transform: `translateX(${tremor}px)` }}>
      <Foto arquivo={fundo} cinza={cinza} escuro={escuro} zoom={[1.0, 1.12]} dur={360} foco="55% 45%" />
      <AbsoluteFill style={{ opacity: sai1 }}>
        {/* a fala começa ligando a aposentadoria ao salário mínimo; o "acima da inflação" entra com as barras */}
        <div style={{ position: 'absolute', top: 150, left: 60, right: 60, textAlign: 'center', opacity: entra, transform: `translateY(${(1 - entra) * 40}px)` }}>
          <div style={{ ...MONT, fontSize: 40, letterSpacing: 3, color: COR.amarelo, lineHeight: 1.2 }}>A APOSENTADORIA É AJUSTADA<br />JUNTO COM O</div>
          <div style={{ ...ARCHIVO, fontSize: 112, color: COR.branco, marginTop: 10, textShadow: '0 6px 20px rgba(0,0,0,.5)' }}>SALÁRIO MÍNIMO</div>
          <div style={{ ...MONT, fontSize: 40, letterSpacing: 4, color: COR.branco, marginTop: 6, opacity: Math.min(1, tl * 3) }}>ACIMA DA INFLAÇÃO</div>
        </div>
        <div style={{ position: 'absolute', left: 90, right: 90, top: 470, height: 520, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {colunas.map(([n, t, cor, corNum, tam, , , antes], k) => (
            <div key={k} style={{ width: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: Math.min(1, t * 4) }}>
              <div style={{ ...MONT, fontSize: 30, color: corNum, letterSpacing: 2 }}>{antes}</div>
              <div style={{ ...ARCHIVO, fontSize: tam, color: corNum, marginBottom: 14, textShadow: '0 4px 14px rgba(0,0,0,.55)' }}>+{Math.round(n * t)}%</div>
              <div style={{ width: 220, height: Math.max(t > 0 ? 8 : 0, ((ALTURA * n) / LULA) * t), background: cor, borderRadius: '14px 14px 0 0' }} />
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 90, right: 90, top: 990, height: 4, background: 'rgba(255,255,255,.4)', opacity: entra }} />
        <div style={{ position: 'absolute', left: 90, right: 90, top: 1010, display: 'flex', justifyContent: 'space-between', opacity: entra }}>
          {colunas.map(([, , , , , nome, anos], k) => (
            <div key={k} style={{ ...MONT, width: 400, textAlign: 'center', fontSize: k ? 30 : 28, color: k ? '#4ade80' : '#d5d8dd', letterSpacing: 1.5, lineHeight: 1.2 }}>{nome}<br />{anos}</div>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: f >= troca - 4 ? 1 : 0 }}>
        <div style={{ position: 'absolute', top: 360, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ ...MONT, fontSize: 50, letterSpacing: 4, color: COR.amarelo, opacity: plano, transform: `translateY(${(1 - plano) * 30}px)` }}>PLANO DE FLÁVIO BOLSONARO</div>
          <div
            style={{
              ...ARCHIVO, fontSize: 250, color: COR.branco, display: 'inline-block', marginTop: 40, padding: '30px 50px 10px', background: 'rgba(127,20,20,.55)',
              border: `14px solid ${COR.vermelho}`, borderRadius: 24, transform: `rotate(-6deg) scale(${interpolate(carimbo, [0, 1], [2.2, 1])})`, opacity: Math.min(1, carimbo * 2),
            }}
          >
            R$ 250 BI
          </div>
          <div style={{ ...MONT, fontSize: 56, color: COR.branco, marginTop: 50, opacity: carimbo }}>em cortes</div>
          <div style={{ marginTop: 50 }}>
            <span style={{ ...ARCHIVO, display: 'inline-block', fontSize: 84, color: '#fff', background: COR.vermelho, padding: '14px 30px 4px', borderRadius: 12, opacity: Math.min(1, emRisco * 2), transform: `rotate(-3deg) scale(${interpolate(emRisco, [0, 1], [1.6, 1])})` }}>
              APOSENTADOS EM RISCO
            </span>
          </div>
        </div>
      </AbsoluteFill>
      <Fonte texto={fonte} />
    </AbsoluteFill>
  );
};

export const InfoInssCena: React.FC<InfoInss> = (p) => (p.tipo === 'inss_dado' ? <Dado {...p} /> : <Corte {...p} />);

// Uma cena avulsa (peça do meio do vídeo): entra e sai em fusão a partir do fundo, como a Historia com entraPrimeira
const FUSAO = 18;
export type InssProps = { dur: number; info: InfoInss | Info };

export const InssInfo: React.FC<InssProps> = ({ dur, info }) => {
  carregarFontes();
  const f = useCurrentFrame();
  const op = interpolate(f, [0, FUSAO, dur - FUSAO, dur], [0, 1, 1, 0], claro);
  return (
    <AbsoluteFill style={{ background: COR.fundo }}>
      <AbsoluteFill style={{ opacity: op }}>
        {info.tipo.startsWith('inss_') ? <InfoInssCena {...(info as InfoInss)} /> : <InfoFarmacia {...(info as Info)} />}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const InssRoot: React.FC = () => (
  <Composition
    id="InssInfo"
    component={InssInfo}
    durationInFrames={240}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={{ dur: 240, info: { tipo: 'fecho', fundo: '' } } as InssProps}
    calculateMetadata={({ props }) => ({ durationInFrames: props.dur })}
  />
);
