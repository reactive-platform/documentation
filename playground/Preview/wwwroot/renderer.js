export const UNIT_PX = 5;
export const ORIGIN = location.origin;

export const root = document.getElementById('root');
const nodes = new Map();
const textures = new Map();
const measure = document.createElement('canvas').getContext('2d');
const mask = document.createElement('canvas').getContext('2d');
const measureBox = document.body.appendChild(document.createElement('div'));
measureBox.className = 'measure';

export function send(message) {
    parent.postMessage(message, ORIGIN);
}

export function log(level, message) {
    send({ type: 'log', level, message });
}

function font(size, style) {
    return `${style & 1 ? 700 : 500} ${size * UNIT_PX}px Teko, system-ui, sans-serif`;
}

function transformText(text, style) {
    if (style & 16) return text.toUpperCase();
    if (style & 8) return text.toLowerCase();
    return text;
}

function lineHeight(size, style) {
    measure.font = font(size, style);
    const metrics = measure.measureText('');
    return (metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent) / UNIT_PX;
}

function applyFont(el, size, style) {
    el.style.font = font(size, style);
    el.style.lineHeight = lineHeight(size, style) / size;
}

export function measureText(text, size, style, rich) {
    if (rich) {
        applyFont(measureBox, size, style);
        measureBox.textContent = '';
        appendRichText(measureBox, text, style);
        const { width, height } = measureBox.getBoundingClientRect();
        return [width / UNIT_PX, height / UNIT_PX];
    }

    measure.font = font(size, style);
    const lines = transformText(text, style).split('\n');
    const width = Math.max(...lines.map((x) => measure.measureText(x).width));
    return [width / UNIT_PX, lines.length * lineHeight(size, style)];
}

function cssColor(c) {
    return `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${c[3]})`;
}

export function uploadTexture(id, width, height, data, encoded) {
    const texture = { source: null, height };
    textures.set(id, texture);

    if (encoded) {
        createImageBitmap(new Blob([data])).then((bitmap) => {
            texture.source = bitmap;
            for (const el of nodes.values()) {
                if (el.__node.sp?.t === id) drawImage(el);
            }
        }, (error) => log(0, `Failed to decode an image: ${error}`));
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
        const from = (height - 1 - y) * width * 4;
        image.data.set(data.subarray(from, from + width * 4), y * width * 4);
    }
    ctx.putImageData(image, 0, 0);
    texture.source = canvas;
}

function paintSliced(ctx, source, area, n, width, height, unit) {
    const [sx, sy, sw, sh] = area;
    const [left, bottom, right, top] = n.sp.b;

    const xFit = Math.min(1, width / ((left + right) * unit || 1));
    const yFit = Math.min(1, height / ((top + bottom) * unit || 1));
    const l = Math.round(left * unit * xFit);
    const r = Math.round(right * unit * xFit);
    const t = Math.round(top * unit * yFit);
    const b = Math.round(bottom * unit * yFit);

    const srcX = [0, left, sw - right, sw];
    const srcY = [0, top, sh - bottom, sh];
    const dstX = [0, l, width - r, width];
    const dstY = [0, t, height - b, height];

    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            if (x === 1 && y === 1 && !n.fc) continue;
            const dstW = dstX[x + 1] - dstX[x];
            const dstH = dstY[y + 1] - dstY[y];
            if (dstW <= 0 || dstH <= 0) continue;

            const srcW = Math.max(srcX[x + 1] - srcX[x], 1);
            const srcH = Math.max(srcY[y + 1] - srcY[y], 1);
            const fromX = sx + Math.min(srcX[x], sw - srcW);
            const fromY = sy + Math.min(srcY[y], sh - srcH);
            ctx.drawImage(source, fromX, fromY, srcW, srcH, dstX[x], dstY[y], dstW, dstH);
        }
    }
}

function paintTiled(ctx, source, area, width, height, unit) {
    const [sx, sy, sw, sh] = area;
    const tileW = sw * unit;
    const tileH = sh * unit;

    for (let y = 0; y < height; y += tileH) {
        for (let x = 0; x < width; x += tileW) {
            ctx.drawImage(source, sx, sy, sw, sh, x, y, tileW, tileH);
        }
    }
}

function clipFill(ctx, n, x, y, width, height) {
    const amount = n.fa;
    ctx.beginPath();
    if (n.fm === 0) {
        ctx.rect(x, y, width * amount, height);
    } else if (n.fm === 1) {
        ctx.rect(x, y + height * (1 - amount), width, height * amount);
    } else {
        const cx = x + width / 2;
        const cy = y + height / 2;
        const radius = Math.hypot(width, height);
        const turns = n.fm === 2 ? 0.25 : n.fm === 3 ? 0.5 : 1;
        const start = Math.PI / 2;
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, start + Math.PI * 2 * turns * amount);
        ctx.closePath();
    }
    ctx.clip();
}

