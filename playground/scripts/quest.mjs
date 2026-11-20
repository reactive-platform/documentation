import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { CLANG_FILES, CLANG_VERSION, createClang } from './clang.mjs';
import { PATHS, PLAYGROUND, listFiles, remove } from './common.mjs';

const OUTPUT = join(PATHS.web, 'quest');
const CACHE = join(PATHS.questBuild, 'obj');

// The Playground's own headers, by the path the sources include them with
const HEADERS = {
    'main.hpp': 'Reactive/main.hpp',
    'playground/Engine.hpp': 'UnityEngine/Engine.hpp',
    'playground/Prelude.hpp': 'Compiler/Prelude.hpp',
};

const SOURCES = [
    'UnityEngine/Engine.cpp',
    'Reactive.BeatSaber/Resources.cpp',
    'Compiler/Instantiations.cpp',
];

const HOST = 'Preview/Host.cpp';

const WEB_FILES = [
    'Compiler/worker.js',
    'Preview/index.html',
    'Preview/preview.js',
];

// reactive-quest sources that only work inside the game, replaced by SOURCES
const GAME_SOURCES = [
    'main.cpp',
    'BeatSaberResources.cpp',
    'GameResources.cpp',
    'VRScrollAdapter.cpp',
];

// Game and Unity headers, which all resolve to the Playground's engine instead
const ENGINE_INCLUDE = /^(UnityEngine|TMPro|HMUI|GlobalNamespace|System|Zenject|custom-types|beatsaber-hook)\//;
const ENGINE_HEADER = '#pragma once\n#include "playground/Engine.hpp"\n';
const EXTRA_ENGINE_HEADERS = [
    'UnityEngine/Debug.hpp',
    'UnityEngine/WaitForSeconds.hpp',
    'UnityEngine/Component.hpp',
    'UnityEngine/Behaviour.hpp',
];

const SPRITES = ['Background', 'Underline', 'Spinner', 'Cross', 'Frame', 'TransparentPixel'];

const REACTIVE_FLAGS = [
    '-std=c++23',
    '-O2',
    '-frtti',
    '-fexceptions',
    '-Wno-reorder-init-list',
    '-Wno-c23-extensions',
    '-Iinclude',
    '-Isrc',
    '-DMOD_ID="reactive"',
    '-DVERSION="playground"',
    '--embed-dir=sprites',
];

const YOGA_FLAGS = [
    '-std=c++20',
    '-O2',
    '-fno-exceptions',
    '-fno-rtti',
    '-Iyoga',
];

const SNIPPET_FLAGS = [
    '-std=c++23',
    '-O0',
    '-frtti',
    '-fno-exceptions',
    '-Wno-reorder-init-list',
    '-Iinclude',
];

const PCH_FLAGS = [
    '-fpch-instantiate-templates',
    '-fpch-codegen',
    '-Xclang',
    '-fno-pch-timestamp',
];

const PCH_OBJECT_FLAGS = [
    '-O1',
    '-frtti',
    '-fno-exceptions',
];

function readTree(dir, filter = () => true) {
    const tree = {};

    for (const name of readdirSync(dir)) {
        const path = join(dir, name);

        if (statSync(path).isDirectory()) {
            tree[name] = readTree(path, filter);
        } else if (filter(name)) {
            tree[name] = readFileSync(path);
        }
    }
    return tree;
}

function setFile(tree, path, content) {
    const parts = path.split('/');
    let node = tree;

    for (const part of parts.slice(0, -1)) {
        node[part] ??= {};
        node = node[part];
    }
    node[parts.at(-1)] = content;
}

function listTreeFiles(tree, prefix = '') {
    const files = {};

    for (const [name, value] of Object.entries(tree)) {
        if (typeof value === 'string' || value instanceof Uint8Array) {
            files[prefix + name] = Buffer.from(value).toString();
        } else {
            Object.assign(files, listTreeFiles(value, `${prefix}${name}/`));
        }
    }
    return files;
}

function digest(value) {
    const hash = createHash('sha1');

    function visit(x) {
        if (x instanceof Uint8Array || typeof x === 'string') {
            hash.update(x);
            return;
        }
        for (const key of Object.keys(x).sort()) {
            hash.update(key);
            visit(x[key]);
        }
    }

    visit(value);
    return hash.digest('hex');
}

