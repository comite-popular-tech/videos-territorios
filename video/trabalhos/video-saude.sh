#!/bin/bash
# Trabalho "video-saude" da fila (ver video-saude.mjs ao lado, que faz o serviço; este .sh é só o nome padrão do contrato).
#   bash video/trabalhos/video-saude.sh <pasta-entradas> <pasta-saidas> <slug ...> [--gl angle|swangle]
exec node "$(dirname "$0")/video-saude.mjs" "$@"
