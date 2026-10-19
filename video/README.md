# Vídeo "Alerta Saúde SUS"

Vídeo vertical (1080×1920, ~36 s) para cada território do acervo de cards. Ele usa os mesmos números e o mesmo
jeito de falar do card de Saúde e é montado todo por código:

1. **Território**: cidade com menos de 100 mil habitantes tem um vídeo só, que fala dos "postos de saúde" da cidade.
   Cidade maior tem um vídeo por bairro, que cita o posto do bairro pelo nome (de 2 a 8 por cidade).
2. **Dados** ([cidade.mjs](cidade.mjs)): `saida/territorios/<território>/pedidos.json`, a foto aprovada da cidade
   (`dados/fotos_cidades.json` + `dados/brutos/fotos_cidades/`) ou, sem foto, o mapa do município
   (`dados/brutos/artes_mapa/`). O jeito de falar o nome de cada unidade fica em [nomes_falados.json](nomes_falados.json).
3. **Narração** ([vozes.py](vozes.py)): voz sintética edge-tts (`pt-BR-AntonioNeural`, grátis, sem cadastro), com o
   tempo de cada palavra para a legenda palavra por palavra.
4. **Música** ([trilha.py](trilha.py)): trilha instrumental gerada por código, sem direito autoral.
5. **Montagem** ([src/Saude.tsx](src/Saude.tsx)): Remotion (React → MP4), em 5 cenas: abertura, repasse e unidades,
   Farmácia Popular, corte de até R$ 250 bi e fecho.
6. **Lote** ([lote.mjs](lote.mjs), [rodar_tudo.sh](rodar_tudo.sh)): gera as vozes e renderiza; retoma sozinho.

## Rodar na sua máquina

Precisa de Node 20+, Python 3.10+, Git e o Google Chrome.

```bash
git clone https://github.com/comite-popular-tech/producao-de-conteudo-para-municipios.git
cd producao-de-conteudo-para-municipios/video
npm i
npx playwright install chromium   # converte o mapa do município em imagem
pip install edge-tts numpy
python trilha.py           # gera public/trilha.wav (uma vez)

node lote.mjs --exemplo --todas --frames
```

O `--exemplo` usa o kit pequeno de [exemplo/](exemplo/): 4 territórios (um bairro de São Paulo, um de Rio Branco,
Bujari com foto e Aiquara com mapa), sem precisar dos dados brutos. Os vídeos saem em
`saida/territorios/<território>/video/saude.mp4`, na raiz do repositório. Com `--frames` saem também 5 PNGs por vídeo
para conferir sem assistir.

Para ver e mexer nas cenas com prévia ao vivo: `npm run studio`.

## Todos os territórios

Precisa dos dados completos: `saida/territorios/` (gerado por `python scripts/gerar_cidade.py --territorios`) e as
fotos e mapas de `dados/brutos/` (1,2 GB, fora do git: peça a pasta ao Gui). Depois:

```bash
bash video/rodar_tudo.sh   # blocos de 200, primeiro os com foto; log em video/rodar_tudo.log
```

Opções do lote no cabeçalho de [lote.mjs](lote.mjs): `--720` (cerca de 40% mais rápido), `--voz francisca`,
`--refazer`, `--amostra 50`. Com placa de vídeo cada vídeo leva de 20 a 30 s.

## Rodar no GitHub Actions

Em vez de uma máquina só, até 20 máquinas do GitHub rendem ao mesmo tempo ([.github/workflows/videos.yml](../.github/workflows/videos.yml)).
Dá para disparar de dois lugares:

**Neste repositório** (quem tem acesso de escrita): Actions → **videos** → **Run workflow**. Escolha quantas máquinas (`jobs`, padrão 20) e
quantos territórios cada uma pega antes de parar (`limite`, 0 = até a fila esvaziar) e confirme.

**No seu fork, com as 20 máquinas da sua conta** (qualquer voluntário com conta no GitHub):

1. Faça um fork do repositório (botão Fork, no alto da página).
2. No fork, abra a aba **Actions** e clique em **I understand my workflows, go ahead and enable them** (o GitHub
   desliga os workflows num fork novo).
3. Actions → **videos** → **Run workflow**, como acima. Não precisa de segredo nem de permissão especial: o workflow só
   lê o código e fala com a fila pela internet.

Em qualquer dos dois, cada máquina prepara o `video/` (cerca de 3 min, menos quando o cache pega), roda
`bash video/ajudar.sh --gl swangle` e vai pegando territórios da fila (`trabalho`, padrão `video-saude`) até ela
acabar ou até 5h50 (limite do GitHub é 6 h). A fila é um Worker público: o endereço vem da entrada `fila_url` ou, vazia,
da variável de repositório `FILA_URL` (nunca de um segredo, para o fork funcionar). O resumo da rodada, com o tempo
de cada vídeo, fica na aba Summary da execução.

Sem endereço da fila, cada máquina renderiza só o kit de exemplo (4 territórios) e deixa os MP4 como artifact da
execução (`videos-exemplo-N`): é o jeito de testar o workflow. As máquinas do GitHub não têm placa de vídeo
(`--gl swangle`): medido em 19/10/2026, cada vídeo levou de 27 a 40 s (média 34 s) na máquina de 4 núcleos que o
GitHub dá a repositório público, contra 20 a 30 s com placa. Nesse ritmo, 20 máquinas fazem os 6.121 territórios em
cerca de 3 h, numa rodada só. Preparar cada máquina leva menos de 1 min quando o cache pega e uns 2 min na primeira vez.

A voz sintética ainda precisa ser aprovada pela coordenação.
