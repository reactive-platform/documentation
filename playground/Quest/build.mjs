import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { gzipSync } from 'node:zlib';

const CLANG_VERSION = '22.0.0-git20542-10';
const HERE = dirname(fileURLToPath(import.meta.url));
const DEPS = resolve(HERE, '../deps');
const CLANG_DIR = join(DEPS, `yowasp-clang-${CLANG_VERSION}`);
const CLANG_BUNDLE = join(CLANG_DIR, 'package/gen/bundle.js');

const SNIPPET_FLAGS = ['-std=c++23', '-O0', '-frtti', '-fno-exceptions', '-Wno-reorder-init-list', '-Iinclude'];
const PCH_FLAGS = ['-fpch-instantiate-templates', '-fpch-codegen', '-Xclang', '-fno-pch-timestamp'];
const PCH_OBJECT_FLAGS = ['-O1', '-frtti', '-fno-exceptions'];
const REACTIVE_FLAGS = ['-std=c++23', '-O2', '-frtti', '-fexceptions', '-Wno-reorder-init-list', '-Wno-c23-extensions', '-Iinclude', '-Isrc', '-DMOD_ID="reactive"', '-DVERSION="playground"', '--embed-dir=sprites'];
const YOGA_FLAGS = ['-std=c++20', '-O2', '-fno-exceptions', '-fno-rtti', '-Iyoga'];
const REPLACED_SOURCES = new Set(['main.cpp', 'BeatSaberResources.cpp', 'GameResources.cpp', 'VRScrollAdapter.cpp']);
const FORWARDED_INCLUDE = /^(UnityEngine|TMPro|HMUI|GlobalNamespace|System|Zenject|custom-types|beatsaber-hook)\//;
const SPRITES = ['Background', 'Underline', 'Spinner', 'Cross', 'Frame', 'TransparentPixel'];

function tree(dir, filter = () => true) {
    const out = {};
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) out[name] = tree(path, filter);
        else if (filter(name)) out[name] = readFileSync(path);
    }
    return out;
}

function listFiles(dir, extension) {
    return readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .map((x) => join(dir, x))
        .filter((x) => x.endsWith(extension) && statSync(x).isFile());
}

function setPath(root, path, value) {
    const parts = path.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) node = node[part] ??= {};
    node[parts.at(-1)] = value;
}

function digest(value) {
    const hash = createHash('sha1');
    const visit = (x) => {
        if (x instanceof Uint8Array || typeof x === 'string') hash.update(x);
        else for (const key of Object.keys(x).sort()) { hash.update(key); visit(x[key]); }
    };
    visit(value);
    return hash.digest('hex');
}

if (!isMainThread) {
    const { runClang } = await import(pathToFileURL(CLANG_BUNDLE).href);
    const print = (bytes) => { if (bytes) parentPort.postMessage({ log: Buffer.from(bytes).toString() }); };

    parentPort.on('message', async ({ id, args, files, output }) => {
        try {
            const result = await runClang(['clang++', ...args], files, { stdout: print, stderr: print, decodeASCII: false });
            parentPort.postMessage({ id, bytes: result[output] });
        } catch (error) {
            parentPort.postMessage({ id, failed: `exit ${error.code ?? error}` });
        }
    });
} else {
    await main();
}

function options(name) {
    const index = process.argv.indexOf(name);
    return index === -1 ? null : process.argv[index + 1];
}

function git(...args) {
    execFileSync('git', args, { stdio: 'inherit' });
}

function getQuestSource() {
    const local = options('--quest');
    if (local) return resolve(local);

    const clone = join(DEPS, 'reactive-quest');
    rmSync(clone, { recursive: true, force: true });
    git('clone', '--depth', '1', '--recurse-submodules', '--shallow-submodules', 'https://github.com/reactive-platform/reactive-quest.git', clone);
    return clone;
}

function getClang() {
    if (existsSync(CLANG_BUNDLE)) return;
    mkdirSync(CLANG_DIR, { recursive: true });
    const name = execFileSync('npm', ['pack', `@yowasp/clang@${CLANG_VERSION}`, '--silent', '--pack-destination', CLANG_DIR], { encoding: 'utf8', shell: true }).trim();
    execFileSync('tar', ['-xzf', name], { cwd: CLANG_DIR });
    rmSync(join(CLANG_DIR, name));
}

