#!/usr/bin/env python3
"""gif.py <frames dir> <out.gif> [fps] [margin]
Crops every frame to the union bounding box of what differs from the backdrop colour, then encodes a looping GIF."""
import sys, os, glob, subprocess, tempfile
import numpy as np
from PIL import Image
BG = np.array([0x1c, 0x1c, 0x21], dtype=np.int16)
src, out = sys.argv[1], sys.argv[2]
fps = int(sys.argv[3]) if len(sys.argv) > 3 else 20
margin = int(sys.argv[4]) if len(sys.argv) > 4 else 24
files = sorted(glob.glob(os.path.join(src, 'f*.png')))
if not files:
    print('no frames'); sys.exit(1)
x0 = y0 = 10**9; x1 = y1 = -1
for f in files:
    a = np.asarray(Image.open(f).convert('RGB')).astype(np.int16)
    a[-60:, -420:] = BG  # watermark corner
    m = np.abs(a - BG).max(axis=2) > 12
    ys, xs = np.where(m)
    if len(ys):
        y0, y1 = min(y0, ys.min()), max(y1, ys.max())
        x0, x1 = min(x0, xs.min()), max(x1, xs.max())
if x1 < 0:
    print('empty'); sys.exit(1)
h, w = a.shape[:2]
y0, y1 = max(y0 - margin, 0), min(y1 + margin + 1, h)
x0, x1 = max(x0 - margin, 0), min(x1 + margin + 1, w)
tmp = tempfile.mkdtemp(prefix='gif-')
prev = None
for i, f in enumerate(files):
    cur = np.asarray(Image.open(f).convert('RGB').crop((x0, y0, x1, y1))).copy()
    if prev is not None:
        # blurred panels shimmer by a few levels every frame; keep the previous pixel where nothing really moved
        still = np.abs(cur.astype(np.int16) - prev.astype(np.int16)).max(axis=2) <= 10
        cur[still] = prev[still]
    prev = cur
    Image.fromarray(cur).save(os.path.join(tmp, f'c{i:04d}.png'))
os.makedirs(os.path.dirname(out), exist_ok=True)
dither = os.environ.get('GIF_DITHER', 'none')
flt = f'fps={fps},split[s0][s1];[s0]palettegen=max_colors=160:stats_mode={os.environ.get('GIF_STATS', 'diff')}[p];[s1][p]paletteuse=dither={dither}'
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', str(fps), '-i', os.path.join(tmp, 'c%04d.png'),
                '-vf', flt, '-loop', '0', out], check=True)
for f in glob.glob(os.path.join(tmp, '*')): os.remove(f)
os.rmdir(tmp)
print(f'{x1-x0}x{y1-y0} {len(files)} frames {os.path.getsize(out)//1024} KB {out}')
