// Vídeo vertical do tema Saúde (UBS): 5 cenas com locução, legenda palavra por palavra e trilha. Funciona também sem
// som (todo dado está na tela). Recebe os dados do card p1 (saida/brasil/<slug>/pedidos.json), a foto da cidade, os
// áudios e o tempo de cada palavra gerados pelo lote. A duração de cada cena vem do tamanho da fala dela (props.duracoes).
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { ARCHIVO, MONTSERRAT, carregarFontes } from './fontes';

// [início em s, duração em s, palavra], relativo ao começo da fala
export type Palavra = [number, number, string];

export type SaudeProps = {
  cidade: string;
  uf: string;
  foto: string; // URL (http) ou arquivo em public/: foto da cidade ou mapa do município
  fundo?: 'foto' | 'mapa';
  fotoCredito: string;
  valorAno: number; // repasse federal da atenção primária, R$/ano
  ubs: number;
  artigo: 'o' | 'a'; // "como o PSF Cajas", "como a USF Japiim"
  unidade: string; // nome da UBS de exemplo; vazio com generica
  bairro?: string; // território de bairro (cidades de 100 mil habitantes para cima): o vídeo fala do bairro
  generica?: boolean; // cidade inteira: "postos de saúde" no lugar de "UBS", sem unidade de exemplo
  manchete?: string[]; // linhas da manchete do card ("Postos de saúde", "de Bujari", "em risco")
  fonte: string;
  duracoes: number[]; // frames de cada cena: abertura, número, farmácia, corte, fecho
  vozes: string[]; // mp3 em public/ ou URL, um por cena; vazio = sem locução
  legendas?: Palavra[][]; // uma lista de palavras por cena; vazio = sem legenda
  trilha: string; // wav/mp3 em public/; vazio = sem trilha
};

export const COR = {
  vermelho: '#DC2626',
  vermelhoEscuro: '#7f1414',
  amarelo: '#F59E0B',
  fundo: '#0B1120',
  branco: '#FFFFFF',
};

export const FPS = 30;
export const PADRAO = [90, 240, 150, 150, 150];
export const ATRASO_VOZ = 8; // frames entre o início da cena e o começo da fala

// "21,8 milhões", "682 mil"
export function milhares(v: number): { num: string; sufixo: string } {
  if (v >= 1e6) {
    const m = Math.round(v / 1e5) / 10;
    return { num: m.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), sufixo: m < 2 ? 'milhão' : 'milhões' };
  }
  if (v >= 1e3) return { num: Math.round(v / 1e3).toLocaleString('pt-BR'), sufixo: 'mil' };
  return { num: Math.round(v).toLocaleString('pt-BR'), sufixo: '' };
}

const Caixa: React.FC<{ cor: string; texto: string; children: React.ReactNode; rot?: number; px?: number }> = ({
  cor, texto, children, rot = -2, px = 96,
}) => (
  <div style={{ display: 'inline-block', transform: `rotate(${rot}deg)`, position: 'relative' }}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.35)', transform: 'translate(14px,14px)' }} />
    <div style={{ position: 'relative', background: cor, color: texto, padding: '18px 40px 10px', ...ARCHIVO, fontSize: px }}>
      {children}
    </div>
  </div>
);

// Arquivo em public/ ou URL do servidor local do lote
export const src = (s: string) => (/^https?:/.test(s) ? s : staticFile(s));

// Tamanho do nome da cidade conforme o comprimento, para nomes longos caberem em até 3 linhas.
const pxNome = (s: string) => (s.length <= 10 ? 190 : s.length <= 16 ? 160 : 130);

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Frame (dentro da cena) em que a fala chega à palavra; sem legenda, uma fração da cena.
const naPalavra = (leg: Palavra[] | undefined, palavra: string, dur: number, fracao: number) => {
  const p = leg?.find((w) => sem(w[2]) === sem(palavra));
  return p ? ATRASO_VOZ + Math.round(p[0] * FPS) : Math.round(dur * fracao);
};

