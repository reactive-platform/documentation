#!/bin/sh
# Usage: cap.sh <asset path under public/assets> [margin]   -- shoots over black and white and mattes.
# The sample must already be shown. Writes public/assets/<path>.
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
SHOTS="$HERE/../shots"
mkdir -p "$SHOTS"
D=$REPO/public/assets/$1
n=$(basename "$1" .png)
$HERE/bscmd.sh "bg 0 0 0" "wait 3" >/dev/null
$HERE/shot.sh "${n}_b" >/dev/null
$HERE/bscmd.sh "bg 1 1 1" "wait 3" >/dev/null
$HERE/shot.sh "${n}_w" >/dev/null
mkdir -p "$(dirname "$D")"
python3 -I $HERE/matte.py "$SHOTS/${n}_b.png" "$SHOTS/${n}_w.png" "$D" ${2:-24}
