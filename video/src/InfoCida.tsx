// Cenas de infográfico do vídeo "A visita da Cida" (dinheiro do SUS para a cidade), irmãs das do InfoHistoria.tsx:
// 'cida_dado' (foto da cidade inteira com o alfinete, depois o cartão claro sobe com duas barras do dinheiro do SUS por
// ano, o governo Bolsonaro em cinza e o governo Lula em verde, e o selo do aumento) e 'cida_corte' (o último quadro do
// clipe da pressão perde a cor; as barras do Brasil, R$ 90 bi contra R$ 123 bi; depois escurece para o carimbo dos
// R$ 250 bi). Os valores chegam já escritos ("R$ 7,5 MI", "R$ 17 BI"), com o mesmo arredondamento da fala.
// A fala diz primeiro o valor de Lula e depois o governo Bolsonaro: cada barra aparece junto da palavra (tAgora, tAntes).
// O fecho é o 'fecho' do InfoFarmacia com a frase do programa. Desenho até ~1380 px: a legenda fica embaixo.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COR } from './Saude';
import { Alfinete, ARCHIVO, CARTAO, claro, Fonte, Foto, MONT, VERDE } from './InfoFarmacia';

export type InfoCidaT =
  // local: rótulo do alfinete ("Irajuba - BA", o estado ou "Brasil"); antes/agora em reais por ano (altura das barras)
  | { tipo: 'cida_dado'; local: string; antes: number; agora: number; cartaoAntes: string; cartaoAgora: string; selo: string; tAgora: number; tAntes: number; fundo: string; fonte: string }
  // tA, tB, flavio, t250: frames em que a fala chega no 90, no 123, em "Flávio" e no "250"; soCorte: quem já ouviu o Brasil
  | { tipo: 'cida_corte'; soCorte: boolean; tA: number; tB: number; flavio: number; t250: number; ameaca: number; fundo: string; fonte: string };

const CINZA = '#9AA1AB';

// Uma barra com o valor em cima, crescendo de t = 0 a 1
const Barra: React.FC<{ rotulo: string; t: number; altura: number; cor: string; corNum: string; tamNum: number; sombra?: boolean }> = ({
  rotulo, t, altura, cor, corNum, tamNum, sombra,
}) => (
  <div style={{ width: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
    <div style={{ ...ARCHIVO, fontSize: tamNum, color: corNum, marginBottom: 16, whiteSpace: 'nowrap', opacity: Math.min(1, t * 3), transform: `scale(${interpolate(t, [0, 1], [0.7, 1])})`, textShadow: sombra ? '0 4px 14px rgba(0,0,0,.55)' : undefined }}>{rotulo}</div>
    <div style={{ width: 220, height: Math.max(t > 0 ? 6 : 0, altura * t), background: cor, borderRadius: '14px 14px 0 0' }} />
  </div>
);

const Dado: React.FC<Extract<InfoCidaT, { tipo: 'cida_dado' }>> = ({ local, antes, agora, cartaoAntes, cartaoAgora, selo, tAgora, tAntes, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1º tempo: a foto inteira, colorida, e o alfinete caindo com o nome do lugar
  const pino = spring({ frame: f - 6, fps, config: { damping: 9, stiffness: 140 } });
  const rotulo = spring({ frame: f - 16, fps, config: { damping: 16 } });
  // 2º tempo: o cartão sobe pouco antes do valor de Lula; depois a barra de Bolsonaro e o selo
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
  const ALTURA = 330;
  const tam = (s: string, base: number) => Math.min(base, Math.round((base * 7.5) / Math.max(7.5, s.length)));
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
          <span style={{ ...MONT, fontSize: 40, color: '#fff', background: VERDE, padding: '8px 24px', borderRadius: 12, letterSpacing: 2 }}>DINHEIRO DO SUS</span>
          <div style={{ ...MONT, fontWeight: 500, fontSize: 32, color: '#3a4150', marginTop: 22 }}>por ano, já descontada a inflação</div>
        </div>
        <div style={{ position: 'absolute', left: 50, right: 50, top: 170, height: 410, display: 'flex', justifyContent: 'space-between' }}>
          <Barra rotulo={cartaoAntes} t={tA} altura={agora ? (ALTURA * antes) / agora : 0} cor={CINZA} corNum="#7d838d" tamNum={tam(cartaoAntes, 92)} />
          <div style={{ transform: `scale(${1 + 0.1 * Math.sin(Math.PI * Math.min(1, pulo))})`, transformOrigin: '50% 100%' }}>
            <Barra rotulo={cartaoAgora} t={tB} altura={ALTURA} cor={VERDE} corNum={COR.fundo} tamNum={tam(cartaoAgora, 120)} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 60, right: 60, top: 582, height: 4, background: '#d9d4c7' }} />
        <div style={{ position: 'absolute', left: 50, right: 50, top: 596, display: 'flex', justifyContent: 'space-between', opacity: legenda }}>
          <div style={{ ...MONT, width: 440, textAlign: 'center', fontSize: 28, color: '#5f6672', letterSpacing: 1.5, lineHeight: 1.1 }}>GOVERNO BOLSONARO<br />2019 A 2022</div>
          <div style={{ ...MONT, width: 440, textAlign: 'center', fontSize: 32, color: VERDE, letterSpacing: 1.5, lineHeight: 1.1 }}>GOVERNO LULA<br />DESDE 2023</div>
        </div>
        {/* o selo acaba antes de ~1380 px da tela: dali para baixo é a legenda */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 680, textAlign: 'center' }}>
          <span style={{ ...ARCHIVO, display: 'inline-block', fontSize: 58, color: '#fff', background: VERDE, padding: '12px 30px 4px', borderRadius: 12, opacity: Math.min(1, carimbo * 2), transform: `rotate(-3deg) scale(${interpolate(carimbo, [0, 1], [1.6, 1])})` }}>
            {selo.toUpperCase()}
          </span>
        </div>
      </div>
      <AbsoluteFill style={{ opacity: legenda }}><Fonte texto={fonte} cor="rgba(11,17,32,.55)" /></AbsoluteFill>
    </AbsoluteFill>
  );
};

