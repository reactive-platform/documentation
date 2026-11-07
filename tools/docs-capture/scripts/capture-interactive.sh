#!/bin/sh
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
SHOTS="$HERE/../shots"
mkdir -p "$SHOTS"
B=$HERE/bscmd.sh
C=$HERE/cap.sh
$B "console off" "canvas 20" "canvasref 10 3.44" >/dev/null
echo "--- table / scroll area"
$B "show Table 100 60" "wait 40" "call TableSample 0 Context.ScrollTo 70 true" "wait 20" | grep -v "^ok"; $C lists/table.png
$B "show ScrollArea 100 60" "wait 40" "call ScrollAreaSample 0 Context.ScrollTo 40 true" "wait 20" | grep -v "^ok"; $C sdk/scroll-area.png
echo "--- dropdown"
$B "show Dropdown" "wait 40" "set BsDropdown 1 _modalOpened.Value true" "wait 40" | grep -v "^ok"; $C sdk/dropdown.png
echo "--- input field"
$B "show InputField 140 80" "wait 40" "set BsInputField 0 Context.Focused true" "wait 50" | grep -v "^ok"; $C sdk/input-field.png
echo "--- color picker"
$B "show ColorPicker 140 80" "wait 40" "set BsColorPicker 0 Context.Focused true" "wait 50" | grep -v "^ok"; $C sdk/color-picker.png
echo "--- modal / dialog"
$B "show Modal 140 80" "wait 40" "set Modal 0 IsPushed true" "wait 50" | grep -v "^ok"; $C sdk/modal.png
$B "show Dialog 140 80" "wait 40" "set Dialog 0 IsPushed true" "wait 50" | grep -v "^ok"; $C sdk/dialog.png
echo "--- animated state (hovered)"
$B "show AnimatedState" "wait 40" "pointer Background 0 enter" "wait 40" | grep -v "^ok"; $C animation/animated-state.png
