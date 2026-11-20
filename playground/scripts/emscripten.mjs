import {existsSync, readdirSync} from 'node:fs';
import {delimiter, dirname, join, sep} from 'node:path';
import {IS_WINDOWS, read} from './common.mjs';

// Sorts numerically, so 10.0.14 comes after 10.0.5
function newest(names) {
    return [...names]
        .sort((a, b) => a.localeCompare(b, 'en', {numeric: true}))
        .at(-1);
}

function findPacks() {
    const sdks = read('dotnet', ['--list-sdks']).split('\n');
    const sdkFolder = /\[(.+)\]\s*$/.exec(sdks.at(-1))?.[1];

    if (!sdkFolder) {
        throw new Error('dotnet --list-sdks found no SDK');
    }
    return join(dirname(sdkFolder), 'packs');
}

function findPack(packs, suffix) {
    const pattern = new RegExp(`^Microsoft\\.NET\\.Runtime\\.Emscripten\\.[\\d.]+\\.${suffix}\\.`);
    const names = existsSync(packs)
        ? readdirSync(packs).filter((x) => pattern.test(x))
        : [];

    if (names.length === 0) {
        return null;
    }

    const pack = join(packs, newest(names));
    return join(pack, newest(readdirSync(pack)), 'tools');
}

function createEnvironment({sdk, node, cache, python}) {
    const pathKey = Object.keys(process.env).find((x) => x.toUpperCase() === 'PATH') ?? 'PATH';
    const paths = [
        join(sdk, 'emscripten'),
        join(sdk, 'bin'),
        join(node, 'bin'),
        process.env[pathKey],
    ];

    const environment = {
        ...process.env,
        DOTNET_EMSCRIPTEN_LLVM_ROOT: join(sdk, 'bin'),
        DOTNET_EMSCRIPTEN_BINARYEN_ROOT: sdk + sep,
        DOTNET_EMSCRIPTEN_NODE_JS: join(node, 'bin', IS_WINDOWS ? 'node.exe' : 'node'),
        EM_CACHE: join(cache, 'emscripten', 'cache'),
        EM_FROZEN_CACHE: '1',
    };

    // The workload ships Python on some platforms only, elsewhere emcc uses the system python3
    if (python) {
        environment.EMSDK_PYTHON = join(python, IS_WINDOWS ? 'python.exe' : join('bin', 'python3'));
        environment.PYTHONUTF8 = '1';
        paths.unshift(python, join(python, 'bin'));

        if (IS_WINDOWS) {
            environment.PYTHONPATH = python;
            environment.PYTHONHOME = '';
            environment.EM_WORKAROUND_PYTHON_BUG_34780 = '1';
        }
    } else {
        read('python3', ['--version']);
    }

    environment[pathKey] = paths.join(delimiter);
    return environment;
}

// Uses the Emscripten from the wasm-tools workload, the same one dotnet publish links with
export function findEmscripten() {
    const packs = findPacks();
    const sdk = findPack(packs, 'Sdk');
    const node = findPack(packs, 'Node');
    const cache = findPack(packs, 'Cache');
    const python = findPack(packs, 'Python');

    if (!sdk || !node || !cache) {
        throw new Error(
            'Emscripten isn\'t installed, run: dotnet workload install wasm-tools (wasm-tools-net10 on SDK 11)',
        );
    }

    return {
        env: createEnvironment({sdk, node, cache, python}),
        tool: (name) => join(sdk, 'emscripten', IS_WINDOWS ? `${name}.bat` : name),
    };
}