const Corte: React.FC<Extract<InfoCidaT, { tipo: 'cida_corte' }>> = ({ soCorte, tA, tB, flavio, t250, ameaca, fundo, fonte }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1º tempo (quem não ouviu o Brasil antes): a cena perde a cor; as barras do Brasil, cada uma no número dela
  const entra = spring({ frame: f - 8, fps, config: { damping: 16 } });
  const iA = Math.max(16, tA - 4), iB = Math.max(iA + 14, tB - 4);
  const ta = interpolate(f, [iA, iA + 16], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const tb = interpolate(f, [iB, iB + 24], [0, 1], { ...claro, easing: Easing.out(Easing.cubic) });
  const carSelo = spring({ frame: f - iB - 26, fps, config: { damping: 10, stiffness: 170 } });
  const troca = soCorte ? 0 : Math.max(iB + 50, flavio - 6);
  const sai1 = soCorte ? 0 : interpolate(f, [troca - 8, troca + 4], [1, 0], claro);
  // 2º tempo: escurece mais, o R$ 250 bi é carimbado e o SUS fica ameaçado
  const cinza = interpolate(f, [4, 30], [0, 1], claro);
  const escuro = soCorte ? interpolate(f, [0, 16], [0.3, 0.86], claro) : interpolate(f, [0, 30, troca - 6, troca + 10], [0.25, 0.72, 0.72, 0.86], claro);
  const plano = spring({ frame: f - troca - 2, fps, config: { damping: 16 } });
  const tc = Math.max(troca + 12, t250 - 4);
  const carimbo = spring({ frame: f - tc, fps, config: { damping: 9, stiffness: 160 } });
  const tremor = f >= tc + 6 && f < tc + 16 ? Math.sin(f * 3) * 10 * (1 - (f - tc - 6) / 10) : 0;
  const risco = spring({ frame: f - Math.max(tc + 20, ameaca - 4), fps, config: { damping: 14 } });
  const ALTURA = 340;
  return (
    <AbsoluteFill style={{ transform: `translateX(${tremor}px)` }}>
      <Foto arquivo={fundo} cinza={cinza} escuro={escuro} zoom={[1.0, 1.12]} dur={360} foco="55% 45%" />
      <AbsoluteFill style={{ opacity: sai1 }}>
        <div style={{ position: 'absolute', top: 200, left: 60, right: 60, textAlign: 'center', opacity: entra, transform: `translateY(${(1 - entra) * 40}px)` }}>
          <div style={{ ...MONT, fontSize: 44, letterSpacing: 5, color: COR.amarelo }}>NO BRASIL</div>
          <div style={{ ...ARCHIVO, fontSize: 96, color: COR.branco, marginTop: 10, textShadow: '0 6px 20px rgba(0,0,0,.5)' }}>DINHEIRO DO SUS</div>
          <div style={{ ...MONT, fontWeight: 500, fontSize: 34, color: '#e5e7eb', marginTop: 6 }}>para as cidades, por ano</div>
        </div>
        <div style={{ position: 'absolute', left: 90, right: 90, top: 520, height: 470, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Barra rotulo="R$ 90 BI" t={ta} altura={(ALTURA * 89.9) / 122.8} cor="#8d939c" corNum="#d5d8dd" tamNum={92} sombra />
          <Barra rotulo="R$ 123 BI" t={tb} altura={ALTURA} cor={VERDE} corNum={COR.branco} tamNum={120} sombra />
        </div>
        <div style={{ position: 'absolute', left: 90, right: 90, top: 990, height: 4, background: 'rgba(255,255,255,.4)', opacity: entra }} />
        <div style={{ position: 'absolute', left: 90, right: 90, top: 1010, display: 'flex', justifyContent: 'space-between', opacity: entra }}>
          <div style={{ ...MONT, width: 400, textAlign: 'center', fontSize: 28, color: '#d5d8dd', letterSpacing: 1.5, lineHeight: 1.2 }}>GOVERNO BOLSONARO<br />2019 A 2022</div>
          <div style={{ ...MONT, width: 400, textAlign: 'center', fontSize: 30, color: '#4ade80', letterSpacing: 1.5, lineHeight: 1.2 }}>GOVERNO LULA<br />DESDE 2023</div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1110, textAlign: 'center' }}>
          <span style={{ ...ARCHIVO, display: 'inline-block', fontSize: 90, color: '#fff', background: VERDE, padding: '14px 34px 4px', borderRadius: 14, opacity: Math.min(1, carSelo * 2), transform: `rotate(-3deg) scale(${interpolate(carSelo, [0, 1], [1.7, 1])})` }}>+37%</span>
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
            SUS AMEAÇADO
          </div>
        </div>
      </AbsoluteFill>
      <Fonte texto={fonte} />
    </AbsoluteFill>
  );
};

export const InfoCida: React.FC<InfoCidaT> = (p) => (p.tipo === 'cida_dado' ? <Dado {...p} /> : <Corte {...p} />);