function createPool(size) {
    const workers = [];
    const idle = [];
    const queue = [];
    const pending = new Map();
    let nextId = 1;

    function pump() {
        while (idle.length && queue.length) {
            const worker = idle.pop();
            const job = queue.shift();
            pending.set(job.id, { ...job, worker });
            worker.postMessage({ id: job.id, args: job.args, files: job.files, output: job.output });
        }
    }

    for (let i = 0; i < size; i++) {
        const worker = new Worker(fileURLToPath(import.meta.url));
        worker.on('message', (message) => {
            if (message.log) { process.stderr.write(message.log); return; }
            const job = pending.get(message.id);
            pending.delete(message.id);
            idle.push(worker);
            if (message.failed) job.reject(new Error(`${job.label}: ${message.failed}`));
            else job.resolve(message.bytes);
            pump();
        });
        workers.push(worker);
        idle.push(worker);
    }

    return {
        compile(label, args, files, output) {
            return new Promise((resolve, reject) => {
                queue.push({ id: nextId++, label, args, files, output, resolve, reject });
                pump();
            });
        },
        close: () => Promise.all(workers.map((x) => x.terminate())),
    };
}

function buildIncludeTree(quest) {
    const include = {};
    Object.assign(include, tree(join(quest, 'shared')));

    const engine = join(HERE, 'include');
    for (const file of listFiles(engine, '.hpp')) setPath(include, relative(engine, file).replaceAll('\\', '/'), readFileSync(file));

    const sources = [...listFiles(join(quest, 'shared/reactive'), '.hpp'), ...listFiles(join(quest, 'src'), '.hpp'), ...listFiles(join(quest, 'src'), '.cpp')];
    for (const file of sources) {
        for (const match of readFileSync(file, 'utf8').matchAll(/#include\s+[<"]([^>"]+)[>"]/g)) {
            if (FORWARDED_INCLUDE.test(match[1])) setPath(include, match[1], '#pragma once\n#include "playground/Engine.hpp"\n');
        }
    }
    for (const extra of ['UnityEngine/Debug.hpp', 'UnityEngine/WaitForSeconds.hpp', 'UnityEngine/Component.hpp', 'UnityEngine/Behaviour.hpp']) {
        setPath(include, extra, '#pragma once\n#include "playground/Engine.hpp"\n');
    }
    return include;
}

function buildPrelude(quest) {
    const headers = listFiles(join(quest, 'shared/reactive'), '.hpp')
        .map((x) => relative(join(quest, 'shared'), x).replaceAll('\\', '/'))
        .filter((x) => !x.includes('/SDK/') && !x.endsWith('BeatSaberUtils.hpp'));
    return `#pragma once\n#include <algorithm>\n#include <functional>\n#include <memory>\n#include <optional>\n#include <string>\n#include <vector>\n#include "reactive/layout/Props.hpp"\n#include "playground/Prelude.hpp"\n${headers.map((x) => `#include "${x}"`).join('\n')}\n`;
}

async function main() {
    const started = performance.now();
    const quest = getQuestSource();
    getClang();

    const bundle = options('--bundle') ?? join(DEPS, 'beat-saber-sdk-bundle');
    const spriteDir = join(bundle, 'Assets/Resources/Sprites');

    const include = buildIncludeTree(quest);
    const sprites = Object.fromEntries(SPRITES.map((x) => [`${x}.png`, readFileSync(join(spriteDir, `${x}.png`))]));
    const reactiveFiles = { include, src: tree(join(quest, 'src'), (x) => x.endsWith('.hpp')), sprites };
    const reactiveDigest = digest(reactiveFiles);

    const cache = join(DEPS, 'quest-obj');
    mkdirSync(cache, { recursive: true });
    const pool = createPool(Math.max(2, Math.min(8, availableParallelism() - 1)));

    async function compile(file, flags, files, depsDigest) {
        const source = readFileSync(file);
        const key = digest({ source, flags: flags.join(' '), depsDigest, CLANG_VERSION });
        const cached = join(cache, `${key}.o`);
        if (existsSync(cached)) return readFileSync(cached);

        const bytes = await pool.compile(relative(HERE, file), [...flags, '-c', 'input.cpp', '-o', 'output.o'], { ...files, 'input.cpp': source }, 'output.o');
        writeFileSync(cached, bytes);
        console.log(`  ${basename(file)}`);
        return bytes;
    }

    const reactiveSources = listFiles(join(quest, 'src'), '.cpp').filter((x) => !REPLACED_SOURCES.has(basename(x)));
    const engineSources = listFiles(join(HERE, 'src'), '.cpp').filter((x) => basename(x) !== 'Host.cpp');
    const yogaRoot = join(quest, 'lib/yoga');
    const yogaFiles = { yoga: { yoga: tree(join(yogaRoot, 'yoga'), (x) => x.endsWith('.h')) } };
    const yogaDigest = digest(yogaFiles);

    const objects = await Promise.all([
        ...[...reactiveSources, ...engineSources].map((x) => compile(x, REACTIVE_FLAGS, reactiveFiles, reactiveDigest)),
        ...listFiles(join(yogaRoot, 'yoga'), '.cpp').map((x) => {
            const folder = relative(yogaRoot, dirname(x)).replaceAll('\\', '/');
            return compile(x, [...YOGA_FLAGS, `-Iyoga/${folder}`], yogaFiles, yogaDigest);
        }),
    ]);
    const host = await compile(join(HERE, 'src/Host.cpp'), REACTIVE_FLAGS, reactiveFiles, reactiveDigest);

    const prelude = buildPrelude(quest);
    const preludeFiles = { include, 'prelude.hpp': prelude };
    const preludeKey = digest({ preludeFiles, flags: [...SNIPPET_FLAGS, ...PCH_FLAGS, ...PCH_OBJECT_FLAGS].join(' '), CLANG_VERSION });
    const cachedPch = join(cache, `${preludeKey}.pch`);
    const cachedPreludeObject = join(cache, `${preludeKey}.o`);

    if (!existsSync(cachedPch) || !existsSync(cachedPreludeObject)) {
        const pch = await pool.compile('prelude', [...SNIPPET_FLAGS, ...PCH_FLAGS, '-x', 'c++-header', 'prelude.hpp', '-o', 'prelude.pch'], preludeFiles, 'prelude.pch');
        const object = await pool.compile('prelude object', [...PCH_OBJECT_FLAGS, '-c', 'prelude.pch', '-o', 'prelude.o'], { ...preludeFiles, 'prelude.pch': pch }, 'prelude.o');
        writeFileSync(cachedPch, pch);
        writeFileSync(cachedPreludeObject, object);
    }
    const pch = readFileSync(cachedPch);
    objects.push(readFileSync(cachedPreludeObject));

    const archiveFiles = Object.fromEntries(objects.map((bytes, index) => [`o${index}.o`, bytes]));
    const { runLLVM } = await import(pathToFileURL(CLANG_BUNDLE).href);
    const archive = (await runLLVM(['ar', 'rcs', 'quest.a', ...Object.keys(archiveFiles)], archiveFiles, { decodeASCII: false }))['quest.a'];

    await pool.close();

    const output = resolve(HERE, '../../public/reactive-playground/quest');
    rmSync(output, { recursive: true, force: true });
    mkdirSync(output, { recursive: true });

    const headers = {};
    const collect = (node, prefix) => {
        for (const [name, value] of Object.entries(node)) {
            if (typeof value === 'string' || value instanceof Uint8Array) headers[prefix + name] = Buffer.from(value).toString();
            else collect(value, `${prefix}${name}/`);
        }
    };
    collect(include, '');

    const publish = (name, bytes) => {
        const compressed = gzipSync(bytes, { level: 9 });
        writeFileSync(join(output, `${name}.gz`), compressed);
        console.log(`${name}: ${(bytes.length / 1048576).toFixed(1)} MB, ${(compressed.length / 1048576).toFixed(1)} MB compressed`);
    };

    publish('toolchain.json', Buffer.from(JSON.stringify({ headers, prelude, snippetFlags: SNIPPET_FLAGS })));
    publish('prelude.pch', pch);
    publish('quest.a', archive);
    publish('host.o', host);

    for (const file of readdirSync(join(HERE, 'wwwroot'))) {
        const source = join(HERE, 'wwwroot', file);
        if (file === 'worker.js') writeFileSync(join(output, file), readFileSync(source, 'utf8').replaceAll('__CLANG_VERSION__', CLANG_VERSION));
        else copyFileSync(source, join(output, file));
    }

    console.log(`Built ${output} in ${Math.round((performance.now() - started) / 1000)} s`);
}
