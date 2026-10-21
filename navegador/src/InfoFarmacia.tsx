// Cenas de infográfico do vídeo "A insulina do Seu Raimundo" (Farmácia Popular), no lugar de um clipe da história:
// 'dado' (foto da cidade inteira com o alfinete, depois um cartão claro sobe com o contador de atendidos e o
// pictograma "1 em cada N moradores"), 'corte' (a farmácia da história perde a cor enquanto a barra da Farmácia
// Popular perde 59%, depois escurece para o carimbo dos R$ 250 bi) e 'fecho' (a rua colorida, que só escurece um pouco,
// e o pedido de compartilhamento). A legenda da Historia fica embaixo (bottom 390): o desenho ocupa até ~1380 px.
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COR, src } from './Saude';

export type Info =
  // local: rótulo do alfinete ("São Paulo - SP", ou o estado quando a cidade não tem farmácia credenciada)
  | { tipo: 'dado'; local: string; atendidos: number; populacao: number; mes: string; fundo: string; fonte: string }
  | { tipo: 'corte'; troca: number; fundo: string; fonte: string } // troca = frame em que a fala passa para o plano de R$ 250 bi
  | { tipo: 'fecho'; fundo: string };

const ARCHIVO: React.CSSProperties = { fontFamily: 'Archivo', fontWeight: 900, fontStretch: '75%', lineHeight: 0.92 };
const MONT: React.CSSProperties = { fontFamily: 'Montserrat', fontWeight: 700 };
const VERDE = '#16A34A';
const CARTAO = '#F7F4EC'; // papel claro, quente como a luz dos clipes
// no navegador o vídeo sai direto em 1,25x: as animações andam no mesmo ritmo do vídeo aprovado
const RITMO = 1.25;
const claro = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Imagem de fundo em tela cheia, com aproximação lenta; cinza (0 a 1) e escuro (0 a 1) animáveis por quem chama
const Foto: React.FC<{ arquivo: string; cinza?: number; escuro?: number; zoom?: [number, number]; dur?: number; foco?: string }> = ({
  arquivo, cinza = 0, escuro = 0, zoom = [1.04, 1.12], dur = 240, foco = '50% 50%',
}) => {
  const f = useCurrentFrame() * RITMO;
  return (
    <AbsoluteFill style={{ background: COR.fundo }}>
      <Img
        src={src(arquivo)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transformOrigin: foco, transform: `scale(${interpolate(f, [0, dur], zoom, claro)})`, filter: `grayscale(${cinza}) contrast(${1 + 0.1 * cinza})` }}
      />
      <AbsoluteFill style={{ background: `rgba(11,17,32,${escuro})` }} />
    </AbsoluteFill>
  );
};

const Fonte: React.FC<{ texto: string; cor?: string }> = ({ texto, cor = 'rgba(255,255,255,.6)' }) => (
  <div style={{ ...MONT, fontWeight: 500, position: 'absolute', left: 60, right: 60, bottom: 300, fontSize: 24, color: cor, textAlign: 'center' }}>{texto}</div>
);

// Pessoa simples (cabeça + tronco) para o pictograma
const Pessoa: React.FC<{ cor: string; tam: number }> = ({ cor, tam }) => (
  <svg width={tam} height={tam * 1.25} viewBox="0 0 40 50">
    <circle cx="20" cy="11" r="9" fill={cor} />
    <path d="M4 50 Q4 24 20 24 Q36 24 36 50 Z" fill={cor} />
  </svg>
);

const Alfinete: React.FC<{ tam: number; cor: string }> = ({ tam, cor }) => (
  <svg width={tam} height={tam * 1.33} viewBox="0 0 24 32">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill={cor} />
    <circle cx="12" cy="12" r="5" fill="#fff" />
  </svg>
);

// "576", "550 mil", "1,2 milhão": o número do cartão no mesmo arredondamento da fala
function numero(v: number): [string, string] {
  if (v < 1000) return [String(Math.round(v)), ''];
  if (v < 1e6) return [Math.round(v / 1000).toLocaleString('pt-BR'), 'mil'];
  const m = Math.round(v / 1e5) / 10;
  return [m.toLocaleString('pt-BR'), m < 2 ? 'milhão' : 'milhões'];
}

