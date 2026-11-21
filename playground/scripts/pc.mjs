import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { PATHS, listFiles, read, remove, run } from './common.mjs';
import { findEmscripten } from './emscripten.mjs';

const APPS = ['Preview', 'Compiler'];
const YOGA = join(PATHS.pcBuild, 'yoga');

function warnAboutSdk() {
    const version = read('dotnet', ['--version']);
    const [major, , patch] = version.split('.').map((x) => Number.parseInt(x));

    if (major > 10 || (major === 10 && patch >= 400)) {
        return;
    }

    console.warn(`Warning: SDK ${version} might fail to build`);
}

function buildYoga(rebuild) {
    const library = join(YOGA, 'yoga.a');
    if (existsSync(library) && !rebuild) {
        return;
    }

    const { env, tool } = findEmscripten();
    const binding = PATHS.yogaBinding;
    const objects = join(YOGA, 'obj');
    mkdirSync(objects, { recursive: true });

    const sources = [
        ...listFiles(join(binding, 'lib', 'yoga', 'yoga'), '.cpp'),
        join(binding, 'src', 'bindings.cpp'),
        join(PATHS.pc, 'Yoga', 'bridge.cpp'),
    ];

    const built = sources.map((source) => {
        const object = join(objects, `${basename(source, extname(source))}.o`);

        run(tool('emcc'), [
            '-c', source,
            '-o', object,
            '-std=c++20',
            '-O2',
            '-fno-exceptions',
            '-fno-rtti',
            `-I${join(binding, 'lib', 'yoga')}`,
            `-I${join(binding, 'src')}`,
        ], { env });

        return object;
    });

    remove(library);
    run(tool('emar'), ['rcs', library, ...built], { env });
}

// Browser .NET can't pass delegates to native code, so pc/Yoga/YogaNative.Bridge.cs replaces those imports
function generateYogaNative() {
    const file = join(PATHS.reactiveMono, 'src', 'Reactive', 'Layout', 'Flex', 'Yoga', 'YogaNative.cs');
    let source = readFileSync(file, 'utf8').replace(/^﻿/, '');

    for (const name of ['YGConfigSetLogger', 'YGNodeSetMeasureFunc']) {
        const pattern = new RegExp(`\\[DllImport[^\\]]*\\]\\s*public static extern \\S+ ${name}\\([^)]*\\);`, 'gi');

        if (!pattern.test(source)) {
            throw new Error(`YogaNative.cs no longer imports ${name}, pc/Yoga/YogaNative.Bridge.cs needs another look`);
        }
        source = source.replace(pattern, '');
    }

    const delegate = /extern[^;]*\w(Delegate|Func)\??\s+\w+\s*[,)]/.exec(source);
    if (delegate) {
        throw new Error(`YogaNative.cs has a new delegate import, which browser .NET can't call: ${delegate[0]}`);
    }

    source = source.replace(/static class YogaNative/gi, 'static partial class YogaNative');
    mkdirSync(YOGA, { recursive: true });
    writeFileSync(join(YOGA, 'YogaNative.g.cs'), source);
}

function publishApp(app) {
    const output = join(PATHS.pcBuild, 'publish', app);
    remove(output);

    run('dotnet', [
        'publish', join(PATHS.pc, app, `${app}.csproj`),
        '-c', 'Release',
        '-o', output,
        '-nologo',
        '-v:q',
        '-clp:NoSummary;ErrorsOnly',
    ]);
}

function copyApp(app) {
    const target = join(PATHS.web, app.toLowerCase());
    remove(target);
    cpSync(join(PATHS.pcBuild, 'publish', app, 'wwwroot'), target, { recursive: true });

    // The site only serves the framework as .wasm.gz
    for (const file of listFiles(target)) {
        const isWasm = file.endsWith('.wasm');
        const isOtherGzip = file.endsWith('.gz') && !file.endsWith('.wasm.gz');

        if (isWasm || isOtherGzip) {
            rmSync(file);
        }
    }
}

export function buildPc({ rebuildYoga = false } = {}) {
    warnAboutSdk();
    buildYoga(rebuildYoga);
    generateYogaNative();

    // Both apps are published before either is copied, so a failed publish leaves the old output in place
    APPS.forEach(publishApp);
    APPS.forEach(copyApp);
}
