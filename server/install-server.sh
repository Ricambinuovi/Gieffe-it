#!/usr/bin/env bash
# Installa il server Gieffe-it come servizio systemd (Linux).
# Uso:  sudo ./install-server.sh
# Si può rieseguire per aggiornare migrazioni, hook e servizio: i dati non vengono toccati.
# Variabili opzionali: ADMIN_EMAIL, ADMIN_PASSWORD (altrimenti le chiede), PB_VERSION.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Esegui con sudo:  sudo $0" >&2
  exit 1
fi

QUI="$(cd "$(dirname "$0")" && pwd)"
APP=/opt/gieffe-it
DATI=/var/lib/gieffe-it

id gieffe >/dev/null 2>&1 || useradd --system --home-dir "$DATI" --shell /usr/sbin/nologin gieffe
mkdir -p "$APP" "$DATI"

# eseguibile (si scarica solo se manca)
if [ ! -x "$APP/pocketbase" ]; then
  if [ -x "$QUI/bin/pocketbase" ]; then
    install -m 0755 "$QUI/bin/pocketbase" "$APP/pocketbase"
  else
    "$QUI/scripts/scarica-pocketbase.sh" "$APP"
  fi
fi

# migrazioni e hook (sempre aggiornati)
rm -rf "$APP/pb_migrations" "$APP/pb_hooks"
cp -r "$QUI/pb_migrations" "$QUI/pb_hooks" "$APP/"
chown -R root:root "$APP"
chown -R gieffe:gieffe "$DATI"

# amministratore (solo se il database non esiste ancora)
if [ ! -f "$DATI/pb_data/data.db" ]; then
  EMAIL="${ADMIN_EMAIL:-}"
  PASS="${ADMIN_PASSWORD:-}"
  [ -n "$EMAIL" ] || read -r -p "Email dell'amministratore: " EMAIL
  if [ -z "$PASS" ]; then
    read -r -s -p "Password dell'amministratore (min. 10 caratteri): " PASS; echo
  fi
  runuser -u gieffe -- "$APP/pocketbase" superuser upsert "$EMAIL" "$PASS" \
    --dir="$DATI/pb_data" --migrationsDir="$APP/pb_migrations" --hooksDir="$APP/pb_hooks"
fi

install -m 0644 "$QUI/deploy/gieffe-it.service" /etc/systemd/system/gieffe-it.service
systemctl daemon-reload
systemctl enable gieffe-it.service
systemctl restart gieffe-it.service

sleep 2
if systemctl is-active --quiet gieffe-it.service; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo
  echo "Gieffe-it server avviato."
  echo "  Pannello admin:        http://${IP:-<ip-del-server>}:8090/_/"
  echo "  Indirizzo per i client: http://${IP:-<ip-del-server>}:8090"
  echo "Ricorda di dare a questo PC un indirizzo IP fisso (o una prenotazione sul router)."
else
  echo "Il servizio non è partito. Dettagli:  journalctl -u gieffe-it -n 50" >&2
  exit 1
fi