const useSaida = (dur: number) => {
  const f = useCurrentFrame();
  return interpolate(f, [dur - 10, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
};

type Cena = React.FC<SaudeProps & { dur: number; leg?: Palavra[] }>;

const Abertura: Cena = ({ cidade, uf, bairro, foto, fundo, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(f, [0, dur], [1.05, 1.18]);
  const sobe = spring({ frame: f - 8, fps, config: { damping: 14, stiffness: 90 } });
  const faixa = spring({ frame: f - 2, fps, config: { damping: 20 } });
  return (
    <AbsoluteFill style={{ background: COR.fundo, opacity: useSaida(dur) }}>
      {fundo === 'mapa' ? (
        // mapa do município (1600x900): inteiro, numa moldura inclinada sobre o fundo escuro
        <AbsoluteFill style={{ background: `linear-gradient(180deg, ${COR.fundo} 0%, ${COR.vermelhoEscuro} 100%)` }}>
          <div style={{ position: 'absolute', top: 330, left: 50, width: 980, height: 551, transform: 'rotate(-2deg)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', transform: 'translate(18px,18px)' }} />
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', border: '10px solid #fff', background: '#ececec' }}>
              <Img src={src(foto)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})` }} />
            </div>
          </div>
        </AbsoluteFill>
      ) : (
        <>
          <Img src={src(foto)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`, filter: 'brightness(.8) saturate(.9)' }} />
          <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(11,17,32,.1) 30%, rgba(11,17,32,.95) 85%)` }} />
        </>
      )}
      {/* faixa vermelha de urgência no topo */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150, background: COR.vermelho, transform: `translateY(${(1 - faixa) * -160}px)`, display: 'flex', alignItems: 'flex-end', padding: '0 80px 26px' }}>
        <div style={{ ...ARCHIVO, fontSize: 64, color: COR.branco, letterSpacing: 2 }}>ALERTA · SAÚDE</div>
      </div>
      <div style={{ position: 'absolute', left: 80, right: 80, bottom: 520, transform: `translateY(${(1 - sobe) * 200}px)`, opacity: sobe }}>
        {/* o município em destaque; embaixo, pequeno, o bairro (território de bairro) ou a UF */}
        <div style={{ ...ARCHIVO, fontSize: pxNome(cidade), color: COR.branco, lineHeight: 0.95, textShadow: '0 8px 30px rgba(0,0,0,.5)' }}>{cidade}</div>
        <div style={{ ...ARCHIVO, fontSize: bairro ? 70 : 90, color: COR.amarelo, marginTop: 14 }}>{bairro ? `${bairro} - ${uf}` : uf}</div>
      </div>
    </AbsoluteFill>
  );
};

const Numero: Cena = ({ cidade, valorAno, ubs, artigo, unidade, generica, dur, leg }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame: f, fps, config: { damping: 20 } });
  const conta = interpolate(f, [10, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const final = milhares(valorAno);
  const total = conta >= 1 ? final : milhares(valorAno * (1 - Math.pow(1 - conta, 3)));
  const porUbs = milhares(valorAno / Math.max(ubs, 1));
  // a segunda frase entra quando a fala chega em "Em média" (ou no nome da UBS, quando é uma só)
  const segunda = spring({ frame: f - naPalavra(leg, ubs === 1 ? 'para' : 'média', dur, 0.52), fps, config: { damping: 18 } });
  return (
    <AbsoluteFill style={{ background: COR.fundo, color: COR.branco, padding: '0 80px', justifyContent: 'center', opacity: useSaida(dur) }}>
      <div style={{ marginTop: -220 }}>
        <div style={{ ...MONTSERRAT, fontWeight: 700, fontSize: 46, opacity: entra, transform: `translateY(${(1 - entra) * 40}px)` }}>
          {cidade} recebe, por ano, do SUS federal
        </div>
        <div style={{ ...ARCHIVO, color: COR.amarelo, fontSize: 280, marginTop: 20, opacity: entra, display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <span style={{ fontSize: 120 }}>R$</span>
          <span>{total.num}</span>
        </div>
        <div style={{ ...ARCHIVO, color: COR.amarelo, fontSize: 140, opacity: entra }}>{final.sufixo}</div>
        <div style={{ ...MONTSERRAT, fontWeight: 700, fontSize: 46, marginTop: 30, opacity: entra }}>
          {generica ? (
            ubs === 1 ? (
              <>para o <b style={{ color: COR.amarelo, fontWeight: 900 }}>seu posto de saúde</b></>
            ) : (
              <>para os seus <b style={{ color: COR.amarelo, fontWeight: 900 }}>{ubs} postos de saúde</b></>
            )
          ) : ubs === 1 ? (
            <>para a <b style={{ color: COR.amarelo, fontWeight: 900 }}>sua UBS</b></>
          ) : (
            <>para as suas <b style={{ color: COR.amarelo, fontWeight: 900 }}>{ubs} UBS</b></>
          )}
        </div>
        <div style={{ marginTop: 70, opacity: generica && ubs === 1 ? 0 : segunda, transform: `translateY(${(1 - segunda) * 60}px)`, borderTop: '6px solid ' + COR.vermelho, paddingTop: 36 }}>
          <div style={{ ...MONTSERRAT, fontWeight: 600, fontSize: 44, lineHeight: 1.3 }}>
            {generica ? (
              <>Em média, <b style={{ color: COR.amarelo, fontWeight: 900 }}>R$ {porUbs.num} {porUbs.sufixo}</b> para cada um.</>
            ) : ubs === 1 ? (
              <>{artigo === 'o' ? 'O' : 'A'} <b style={{ fontWeight: 900 }}>{unidade}</b>, que atende a cidade.</>
            ) : (
              <>
                Em média, <b style={{ color: COR.amarelo, fontWeight: 900 }}>R$ {porUbs.num} {porUbs.sufixo}</b> para cada uma,
                <br />como {artigo} <b style={{ fontWeight: 900 }}>{unidade}</b>.
              </>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Farmacia: Cena = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const texto = spring({ frame: f, fps, config: { damping: 20 } });
  const pct = spring({ frame: f - 20, fps, config: { damping: 10, stiffness: 160 } });
  return (
    <AbsoluteFill style={{ background: COR.vermelho, color: COR.branco, padding: '0 80px', justifyContent: 'center', opacity: useSaida(dur) }}>
      <div style={{ marginTop: -260 }}>
        <div style={{ ...MONTSERRAT, fontWeight: 700, fontSize: 56, lineHeight: 1.25, opacity: texto, transform: `translateY(${(1 - texto) * 50}px)` }}>
          Bolsonaro já tentou cortar
        </div>
        <div style={{ ...ARCHIVO, fontSize: 340, color: COR.amarelo, transform: `scale(${pct})`, transformOrigin: 'left center', marginTop: 10, textShadow: '0 10px 0 rgba(0,0,0,.25)' }}>59%</div>
        <div style={{ ...MONTSERRAT, fontWeight: 600, fontSize: 56, lineHeight: 1.25, opacity: pct }}>
          da <b style={{ fontWeight: 900 }}>Farmácia Popular</b>, que dá remédio de graça.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// tarja zebrada de atenção
const Tarja: React.FC<{ x: number }> = ({ x }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, background: `repeating-linear-gradient(-45deg, ${COR.amarelo} 0 40px, ${COR.fundo} 40px 80px)`, backgroundPosition: `${x}px 0`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ ...ARCHIVO, fontSize: 60, background: COR.amarelo, color: COR.fundo, padding: '12px 36px 4px' }}>EM RISCO</div>
  </div>
);

// Foto do Flávio com a tesoura (modelos/cidades/arte-flavio-tesoura.jpg, imagem da web: confirmar o direito de uso)
// ao fundo, com o texto num retângulo semitransparente abaixo do rosto.
const Corte: Cena = ({ cidade, manchete, dur, leg }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(f, [0, dur], [1.0, 1.08]);
  const texto = spring({ frame: f - 6, fps, config: { damping: 20 } });
  const valor = spring({ frame: f - 18, fps, config: { damping: 11, stiffness: 150 } });
  // a caixa entra junto com "<cidade> está em risco"
  const caixa = spring({ frame: f - Math.min(naPalavra(leg, 'está', dur, 0.62), naPalavra(leg, 'estão', dur, 0.62)) + 6, fps, config: { damping: 10, stiffness: 150 } });
  // a manchete do card ("AMA Capão Redondo / em risco"); sem ela, "<cidade> está em risco"
  const linhas = manchete?.length ? manchete.map((l) => l.toUpperCase()) : [cidade.toUpperCase(), 'ESTÁ EM RISCO'];
  const maior = Math.max(...linhas.map((l) => l.length));
  const px = Math.min(88, Math.floor(1300 / maior));
  return (
    <AbsoluteFill style={{ background: COR.fundo, color: COR.branco, opacity: useSaida(dur) }}>
      <Img src={staticFile('flavio-tesoura.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '30% center', transform: `scale(${zoom})`, transformOrigin: '40% 30%' }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(11,17,32,0) 45%, rgba(11,17,32,.6) 100%)' }} />
      <Tarja x={f * 2} />
      <div style={{ position: 'absolute', left: 50, right: 50, top: 790, background: 'rgba(11,17,32,.78)', borderLeft: `10px solid ${COR.vermelho}`, padding: '36px 40px 40px', opacity: texto, transform: `translateY(${(1 - texto) * 60}px)` }}>
        <div style={{ ...MONTSERRAT, fontWeight: 700, fontSize: 50, lineHeight: 1.2 }}>Flávio Bolsonaro planeja cortar</div>
        <div style={{ ...ARCHIVO, color: COR.amarelo, display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 6, opacity: valor, transform: `scale(${interpolate(valor, [0, 1], [0.7, 1])})`, transformOrigin: 'left center' }}>
          <span style={{ fontSize: 70 }}>até R$</span>
          <span style={{ fontSize: 210 }}>250</span>
          <span style={{ fontSize: 100 }}>bilhões</span>
        </div>
        <div style={{ marginTop: 20, transform: `scale(${caixa})`, transformOrigin: 'left center' }}>
          <Caixa cor={COR.vermelho} texto={COR.branco} px={px}>
            {linhas.map((l, i) => <React.Fragment key={i}>{i > 0 && <br />}{l}</React.Fragment>)}
          </Caixa>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Fecho: Cena = ({ cidade, bairro, fonte, fotoCredito }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame: f, fps, config: { damping: 20 } });
  return (
    <AbsoluteFill style={{ background: COR.fundo, color: COR.branco, padding: '0 80px', justifyContent: 'center' }}>
      <div style={{ marginTop: -240 }}>
        <div style={{ ...ARCHIVO, fontSize: Math.min(112, Math.floor(1500 / Math.max(...(bairro || cidade).split(' ').map((w) => w.length)))), lineHeight: 1.0, opacity: entra, transform: `translateY(${(1 - entra) * 60}px)` }}>
          COMPARTILHE COM QUEM USA O SUS {bairro ? 'NO BAIRRO' : 'EM'} <span style={{ color: COR.amarelo }}>{(bairro || cidade).toUpperCase()}</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 80, right: 80, bottom: 70, ...MONTSERRAT, fontWeight: 500, fontSize: 22, lineHeight: 1.35, color: '#9aa3b5', opacity: entra }}>
        {fonte} · {fotoCredito}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- legenda palavra por palavra
type Trecho = { ini: number; fim: number; palavras: { ini: number; fim: number; texto: string }[] };

// Junta as palavras de todas as cenas em trechos de até 4 palavras (quebra também nas pausas da fala), em frames absolutos.
export function trechos(legendas: Palavra[][], inicios: number[]): Trecho[] {
  const out: Trecho[] = [];
  legendas.forEach((fala, cena) => {
    // "59 por cento" aparece como "59%"
    const leg: Palavra[] = [];
    for (let k = 0; k < fala.length; k++) {
      const ant = leg[leg.length - 1];
      if (ant && /\d$/.test(ant[2]) && sem(fala[k][2]) === 'por' && sem(fala[k + 1]?.[2] ?? '') === 'cento') {
        leg[leg.length - 1] = [ant[0], fala[k + 1][0] + fala[k + 1][1] - ant[0], ant[2] + '%'];
        k++;
      } else leg.push(fala[k]);
    }
    let atual: Trecho | null = null;
    for (const [t, d, texto] of leg) {
      const ini = inicios[cena] + ATRASO_VOZ + Math.round(t * FPS);
      const fim = inicios[cena] + ATRASO_VOZ + Math.round((t + d) * FPS);
      const pausa = atual && ini - atual.fim > 6;
      if (!atual || atual.palavras.length >= 4 || pausa) {
        if (atual) out.push(atual);
        atual = { ini, fim, palavras: [] };
      }
      atual.palavras.push({ ini, fim, texto });
      atual.fim = fim;
    }
    if (atual) out.push(atual);
  });
  return out;
}

export const Legenda: React.FC<{ lista: Trecho[]; cor?: string }> = ({ lista, cor = COR.amarelo }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const i = lista.findIndex((t, k) => f >= t.ini && f < Math.min(t.fim + 12, lista[k + 1]?.ini ?? Infinity));
  if (i < 0) return null;
  const t = lista[i];
  const entra = spring({ frame: f - t.ini, fps, config: { damping: 18, stiffness: 220 } });
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, bottom: 390, display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: 'rgba(11,17,32,.82)', borderRadius: 18, padding: '18px 30px 10px', transform: `scale(${interpolate(entra, [0, 1], [0.9, 1])})`, opacity: entra, textAlign: 'center' }}>
        {t.palavras.map((p, k) => {
          const ativa = f >= p.ini && (f < (t.palavras[k + 1]?.ini ?? Infinity));
          const pop = spring({ frame: f - p.ini, fps, config: { damping: 12, stiffness: 300 } });
          return (
            <span key={k} style={{ ...ARCHIVO, fontSize: 76, display: 'inline-block', margin: '0 12px', color: ativa ? cor : f >= p.ini ? COR.branco : 'rgba(255,255,255,.45)', transform: `scale(${ativa ? interpolate(pop, [0, 1], [1, 1.12]) : 1})` }}>
              {p.texto.toUpperCase()}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const CENAS = [Abertura, Numero, Farmacia, Corte, Fecho];

export const Saude: React.FC<SaudeProps> = (p) => {
  carregarFontes();
  const { durationInFrames } = useVideoConfig();
  const dur = p.duracoes?.length === CENAS.length ? p.duracoes : PADRAO;
  const inicios = dur.map((_, i) => dur.slice(0, i).reduce((a, b) => a + b, 0));
  const lista = p.legendas?.length ? trechos(p.legendas, inicios) : [];
  const ultima = inicios[CENAS.length - 1];
  return (
    <AbsoluteFill style={{ background: COR.fundo }}>
      {CENAS.map((Cena, i) => (
        <Sequence key={i} from={inicios[i]} durationInFrames={dur[i]}>
          <Cena {...p} dur={dur[i]} leg={p.legendas?.[i]} />
        </Sequence>
      ))}
      <Legenda lista={lista} />
      {p.vozes?.map((v, i) =>
        v ? (
          <Sequence key={'v' + i} from={inicios[i] + ATRASO_VOZ}>
            <Audio src={src(v)} />
          </Sequence>
        ) : null,
      )}
      {p.trilha ? (
        <Audio
          src={src(p.trilha)}
          // baixa por baixo da voz, sobe um pouco no fecho e some no último segundo
          volume={(f) =>
            interpolate(
              f,
              [0, ultima, ultima + 15, durationInFrames - 30, durationInFrames],
              [0.18, 0.18, 0.32, 0.32, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            )
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};
