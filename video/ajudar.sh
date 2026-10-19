#!/usr/bin/env bash
# Ajudante de render: cada máquina roda isto e renderiza vídeos de Saúde até a fila acabar. É o que o GitHub Actions
# chama (.github/workflows/videos.yml), mas serve em qualquer máquina com o video/ preparado (ver README).
#   bash video/ajudar.sh [--trabalho video-saude] [--gl angle|swangle] [--limite N] [--conc N] [--sem-voz]
# Contrato: lê FILA_URL do ambiente (Worker com a fila de territórios e o kit de fundos no R2), --trabalho <nome>
# (qual fila; padrão video-saude, a fila é genérica para servir a outros materiais depois), --limite N para
# parar depois de N territórios (0 = até a fila esvaziar), --gl angle (placa de vídeo) ou swangle (só CPU), e
# termina com 0 quando a fila está vazia.
# Sem FILA_URL renderiza o kit de exemplo (video/exemplo/, 4 territórios, sem os dados brutos) e termina com 0.
# A parte da fila ainda está sendo feita (Worker + R2): até lá este script só sabe o modo de exemplo.
set -euo pipefail
cd "$(dirname "$0")"
GL=angle LIMITE=0 CONC=4 TRABALHO=video-saude EXTRA=()
while [ $# -gt 0 ]; do
  case "$1" in
    --trabalho) TRABALHO=$2; shift 2 ;;
    --gl) GL=$2; shift 2 ;;
    --limite) LIMITE=$2; shift 2 ;;
    --conc) CONC=$2; shift 2 ;;
    --sem-voz) EXTRA+=(--sem-voz); shift ;;
    *) echo "ajudar.sh: opção desconhecida: $1" >&2; exit 2 ;;
  esac
done
if [ "$LIMITE" -gt 0 ]; then EXTRA+=(--limite "$LIMITE"); fi

if [ -z "${FILA_URL:-}" ]; then
  echo "FILA_URL não definido: renderizando o kit de exemplo (video/exemplo/, 4 territórios) com gl=$GL, conc=$CONC"
  exec node lote.mjs --exemplo --todas --gl "$GL" --conc "$CONC" ${EXTRA[@]+"${EXTRA[@]}"}
fi

echo "ajudar.sh: a fila $TRABALHO em FILA_URL ainda não está implementada neste script (a outra parte do trabalho está em andamento)" >&2
exit 1
