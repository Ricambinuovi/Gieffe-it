#!/usr/bin/env bash
# Scarica l'eseguibile di PocketBase (release ufficiale) nella cartella indicata.
# Uso: scarica-pocketbase.sh <cartella-destinazione>
# Variabile opzionale: PB_VERSION (default: la versione con cui Gieffe-it è stato testato)
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.40.4}"
DEST="${1:?Uso: $0 <cartella-destinazione>}"

case "$(uname -m)" in
  x86_64|amd64)  ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo "Architettura non supportata: $(uname -m)" >&2; exit 1 ;;
esac

URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Scarico PocketBase ${PB_VERSION} (${ARCH})..."
curl -fL --retry 3 -o "$TMP/pb.zip" "$URL"
unzip -q -o "$TMP/pb.zip" pocketbase -d "$TMP"

mkdir -p "$DEST"
install -m 0755 "$TMP/pocketbase" "$DEST/pocketbase"
echo "Installato: $DEST/pocketbase ($("$DEST/pocketbase" --version))"
