// Records a Playground example as frames, for scripts/gif.py.
// Usage: electron record.cjs <examples.json> <name> <frames dir>
// An example is either { page, index }, the index-th example on a docs page, run exactly as the page shows it, or
// { code }, a C# file run on the playground page. Steps drive it with real input events aimed at preview nodes,
// which the browser build tags with data-name. A target is a data-name with its index, or "text:<label>" for the
// node that holds that text, like a segment of a segmented control.
//   ["wait", ms]                        ["click", target, nth]   ["press", target, nth]
//   ["hover", target, nth]              ["leave"]
//   ["down", target, nth, fx?, fy?]     ["up"]
//   ["drag", target, nth, fx0, fy0, fx1, fy1, ms]
//   ["scroll", target, nth, dy]
//   ["dragTo", target, nth, endTarget, endNth, fx1, fy1, ms]   (from the middle of one node to a point on another)
// fx and fy are fractions of the node's box, 0.5 by default. An endless animation sets "loop" to its length in
// frames, and the clip is cut to a stretch that long which ends where it starts.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const [specPath, name, outDir] = process.argv.slice(-3);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'))[name];
const base = process.env.DOCS_URL || 'http://localhost:3000';
const fps = 20;

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.disableHardwareAcceleration();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (message) => {
    console.error(message);
    app.exit(1);
};

// A script error on the page would otherwise leave Electron running and stall the whole batch
process.on('unhandledRejection', (error) => fail(String(error)));

function playgroundUrl(file) {
    const files = [{ name: path.basename(file), code: fs.readFileSync(path.resolve(path.dirname(specPath), file), 'utf8') }];
    return `/playground?platform=pc#files=${Buffer.from(JSON.stringify(files)).toString('base64url')}`;
}

