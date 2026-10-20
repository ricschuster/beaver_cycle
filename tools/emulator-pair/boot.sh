#!/bin/sh
# usage: boot.sh SERIAL CDPPORT URL
export PATH=~/Android/Sdk/platform-tools:$PATH
adb -s $1 shell am force-stop com.beavercycle.live; adb -s $1 shell am start -n com.beavercycle.live/.MainActivity >/dev/null; sleep 15
pid=$(adb -s $1 shell pidof com.beavercycle.live | tr -d '\r'); adb -s $1 forward tcp:$2 localabstract:webview_devtools_remote_$pid >/dev/null
node "$(dirname "$0")/cdp.mjs" $2 navigate "$3" >/dev/null; sleep 15
node "$(dirname "$0")/cdp.mjs" $2 eval "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Go').click()"
sleep 20
node "$(dirname "$0")/cdp.mjs" $2 eval "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Let\\'s go')?.click()"
