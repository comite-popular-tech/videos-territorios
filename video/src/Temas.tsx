// Vídeos verticais dos outros temas do acervo, no mesmo molde do de Saúde (Saude.tsx): 5 cenas com locução, legenda
// palavra por palavra e trilha. Abertura, corte do Flávio e fecho são os mesmos; mudam a cena do número e a do fato.
//   Escola: card p3 (educação infantil): a pré-escola do território e o veto de Bolsonaro ao reajuste da merenda.
//   Aposentados: card p5: aposentados do INSS na cidade e o salário mínimo com Lula e com Bolsonaro.
import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ARCHIVO, MONTSERRAT } from './fontes';
import { Abertura, COR, Cena, Corte, Fecho, Montagem, SaudeProps, milhares, naPalavra, useSaida } from './Saude';

export type TemaProps = SaudeProps & {
  escola?: string; // "Escola Carlos de Laet"
  escolaOnde?: string; // "no bairro Parque Regina", "no Centro"
  criancas?: number; // matrículas na pré-escola
  turmas?: number;
  docentes?: number;
  aposentados?: string; // "1,2 mil", como no card
  aposResto?: string; // "aposentados" ou "de aposentados" (depois de milhão)
  inssMes?: number; // R$ por mês de benefícios do INSS na cidade
};
type CenaT = React.FC<TemaProps & { dur: number; leg?: Palavra[] }>;
type Palavra = [number, number, string];

const B: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <b style={{ color: COR.amarelo, fontWeight: 900 }}>{children}</b>
);

