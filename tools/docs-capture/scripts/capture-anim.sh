#!/bin/sh
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
SHOTS="$HERE/../shots"
mkdir -p "$SHOTS"
B=$HERE/bscmd.sh
C=$HERE/cap.sh
$B "console off" "canvas 20" "canvasref 10 3.44" >/dev/null
freeze() { sleep $1; $B "timescale 0" >/dev/null; }
echo "--- timing"
$B "show Timing" "wait 40" >/dev/null; $B "set TimingSample 0 Target 1" >/dev/null; freeze 0.18; $C animation/timing.png; $B "timescale 1" >/dev/null
echo "--- curves"
$B "show Curves" "wait 40" >/dev/null; $B "call CurvesSample 0 Play" >/dev/null; freeze 0.45; $C animation/curves.png; $B "timescale 1" >/dev/null
echo "--- interpolators"
$B "show Interpolators" "wait 40" >/dev/null; $B "call InterpolatorsSample 0 Play" >/dev/null; freeze 0.28; $C animation/interpolators.png; $B "timescale 1" >/dev/null
