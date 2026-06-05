#!/usr/bin/env bash
# Télécharge le binaire PocketBase à la version figée et l'installe dans
# src-tauri/binaries/ avec le nom attendu par le sidecar Tauri (triplet de cible).
#
# Usage : ./scripts/fetch-pocketbase.sh
#
# Le binaire n'est jamais committé (voir .gitignore). Ce script est joué en local
# (dev Mac) et en CI (un équivalent .ps1 existe pour le runner Windows).

set -euo pipefail

# Version figée de PocketBase (pré-1.0 : ne monter qu'après lecture du changelog).
PB_VERSION="0.39.1"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="$ROOT/src-tauri/binaries"
mkdir -p "$DEST_DIR"

# Détection de la plateforme et du triplet de cible Rust correspondant.
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64) PB_ARCH="darwin_arm64"; TRIPLE="aarch64-apple-darwin" ;;
      x86_64) PB_ARCH="darwin_amd64"; TRIPLE="x86_64-apple-darwin" ;;
      *) echo "Architecture macOS non gérée : $ARCH" >&2; exit 1 ;;
    esac
    BIN_NAME="pocketbase-$TRIPLE"
    ;;
  Linux)
    case "$ARCH" in
      x86_64) PB_ARCH="linux_amd64"; TRIPLE="x86_64-unknown-linux-gnu" ;;
      aarch64) PB_ARCH="linux_arm64"; TRIPLE="aarch64-unknown-linux-gnu" ;;
      *) echo "Architecture Linux non gérée : $ARCH" >&2; exit 1 ;;
    esac
    BIN_NAME="pocketbase-$TRIPLE"
    ;;
  *)
    echo "Système non géré par ce script : $OS (utiliser fetch-pocketbase.ps1 sous Windows)" >&2
    exit 1
    ;;
esac

ZIP="pocketbase_${PB_VERSION}_${PB_ARCH}.zip"
URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${ZIP}"
DEST_BIN="$DEST_DIR/$BIN_NAME"

if [ -x "$DEST_BIN" ]; then
  echo "PocketBase déjà présent : $DEST_BIN"
  exit 0
fi

echo "Téléchargement de PocketBase v${PB_VERSION} (${PB_ARCH})…"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -sSL "$URL" -o "$TMP/pb.zip"
unzip -q "$TMP/pb.zip" -d "$TMP"
mv "$TMP/pocketbase" "$DEST_BIN"
chmod +x "$DEST_BIN"

echo "Installé : $DEST_BIN"
