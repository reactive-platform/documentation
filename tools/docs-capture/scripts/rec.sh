#!/bin/sh
# Usage: rec.sh <name> <asset.webp> <show args> -- <cmd> <cmd> ...
# Shows the sample on the dark backdrop, records the commands at 20 fps and encodes the clip.
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
SHOTS="$HERE/../shots"
mkdir -p "$SHOTS"
U="${BEAT_SABER_DIR:-/mnt/sdb2/BSManager/BSInstances/1.42.2 Reactive}/UserData"
name=$1; asset=$2; showargs=$3; shift 3
[ "$1" = "--" ] && shift
$HERE/bscmd.sh "bg 0.1098 0.1098 0.1294" "show $showargs" "wait 40" "rec start $name 20" "$@" "rec stop" | grep -v "^ok" 
python3 -I $HERE/gif.py "$U/docs-rec/$name" "$REPO/public/assets/$asset"
