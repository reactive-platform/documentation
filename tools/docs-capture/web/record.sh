#!/bin/sh
# Usage: web/record.sh [name ...]   (every example in examples.json when no name is given)
# Records Playground examples in the browser build and encodes each into public/assets. Needs the docs dev server
# (DOCS_URL, http://localhost:3000 by default) and Electron.
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
ELECTRON=${ELECTRON:-electron44}
FRAMES=${TMPDIR:-/tmp}/docs-web-rec
names=${*:-$(python3 -c "import json,sys; print(' '.join(json.load(open(sys.argv[1]))))" "$HERE/examples.json")}
for name in $names; do
  asset=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]]['asset'])" "$HERE/examples.json" "$name")
  # A preview is centered in its box like the live example, while a still from a file is cropped to its content
  center=$(python3 -c "import json,sys; print(0 if 'code' in json.load(open(sys.argv[1]))[sys.argv[2]] else 1)" "$HERE/examples.json" "$name")
  fps=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]].get('fps', 20))" "$HERE/examples.json" "$name")
  if $ELECTRON --no-sandbox "$HERE/record.cjs" "$HERE/examples.json" "$name" "$FRAMES/$name" 2>&1 | grep -E "frames|loop|no node|failed|no example|Error:"; then
    GIF_WATERMARK=0 GIF_HOLD=0 GIF_CENTER=$center python3 -I "$HERE/../scripts/gif.py" "$FRAMES/$name" "$REPO/public/assets/$asset" "$fps" < /dev/null
  fi
done
