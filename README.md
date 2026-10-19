# Vídeos de Saúde por território

Vídeo vertical "Alerta Saúde SUS" (1080×1920, cerca de 36 s) para cada um dos 6.121 territórios de saúde do Brasil:
cidade pequena tem um vídeo, cidade grande tem um por bairro, com os números do repasse federal e o posto de saúde
do lugar. Tudo é montado por código ([Remotion](https://www.remotion.dev/), React → MP4) a partir de dados públicos.
É parte do material de campanha do Comitê Popular Tech, produzido no repositório
[producao-de-conteudo-para-municipios](https://github.com/comite-popular-tech/producao-de-conteudo-para-municipios); esta cópia existe para que qualquer pessoa possa emprestar as máquinas grátis
do GitHub Actions ao render.

Como funciona, cena por cena, e o que cada arquivo faz: [video/README.md](video/README.md).

## Como ajudar com as máquinas do GitHub (sem instalar nada)

Renderizar os 6.121 vídeos numa máquina só leva mais de 40 horas. O GitHub dá a qualquer conta até 20 máquinas ao
mesmo tempo, de graça. Para emprestar as suas:

1. Faça um **fork** deste repositório (botão Fork, no alto da página).
2. No seu fork, abra a aba **Actions** e clique em **I understand my workflows, go ahead and enable them**.
3. Em Actions, escolha **videos** à esquerda, clique em **Run workflow** e confirme (pode deixar os valores padrão:
   20 máquinas, até a fila esvaziar).

Cada máquina pega territórios de uma fila compartilhada, renderiza e devolve o vídeo pronto; quando a fila acaba, ela
para sozinha. Não precisa de senha nem de permissão: o workflow só lê este código e conversa com a fila pela internet.
A rodada dura até 5h50 (limite do GitHub); se ainda houver fila, é só clicar em Run workflow de novo.

Sem fila configurada (por exemplo, antes de ela abrir), cada máquina renderiza os 4 territórios do kit de exemplo e deixa
os MP4 como artifact da execução, o que serve para testar.

## Rodar na sua máquina

Precisa de Node 20+, Python 3.10+ e Git. O Chrome o Remotion baixa sozinho.

```bash
git clone https://github.com/comite-popular-tech/videos-territorios.git
cd videos-territorios/video
npm install
npx playwright install chromium   # converte o mapa do município em imagem
pip install edge-tts numpy
python trilha.py                  # gera public/trilha.wav (uma vez)

node lote.mjs --exemplo --todas --frames
```

Os vídeos saem em `saida/territorios/<território>/video/saude.mp4`, na raiz do repositório. Para ver e mexer nas
cenas com prévia ao vivo: `npm run studio`. Para ajudar a fila pela sua máquina: `bash video/ajudar.sh`, com a
variável `FILA_URL` apontando para a fila (placa de vídeo: `--gl angle`, só CPU: `--gl swangle`).

## Avisos

- A voz é sintética (edge-tts, `pt-BR-AntonioNeural`), aprovada pela coordenação da campanha em 19/10/2026.
- Os dados completos (fotos e mapas, 1,2 GB) não ficam aqui: as máquinas recebem o fundo de cada território pela fila.
  O kit de exemplo em `video/exemplo/` tem 4 territórios para teste.
- Nomes de cidade seguem o padrão "Cidade - UF".
