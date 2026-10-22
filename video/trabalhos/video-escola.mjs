// Trabalho "video-escola" da fila: vídeo de Escola (educação infantil, card p3). Mesmo contrato e mesmas entradas do video-saude.mjs.
//   node video/trabalhos/video-escola.mjs <pasta-entradas> <pasta-saidas> <slug ...> [--gl angle|swangle] [--paralelo N]
process.env.VIDEO_TEMA = 'escola';
await import('./video-saude.mjs');
