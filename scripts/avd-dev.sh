#!/usr/bin/env bash
# Drive the Cultuvilla dev client on an Android AVD from WSL2.
#
# Background: under WSL2 the Android emulator runs on the Windows host,
# so the Linux-side `adb` cannot see it. This wrapper always uses the
# Windows-side adb.exe and exposes the operations we actually need.
#
# Subcommands:
#   boot   [<avd>]            Launch the AVD (default: Cultuvilla_Big) and
#                             wait for boot_completed=1.
#   reverse                   `adb reverse tcp:8081 tcp:8081` so the device
#                             can reach the Metro bundler running in WSL.
#   open                      Force-stop + open Cultuvilla (Dev) pointed at
#                             http://localhost:8081 via the dev-launcher
#                             deep link.
#   metro                     Start Metro in apps/mobile (foreground, kill
#                             with Ctrl-C). Sets ADB_PATH so expo finds
#                             adb.exe if it ever needs it.
#   shot   [<out.png>]        Save a screenshot (default: /tmp/avd.png).
#   logs   [<seconds>]        Tail logcat for the app process, filtered
#                             for JS warnings / errors / firestore-deny.
#                             Default: stream until Ctrl-C.
#   denies [<seconds>]        Stream ONLY [firestore-deny*] lines.
#                             Default: stream until Ctrl-C.
#   tap    <x> <y>            Tap at logical pixel coordinates.
#   key    <KEYCODE>          Send a keycode (e.g. BACK, HOME, MENU).
#   doctor                    Print device + Metro status.
#
# Usage:
#   ./scripts/avd-dev.sh boot
#   ./scripts/avd-dev.sh reverse
#   ./scripts/avd-dev.sh metro &
#   ./scripts/avd-dev.sh open
#   ./scripts/avd-dev.sh denies
set -euo pipefail

ADB=${ADB:-/mnt/c/Users/alvar/AppData/Local/Android/Sdk/platform-tools/adb.exe}
EMU=${EMU:-/mnt/c/Users/alvar/AppData/Local/Android/Sdk/emulator/emulator.exe}
PKG=${PKG:-com.cultuvilla.app.dev}
SCHEME=${SCHEME:-cultuvilla}
METRO_URL=${METRO_URL:-http://localhost:8081}
DEFAULT_AVD=${DEFAULT_AVD:-Cultuvilla_Big}

cmd=${1:-doctor}; shift || true

require_adb() {
  [ -x "$ADB" ] || { echo "adb.exe not found at $ADB" >&2; exit 1; }
}

case "$cmd" in
  boot)
    require_adb
    avd=${1:-$DEFAULT_AVD}
    if "$ADB" devices | grep -qE "^emulator-.*device$"; then
      echo "[boot] device already attached"
    else
      [ -x "$EMU" ] || { echo "emulator.exe not found at $EMU" >&2; exit 1; }
      echo "[boot] launching $avd"
      nohup "$EMU" "@$avd" -no-snapshot-save >/tmp/avd-$avd.log 2>&1 &
      disown
    fi
    until "$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' | grep -q 1; do
      sleep 2
    done
    "$ADB" devices
    ;;
  reverse)
    require_adb
    "$ADB" reverse tcp:8081 tcp:8081
    "$ADB" reverse --list
    ;;
  open)
    require_adb
    "$ADB" shell am force-stop "$PKG"
    sleep 1
    encoded=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$METRO_URL")
    "$ADB" shell am start -a android.intent.action.VIEW \
      -d "$SCHEME://expo-development-client/?url=$encoded"
    ;;
  metro)
    cd "$(git rev-parse --show-toplevel)/apps/mobile"
    ADB_PATH="$ADB" exec pnpm start "$@"
    ;;
  shot)
    require_adb
    out=${1:-/tmp/avd.png}
    "$ADB" exec-out screencap -p > "$out"
    echo "$out"
    ;;
  logs)
    require_adb
    pid=$("$ADB" shell pidof "$PKG" | tr -d '\r')
    [ -n "$pid" ] || { echo "$PKG not running" >&2; exit 1; }
    if [ "${1:-}" ]; then
      timeout "$1" "$ADB" logcat -v brief --pid="$pid" 2>&1 \
        | grep -E --line-buffered "ReactNativeJS|firestore-deny|FirebaseError|chromium.*ERROR" || true
    else
      "$ADB" logcat -v brief --pid="$pid" 2>&1 \
        | grep -E --line-buffered "ReactNativeJS|firestore-deny|FirebaseError|chromium.*ERROR"
    fi
    ;;
  denies)
    require_adb
    pid=$("$ADB" shell pidof "$PKG" | tr -d '\r')
    [ -n "$pid" ] || { echo "$PKG not running" >&2; exit 1; }
    if [ "${1:-}" ]; then
      timeout "$1" "$ADB" logcat -v brief --pid="$pid" 2>&1 \
        | grep -E --line-buffered "firestore-deny" || true
    else
      "$ADB" logcat -v brief --pid="$pid" 2>&1 \
        | grep -E --line-buffered "firestore-deny"
    fi
    ;;
  tap)
    require_adb
    "$ADB" shell input tap "$1" "$2"
    ;;
  key)
    require_adb
    "$ADB" shell input keyevent "KEYCODE_$1"
    ;;
  doctor)
    require_adb
    echo "adb     : $ADB"
    "$ADB" version | head -2
    echo "devices :"
    "$ADB" devices
    echo "reverse :"
    "$ADB" reverse --list || true
    pid=$("$ADB" shell pidof "$PKG" 2>/dev/null | tr -d '\r' || true)
    echo "$PKG pid: ${pid:-<not running>}"
    if curl -sf "$METRO_URL/status" >/dev/null 2>&1; then
      echo "metro   : up ($METRO_URL)"
    else
      echo "metro   : down ($METRO_URL)"
    fi
    ;;
  *)
    sed -n '2,40p' "$0"
    exit 2
    ;;
esac