const Dado: React.FC<Extract<Info, { tipo: 'dado' }>> = ({ local, atendidos, populacao, mes, fundo, fonte }) => {
  const f = useCurrentFrame() * RITMO;
  const { fps } = useVideoConfig();
  // 1º tempo (0-30): a foto inteira, colorida, e o alfinete caindo com o nome da cidade
  const pino = spring({ frame: f - 6, fps, config: { damping: 9, stiffness: 140 } });
  const rotulo = spring({ frame: f - 16, fps, config: { damping: 16 } });
  // 2º tempo: o cartão sobe e a cidade fica no terço de cima
  const sobe = spring({ frame: f - 30, fps, config: { damping: 18, stiffness: 90 } });
  const topoCartao = interpolate(sobe, [0, 1], [1920, 600]);
  const pinoY = interpolate(sobe, [0, 1], [760, 300]);
  const conta = interpolate(f, [42, 95], [0, atendidos], { ...claro, easing: Easing.out(Easing.cubic) });
  const [num, unidade] = numero(f >= 95 ? atendidos : conta);
  const n = Math.max(2, Math.round(populacao / atendidos)); // "1 em cada N"
  const grade = n <= 30; // acima disso o pictograma não cabe: fica só a frase, maior
  const colunas = Math.min(8, Math.ceil(n / 3));
  const iniPicto = 80;
  const fimPicto = iniPicto + n * 1.4;
  const acende = interpolate(f, [fimPicto + 4, fimPicto + 14], [0, 1], claro);
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
            {atendidos === 1 ? 'pessoa pegou' : 'pessoas pegaram'} remédio <span style={{ background: VERDE, color: '#fff', padding: '0 14px', borderRadius: 10 }}>de graça</span>
            <br />
            em {mes}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 28 }}>
          <div style={{ display: grade ? 'grid' : 'none', gridTemplateColumns: `repeat(${colunas}, 1fr)`, gap: '6px 18px' }}>
            {Array.from({ length: n }, (_, i) => {
              const t = spring({ frame: f - iniPicto - i * 1.4, fps, config: { damping: 14 } });
              const destaque = i === 0;
              return (
                <div key={i} style={{ transform: `scale(${t * (destaque ? 1 + 0.3 * acende : 1)})`, opacity: t }}>
                  <Pessoa cor={destaque && acende > 0.5 ? VERDE : 'rgba(11,17,32,.22)'} tam={50} />
                </div>
              );
            })}
          </div>
          <div style={{ ...MONT, fontSize: grade ? 44 : 60, color: COR.fundo, marginTop: grade ? 14 : 60, opacity: grade ? acende : interpolate(f, [80, 96], [0, 1], claro) }}>
            <span style={{ color: VERDE }}>1 em cada {n.toLocaleString('pt-BR')}</span> moradores
          </div>
        </div>
      </div>
      <Fonte texto={fonte} cor="rgba(11,17,32,.55)" />
    </AbsoluteFill>
  );
};

