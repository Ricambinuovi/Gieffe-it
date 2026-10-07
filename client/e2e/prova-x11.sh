#!/usr/bin/env bash
# Prova end-to-end su Linux con schermo virtuale (Xvfb + openbox): due utenti reali che accedono
# dall'interfaccia, invio e ricezione in tempo reale, recupero dopo il riavvio del server.
#
# Requisiti: xvfb openbox xdotool dbus-run-session, un server PocketBase (variabile PB_BIN o server/bin),
# e l'app compilata:  npm run tauri build -- --debug --no-bundle
# Uso:  PB_BIN=/percorso/pocketbase e2e/prova-x11.sh
set -uo pipefail

QUI="$(cd "$(dirname "$0")" && pwd)"
CLIENT="$QUI/.."
SERVER="$CLIENT/../server"
PB_BIN="${PB_BIN:-$SERVER/bin/pocketbase}"
APP="$CLIENT/src-tauri/target/debug/gieffe-it"
LAV="$(mktemp -d)"
export DISPLAY=:99
export PB_URL=http://127.0.0.1:18095 PB_ADMIN_EMAIL=e2e@test.local PB_ADMIN_PASSWORD=e2epass12345
PB_ARGS=("--dir=$LAV/pbdata" "--migrationsDir=$SERVER/pb_migrations" "--hooksDir=$SERVER/pb_hooks")
fallite=0

[ -x "$PB_BIN" ] || { echo "PocketBase non trovato ($PB_BIN)"; exit 2; }
[ -x "$APP" ] || { echo "App non compilata: npm run tauri build -- --debug --no-bundle"; exit 2; }

pulisci() {
  [ -n "${CONSERVA:-}" ] && { echo "Dati della prova conservati in $LAV"; return; }
  pkill -x gieffe-it 2>/dev/null; kill $PB_PID $XVFB_PID $OB_PID 2>/dev/null; rm -rf "$LAV"
}
trap pulisci EXIT

verifica() { # descrizione, condizione (0 = ok)
  if [ "$2" -eq 0 ]; then echo "  ok   $1"; else echo "  FALLITO  $1"; fallite=$((fallite+1)); fi
}
api() { (cd "$CLIENT" && node e2e/api.mjs "$@" 2>&1); }
avvia_pb() { "$PB_BIN" serve --http=127.0.0.1:18095 "${PB_ARGS[@]}" >"$LAV/pb.log" 2>&1 & PB_PID=$!; sleep 3; }

# finestra del post-it di un'istanza: restituisce "x y larghezza altezza"
postit() { # nome-istanza
  local pid w
  pid=$(pgrep -f "gieffe-it-prova/$1/" | head -1)
  for p in $(pgrep -x gieffe-it); do
    if tr '\0' '\n' < /proc/$p/environ | grep -q "gieffe-it-prova/$1/"; then pid=$p; fi
  done
  for w in $(xdotool search --all --onlyvisible --pid "$pid" --name "^Gieffe-it$" 2>/dev/null); do
    xdotool getwindowgeometry --shell "$w" | tr '\n' ' ' | sed -E 's/.*X=([0-9-]+).*Y=([0-9-]+).*WIDTH=([0-9]+).*HEIGHT=([0-9]+).*/\1 \2 \3 \4/'
    return
  done
}
altezza_postit() { postit "$1" | awk '{print $4+0}'; }
attendi_altezza_maggiore() { # istanza, soglia, secondi
  for _ in $(seq 1 $(( $3 * 2 ))); do
    [ "$(altezza_postit "$1")" -gt "$2" ] && return 0; sleep 0.5
  done; return 1
}

echo "Avvio ambiente di prova..."
Xvfb :99 -screen 0 1600x900x24 >/dev/null 2>&1 & XVFB_PID=$!
sleep 1; openbox >/dev/null 2>&1 & OB_PID=$!
"$PB_BIN" superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" "${PB_ARGS[@]}" >/dev/null 2>&1
avvia_pb
(cd "$SERVER" && node seed/seed.mjs >/dev/null) || { echo "seed fallito"; exit 2; }

accedi() { # nome-istanza email
  export HOME_PROVA="$LAV/home"
  (cd "$CLIENT" && HOME="$LAV/home" dbus-run-session -- scripts/istanza.sh "$1" >"$LAV/$1.log" 2>&1 &)
  sleep 6
  xdotool type --delay 25 "127.0.0.1:18095"; xdotool key Tab
  xdotool type --delay 25 "$2"; xdotool key Tab
  xdotool type --delay 25 "gieffe-prova-123"; xdotool key Return
  sleep 4
}
mkdir -p "$LAV/home"

echo "Accesso di Luca e di Maria dall'interfaccia..."
accedi luca luca@gieffecar.test
accedi maria maria@gieffecar.test

read -r X Y L H <<< "$(postit maria)"
[ -n "${H:-}" ] && [ "${H:-0}" -gt 150 ]; rc=$?
verifica "Maria vede il post-it con i messaggi già in attesa (recupero iniziale)" $rc
[ "${X:-0}" -ge $((1600 - 380 - 40)) ] && [ $((${Y:-0} + ${H:-0})) -le 900 ]; rc=$?
verifica "il post-it è in basso a destra e dentro lo schermo" $rc

H0=$(altezza_postit maria)
api invia paolo Maria "Prova in tempo reale" >/dev/null
attendi_altezza_maggiore maria "$H0" 8; rc=$?
verifica "un nuovo messaggio compare in tempo reale (altezza $H0 -> $(altezza_postit maria))" $rc

echo "Spengo il server, invio un messaggio, lo riaccendo..."
kill $PB_PID; wait $PB_PID 2>/dev/null; sleep 8
H1=$(altezza_postit maria)
avvia_pb
api invia sara Maria "Arrivato dopo il riavvio del server" >/dev/null
attendi_altezza_maggiore maria "$H1" 25; rc=$?
verifica "dopo il riavvio del server il messaggio perso viene recuperato da solo (altezza $H1 -> $(altezza_postit maria))" $rc

api stati Maria | grep -q "Arrivato dopo il riavvio"; rc=$?
verifica "la consegna risulta sul server" $rc

echo
if [ "$fallite" -eq 0 ]; then echo "Tutte le verifiche superate."; else echo "$fallite verifiche fallite."; exit 1; fi
