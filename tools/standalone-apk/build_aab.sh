#!/usr/bin/env bash
# Build the release App Bundle for Google Play and sign it with the upload key (see README, "Release bundle for Google Play").
# Run from tools/standalone-apk after `npm run build` at the repo root, `npx cap sync android`, and local.properties. The key
# lives outside the repo: KEYSTORE (default ~/.beaver-cycle-keys/upload.jks) with its password in KEYSTORE_PASSWORD or the file
# next to it, password.txt. Writes android/app/build/outputs/bundle/release/beaver-cycle-<versionName>-signed.aab.
set -euo pipefail
: "${ANDROID_HOME:?set ANDROID_HOME}" "${JAVA_HOME:?set JAVA_HOME (JDK 21)}"
KEYSTORE="${KEYSTORE:-$HOME/.beaver-cycle-keys/upload.jks}"
ALIAS="${KEY_ALIAS:-upload}"
PASSWORD="${KEYSTORE_PASSWORD:-$(cat "$(dirname "$KEYSTORE")/password.txt")}"
cd "$(dirname "$0")/android"
./gradlew bundleRelease -q
out=app/build/outputs/bundle/release
version=$(sed -n 's/.*versionName "\(.*\)".*/\1/p' app/build.gradle)
signed="$out/beaver-cycle-$version-signed.aab"
cp "$out/app-release.aab" "$signed"
"$JAVA_HOME/bin/jarsigner" -sigalg SHA256withRSA -digestalg SHA-256 -keystore "$KEYSTORE" -storepass "$PASSWORD" "$signed" "$ALIAS" >/dev/null
"$JAVA_HOME/bin/jarsigner" -verify "$signed" | head -1
echo "$signed"
