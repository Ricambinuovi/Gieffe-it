#!/usr/bin/env bash
# Avvia un'istanza di Gieffe-it con dati propri, per provare due utenti sullo stesso PC.
# Uso:  scripts/istanza.sh luca      (prima: npm run tauri build -- --debug --no-bundle)
# Ogni nome ha la sua sessione e le sue impostazioni; l'istanza singola è disattivata.
set -euo pipefail

nome="${1:?Uso: $0 <nome-istanza> [--apri nuovo|inviati|storico|impostazioni]}"
shift
qui="$(cd "$(dirname "$0")" && pwd)"
base="${HOME}/.local/share/gieffe-it-prova/${nome}"
mkdir -p "$base"

export GIEFFE_MULTI=1
export XDG_DATA_HOME="$base/data" XDG_CONFIG_HOME="$base/config" XDG_CACHE_HOME="$base/cache"

exec "$qui/../src-tauri/target/debug/gieffe-it" "$@"
