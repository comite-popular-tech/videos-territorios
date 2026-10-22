// Trabalho "video-aposentados" da fila: vídeo de Aposentados (card p5; um por cidade). Mesmo contrato e mesmas entradas do video-saude.mjs.
//   node video/trabalhos/video-aposentados.mjs <pasta-entradas> <pasta-saidas> <slug ...> [--gl angle|swangle] [--paralelo N]
process.env.VIDEO_TEMA = 'aposentados';
await import('./video-saude.mjs');
