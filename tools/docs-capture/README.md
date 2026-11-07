# Docs capture

The images under `public/assets` are rendered in the game, not drawn by hand. This folder holds the small
BSIPA plugin and the scripts that produce them, so they can be regenerated after a visual change in Reactive.

`Samples.cs`, `Samples2.cs` and `Samples3.cs` contain one component per image, built from the code shown on the docs page it
belongs to. `Driver.cs` puts a sample on a flat screen-space canvas drawn by its own camera, so a screenshot
shows only the sample, and takes commands from `UserData/docs-capture.cmd` (one per line, one per frame).
The useful ones:

```
canvas 10            create the canvas (10 pixels per layout point)
canvasref 10 3.44    match the game's canvas pixel reference, so rounded corners look right
show Counter [w h]   render a sample, optionally inside a w x h point root
set Modal 0 IsPushed true    set a property on the n-th component of a type (private fields work too)
call CurvesSample 0 Play     call a method or an Action property
pointer Background 0 enter   send a pointer event to a component
bg 0 0 0             camera background colour
timescale 0          freeze animations
```

`scripts/launch-bs.sh` starts the game in a headless gamescope session, so nothing needs a desktop.

Most assets are GIFs. `rec start <name> 20` locks the game to 20 frames per second and writes every frame to
`UserData/docs-rec/<name>`, so the commands that follow (clicks, hovers, value changes) land on exact frames,
and `rec stop` ends the clip. `scripts/rec.sh` wraps that for one sample and `scripts/gif.py` crops the frames
to what moved and encodes the GIF with the docs' dark backdrop baked in. `scripts/record-all.sh` holds the
sequence for every animated asset. The few still images come from `scripts/cap.sh <asset>`, which shoots the
sample over black and over white, recovers the alpha and trims it into a transparent PNG; `capture-static.sh`
lists them.

To regenerate everything:

```sh
dotnet build -c Release -p:BeatSaberDir="/path/to/Beat Saber" -p:ReactiveDir="/path/to/reactive-mono/src"
cp bin/Release/net48/DocsCapture.dll "/path/to/Beat Saber/Plugins/"
BEAT_SABER_DIR="/path/to/Beat Saber" scripts/launch-bs.sh &
scripts/wait-menu.sh && scripts/record-all.sh && scripts/capture-static.sh
```

`wait-menu.sh` matters: showing a sample before the main menu exists breaks Reactive's resource initialisers for the
rest of the process. The Reactive assemblies are read from the game's `Libs` and `Plugins`; `ReactiveLibsDir`,
`ReactivePluginsDir` and `ReactiveCompilerDir` override that, for example to build against an update staged in
`IPA/Pending`. The scripts write the game's `UserData`, so they run outside a sandbox.

The web image sample expects a local file server on port 8765 serving `cover.png`. Needs ImageMagick, ffmpeg,
Python with numpy and Pillow, gamescope and GE-Proton. Mods built against Reactive v1 (BeatLeader at the time of
writing) have to be set aside first, or their errors keep the development console on screen. Remove `DocsCapture.dll` from `Plugins` when done.
