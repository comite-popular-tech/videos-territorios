// Mesmas fontes dos cards (Archivo condensado para títulos, Montserrat para texto), carregadas do Google Fonts.
// O render só começa depois que o Chromium confirma que as fontes estão prontas.
import { continueRender, delayRender } from 'remotion';

const CSS =
  'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Montserrat:wght@500;600;700;800;900&display=swap';

let carregadas = false;

export function carregarFontes() {
  if (carregadas || typeof document === 'undefined') return;
  carregadas = true;
  const handle = delayRender('fontes do Google');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS;
  document.head.appendChild(link);
  const pedidos = [
    "900 100px 'Archivo'",
    "700 40px 'Montserrat'",
    "900 40px 'Montserrat'",
    "500 40px 'Montserrat'",
  ];
  link.onload = () =>
    Promise.all(pedidos.map((f) => document.fonts.load(f)))
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  link.onerror = () => continueRender(handle);
}

export const ARCHIVO = { fontFamily: "'Archivo', sans-serif", fontWeight: 900, fontStretch: '62%', textTransform: 'uppercase' as const, lineHeight: 0.9 };
export const MONTSERRAT = { fontFamily: "'Montserrat', sans-serif" };
