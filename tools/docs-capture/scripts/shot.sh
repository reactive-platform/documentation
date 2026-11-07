#!/bin/sh
# Usage: shot.sh <name>  -> scratchpad/shots/<name>.png
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
SHOTS="$HERE/../shots"
mkdir -p "$SHOTS"
rm -f "$SHOTS/$1.png"
GAMESCOPE_WAYLAND_DISPLAY=gamescope-0 gamescopectl screenshot "$SHOTS/$1.png" >/dev/null 2>&1
for i in $(seq 1 100); do [ -s "$SHOTS/$1.png" ] && break; sleep 0.1; done
sleep 0.3
ls -la "$SHOTS/$1.png" | awk '{print $5, $9}'
