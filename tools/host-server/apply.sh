#!/bin/sh
# Adds the HostServer plugin (WebSocket server for the host tablet, #662) to a generated Capacitor Android project.
# Usage: tools/host-server/apply.sh tools/tablet-live/android
set -e
ANDROID="$1"
[ -d "$ANDROID/app" ] || { echo "usage: apply.sh <capacitor android dir>"; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$ANDROID/app/src/main/java/com/beavercycle/hostserver"
mkdir -p "$PKG_DIR"
cp "$HERE/HostServerPlugin.java" "$PKG_DIR/"
MAIN="$(find "$ANDROID/app/src/main/java" -name MainActivity.java | head -1)"
if ! grep -q HostServerPlugin "$MAIN"; then
  python3 - "$MAIN" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p).read()
s = s.replace("import com.getcapacitor.BridgeActivity;", "import com.beavercycle.hostserver.HostServerPlugin;\nimport com.getcapacitor.BridgeActivity;")
if "super.onCreate(savedInstanceState);" in s:
    # A MainActivity of our own (tools/standalone-apk/shell): the plugin is registered before super.onCreate.
    s = s.replace("super.onCreate(savedInstanceState);", "registerPlugin(HostServerPlugin.class);\n    super.onCreate(savedInstanceState);", 1)
else:
    s = s.replace("import com.beavercycle.hostserver.HostServerPlugin;", "import android.os.Bundle;\nimport com.beavercycle.hostserver.HostServerPlugin;")
    s = re.sub(r"public class MainActivity extends BridgeActivity \{\}", "public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(HostServerPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n}", s)
open(p, "w").write(s)
PY
fi
GRADLE="$ANDROID/app/build.gradle"
grep -q Java-WebSocket "$GRADLE" || sed -i "s|^    implementation project(':capacitor-android')|    implementation project(':capacitor-android')\n    implementation 'org.java-websocket:Java-WebSocket:1.5.7'|" "$GRADLE"
echo "HostServer plugin added to $ANDROID"
