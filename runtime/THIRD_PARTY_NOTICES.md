# Third-party notices — Android local runtime

## Node.js for Android ARM

The Android ARM64 Node.js executable is obtained from:

- Project: https://github.com/Towartz/nodejs-arm
- Maintainer: Towartz (21_whiten)
- Upstream release used by the staging script: `node-android-v26.7.0-run159`
- Asset: `node-v26.7.0-android-arm64-v8a.zip`
- Upstream license: GNU GPL version 3 or later, with additional restrictions.

The upstream project requires prominent attribution, preservation of notices, and a visible reference to the original repository and author in derived build workflows. The upstream project must not be rebranded in a way that hides its origin. This project does not claim authorship of that runtime.

The upstream license text and additional restrictions are available at:
https://github.com/Towartz/nodejs-arm/blob/main/LICENSE

Before distributing an APK containing this runtime, include the complete upstream LICENSE text in the APK's third-party notices and have the distribution obligations reviewed. The staging script verifies the pinned archive SHA-256 before extracting it.

Node.js itself is not an officially supported Android target in the upstream Node.js project. Compatibility of this runtime with this app, Android versions, and Minecraft protocol libraries must be demonstrated by build and device tests; upstream ARM64 build claims are not a substitute for those tests.