function paintShape(ctx, n, texture, width, height, scale) {
    const sprite = n.sp;

    if (!sprite) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        return;
    }

    const source = texture.source;
    const area = [sprite.x, texture.height - sprite.y - sprite.h, sprite.w, sprite.h];
    const unit = scale / sprite.u;

    if (n.it === 1 && sprite.b.some((x) => x > 0)) {
        paintSliced(ctx, source, area, n, width, height, unit);
    } else if (n.it === 2) {
        paintTiled(ctx, source, area, width, height, unit);
    } else {
        let x = 0;
        let y = 0;
        let w = width;
        let h = height;
        if (n.pa) {
            const fit = Math.min(width / sprite.w, height / sprite.h);
            w = sprite.w * fit;
            h = sprite.h * fit;
            x = (width - w) / 2;
            y = (height - h) / 2;
        }
        ctx.save();
        if (n.it === 3) clipFill(ctx, n, x, y, w, h);
        ctx.drawImage(source, ...area, x, y, w, h);
        ctx.restore();
    }
}

function multiply(a, b) {
    return [a[0] * b[0], a[1] * b[1], a[2] * b[2], a[3] * b[3]];
}

function tintStyle(ctx, n, width, height, withAlpha) {
    const part = (c) => (withAlpha ? `rgba(0, 0, 0, ${c[3]})` : cssColor([c[0], c[1], c[2], 1]));
    if (!n.g) return part(n.c);

    const gradient = n.g.d === 0 ? ctx.createLinearGradient(0, 0, width, 0) : ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, part(multiply(n.c, n.g.a)));
    gradient.addColorStop(1, part(multiply(n.c, n.g.b)));
    return gradient;
}

function paintColorPicker(ctx, n, width, height) {
    ctx.globalCompositeOperation = 'source-in';
    const saturation = ctx.createLinearGradient(0, 0, width, 0);
    saturation.addColorStop(0, '#fff');
    saturation.addColorStop(1, cssColor([n.c[0], n.c[1], n.c[2], 1]));
    ctx.fillStyle = saturation;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'source-atop';
    const value = ctx.createLinearGradient(0, 0, 0, height);
    value.addColorStop(0, 'rgba(0, 0, 0, 0)');
    value.addColorStop(1, '#000');
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, width, height);
}

function drawImage(el) {
    const n = el.__node;
    const texture = n.sp ? textures.get(n.sp.t) : null;
    if (n.sp && !texture.source) return;

    if (!n.sp && !n.sk && !n.g) {
        const fill = content(el, 'div', 'fill');
        fill.style.backgroundColor = cssColor(n.c);
        fill.style.opacity = n.o;
        return;
    }

    const scale = UNIT_PX * devicePixelRatio;
    const width = Math.max(1, Math.round(n.w * scale));
    const height = Math.max(1, Math.round(n.h * scale));
    const canvas = content(el, 'canvas', 'sprite');

    canvas.style.opacity = n.o;
    canvas.style.transform = n.sk ? `skewX(${-Math.atan(n.sk)}rad)` : '';
    canvas.style.transformOrigin = `50% ${(1 - n.py) * 100}%`;
    canvas.style.mixBlendMode = n.m === 'UIAdditiveGlow' ? 'plus-lighter' : '';

    const signature = JSON.stringify([n.sp, n.g, n.c, n.it, n.fm, n.fa, n.pa, n.fc, n.m, width, height]);
    if (canvas.__signature === signature) return;
    canvas.__signature = signature;

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.reset();
    paintShape(ctx, n, texture, width, height, scale);

    if (n.m === 'UISVColorPicker') {
        paintColorPicker(ctx, n, width, height);
        return;
    }

    const parts = n.g ? [multiply(n.c, n.g.a), multiply(n.c, n.g.b)] : [n.c];
    if (parts.some((c) => c[0] !== 1 || c[1] !== 1 || c[2] !== 1)) {
        if (mask.canvas.width < width) mask.canvas.width = width;
        if (mask.canvas.height < height) mask.canvas.height = height;
        mask.clearRect(0, 0, width, height);
        mask.drawImage(canvas, 0, 0);

        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = tintStyle(ctx, n, width, height, false);
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(mask.canvas, 0, 0);
    }
    if (parts.some((c) => c[3] !== 1)) {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = tintStyle(ctx, n, width, height, true);
        ctx.fillRect(0, 0, width, height);
    }
}