function buildIncludeTree(quest) {
    const include = readTree(join(quest, 'shared'));

    for (const [path, file] of Object.entries(HEADERS)) {
        setFile(include, path, readFileSync(join(PATHS.quest, file)));
    }

    const sources = [
        ...listFiles(join(quest, 'shared', 'reactive'), '.hpp'),
        ...listFiles(join(quest, 'src'), '.hpp'),
        ...listFiles(join(quest, 'src'), '.cpp'),
    ];

    for (const file of sources) {
        for (const [, path] of readFileSync(file, 'utf8').matchAll(/#include\s+[<"]([^>"]+)[>"]/g)) {
            if (ENGINE_INCLUDE.test(path)) {
                setFile(include, path, ENGINE_HEADER);
            }
        }
    }

    for (const path of EXTRA_ENGINE_HEADERS) {
        setFile(include, path, ENGINE_HEADER);
    }
    return include;
}

function buildPrelude(quest) {
    const headers = listFiles(join(quest, 'shared', 'reactive'), '.hpp')
        .map((x) => relative(join(quest, 'shared'), x).replaceAll('\\', '/'))
        .filter((x) => !x.includes('/SDK/') && !x.endsWith('BeatSaberUtils.hpp'));

    const includes = [
        '<algorithm>',
        '<functional>',
        '<memory>',
        '<optional>',
        '<string>',
        '<vector>',
        '"reactive/layout/Props.hpp"',
        '"playground/Prelude.hpp"',
        ...headers.map((x) => `"${x}"`),
    ];

    return `#pragma once\n${includes.map((x) => `#include ${x}`).join('\n')}\n`;
}

// Object files are cached by their source, flags and headers, so unchanged files aren't compiled again
async function compileCached(clang, file, flags, files) {
    const source = readFileSync(file);
    const key = digest({ source, flags: flags.join(' '), files: files.digest, CLANG_VERSION });
    const cached = join(CACHE, `${key}.o`);

    if (existsSync(cached)) {
        return readFileSync(cached);
    }

    const bytes = await clang.compile(
        relative(PLAYGROUND, file),
        [...flags, '-c', 'input.cpp', '-o', 'output.o'],
        { ...files.tree, 'input.cpp': source },
        'output.o',
    );

    writeFileSync(cached, bytes);
    console.log(`  ${basename(file)}`);
    return bytes;
}

async function compilePrelude(clang, include, prelude) {
    const files = { include, 'prelude.hpp': prelude };
    const flags = [...SNIPPET_FLAGS, ...PCH_FLAGS, ...PCH_OBJECT_FLAGS].join(' ');
    const key = digest({ files, flags, CLANG_VERSION });
    const pchPath = join(CACHE, `${key}.pch`);
    const objectPath = join(CACHE, `${key}.o`);

    if (!existsSync(pchPath) || !existsSync(objectPath)) {
        const pch = await clang.compile(
            'prelude',
            [...SNIPPET_FLAGS, ...PCH_FLAGS, '-x', 'c++-header', 'prelude.hpp', '-o', 'prelude.pch'],
            files,
            'prelude.pch',
        );

        const object = await clang.compile(
            'prelude object',
            [...PCH_OBJECT_FLAGS, '-c', 'prelude.pch', '-o', 'prelude.o'],
            { ...files, 'prelude.pch': pch },
            'prelude.o',
        );

        writeFileSync(pchPath, pch);
        writeFileSync(objectPath, object);
    }

    return {
        pch: readFileSync(pchPath),
        object: readFileSync(objectPath),
    };
}

function publish(name, bytes) {
    const compressed = gzipSync(bytes, { level: 9 });
    const megabytes = (x) => (x.length / 1048576).toFixed(1);

    writeFileSync(join(OUTPUT, `${name}.gz`), compressed);
    console.log(`${name}: ${megabytes(bytes)} MB, ${megabytes(compressed)} MB compressed`);
}

function copyWebFiles() {
    for (const file of WEB_FILES) {
        copyFileSync(join(PATHS.quest, file), join(OUTPUT, basename(file)));
    }
}

// Stored gzipped only, the site serves them with Content-Encoding
function copyClang() {
    const target = join(OUTPUT, 'clang');
    mkdirSync(target, { recursive: true });

    const files = readdirSync(CLANG_FILES, { withFileTypes: true }).filter((x) => x.isFile());

    for (const { name } of files) {
        const bytes = readFileSync(join(CLANG_FILES, name));
        writeFileSync(join(target, `${name}.gz`), gzipSync(bytes, { level: 9 }));
    }
}

export async function buildQuest() {
    const started = performance.now();
    const quest = PATHS.reactiveQuest;
    const yogaRoot = join(quest, 'lib', 'yoga');
    const spriteDir = join(PATHS.bundle, 'Assets', 'Resources', 'Sprites');

    const include = buildIncludeTree(quest);
    const sprites = Object.fromEntries(
        SPRITES.map((x) => [`${x}.png`, readFileSync(join(spriteDir, `${x}.png`))]),
    );

    const reactiveTree = {
        include,
        src: readTree(join(quest, 'src'), (x) => x.endsWith('.hpp')),
        sprites,
    };
    const yogaTree = {
        yoga: {
            yoga: readTree(join(yogaRoot, 'yoga'), (x) => x.endsWith('.h')),
        },
    };

    const reactiveFiles = { tree: reactiveTree, digest: digest(reactiveTree) };
    const yogaFiles = { tree: yogaTree, digest: digest(yogaTree) };

    const reactiveSources = [
        ...listFiles(join(quest, 'src'), '.cpp').filter((x) => !GAME_SOURCES.includes(basename(x))),
        ...SOURCES.map((x) => join(PATHS.quest, x)),
    ];
    const yogaSources = listFiles(join(yogaRoot, 'yoga'), '.cpp');

    mkdirSync(CACHE, { recursive: true });
    const clang = createClang();

    const objects = await Promise.all([
        ...reactiveSources.map((file) => compileCached(clang, file, REACTIVE_FLAGS, reactiveFiles)),
        ...yogaSources.map((file) => {
            const folder = relative(yogaRoot, dirname(file)).replaceAll('\\', '/');
            return compileCached(clang, file, [...YOGA_FLAGS, `-Iyoga/${folder}`], yogaFiles);
        }),
    ]);

    const host = await compileCached(clang, join(PATHS.quest, HOST), REACTIVE_FLAGS, reactiveFiles);
    const prelude = buildPrelude(quest);
    const compiledPrelude = await compilePrelude(clang, include, prelude);
    const archive = await clang.archive('quest.a', [...objects, compiledPrelude.object]);

    await clang.close();

    remove(OUTPUT);
    mkdirSync(OUTPUT, { recursive: true });

    const toolchain = {
        headers: listTreeFiles(include),
        prelude,
        snippetFlags: SNIPPET_FLAGS,
    };

    publish('toolchain.json', Buffer.from(JSON.stringify(toolchain)));
    publish('prelude.pch', compiledPrelude.pch);
    publish('quest.a', archive);
    publish('host.o', host);
    copyWebFiles();
    copyClang();

    console.log(`Built ${OUTPUT} in ${Math.round((performance.now() - started) / 1000)} s`);
}
