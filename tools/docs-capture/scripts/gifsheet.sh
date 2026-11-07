#!/bin/sh
# Usage: gifsheet.sh <out.png> <gif>...  -- 4 coalesced frames per gif (first, 1/3, 2/3, last), one row per gif
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
SHOTS="$HERE/../shots"
mkdir -p "$SHOTS"
out=$1; shift; rows=""; t=$(mktemp -d)
for g in "$@"; do
  [ -f "$g" ] || continue
  rm -f $t/*.png; magick "$g" -coalesce $t/f-%03d.png
  n=$(ls $t/*.png | wc -l); a=$((n/3)); b=$((2*n/3)); c=$((n-1))
  r=$t/row-$(basename $g .gif).png
  magick $(printf "$t/f-%03d.png " 0 $a $b $c) -resize 360x200 -background '#2b2b30' -gravity center -extent 360x200 +append -bordercolor '#444' -border 2 "$r"
  rows="$rows $r"
done
magick $rows -append "$out"; rm -rf $t; echo "$out"
