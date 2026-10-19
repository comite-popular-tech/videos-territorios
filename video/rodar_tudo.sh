#!/bin/bash
# Gera o vídeo de Saúde de todos os territórios (saida/territorios), em blocos de 200 (vozes do bloco, depois render), primeiro as com foto
# e depois as com mapa. Retoma sozinho: cidade já pronta é pulada. Log em video/rodar_tudo.log.
#   bash video/rodar_tudo.sh
cd "$(dirname "$0")"
for fundo in foto mapa; do
  n=$(node -e "import('./cidade.mjs').then(({dadosCidade})=>{const fs=require('fs');console.log(fs.readdirSync('../saida/territorios').map(dadosCidade).filter(c=>!c.erro&&c.fundo==='$fundo').length)})")
  for ((i=0; i<n; i+=200)); do
    echo "=== $(date '+%d/%m %H:%M') $fundo $i-$((i+200)) de $n"
    node lote.mjs --todas --fundo $fundo --pular $i --limite 200 --paralelo 2 --conc 6 2>&1 | grep -E "^[0-9]+/|^fim|ERRO|vozes: (fim|falha)|cidades \("
  done
done
echo "=== $(date '+%d/%m %H:%M') tudo pronto"
