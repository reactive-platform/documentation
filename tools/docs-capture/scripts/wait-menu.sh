#!/bin/sh
# Waits until the game has reached the main menu and the driver answers. Showing a sample before the menu scene
# exists breaks Reactive's resource initialisers for the rest of the process, so run this after launch-bs.sh.
HERE=$(cd "$(dirname "$0")" && pwd)
BS="${BEAT_SABER_DIR:-/mnt/sdb2/BSManager/BSInstances/1.42.2 Reactive}"
LOG="$BS/Logs/_latest.log"
start=$(date +%s)
for i in $(seq 1 120); do
  if [ -f "$LOG" ] && [ "$(stat -c %Y "$LOG")" -ge "$start" ] && grep -q "SongCore\] Saving cached song data" "$LOG" 2>/dev/null; then
    break
  fi
  sleep 2
done
# The menu scene is still being built when SongCore finishes, so give it a while longer
sleep 30
for i in $(seq 1 10); do
  case "$($HERE/bscmd.sh nop 2>&1)" in *TIMEOUT*) ;; *) echo ready; exit 0;; esac
done
echo "driver did not answer"; exit 1
