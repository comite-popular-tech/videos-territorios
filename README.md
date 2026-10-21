# Vídeos da campanha por território

Vídeos verticais (1080×1920, cerca de 35 s) feitos para cada cidade e bairro do Brasil, com os números do lugar,
para a campanha. Agora estamos produzindo **"A insulina do Seu Raimundo"**, sobre a Farmácia Popular; antes saiu o
"Alerta Saúde SUS". Tudo é montado por código ([Remotion](https://www.remotion.dev/), React → MP4) a partir de dados
públicos, pelo Comitê Popular Tech. Este repositório é aberto para que qualquer pessoa possa emprestar o computador
para produzir os vídeos.

## O jeito mais fácil: pelo navegador

Abra <https://comite-popular-tech.github.io/videos-territorios/> no **Chrome** ou no **Edge** do computador e deixe a
aba aberta. Você confere os 2 primeiros vídeos e depois o navegador monta e envia sozinho. Não precisa instalar nada.
Detalhes em [`navegador/`](navegador/).

## Como ajudar com o seu computador

A campanha precisa de milhares de vídeos, um para cada cidade e bairro do Brasil, e cada um leva de 1 a 3 minutos para
ficar pronto. Quanto mais computadores ajudando, mais rápido sai. Você não precisa saber programar: é instalar dois
programas grátis, baixar esta pasta e deixar rodando.

**O que acontece no seu computador:** ele pega da fila o próximo território que ainda não tem vídeo, monta o vídeo e
envia direto para o armazenamento da campanha. Nada fica guardado na sua máquina e ninguém faz o mesmo vídeo duas
vezes. Não precisa de senha nem de cadastro. Dá para usar o computador normalmente enquanto isso, só fica um pouco mais
lento.

**Do que precisa:** Windows, Mac ou Linux, 8 GB de memória ou mais, uns 3 GB livres no disco e internet.

### Windows

1. Instale o **Node.js**: em <https://nodejs.org>, baixe a versão **LTS** e instale com as opções padrão
   (Avançar, Avançar, Concluir).
2. Instale o **Python**: em <https://www.python.org/downloads/>, clique em *Download Python*. Na primeira tela do
   instalador, **marque "Add python.exe to PATH"** e depois clique em *Install Now*.
3. Baixe esta pasta: no alto desta página, clique no botão verde **Code** e depois em **Download ZIP**. Abra o ZIP e
   extraia (botão direito → *Extrair tudo*) para um lugar fácil, como a Área de Trabalho.
4. Entre na pasta extraída, depois na pasta **video**, e dê **dois cliques em `AJUDAR-windows.bat`**.
   Se o Windows avisar "O Windows protegeu o computador", clique em *Mais informações* → *Executar assim mesmo*.
5. Na primeira vez ele instala o que falta (alguns minutos). Depois aparecem linhas como
   `pronto: Urucurituba - AM`: cada uma é um vídeo entregue. Pode deixar a janela aberta.

### Mac

1. Instale o **Node.js** (versão **LTS**, <https://nodejs.org>) e o **Python** (<https://www.python.org/downloads/>).
2. Baixe esta pasta (botão verde **Code** → **Download ZIP**) e abra o ZIP. Ele vira a pasta `videos-territorios-master`
   em Downloads.
3. Abra o aplicativo **Terminal** (Cmd + espaço, digite "Terminal") e cole:

   ```bash
   bash ~/Downloads/videos-territorios-master/video/ajudar.sh
   ```

### Linux

Com Node 20+, Python 3.10+ e Git instalados:

```bash
git clone https://github.com/comite-popular-tech/videos-territorios.git
bash videos-territorios/video/ajudar.sh
```

### Vídeo de alerta do Bolsa Família

É outra fila: o trabalho `video-bolsa-familia` (36 s, 720×1280, um vídeo por município). Precisa do **Node.js 22 ou
mais novo** (a versão LTS de <https://nodejs.org> serve). Na primeira vez, ele baixa sozinho o navegador que desenha o
vídeo (HyperFrames).

- **Windows:** abra o PowerShell na pasta `video` e rode
  `powershell -ExecutionPolicy Bypass -File ajudar.ps1 --trabalho video-bolsa-familia`
- **Mac ou Linux:** `bash videos-territorios/video/ajudar.sh --trabalho video-bolsa-familia`

**Sem navegador, mais rápido (Pillow + FFmpeg):** ponha `--pillow` no fim do comando. O vídeo sai igual, desenhado em
Python por cima de fundos prontos; não precisa do Node 22 nem do navegador, só do Python (o script instala o Pillow e o
numpy sozinho). Exemplo no Windows: `powershell -ExecutionPolicy Bypass -File ajudar.ps1 --trabalho video-bolsa-familia --pillow`.

Para testar com poucos vídeos, ponha `--limite 2` no fim; para pesar menos no computador, `--conc 1` (com `--pillow`,
`--paralelo 2`). Tudo o que cada cidade precisa (falas, números, foto) vem da fila. A foto fica em
`https://fila-videos.boralula.workers.dev/entradas/fundos/<cidade>.jpg`.

### Dúvidas comuns

- **Como paro?** Feche a janela (ou Ctrl+C). Os vídeos que estavam pela metade voltam para a fila sozinhos em 2 horas.
- **Como volto a ajudar?** Faça de novo o último passo (dois cliques no `AJUDAR-windows.bat`, ou o comando no Terminal).
- **O computador ficou muito lento.** Pare e rode com menos esforço: no Windows, abra o PowerShell na pasta `video` e rode
  `powershell -ExecutionPolicy Bypass -File ajudar.ps1 --conc 2`; no Mac/Linux, ponha `--conc 2` no fim do comando.
- **Apareceu "PARE: falta o Node.js" ou "falta o Python".** Instale o programa indicado, feche a janela e tente de novo.
- **Acabou?** Quando a fila esvazia, aparece `fila vazia` e o programa para sozinho. O andamento de todos está em
  <https://fila-videos.boralula.workers.dev/>.

## Para a equipe: máquinas do GitHub Actions

O workflow **videos** (aba Actions → videos → Run workflow) põe até 20 máquinas do GitHub na mesma fila. É o jeito
de a equipe da campanha acelerar uma rodada; para voluntários, o caminho é o computador próprio, acima. **Dispare num
fork, na sua conta**, nunca neste repositório: o GitHub dá 20 máquinas por conta, e aqui elas seriam as 20 da org
inteira, deixando o CI dos outros repositórios na fila (aqui o workflow só aceita o kit de exemplo). O campo
**Trabalho da fila** diz qual vídeo produzir (hoje `video-insulina`). A rodada dura até 5h50 (limite do GitHub); se
ainda houver fila, rode de novo. Com `exemplo` marcado, renderiza só os 4 territórios do kit de exemplo, para teste.

## Para quem programa

Como funciona, cena por cena, e o que cada arquivo faz: [video/README.md](video/README.md). Para mexer nas cenas com
prévia ao vivo: `cd video && npm install && npm run studio`. O kit de exemplo (`node lote.mjs --exemplo --todas`)
renderiza 4 territórios do vídeo de Saúde sem precisar da fila.

## Avisos

- A voz é sintética (edge-tts, `pt-BR-AntonioNeural`), aprovada pela coordenação da campanha em 19/10/2026.
- Os dados completos (fotos e mapas, 1,2 GB) não ficam aqui: as máquinas recebem o fundo de cada território pela fila.
  O kit de exemplo em `video/exemplo/` tem 4 territórios para teste.
- Nomes de cidade seguem o padrão "Cidade - UF".
