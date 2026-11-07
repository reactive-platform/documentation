#!/usr/bin/env python3
"""matte.py <black.png> <white.png> <out.png> [margin_px]
Recovers alpha from two renders over black and white, trims to content and saves a transparent PNG."""
import sys, numpy as np
from PIL import Image
b = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32)
w = np.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(np.float32)
margin = int(sys.argv[4]) if len(sys.argv) > 4 else 24
alpha = 1.0 - (w - b).mean(axis=2) / 255.0
alpha = np.clip(alpha, 0.0, 1.0)
rgb = np.where(alpha[..., None] > 0.002, b / np.maximum(alpha[..., None], 0.002), 0.0)
rgb = np.clip(rgb, 0, 255)
out = np.dstack([rgb, alpha * 255.0]).astype(np.uint8)
alpha[-60:, -420:] = 0.0  # 'Development Build' watermark
out[-60:, -420:, 3] = 0
mask = alpha > 0.02
if len(sys.argv) > 5:
    x, y, cw, ch = map(int, sys.argv[5:9])
    out = out[y:y+ch, x:x+cw]
else:
    ys, xs = np.where(mask)
    if len(ys) == 0:
        print("empty"); sys.exit(1)
    y0, y1 = max(ys.min() - margin, 0), min(ys.max() + margin + 1, out.shape[0])
    x0, x1 = max(xs.min() - margin, 0), min(xs.max() + margin + 1, out.shape[1])
    out = out[y0:y1, x0:x1]
Image.fromarray(out, 'RGBA').save(sys.argv[3])
print(f"{out.shape[1]}x{out.shape[0]} {sys.argv[3]}")