app.whenReady().then(async () => {
    const win = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { offscreen: true } });
    const wc = win.webContents;
    wc.setFrameRate(60);
    await wc.loadURL(base + (spec.code ? playgroundUrl(spec.code) : spec.page));
    // A docs example is drawn at 1.5 times its size, the playground page at 1, and the in-game captures at 10 pixels
    // per point, which the docs scale matches
    const zoom = spec.code ? 1.5 : 1;
    wc.setZoomFactor(zoom);
    await wc.executeJavaScript('document.fonts.ready.then(() => true)');

    // Starts the example, retrying Run until the page has hydrated, and waits until the preview has drawn it
    const status = await wc.executeJavaScript(`(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const scope = ${spec.code ? 'document' : `document.querySelectorAll('.playground-frame')[${spec.index}]`};
        if (!scope) return 'no example ${spec.index ?? ''}';
        scope.scrollIntoView?.({ block: 'start' });
        for (let i = 0; i < 100 && !scope.querySelector('iframe'); i++) {
            [...scope.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Run')?.click();
            await wait(300);
        }
        for (let i = 0; i < 600; i++) {
            await wait(100);
            if (/\\d+ errors?|Failed to start/.test(scope.textContent)) return 'failed: ' + scope.textContent.slice(0, 300);
            const doc = scope.querySelector('iframe')?.contentDocument;
            if (doc && doc.querySelectorAll('[data-name]').length > 1) break;
        }
        await wait(500);
        // Only the example is recorded, without the zoom controls and the artboard outline
        const iframe = scope.querySelector('iframe');
        for (const el of iframe.parentElement.children) if (el !== iframe) el.style.display = 'none';
        for (const el of iframe.parentElement.parentElement.children) if (el !== iframe.parentElement) el.style.display = 'none';
        if (scope !== document) window.scrollTo(0, window.scrollY + scope.getBoundingClientRect().top);
        // The playground page gives the preview a short pane, so it's pinned over the whole window instead
        else Object.assign(iframe.parentElement.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', zIndex: '99999' });
        // A wheel step is meant for the example, so the page itself must not scroll away under it
        document.documentElement.style.overflow = 'hidden';
        // The dev server's badge would show up in the frames
        const hide = document.createElement('style');
        hide.textContent = 'nextjs-portal { display: none !important; }';
        document.head.append(hide);
        // A drag would otherwise select the text it passes over
        const style = iframe.contentDocument.createElement('style');
        style.textContent = '* { user-select: none !important; }';
        iframe.contentDocument.head.append(style);
        window.__iframe = iframe;
        return 'ok';
    })()`);
    if (status !== 'ok') return fail(status);
    await sleep(1500);

    const box = await wc.executeJavaScript(`(() => {
        const a = window.__iframe.getBoundingClientRect(), b = window.__iframe.parentElement.getBoundingClientRect();
        const x0 = Math.max(a.left, b.left, 0), y0 = Math.max(a.top, b.top, 0);
        const x1 = Math.min(a.right, b.right, innerWidth), y1 = Math.min(a.bottom, b.bottom, innerHeight);
        return [x0, y0, x1, y1].map((v) => v * ${zoom});
    })()`);
    // A couple of pixels in from the edge, where the frame's border can bleed in
    const rect = { x: Math.ceil(box[0]) + 2, y: Math.ceil(box[1]) + 2, width: Math.floor(box[2] - box[0]) - 4, height: Math.floor(box[3] - box[1]) - 4 };

    // Every paint replaces the latest frame, and a timer samples it at a fixed rate
    const shots = [];
    let latest = null;
    wc.on('paint', (_e, _dirty, image) => {
        latest = image.crop(rect);
    });
    wc.invalidate();
    await sleep(100);
    const sampler = setInterval(() => {
        if (latest) shots.push(latest);
    }, 1000 / fps);

    const point = (target, nth, fx = 0.5, fy = 0.5) =>
        wc.executeJavaScript(`(() => {
            const iframe = window.__iframe;
            const doc = iframe.contentDocument;
            const target = ${JSON.stringify(target)};
            const all = target.startsWith('text:')
                ? [...doc.querySelectorAll('.text')].filter((x) => x.textContent.trim() === target.slice(5)).map((x) => x.closest('.node'))
                : [...doc.querySelectorAll('[data-name="' + target + '"]')];
            const el = all[${nth}];
            if (!el) return null;
            const f = iframe.getBoundingClientRect();
            const scale = f.width / iframe.offsetWidth;
            const r = el.getBoundingClientRect();
            return {
                x: Math.round((f.left + (r.left + r.width * ${fx}) * scale) * ${zoom}),
                y: Math.round((f.top + (r.top + r.height * ${fy}) * scale) * ${zoom})
            };
        })()`);
    const send = (type, p, extra = {}) => wc.sendInputEvent({ type, x: p.x, y: p.y, ...extra });
    const corner = { x: rect.x + 2, y: rect.y + 2 };
    let at = corner;

    for (const [kind, ...a] of spec.steps) {
        if (kind === 'wait') {
            await sleep(a[0]);
            continue;
        }
        if (kind === 'leave') {
            at = corner;
            send('mouseMove', at);
            continue;
        }
        if (kind === 'up') {
            send('mouseUp', at, { button: 'left', clickCount: 1 });
            continue;
        }
        // A scroll step's third argument is its delta, so it always aims at the middle of the node
        const fraction = kind === 'scroll' || kind === 'dragTo' ? [0.5, 0.5] : [a[2] ?? 0.5, a[3] ?? 0.5];
        const p = await point(a[0], a[1] ?? 0, ...fraction);
        if (!p) return fail(`no node ${a[0]} #${a[1] ?? 0}`);
        at = p;
        if (kind === 'hover') send('mouseMove', p);
        else if (kind === 'click' || kind === 'press') {
            send('mouseMove', p);
            await sleep(40);
            send('mouseDown', p, { button: 'left', clickCount: 1 });
            await sleep(120);
            send('mouseUp', p, { button: 'left', clickCount: 1 });
            // A button that stays highlighted after a click hides when the next press happens, so the pointer
            // moves away right after it. A press keeps it there, for examples that show hover.
            if (kind === 'click') {
                await sleep(60);
                at = corner;
                send('mouseMove', at);
            }
        } else if (kind === 'down') {
            send('mouseMove', p);
            await sleep(40);
            send('mouseDown', p, { button: 'left', clickCount: 1 });
        } else if (kind === 'scroll') {
            send('mouseMove', p);
            await sleep(40);
            wc.sendInputEvent({ type: 'mouseWheel', x: p.x, y: p.y, deltaX: 0, deltaY: a[2], canScroll: true });
        } else if (kind === 'drag' || kind === 'dragTo') {
            const q = kind === 'drag' ? await point(a[0], a[1], a[4], a[5]) : await point(a[2], a[3], a[4], a[5]);
            if (!q) return fail(`no node ${a[2]} #${a[3]}`);
            const ms = a[6] ?? 600;
            send('mouseMove', p);
            await sleep(40);
            send('mouseDown', p, { button: 'left', clickCount: 1 });
            const steps = Math.max(2, Math.round(ms / 16));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
                at = { x: Math.round(p.x + (q.x - p.x) * e), y: Math.round(p.y + (q.y - p.y) * e) };
                send('mouseMove', at, { button: 'left' });
                await sleep(ms / steps);
            }
            send('mouseUp', at, { button: 'left', clickCount: 1 });
        }
    }

    clearInterval(sampler);
    let clip = shots;
    if (spec.loop) {
        // An endless animation is cut where a frame matches the one about loop frames later, so the clip repeats
        // without a jump
        const pixels = shots.map((x) => x.toBitmap());
        const diff = (a, b) => {
            let sum = 0;
            for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
            return sum;
        };
        // Among equally good cuts, the clip starts on its longest pause, which is where the animation starts over
        const still = shots.map(() => 0);
        for (let i = shots.length - 2; i >= 0; i--) still[i] = diff(pixels[i], pixels[i + 1]) === 0 ? still[i + 1] + 1 : 0;
        let best = null;
        for (let s = 10; s < shots.length; s++) {
            for (let n = spec.loop - 3; n <= spec.loop + 3 && s + n < shots.length; n++) {
                const d = diff(pixels[s], pixels[s + n]);
                const pause = s > 0 && still[s - 1] === 0 ? still[s] : -1;
                if (!best || d < best.d || (d === best.d && pause > best.pause)) best = { s, n, d, pause };
            }
        }
        if (!best) return fail(`too few frames for a loop of ${spec.loop}`);
        clip = shots.slice(best.s, best.s + best.n);
        console.error(`loop from ${best.s}, ${best.n} frames, diff ${best.d}`);
    }
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    clip.forEach((image, i) => fs.writeFileSync(path.join(outDir, `f${String(i).padStart(4, '0')}.png`), image.toPNG()));
    console.log(`${clip.length} frames ${rect.width}x${rect.height}`);
    app.exit(0);
});
