#!/usr/bin/env bash
# Avvia un server di sviluppo sul proprio PC (dati in server/pb_data_dev).
# Raggiungibile da altri PC della rete su http://<ip-di-questo-pc>:8090
set -euo pipefail
cd "$(dirname "$0")"

[ -x bin/pocketbase ] || ./scripts/scarica-pocketbase.sh bin

exec bin/pocketbase serve --http=0.0.0.0:8090 \
  --dir=pb_data_dev --migrationsDir=pb_migrations --hooksDir=pb_hooks
