#!/usr/bin/env python3
"""gif.py <frames dir> <out.webp|out.gif> [fps] [margin]
Crops every frame to the union bounding box of what differs from the backdrop colour, then encodes a looping clip,
a lossless WebP by default, a GIF when the name ends in .gif, or a still of the last frame for .png. GIF_HOLD=0 turns off the hold that hides the game's
shimmer, for clips from the browser build, which has none. GIF_CENTER=1 keeps the crop centred on the frame."""
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
    if os.environ.get('GIF_WATERMARK', '1') != '0':
        a[-60:, -420:] = BG  # the game's watermark corner
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
if os.environ.get('GIF_CENTER', '0') != '0':
    # The docs centre a preview in its box, so a crop that stays centred on the frame keeps content where the live
    # example draws it, like a counter that sits at the top
    dx, dy = max(w // 2 - x0, x1 - w // 2), max(h // 2 - y0, y1 - h // 2)
    x0, x1 = max(w // 2 - dx, 0), min(w // 2 + dx, w)
    y0, y1 = max(h // 2 - dy, 0), min(h // 2 + dy, h)
tmp = tempfile.mkdtemp(prefix='gif-')
held = raw_prev = None
for i, f in enumerate(files):
    raw = np.asarray(Image.open(f).convert('RGB').crop((x0, y0, x1, y1)))
    cur = raw.copy()
    if held is not None and os.environ.get('GIF_HOLD', '1') != '0':
        # Blurred panels shimmer by a few levels every frame, so a pixel within that noise keeps its held value.
        # A pixel that stops changing while its held value is still visibly off snaps to its real value, because
        # without that the hold leaves the tail of every fade on screen.
        off = np.abs(raw.astype(np.int16) - held.astype(np.int16)).max(axis=2)
        settled = np.abs(raw.astype(np.int16) - raw_prev.astype(np.int16)).max(axis=2) == 0
        keep = (off <= 10) & ~(settled & (off > 3))
        cur[keep] = held[keep]
    held, raw_prev = cur, raw
    Image.fromarray(cur).save(os.path.join(tmp, f'c{i:04d}.png'))
os.makedirs(os.path.dirname(out), exist_ok=True)
src_frames = ['-framerate', str(fps), '-i', os.path.join(tmp, 'c%04d.png')]
if out.endswith('.png'):
    # A still keeps only the last frame, once everything has settled
    Image.open(os.path.join(tmp, f'c{len(files) - 1:04d}.png')).save(out, optimize=True)
elif out.endswith('.webp'):
    # WebP keeps full colour, so gradients and blurred panels don't band the way a 160-colour GIF palette does
    lossless = os.environ.get('WEBP_LOSSLESS', '1')
    quality = os.environ.get('WEBP_QUALITY', '85' if lossless == '0' else '100')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *src_frames, '-c:v', 'libwebp_anim', '-lossless', lossless,
                    '-quality', quality, '-compression_level', os.environ.get('WEBP_EFFORT', '6'), '-loop', '0', out],
                   check=True, stdin=subprocess.DEVNULL)
else:
    dither = os.environ.get('GIF_DITHER', 'none')
    flt = f'fps={fps},split[s0][s1];[s0]palettegen=max_colors=160:stats_mode={os.environ.get('GIF_STATS', 'diff')}[p];[s1][p]paletteuse=dither={dither}'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *src_frames, '-vf', flt, '-loop', '0', out], check=True, stdin=subprocess.DEVNULL)
for f in glob.glob(os.path.join(tmp, '*')): os.remove(f)
os.rmdir(tmp)
print(f'{x1-x0}x{y1-y0} {len(files)} frames {os.path.getsize(out)//1024} KB {out}')