function content(el, tag, className) {
    if (el.__content?.className === className) return el.__content;
    el.__content?.remove();
    const child = document.createElement(tag);
    child.className = className;
    el.prepend(child);
    el.__content = child;
    return child;
}

function dropContent(el) {
    el.__content?.remove();
    el.__content = null;
}

const RICH_TAG = /<(\/?)(#[0-9a-f]{3,8}|[a-z-]+)(?:=([^>]*))?>/gi;
const TMP_COLORS = { green: '#0f0', yellow: '#ffeb04', purple: '#a020f0', orange: '#ff8000' };

function richLength(value) {
    const number = parseFloat(value);
    if (value.endsWith('%')) return `${number}%`;
    if (value.endsWith('em')) return `${number}em`;
    return `${number * UNIT_PX}px`;
}

const RICH_STYLES = {
    color: (s, v) => { s.color = TMP_COLORS[v] ?? v; },
    alpha: (s, v) => { s.opacity = parseInt(v.slice(1), 16) / 255; },
    mark: (s, v) => { s.backgroundColor = v; },
    b: (s) => { s.fontWeight = '700'; },
    i: (s) => { s.fontStyle = 'italic'; },
    u: (s) => { s.textDecoration = 'underline'; },
    s: (s) => { s.textDecoration = 'line-through'; },
    sub: (s) => { s.verticalAlign = 'sub'; s.fontSize = '0.7em'; },
    sup: (s) => { s.verticalAlign = 'super'; s.fontSize = '0.7em'; },
    uppercase: (s) => { s.textTransform = 'uppercase'; },
    allcaps: (s) => { s.textTransform = 'uppercase'; },
    lowercase: (s) => { s.textTransform = 'lowercase'; },
    smallcaps: (s) => { s.fontVariant = 'small-caps'; },
    nobr: (s) => { s.whiteSpace = 'pre'; },
    size: (s, v) => { s.fontSize = /^[+-]/.test(v) ? `calc(1em + ${parseFloat(v) * UNIT_PX}px)` : richLength(v); },
    cspace: (s, v) => { s.letterSpacing = richLength(v); },
    'line-height': (s, v) => { s.lineHeight = richLength(v); },
    voffset: (s, v) => { s.position = 'relative'; s.top = `calc(-1 * ${richLength(v)})`; },
    space: (s, v) => { s.marginLeft = richLength(v); },
    align: (s, v) => { s.display = 'inline-block'; s.width = '100%'; s.textAlign = v; },
    indent: (s, v) => { s.display = 'inline-block'; s.paddingLeft = richLength(v); },
    margin: (s, v) => { s.display = 'inline-block'; s.marginInline = richLength(v); },
    width: (s, v) => { s.display = 'inline-block'; s.width = richLength(v); },
    font: () => {},
    style: () => {},
    link: () => {},
    gradient: () => {},
    mspace: () => {},
    rotate: () => {},
    pos: () => {},
    page: () => {},
};

function appendRichText(parent, text, style) {
    const stack = [{ tag: null, el: parent }];
    const write = (value) => stack.at(-1).el.append(transformText(value, style));
    const close = (tag) => {
        const index = stack.findLastIndex((x) => x.tag === tag);
        if (index > 0) stack.length = index;
    };
    let position = 0;

    for (const match of text.matchAll(RICH_TAG)) {
        if (match.index < position) continue;

        const isColorCode = match[2].startsWith('#');
        const tag = isColorCode ? 'color' : match[2].toLowerCase();
        const value = isColorCode ? match[2] : (match[3] ?? '').replaceAll('"', '');

        if (tag !== 'br' && tag !== 'noparse' && !Object.hasOwn(RICH_STYLES, tag)) continue;

        write(text.slice(position, match.index));
        position = match.index + match[0].length;

        if (tag === 'br') {
            write('\n');
        } else if (tag === 'noparse') {
            if (match[1]) continue;
            const end = text.indexOf('</noparse>', position);
            write(text.slice(position, end === -1 ? text.length : end));
            position = end === -1 ? text.length : end + '</noparse>'.length;
        } else if (match[1]) {
            close(tag);
        } else {
            if (tag === 'alpha') close(tag);
            const span = document.createElement('span');
            RICH_STYLES[tag](span.style, value);
            stack.at(-1).el.append(span);
            stack.push({ tag, el: span });
        }
    }
    write(text.slice(position));
}

function applyText(el, n) {
    const box = content(el, 'div', 'text');
    let line = box.firstElementChild;
    if (!line) {
        line = document.createElement('span');
        box.append(line);
    }

    const signature = `${n.rt}|${n.st}|${n.t}`;
    if (box.__signature !== signature) {
        box.__signature = signature;
        line.textContent = '';
        if (n.rt) appendRichText(line, n.t, n.st);
        else line.textContent = transformText(n.t, n.st);
    }

    const horizontal = n.al & 0xff;
    const vertical = n.al & 0xff00;
    const clipped = n.of > 0;

    applyFont(box, n.fs, n.st);
    box.style.color = cssColor(n.c);
    box.style.opacity = n.o;
    box.style.overflow = n.of > 1 ? 'hidden' : 'visible';
    box.style.justifyContent = horizontal === 1 ? 'flex-start' : horizontal === 4 ? 'flex-end' : 'center';
    box.style.alignItems = vertical === 0x100 ? 'flex-start' : vertical === 0x400 ? 'flex-end' : 'center';
    box.style.textAlign = horizontal === 1 ? 'left' : horizontal === 4 ? 'right' : 'center';

    line.style.display = 'inline-block';
    line.style.maxWidth = clipped ? '100%' : '';
    line.style.overflow = n.of === 1 ? 'hidden' : '';
    line.style.textOverflow = n.of === 1 ? 'ellipsis' : '';
    line.style.whiteSpace = n.wr ? 'pre-wrap' : 'pre';
    line.style.textDecoration = n.st & 4 ? 'underline' : n.st & 64 ? 'line-through' : '';
    line.style.transform = n.st & 2 ? 'skewX(-10deg)' : '';
}

export function render(batch) {
    const { s: changed, r: removed } = JSON.parse(batch);

    for (const n of changed) {
        let el = nodes.get(n.id);
        if (!el) {
            el = document.createElement('div');
            el.className = 'node';
            el.dataset.id = n.id;
            nodes.set(n.id, el);
        }

        const parent = n.p === 0 ? root : nodes.get(n.p);
        const index = n.i + (parent.__content ? 1 : 0);
        if (el.parentElement !== parent || parent.children[index] !== el) {
            parent.insertBefore(el, parent.children[index] ?? null);
        }

        el.__node = n;
        el.dataset.name = n.n;
        el.style.left = `${n.x * UNIT_PX}px`;
        el.style.top = `${n.y * UNIT_PX}px`;
        el.style.width = `${n.w * UNIT_PX}px`;
        el.style.height = `${n.h * UNIT_PX}px`;
        el.style.overflow = n.cl ? 'hidden' : 'visible';
        el.style.display = n.a ? 'block' : 'none';
        el.style.pointerEvents = n.r ? 'auto' : 'none';
        el.style.transformOrigin = `${n.px * 100}% ${(1 - n.py) * 100}%`;

        const scaled = n.sx !== 1 || n.sy !== 1;
        el.style.transform = `${n.rz ? `rotate(${-n.rz}deg) ` : ''}${scaled ? `scale(${n.sx}, ${n.sy})` : ''}`.trim();

        if (n.k === 2) applyText(el, n);
        else if (n.k === 1) drawImage(el);
        else dropContent(el);
    }

    for (const id of removed) {
        nodes.get(id).remove();
        nodes.delete(id);
    }
}

export function setTexture(id, source, height) {
    textures.set(id, { source, height });
    for (const el of nodes.values()) {
        if (el.__node.sp?.t === id) drawImage(el);
    }
}

export function clearScene() {
    nodes.clear();
    textures.clear();
    root.textContent = '';
}

export const fontLoaded = document.fonts.load('500 16px Teko');

export function startLoop({ tick, setRootSize, pointer, wheelDelta = (e) => -Math.sign(e.deltaY) }) {
    function sendSize() {
        setRootSize(root.clientWidth / UNIT_PX, root.clientHeight / UNIT_PX);
    }
    sendSize();
    new ResizeObserver(sendSize).observe(root);

    let last = performance.now();
    function frame(now) {
        tick(Math.min((now - last) / 1000, 0.1));
        last = now;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    function send(kind, e, deltaY = 0) {
        const rect = root.getBoundingClientRect();
        const id = Number(e.target.closest?.('[data-id]')?.dataset.id ?? 0);
        pointer(kind, id, (e.clientX - rect.left) / UNIT_PX, (rect.bottom - e.clientY) / UNIT_PX, deltaY);
    }
    root.addEventListener('pointermove', (e) => send('move', e));
    root.addEventListener('pointerleave', () => pointer('move', 0, 0, 0, 0));
    root.addEventListener('pointerdown', (e) => send('down', e));
    window.addEventListener('pointerup', (e) => send('up', e));
    root.addEventListener('wheel', (e) => send('scroll', e, wheelDelta(e)), { passive: true });
}
