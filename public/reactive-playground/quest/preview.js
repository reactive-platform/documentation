import { clearScene, fontLoaded, log, measureText, ORIGIN, render, root, send, setTexture, startLoop, UNIT_PX, uploadTexture } from '../preview/renderer.js';

const POINTER_KINDS = { move: 0, down: 1, up: 2, scroll: 3 };

const decoder = new TextDecoder();
let instance = null;
let latestRun = 0;

function memory() {
    return instance.exports.memory.buffer;
}

function readString(pointer, length) {
    return decoder.decode(new Uint8Array(memory(), pointer, length));
}

function guarded(action) {
    if (!instance) return;

    try {
        action(instance.exports);
    } catch (error) {
        instance = null;
        log(0, `The preview stopped: ${error.message}`);
    }
}

function fetchImage(owner, request, texture, url) {
    const finish = (succeeded, status, width, height) => {
        if (instance === owner) guarded((x) => x.quest_request_finished(request, succeeded, status, width, height));
    };

    fetch(url)
        .then(async (response) => {
            if (!response.ok) return finish(0, response.status, 0, 0);

            const bitmap = await createImageBitmap(await response.blob());
            if (instance === owner) setTexture(texture, bitmap, bitmap.height);
            finish(1, response.status, bitmap.width, bitmap.height);
        })
        .catch(() => finish(0, 0, 0, 0));
}

function createWasi() {
    const lines = ['', ''];

    return {
        fd_write(fd, vectors, count, written) {
            const view = new DataView(memory());
            let total = 0;
            for (let i = 0; i < count; i++) {
                const pointer = view.getUint32(vectors + i * 8, true);
                const length = view.getUint32(vectors + i * 8 + 4, true);
                total += length;

                const parts = (lines[fd - 1] + readString(pointer, length)).split('\n');
                lines[fd - 1] = parts.pop();
                for (const line of parts) log(fd === 2 ? 0 : 3, line);
            }
            view.setUint32(written, total, true);
            return 0;
        },
        fd_fdstat_get(fd, result) {
            const view = new DataView(memory());
            view.setUint8(result, 2);
            view.setUint16(result + 2, 0, true);
            view.setBigUint64(result + 8, 0xffffffffffffffffn, true);
            view.setBigUint64(result + 16, 0xffffffffffffffffn, true);
            return 0;
        },
        clock_time_get(id, precision, result) {
            new DataView(memory()).setBigUint64(result, BigInt(Math.round(performance.now() * 1e6)), true);
            return 0;
        },
        random_get(pointer, length) {
            crypto.getRandomValues(new Uint8Array(memory(), pointer, length));
            return 0;
        },
        environ_sizes_get(count, size) {
            const view = new DataView(memory());
            view.setUint32(count, 0, true);
            view.setUint32(size, 0, true);
            return 0;
        },
        environ_get: () => 0,
        proc_exit(code) {
            throw new Error(`exit(${code})`);
        },
    };
}

function createImports(module, owner) {
    const wasi = createWasi();
    for (const { module: name, name: symbol } of WebAssembly.Module.imports(module)) {
        if (name === 'wasi_snapshot_preview1') wasi[symbol] ??= () => 52;
    }

    return {
        wasi_snapshot_preview1: wasi,
        env: {
            js_render: (pointer, length) => render(readString(pointer, length)),
            js_log: (level, pointer, length) => log(level, readString(pointer, length)),
            js_measure_text(pointer, length, size, style, richText, result) {
                new Float32Array(memory(), result, 2).set(measureText(readString(pointer, length), size, style, richText !== 0));
            },
            js_upload_texture(id, width, height, pointer, length, encoded) {
                uploadTexture(id, width, height, new Uint8Array(memory().slice(pointer, pointer + length)), encoded !== 0);
            },
            js_fetch_image(request, texture, pointer, length) {
                fetchImage(owner.current, request, texture, readString(pointer, length));
            },
        },
    };
}

async function run(id, bytes) {
    const module = await WebAssembly.compile(bytes);
    if (id !== latestRun) return;

    const owner = { current: null };
    const created = await WebAssembly.instantiate(module, createImports(module, owner));
    if (id !== latestRun) return;

    owner.current = created;
    clearScene();
    instance = created;
    created.exports._initialize();
    created.exports.quest_set_root_size(root.clientWidth / UNIT_PX, root.clientHeight / UNIT_PX);
    created.exports.quest_run();
}

startLoop({
    tick: (deltaTime) => guarded((x) => x.quest_tick(deltaTime)),
    setRootSize: (width, height) => guarded((x) => x.quest_set_root_size(width, height)),
    pointer: (kind, id, x, y, deltaY) => guarded((e) => e.quest_pointer(POINTER_KINDS[kind], id, x, y, deltaY)),
    wheelDelta: (e) => -e.deltaY / (e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 3 : 100),
});

window.addEventListener('message', async (e) => {
    if (e.origin !== ORIGIN || e.data?.type !== 'run') return;

    const { id, assembly } = e.data;
    latestRun = id;

    const started = performance.now();
    try {
        await run(id, assembly);
        send({ type: 'ran', id, error: null, ms: performance.now() - started });
    } catch (error) {
        instance = null;
        send({ type: 'ran', id, error: String(error), ms: performance.now() - started });
    }
});

await fontLoaded;
send({ type: 'ready' });
