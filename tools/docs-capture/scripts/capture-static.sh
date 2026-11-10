#!/bin/sh
# Captures every sample that needs no interaction. Each line: sample [w h] -> asset path
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
SHOTS="$HERE/../shots"
mkdir -p "$SHOTS"
B=$HERE/bscmd.sh
one() {  # one <sample> <asset> [w] [h] [waitframes]
  $B "show $1 ${3:-} ${4:-}" "wait ${5:-40}" | grep -v "^ok" 
  $HERE/cap.sh "$2"
}
$B "console off" "canvas 20" "canvasref 10 3.44" >/dev/null
one Hello components/hello.png
one Composing components/composing.png
one Counter intro/counter.png
cp $REPO/public/assets/intro/counter.png $REPO/public/assets/intro/quick-start.png
one Settings intro/coming-from-bsml.png 110 60
one Containers1 layout/containers-1.png 110 70
one Containers2 layout/containers-2.png 110 70
one FlexItems layout/flex-item.png 230 100
one RootSizes layout/root-expands.png 230 80
one Roots layout/roots-2.png
one Visibility layout/visibility.png
one Buttons sdk/buttons.png
one ButtonContent sdk/button-content.png
one PrimaryButtons sdk/primary-buttons.png
one PrimaryLoading sdk/primary-loading.png
one AeroButtons sdk/aero-buttons.png
one Toggle sdk/toggle.png
one Slider sdk/slider.png
one SegmentedControl sdk/segmented-control.png
one KeyedContainer sdk/keyed-container.png
one ListControl sdk/list-control.png
one ColorCircle sdk/color-circle.png
one Gradient sdk/gradient.png
one Fills sdk/fills.png
one LabelsStyles sdk/labels-styles.png
one LabelsRich sdk/labels-rich.png
one LabelsAutosize sdk/labels-autosize.png
one Repeater lists/repeater.png
one Selection lists/selection.png
one Table lists/table.png 100 60
one WebImages sdk/web-image.png "" "" 150
