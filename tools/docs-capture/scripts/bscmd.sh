#!/bin/sh
# Usage: bscmd.sh "cmd1" "cmd2" ...   (each argument is one driver command)
# Writes UserData/docs-capture.cmd, waits for docs-capture.out, prints it.
U="${BEAT_SABER_DIR:-/mnt/sdb2/BSManager/BSInstances/1.42.2 Reactive}/UserData"
rm -f "$U/docs-capture.out"
printf '%s\n' "$@" > "$U/docs-capture.cmd.tmp" && mv "$U/docs-capture.cmd.tmp" "$U/docs-capture.cmd"
for i in $(seq 1 600); do
  [ -f "$U/docs-capture.out" ] && { cat "$U/docs-capture.out"; exit 0; }
  sleep 0.05
done
echo "TIMEOUT waiting for driver"; exit 1
