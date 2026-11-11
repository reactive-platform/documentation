#!/bin/sh
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
SHOTS="$HERE/../shots"
mkdir -p "$SHOTS"
R=$HERE/rec.sh
B=$HERE/bscmd.sh
A=$REPO/public/assets
$B "console off" "canvas 10" "canvasref 10 3.44" >/dev/null

hover() { # hover <type> <count>
  t=$1; n=$2; i=0; out=""
  while [ $i -lt $n ]; do out="$out|pointer $t $i enter|wait 10|pointer $t $i exit|wait 4"; i=$((i+1)); done
  echo "$out"
}
# split a |-separated list into arguments
run() { name=$1; asset=$2; show=$3; seq=$4; oldIFS=$IFS; IFS='|'; set -- $seq; IFS=$oldIFS; shift; $R "$name" "$asset" "$show" -- "$@"; }

run counter intro/counter.webp "Counter" "|wait 10|pointer BsPrimaryTextButton 0 click|wait 12|pointer BsPrimaryTextButton 0 click|wait 12|pointer BsPrimaryTextButton 0 click|wait 20"
cp $A/intro/counter.webp $A/intro/quick-start.webp
run settings intro/coming-from-bsml.webp "Settings 110 60" "|wait 10|pointer BsToggle 0 click|wait 15|set Settings 0 Volume 50|wait 10|set Settings 0 Volume 30|wait 15|set Settings 0 Language english|wait 20|pointer BsToggle 0 click|wait 15"
run visibility layout/visibility.webp "Visibility" "|wait 10|set Visibility 0 Shown true|wait 25|set Visibility 0 Shown false|wait 25|set Visibility 0 Shown true|wait 25|set Visibility 0 Shown false|wait 10"
run animated-state animation/animated-state.webp "AnimatedState" "|wait 10|pointer Background 0 enter|wait 30|pointer Background 0 exit|wait 30|pointer Background 0 enter|wait 30|pointer Background 0 exit|wait 15"
run timing animation/timing.webp "Timing" "|wait 5|set TimingSample 0 Target 1|wait 40|set TimingSample 0 Target 0|wait 40"
run curves animation/curves.webp "Curves" "|wait 5|call CurvesSample 0 Play|wait 45|call CurvesSample 0 Play|wait 45"
run interpolators animation/interpolators.webp "Interpolators" "|wait 5|call InterpolatorsSample 0 Play|wait 35|call InterpolatorsSample 0 Play|wait 35"
run repeater lists/repeater.webp "Repeater" "|wait 10|pointer BsTextButton 0 click|wait 15|pointer BsTextButton 0 click|wait 15|pointer BsTextButton 1 click|wait 12|pointer BsTextButton 1 click|wait 12|pointer BsTextButton 1 click|wait 15"
run selection lists/selection.webp "Selection" "|wait 10|pointer Background 1 down|wait 12|pointer Background 4 down|wait 12|pointer Background 2 down|wait 12|pointer Background 3 down|wait 15"
run table lists/table.webp "Table 100 60" "|wait 10|call TableSample 0 Context.ScrollTo 150 false|wait 40|call TableSample 0 Context.ScrollTo 4000 false|wait 40|call TableSample 0 Context.ScrollTo 0 false|wait 40"
run buttons sdk/buttons.webp "Buttons" "|wait 5$(hover BsTextButton 5)|pointer BsImageButton 0 enter|wait 10|pointer BsImageButton 0 exit|wait 10"
run button-content sdk/button-content.webp "ButtonContent" "|wait 10|pointer BsButton 0 click|wait 14|pointer BsButton 0 click|wait 14|pointer BsButton 0 click|wait 15"
run primary-buttons sdk/primary-buttons.webp "PrimaryButtons" "|wait 5$(hover BsPrimaryTextButton 3)|pointer BsPrimaryImageButton 0 enter|wait 10|pointer BsPrimaryImageButton 0 exit|wait 10"
run primary-loading sdk/primary-loading.webp "PrimaryLoading" "|wait 8|pointer BsPrimaryButton 0 click|wait 62"
run aero-buttons sdk/aero-buttons.webp "AeroButtons" "|wait 5$(hover BsAeroButton 3)|wait 8"
run toggle sdk/toggle.webp "Toggle" "|wait 8|pointer BsToggle 0 click|wait 15|pointer BsToggle 1 click|wait 15|pointer BsToggle 2 click|wait 15|pointer BsToggle 0 click|wait 12"
run slider sdk/slider.webp "Slider" "|wait 8|set BsSlider 0 Value 0.55|wait 1|set BsSlider 0 Value 0.6|wait 1|set BsSlider 0 Value 0.65|wait 1|set BsSlider 0 Value 0.7|wait 1|set BsSlider 0 Value 0.75|wait 1|set BsSlider 0 Value 0.8|wait 1|set BsSlider 0 Value 0.85|wait 1|set BsSlider 0 Value 0.9|wait 12|set BsSlider 1 Value 4|wait 3|set BsSlider 1 Value 5|wait 3|set BsSlider 1 Value 6|wait 3|set BsSlider 1 Value 7|wait 3|set BsSlider 1 Value 8|wait 12|set BsSlider 2 Value 0.3|wait 1|set BsSlider 2 Value 0.35|wait 1|set BsSlider 2 Value 0.4|wait 1|set BsSlider 2 Value 0.45|wait 1|set BsSlider 2 Value 0.5|wait 1|set BsSlider 2 Value 0.55|wait 1|set BsSlider 2 Value 0.6|wait 15"
run segmented-control sdk/segmented-control.webp "SegmentedControl" "|wait 10|set BsSegmentedControl 0 Key 1|wait 15|set BsSegmentedControl 0 Key 2|wait 15|set BsSegmentedControl 1 Key 1|wait 15|set BsSegmentedControl 1 Key 2|wait 15|set BsSegmentedControl 0 Key 0|wait 2|set BsSegmentedControl 1 Key 0|wait 15"
run keyed-container sdk/keyed-container.webp "KeyedContainer" "|wait 10|set BsSegmentedControl 0 Key Slider|call BsSegmentedControl 0 OnKeyChanged Slider|wait 22|set BsSegmentedControl 0 Key Buttons|call BsSegmentedControl 0 OnKeyChanged Buttons|wait 22|set BsSegmentedControl 0 Key Toggle|call BsSegmentedControl 0 OnKeyChanged Toggle|wait 18"
run dropdown sdk/dropdown.webp "Dropdown" "|wait 10|set BsDropdown 1 _modalOpened.Value true|wait 30|set BsDropdown 1 Key 5|wait 6|set BsDropdown 1 _modalOpened.Value false|wait 25"
run list-control sdk/list-control.webp "ListControl" "|wait 10|set BsListControl 0 Key Expert+|wait 15|set BsListControl 0 Key Hard|wait 15|set BsListControl 1 Key 1|wait 15|set BsListControl 1 Key 2|wait 15|set BsListControl 2 Key Easy|wait 15"
run input-field sdk/input-field.webp "InputField 140 80" "|wait 10|set BsInputField 0 Context.Focused true|wait 25|set BsInputField 0 Context.Text S|wait 5|set BsInputField 0 Context.Text Sa|wait 5|set BsInputField 0 Context.Text Sab|wait 5|set BsInputField 0 Context.Text Sabe|wait 5|set BsInputField 0 Context.Text Saber|wait 20|set BsInputField 0 Context.Focused false|wait 20"
run color-picker sdk/color-picker.webp "ColorPicker 140 80" "|wait 10|set BsColorPicker 0 Context.Focused true|wait 25|set BsColorPicker 0 Context.Color 1,0.3,0.2|wait 10|set BsColorPicker 0 Context.Color 0.3,1,0.4|wait 10|set BsColorPicker 0 Context.Color 0.5,0.3,1|wait 10|set BsColorPicker 0 Context.SelectedColor 0.5,0.3,1|wait 5|set BsColorPicker 0 Context.Focused false|wait 25"
hues=""; for h in 0.05 0.12 0.2 0.28 0.36 0.45 0.55 0.65 0.75 0.85 0.93; do c=$(python3 -c "import colorsys;print(','.join('%.3f'%v for v in colorsys.hsv_to_rgb($h,0.85,1)))"); hues="$hues|set ColorCircleSample 0 Live $c|wait 3"; done
run color-circle sdk/color-circle.webp "ColorCircle" "|wait 8$hues|set ColorCircleSample 0 Saved 0.5,0.3,1|wait 20"
run modal sdk/modal.webp "Modal 140 80" "|wait 10|set Modal 0 IsPushed true|wait 35|set Modal 0 IsPushed false|wait 30"
run dialog sdk/dialog.webp "Dialog 140 80" "|wait 10|set Dialog 0 IsPushed true|wait 35|set Dialog 0 IsPushed false|wait 30"
run gradient sdk/gradient.webp "Gradient" "|wait 8|call GradientSample 0 Swap|wait 30|call GradientSample 0 Swap|wait 30"
run fills sdk/fills.webp "Fills" "|wait 5|set FillsSample 0 Fill 1|wait 30|set FillsSample 0 Fill 0.2|wait 30|set FillsSample 0 Fill 0.65|wait 25"
run labels-autosize sdk/labels-autosize.webp "LabelsAutosize" "|wait 5|set LabelsAutosizeSample 0 Width 14|wait 40|set LabelsAutosizeSample 0 Width 40|wait 40"
run scroll-area sdk/scroll-area.webp "ScrollArea 100 60" "|wait 10|call ScrollAreaSample 0 Context.ScrollTo 60 false|wait 35|call ScrollAreaSample 0 Context.ScrollTo 0 false|wait 35"
run radial-showcase layout/radial-showcase.webp "RadialShowcase" "|wait 10|set RadialShowcaseSample 0 Radius 9|wait 6|set RadialShowcaseSample 0 Radius 8|wait 6|set RadialShowcaseSample 0 Radius 7|wait 6|set RadialShowcaseSample 0 Radius 6|wait 6|wait 12|set RadialShowcaseSample 0 Radius 7|wait 6|set RadialShowcaseSample 0 Radius 8|wait 6|set RadialShowcaseSample 0 Radius 9|wait 6|set RadialShowcaseSample 0 Radius 10|wait 6|set RadialShowcaseSample 0 Radius 11|wait 6|wait 12|set RadialShowcaseSample 0 Radius 10|wait 10"
run radial-in-flex layout/radial-in-flex.webp "RadialInFlex" "|wait 12|set RadialInFlexSample 0 Stage 1|wait 22|set RadialInFlexSample 0 Stage 2|wait 22|set RadialInFlexSample 0 Stage 3|wait 34|set RadialInFlexSample 0 Stage 0|wait 16"
run flex-in-radial layout/flex-in-radial.webp "FlexInRadial" "|wait 10|set FlexInRadialSample 0 Caption 1|wait 25|set FlexInRadialSample 0 Expanded true|wait 25|set FlexInRadialSample 0 Caption 0|wait 20|set FlexInRadialSample 0 Expanded false|wait 20"
# web images: record from the moment the sample appears, so the load is visible
$B "bg 0.1098 0.1098 0.1294" "clear" "wait 3" "rec start web-image 20" "wait 2" "show WebImages" "wait 70" "rec stop" | grep -v "^ok"
python3 -I $HERE/gif.py "${BEAT_SABER_DIR:-/mnt/sdb2/BSManager/BSInstances/1.42.2 Reactive}/UserData/docs-rec/web-image" $A/sdk/web-image.webp