const Corte: React.FC<Extract<Info, { tipo: 'corte' }>> = ({ troca, fundo, fonte }) => {
  const f = useCurrentFrame() * RITMO;
  const { fps } = useVideoConfig();
  // 1º tempo: a farmácia da história, colorida; a barra entra e a tesoura leva 59%, tirando a cor da cena junto
  const entra = spring({ frame: f - 10, fps, config: { damping: 16 } });
  const corta = interpolate(f, [34, 62], [0, 1], { ...claro, easing: Easing.inOut(Easing.cubic) });
  const sai1 = interpolate(f, [troca - 8, troca + 4], [1, 0], claro);
  // 2º tempo: a cena escurece e o R$ 250 bi é carimbado
  const carimbo = spring({ frame: f - troca - 4, fps, config: { damping: 9, stiffness: 160 } });
  const escuro = interpolate(f, [0, 12, troca - 6, troca + 8], [0, 0.35, 0.45, 0.78], claro);
  const tremor = f >= troca && f < troca + 10 ? Math.sin(f * 3) * 10 * (1 - (f - troca) / 10) : 0;
  const larg = 860;
  return (
    <AbsoluteFill style={{ transform: `translateX(${tremor}px)` }}>
      <Foto arquivo={fundo} cinza={corta} escuro={escuro} zoom={[1.0, 1.15]} dur={330} foco="60% 40%" />
      <AbsoluteFill style={{ background: `rgba(220,38,38,${0.12 * corta * sai1})` }} />
      <AbsoluteFill style={{ opacity: sai1 }}>
        <div style={{ position: 'absolute', top: 280, left: 60, right: 60, textAlign: 'center', opacity: entra, transform: `translateY(${(1 - entra) * 50}px)` }}>
          <div style={{ display: 'inline-block', ...MONT, fontSize: 50, color: COR.branco, background: 'rgba(11,17,32,.8)', padding: '10px 26px', borderRadius: 12 }}>Verba da Farmácia Popular</div>
          <div style={{ position: 'relative', width: larg, height: 170, margin: '36px auto 0', borderRadius: 20, overflow: 'hidden', background: 'rgba(255,255,255,.2)', boxShadow: '0 12px 30px rgba(0,0,0,.4)' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: larg * entra, background: VERDE }} />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: larg * 0.59 * corta, background: COR.vermelho }} />
            <div style={{ position: 'absolute', right: larg * 0.59 * corta - 3, top: -10, bottom: -10, width: 6, background: COR.branco, opacity: corta > 0 && corta < 1 ? 1 : 0 }} />
          </div>
          <div style={{ ...ARCHIVO, fontSize: 330, color: COR.branco, marginTop: 50, opacity: corta, transform: `scale(${0.8 + 0.2 * corta})`, textShadow: `0 0 0 ${COR.vermelho}, 0 14px 0 ${COR.vermelhoEscuro}` }}>−59%</div>
          <div style={{ display: 'inline-block', ...MONT, fontSize: 46, color: COR.branco, background: 'rgba(11,17,32,.8)', padding: '8px 24px', borderRadius: 12, opacity: corta }}>foi o corte que Bolsonaro tentou</div>
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

const Fecho: React.FC<Extract<Info, { tipo: 'fecho' }>> = ({ fundo }) => {
  const f = useCurrentFrame() * RITMO;
  const { fps } = useVideoConfig();
  const a = spring({ frame: f - 16, fps, config: { damping: 14 } });
  const b = spring({ frame: f - 28, fps, config: { damping: 12 } });
  const pulso = 1 + 0.04 * Math.sin(f / 6);
  return (
    <AbsoluteFill>
      <Foto arquivo={fundo} escuro={interpolate(f, [8, 30], [0, 0.45], claro)} zoom={[1.0, 1.08]} dur={210} foco="45% 35%" />
      <div style={{ position: 'absolute', top: 330, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 300, height: 300, borderRadius: 150, background: VERDE, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${a * pulso})`, boxShadow: '0 16px 40px rgba(0,0,0,.4)' }}>
          <svg width="170" height="170" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
          </svg>
        </div>
        <div style={{ ...ARCHIVO, fontSize: 150, color: COR.branco, marginTop: 60, opacity: b, transform: `translateY(${(1 - b) * 40}px)`, textShadow: '0 8px 24px rgba(0,0,0,.5)' }}>COMPARTILHE</div>
        <div style={{ ...MONT, fontSize: 44, color: COR.branco, marginTop: 24, opacity: b, background: 'rgba(22,163,74,.9)', padding: '8px 24px', borderRadius: 12 }}>Farmácia Popular é direito seu</div>
      </div>
    </AbsoluteFill>
  );
};

export const InfoFarmacia: React.FC<Info> = (p) => (p.tipo === 'dado' ? <Dado {...p} /> : p.tipo === 'corte' ? <Corte {...p} /> : <Fecho {...p} />);
