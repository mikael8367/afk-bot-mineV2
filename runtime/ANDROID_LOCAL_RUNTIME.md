# Android local runtime — implementation status

This branch is for adding a true on-device bot engine alongside the existing Render engine.

## Required architecture

- Node.js ARM64 executable packaged in the APK (not downloaded after installation).
- Android foreground service owns the local Node process.
- Local HTTP API bound only to `127.0.0.1`; never expose the local bot API on all network interfaces.
- The existing panel selects Render or Device and targets the matching API.
- Local backend bundle contains the same Java/Bedrock bot engine, public panel, and pinned production dependencies.
- Service shutdown disconnects the bot and terminates the child process.
- Device mode is available only on ARM64 devices supported by the packaged runtime.

## Runtime source and attribution

The current staging script uses the pinned Node.js ARM64 release from Towartz's Node.js for Android project. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Its additional license restrictions require preserving attribution in distributed artifacts and build workflows.

## Current state

`scripts/prepare-android-runtime.sh` downloads and verifies the pinned runtime archive, stages the executable under Android's ARM64 native-library directory, and stages the backend/panel assets. It requires a committed `package-lock.json` before it can install production dependencies reproducibly.

This is only the runtime-staging foundation. It does **not** yet provide the Android foreground service, local API lifecycle, WebView mode switching, or a tested APK. Do not expose a Device mode selector until those pieces are implemented and verified.

## Verification still required

1. Generate and review a lockfile using Node.js 24 or newer.
2. Run the staging script and verify the executable with `file`, `readelf`, and `node --version`.
3. Verify the Node executable starts on Android API 31 / ARM64.
4. Start the backend on loopback and exercise health, versions, connect/disconnect, logs, chat, and reconnect APIs.
5. Confirm Bedrock 1.26.60 and Java bot dependencies work without unsupported native addons.
6. Verify foreground-service behavior, notifications, process recovery, battery restrictions, and memory use on a physical Galaxy A12.
7. Run the full test suite and inspect the final APK contents before calling Device mode complete.