// ---------------------------------------------------------------- Escola
const EscolaNumero: CenaT = ({ escola, escolaOnde, criancas = 0, turmas = 0, docentes = 0, dur, leg }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame: f, fps, config: { damping: 20 } });
  const conta = interpolate(f, [10, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const n = Math.round(criancas * (1 - Math.pow(1 - conta, 3)));
  const segunda = spring({ frame: f - naPalavra(leg, 'turmas', dur, 0.6) + 4, fps, config: { damping: 18 } });
  return (
    <AbsoluteFill style={{ background: COR.fundo, color: COR.branco, padding: '0 80px', justifyContent: 'center', opacity: useSaida(dur) }}>
      <div style={{ marginTop: -220 }}>
        <div style={{ ...MONTSERRAT, fontWeight: 700, fontSize: 46, lineHeight: 1.25, opacity: entra, transform: `translateY(${(1 - entra) * 40}px)` }}>
          Na <B>{escola}</B>{escolaOnde ? `, ${escolaOnde}` : ''}
        </div>
        <div style={{ ...ARCHIVO, color: COR.amarelo, fontSize: 300, marginTop: 20, opacity: entra }}>{n.toLocaleString('pt-BR')}</div>
        <div style={{ ...MONTSERRAT, fontWeight: 700, fontSize: 56, opacity: entra }}>crianças na pré-escola</div>
        {turmas > 0 && (
          <div style={{ marginTop: 70, opacity: segunda, transform: `translateY(${(1 - segunda) * 60}px)`, borderTop: '6px solid ' + COR.vermelho, paddingTop: 36 }}>
            <div style={{ ...MONTSERRAT, fontWeight: 600, fontSize: 44, lineHeight: 1.3 }}>
              <B>{turmas} {turmas === 1 ? 'turma' : 'turmas'}</B>
              {docentes > 0 && <> e <B>{docentes} {docentes === 1 ? 'professor' : 'professores'}</B></>}
              {' '}na pré-escola.
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

const Merenda: CenaT = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const texto = spring({ frame: f, fps, config: { damping: 20 } });
  const big = spring({ frame: f - 18, fps, config: { damping: 10, stiffness: 160 } });
  return (
    <AbsoluteFill style={{ background: COR.vermelho, color: COR.branco, padding: '0 80px', justifyContent: 'center', opacity: useSaida(dur) }}>
      <div style={{ marginTop: -260 }}>
        <div style={{ ...MONTSERRAT, fontWeight: 700, fontSize: 56, lineHeight: 1.25, opacity: texto, transform: `translateY(${(1 - texto) * 50}px)` }}>
          Bolsonaro já
        </div>
        <div style={{ ...ARCHIVO, fontSize: 260, color: COR.amarelo, transform: `scale(${big})`, transformOrigin: 'left center', marginTop: 10, textShadow: '0 10px 0 rgba(0,0,0,.25)' }}>VETOU</div>
        <div style={{ ...MONTSERRAT, fontWeight: 600, fontSize: 56, lineHeight: 1.25, opacity: big }}>
          o reajuste da <b style={{ fontWeight: 900 }}>merenda escolar</b> em 2022.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Aposentados
const AposNumero: CenaT = ({ cidade, aposentados = '', aposResto = 'aposentados', inssMes = 0, dur, leg }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame: f, fps, config: { damping: 20 } });
  const pop = spring({ frame: f - 8, fps, config: { damping: 11, stiffness: 150 } });
  const [num, ...suf] = aposentados.split(' ');
  const mes = inssMes >= 1e9 ? { num: (Math.round(inssMes / 1e8) / 10).toLocaleString('pt-BR'), sufixo: inssMes < 2e9 ? 'bilhão' : 'bilhões' } : milhares(inssMes);
  const segunda = spring({ frame: f - naPalavra(leg, 'mês', dur, 0.5) + 4, fps, config: { damping: 18 } });
  return (
    <AbsoluteFill style={{ background: COR.fundo, color: COR.branco, padding: '0 80px', justifyContent: 'center', opacity: useSaida(dur) }}>
      <div style={{ marginTop: -220 }}>
        <div style={{ ...MONTSERRAT, fontWeight: 700, fontSize: 46, opacity: entra, transform: `translateY(${(1 - entra) * 40}px)` }}>Em {cidade},</div>
        <div style={{ ...ARCHIVO, color: COR.amarelo, display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 10, transform: `scale(${pop})`, transformOrigin: 'left center' }}>
          <span style={{ fontSize: 280 }}>{num}</span>
          <span style={{ fontSize: 120 }}>{suf.join(' ')}</span>
        </div>
        <div style={{ ...MONTSERRAT, fontWeight: 700, fontSize: 56, opacity: entra }}>{aposResto} vivem do INSS</div>
        {inssMes > 0 && (
          <div style={{ marginTop: 70, opacity: segunda, transform: `translateY(${(1 - segunda) * 60}px)`, borderTop: '6px solid ' + COR.vermelho, paddingTop: 36 }}>
            <div style={{ ...MONTSERRAT, fontWeight: 600, fontSize: 44, lineHeight: 1.3 }}>
              Todo mês, <B>R$ {mes.num} {mes.sufixo}</B> do INSS entram na cidade e giram na farmácia e no mercado.
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Aumento real do salário mínimo: quase 12% com Lula (2023 a 2026) contra pouco mais de 1% com Bolsonaro (2019 a 2022)
const Minimo: CenaT = ({ dur, leg }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titulo = spring({ frame: f, fps, config: { damping: 20 } });
  const lula = spring({ frame: f - 12, fps, config: { damping: 16, stiffness: 90 } });
  const bolso = spring({ frame: f - naPalavra(leg, 'bolsonaro', dur, 0.5), fps, config: { damping: 16, stiffness: 90 } });
  const Barra: React.FC<{ nome: string; valor: string; pct: number; cor: string; t: number }> = ({ nome, valor, pct, cor, t }) => (
    <div style={{ marginTop: 50, opacity: t }}>
      <div style={{ ...MONTSERRAT, fontWeight: 800, fontSize: 52, display: 'flex', justifyContent: 'space-between' }}>
        <span>{nome}</span>
        <span style={{ ...ARCHIVO, fontSize: 90, color: cor }}>{valor}</span>
      </div>
      <div style={{ height: 70, background: 'rgba(255,255,255,.12)', marginTop: 10 }}>
        <div style={{ height: '100%', width: `${pct * t}%`, background: cor }} />
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: COR.fundo, color: COR.branco, padding: '0 80px', justifyContent: 'center', opacity: useSaida(dur) }}>
      <div style={{ marginTop: -300 }}>
        <div style={{ ...MONTSERRAT, fontWeight: 700, fontSize: 50, lineHeight: 1.25, opacity: titulo }}>
          Quanto o <B>salário mínimo</B> subiu acima da inflação
        </div>
        <Barra nome="Com Lula" valor="quase 12%" pct={100} cor={COR.amarelo} t={lula} />
        <Barra nome="Com Bolsonaro" valor="+1%" pct={9} cor={COR.vermelho} t={bolso} />
      </div>
    </AbsoluteFill>
  );
};

const ESCOLA = [Abertura, EscolaNumero, Merenda, Corte, Fecho] as Cena[];
const APOSENTADOS = [Abertura, AposNumero, Minimo, Corte, Fecho] as Cena[];
export const Escola: React.FC<TemaProps> = (p) => <Montagem {...p} cenas={ESCOLA} />;
export const Aposentados: React.FC<TemaProps> = (p) => <Montagem {...p} cenas={APOSENTADOS} />;
