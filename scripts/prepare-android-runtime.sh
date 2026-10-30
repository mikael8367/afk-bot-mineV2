#!/usr/bin/env bash
set -euo pipefail

# Node.js Android ARM64 runtime is provided by Towartz/nodejs-arm.
# Keep this attribution and the upstream license notices with every distribution.
# Upstream: https://github.com/Towartz/nodejs-arm
# Author: Towartz (21_whiten)
# License: GPL-3.0-or-later WITH additional restrictions; see runtime/THIRD_PARTY_NOTICES.md.
#
# Pinned upstream release asset; update only after reviewing its source, license,
# release notes, and SHA-256 digest.
NODE_ARCHIVE_URL="https://github.com/Towartz/nodejs-arm/releases/download/node-android-v26.7.0-run159/node-v26.7.0-android-arm64-v8a.zip"
NODE_ARCHIVE_SHA256="3bdef25356d63f54b2de00d40f8d4852d3cdfa587702dfbe53e82e64c68b66a7"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
command -v unzip >/dev/null || { echo "unzip is required" >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "sha256sum is required" >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required" >&2; exit 1; }
command -v file >/dev/null || { echo "file is required" >&2; exit 1; }
command -v readelf >/dev/null || { echo "readelf is required" >&2; exit 1; }

curl --fail --location --retry 3 "$NODE_ARCHIVE_URL" -o "$TMP_DIR/node-runtime.zip"
echo "$NODE_ARCHIVE_SHA256  $TMP_DIR/node-runtime.zip" | sha256sum --check -
mkdir -p "$TMP_DIR/runtime"
unzip -q "$TMP_DIR/node-runtime.zip" -d "$TMP_DIR/runtime"
NODE_BIN="$(find "$TMP_DIR/runtime" -type f -name node -print -quit)"
test -n "$NODE_BIN"
chmod 755 "$NODE_BIN"

# APK's native-library packaging extracts this executable into nativeLibraryDir.
# It is intentionally named libnode.so so Android packages it as a native library;
# it remains an executable Node.js CLI, not a JNI shared object.
JNI_DIR="$ROOT_DIR/app/src/main/jniLibs/arm64-v8a"
mkdir -p "$JNI_DIR"
install -m 755 "$NODE_BIN" "$JNI_DIR/libnode.so"
file "$JNI_DIR/libnode.so" | grep -q "ELF 64-bit" || { echo "Unexpected Node runtime binary" >&2; exit 1; }
readelf -h "$JNI_DIR/libnode.so" | grep -q "AArch64" || { echo "Node runtime is not compiled for ARM64/AArch64" >&2; exit 1; }

PANEL_ASSET_DIR="$ROOT_DIR/app/src/main/assets/panel"
rm -rf "$PANEL_ASSET_DIR"
mkdir -p "$PANEL_ASSET_DIR"
cp -R "$ROOT_DIR/public/." "$PANEL_ASSET_DIR/"

ASSET_DIR="$ROOT_DIR/app/src/main/assets/local-server"
rm -rf "$ASSET_DIR"
mkdir -p "$ASSET_DIR"
cp -R "$ROOT_DIR/src" "$ASSET_DIR/src"
cp -R "$ROOT_DIR/public" "$ASSET_DIR/public"
cp "$ROOT_DIR/package.json" "$ASSET_DIR/package.json"
if [ -f "$ROOT_DIR/package-lock.json" ]; then
  cp "$ROOT_DIR/package-lock.json" "$ASSET_DIR/package-lock.json"
else
  echo "package-lock.json not found; resolving a lockfile for this build." >&2
  (cd "$ASSET_DIR" && npm install --package-lock-only --ignore-scripts --no-audit --no-fund)
fi
# Omit optional native addons so Linux host binaries cannot enter the Android APK.
(cd "$ASSET_DIR" && npm ci --omit=dev --omit=optional --no-audit --no-fund)
test -f "$ASSET_DIR/node_modules/mineflayer/package.json"
test -f "$ASSET_DIR/node_modules/bedrock-protocol/package.json"
node "$ROOT_DIR/scripts/prepare-android-modules.mjs" "$ASSET_DIR"
if find "$ASSET_DIR/node_modules" -type f -name "*.node" -print -quit | grep -q .; then
  echo "Unsupported native Node addon remains in Android bundle." >&2
  exit 1
fi
printf 'AFK Bot Mine V2 local runtime bundle\n' > "$ASSET_DIR/.bundle-info"

cp "$ROOT_DIR/runtime/THIRD_PARTY_NOTICES.md" "$ASSET_DIR/THIRD_PARTY_NOTICES.md"
cp "$ROOT_DIR/runtime/UPSTREAM-LICENSE.txt" "$ASSET_DIR/UPSTREAM-LICENSE.txt"
echo "Android ARM64 Node runtime and local server assets staged."
