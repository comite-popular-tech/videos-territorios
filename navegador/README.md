# Ajudar pelo navegador

Página que monta "A insulina do Seu Raimundo" no próprio navegador do voluntário, sem instalar nada:
<https://comite-popular-tech.github.io/videos-territorios/>. Publicada pelo workflow `pagina` (GitHub Pages) a cada
push em `navegador/`.

**Fluxo:** a pessoa confere os 2 primeiros vídeos ao lado do vídeo padrão aprovado (Capão Redondo). "Está igual,
enviar" envia; "Tem problema" manda o motivo para a URL de erro do item na fila e monta outro para conferir. Com 2
aprovados (guardados no `localStorage`, então não repete a revisão na próxima visita), a aba segue sozinha: pede 1 item
à fila (`POST /lote/video-insulina`), monta, envia (`PUT` em `subir` + `POST pronto`) e repete. "Vi um problema"
manda o motivo sobre o último vídeo enviado. Três falhas seguidas param a aba.

**Como monta:** [`@remotion/web-renderer`](https://www.remotion.dev/docs/web-renderer) (`renderMediaOnWeb`, H.264 + AAC
em MP4, ~2,2 Mbit/s, ~12 MB). Cópias de `video/src/` adaptadas ao navegador: `Video`/`Audio` de `@remotion/media`,
degradê linear no lugar do radial, sem `mixBlendMode`, `FUSAO` 14 e `RITMO` 1,25 nas animações do infográfico. O vídeo
já sai na velocidade final (no Node o ffmpeg acelera 1,25x depois): voz a +18% e tempos ATRASO 8, FOLGA 29, MINIMO 120,
RESPIRO 48; a música entra na composição. Ao mudar `video/src/Historia.tsx`, `InfoFarmacia.tsx` ou `Saude.tsx`, leve a
mudança para cá também.

**Vozes:** o navegador não chama o edge-tts. `node video/insulina_vozes.mjs` (precisa do `FILA_SEGREDO`) gera antes as
falas de todos os territórios com o mesmo `roteiro()` do render em Node (`video/trabalhos/insulina-roteiro.mjs`) e sobe
para o R2 em `comum/video-insulina/web/`: `vozes/<hash>.mp3|json` e `roteiros/<slug>.json`. Mudou o texto? Rode de
novo antes de soltar a fila; território sem roteiro faz a página parar com aviso, sem gastar tentativa do item.

**Vídeo padrão:** `comum/video-insulina/web/padrao.mp4` no R2. Para refazer: abra a página com `?padrao`, baixe o MP4
e suba pelo `PUT /kit/` de administração.

**Navegadores:** Chrome e Edge no computador (testados em 21/10/2026, Windows, Chrome e Edge 155: ~30 a 45 s por vídeo,
também com a aba atrás de outras). **Safari não serve:** não aplica os filtros de imagem e o vídeo sai diferente, então
a página recusa. Celular também é recusado. Firefox só passa se tiver o encoder H.264 do WebCodecs
(`canRenderMediaOnWeb`).

**Testar sem a fila:** `?teste=<slug>` monta um território e mostra, sem pedir lote nem enviar; `?fila=<url>` troca a
fila (por exemplo, uma fila falsa local).

```bash
cd navegador && npm install && npm run dev
```

A licença do Remotion é grátis para pessoas físicas e organizações sem fins lucrativos.
