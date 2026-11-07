#!/bin/sh
# Launches Beat Saber (1.42.2 Reactive instance) in FPFC mode inside a headless gamescope session.
# Screenshots: GAMESCOPE_WAYLAND_DISPLAY=gamescope-0 gamescopectl screenshot <path>
# Input:       DISPLAY=:1 xdotool ...
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$HERE/../shots"
BS="${BEAT_SABER_DIR:-/mnt/sdb2/BSManager/BSInstances/1.42.2 Reactive}"
export STEAM_COMPAT_CLIENT_INSTALL_PATH="$HOME/.steam/root"
export STEAM_COMPAT_DATA_PATH="$HOME/.steam/root/steamapps/compatdata/620980"
export SteamAppId=620980
export SteamGameId=620980
export PROTON_LOG=1
export PROTON_LOG_DIR="$HERE/../shots"
export DXVK_LOG_LEVEL=warn
cd "$BS"
exec gamescope --backend headless -W 2560 -H 1440 -w 2560 -h 1440 --force-windows-fullscreen -- \
  python3 "$HOME/.steam/root/compatibilitytools.d/GE-Proton-latest/proton" run "$BS/Beat Saber.exe" fpfc -screen-width 2560 -screen-height 1440 -screen-fullscreen 0
