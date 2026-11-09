// Builds the browser runtimes into public/reactive-playground on Windows, Linux and macOS.
//
//   node playground/build.mjs [--reactive-repo <path>] [--quest-repo <path>]
//                             [--yoga-binding <path>] [--rebuild-yoga] [--skip-quest]

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, delimiter, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const YOGA_COMMIT = '51e6095005fd713dbfcbaf2c6296009de782d966';
const REACTIVE_URL = 'https://github.com/reactive-platform/reactive-mono.git';
const BUNDLE_URL = 'https://github.com/reactive-platform/beat-saber-sdk-bundle.git';
const YOGA_BINDING_URL = 'https://github.com/reactive-platform/yoga-binding.git';
const YOGA_URL = 'https://github.com/facebook/yoga.git';
const APPS = ['Preview', 'Compiler'];
const IS_WINDOWS = process.platform === 'win32';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const DEPS = join(HERE, 'deps');
const OUTPUT = join(ROOT, 'public', 'reactive-playground');

const { values: args } = parseArgs({
    options: {
        'reactive-repo': { type: 'string' },
        'quest-repo': { type: 'string' },
        'yoga-binding': { type: 'string' },
        'rebuild-yoga': { type: 'boolean', default: false },
        'skip-quest': { type: 'boolean', default: false },
    },
});

function run(file, fileArguments, options = {}) {
    // Node refuses to start .bat files without a shell, and a shell needs the quoting done by hand
    const isBatch = IS_WINDOWS && /\.(bat|cmd)$/i.test(file);
    const result = spawnSync(
        isBatch ? `"${file}"` : file,
        isBatch ? fileArguments.map((x) => `"${x}"`) : fileArguments,
        { stdio: 'inherit', shell: isBatch, ...options },
    );

    if (result.error) throw new Error(`Couldn't run ${file}: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`${file} ${fileArguments.join(' ')} failed with ${result.status}`);
}

function read(file, fileArguments) {
    const result = spawnSync(file, fileArguments, { encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error(`Couldn't run ${file}, is it installed?`);
    return result.stdout.trim();
}

function remove(path) {
    rmSync(path, { recursive: true, force: true, maxRetries: 3 });
}

function listFiles(dir) {
    return readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .map((x) => join(dir, x))
        .filter((x) => statSync(x).isFile());
}

// Compares numerically, because 10.0.14 is newer than 10.0.5
function newest(names) {
    return [...names].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).at(-1);
}

function warnAboutSdk() {
    const version = read('dotnet', ['--version']);
    if (Number.parseInt(version) >= 11) return;

    console.warn(`Warning: SDK ${version} can reject extension(in GraphicState state) with CS9301. SDK 11 builds it.`);
}

function snapshotReactive() {
    const reactive = join(DEPS, 'reactive-mono');
    remove(reactive);

    if (!args['reactive-repo']) {
        run('git', ['clone', '--depth', '1', '--branch', 'v2-dev', REACTIVE_URL, reactive]);
        return reactive;
    }

    mkdirSync(reactive, { recursive: true });
    const archive = join(DEPS, 'reactive-mono.tar');
    run('git', ['-C', resolve(args['reactive-repo']), 'archive', '--format=tar', '-o', archive, 'HEAD']);
    // Relative paths, because GNU tar reads C:\ as a remote host
    run('tar', ['-xf', basename(archive), '-C', basename(reactive)], { cwd: DEPS });
    remove(archive);
    return reactive;
}

function cloneBundle() {
    const bundle = join(DEPS, 'beat-saber-sdk-bundle');
    remove(bundle);
    run('git', ['clone', '--depth', '1', BUNDLE_URL, bundle]);
    return bundle;
}

function hasYogaSources(binding) {
    return existsSync(join(binding, 'lib', 'yoga', 'yoga'));
}

function getYogaBinding() {
    const local = args['yoga-binding'] ? resolve(args['yoga-binding']) : join(ROOT, 'yoga-binding');
    if (hasYogaSources(local)) return local;

    const binding = join(DEPS, 'yoga-binding');
    if (hasYogaSources(binding)) return binding;

    remove(binding);
    run('git', ['clone', '--depth', '1', YOGA_BINDING_URL, binding]);

    const yoga = join(binding, 'lib', 'yoga');
    mkdirSync(yoga, { recursive: true });
    run('git', ['-C', yoga, 'init', '-q']);
    run('git', ['-C', yoga, 'remote', 'add', 'origin', YOGA_URL]);
    run('git', ['-C', yoga, 'fetch', '-q', '--depth', '1', 'origin', YOGA_COMMIT]);
    run('git', ['-C', yoga, 'checkout', '-q', 'FETCH_HEAD']);
    return binding;
}

function findEmscripten() {
    const sdks = read('dotnet', ['--list-sdks']).split('\n');
    const sdkFolder = /\[(.+)\]\s*$/.exec(sdks.at(-1))?.[1];
    if (!sdkFolder) throw new Error('dotnet --list-sdks found no SDK');
    const packs = join(dirname(sdkFolder), 'packs');

    const getPack = (suffix) => {
        const pattern = new RegExp(`^Microsoft\\.NET\\.Runtime\\.Emscripten\\.[\\d.]+\\.${suffix}\\.`);
        const names = existsSync(packs) ? readdirSync(packs).filter((x) => pattern.test(x)) : [];
        if (!names.length) return null;

        const pack = join(packs, newest(names));
        return join(pack, newest(readdirSync(pack)), 'tools');
    };

    const sdk = getPack('Sdk');
    const node = getPack('Node');
    const cache = getPack('Cache');
    if (!sdk || !node || !cache) {
        throw new Error('Emscripten isn\'t installed, run: dotnet workload install wasm-tools (wasm-tools-net10 on SDK 11)');
    }

    return { sdk, node, cache, python: getPack('Python') };
}

function createEmscriptenEnvironment({ sdk, node, cache, python }) {
    const pathKey = Object.keys(process.env).find((x) => x.toUpperCase() === 'PATH') ?? 'PATH';
    const paths = [join(sdk, 'emscripten'), join(sdk, 'bin'), join(node, 'bin'), process.env[pathKey]];
    const environment = {
        ...process.env,
        DOTNET_EMSCRIPTEN_LLVM_ROOT: join(sdk, 'bin'),
        DOTNET_EMSCRIPTEN_BINARYEN_ROOT: sdk + sep,
        DOTNET_EMSCRIPTEN_NODE_JS: join(node, 'bin', IS_WINDOWS ? 'node.exe' : 'node'),
        EM_CACHE: join(cache, 'emscripten', 'cache'),
        EM_FROZEN_CACHE: '1',
    };

    // The workload only ships Python on some platforms, the others use the system one
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

function buildYoga() {
    const library = join(HERE, 'native', 'yoga.a');
    if (!args['rebuild-yoga'] && existsSync(library)) return;

    const binding = getYogaBinding();
    const emscripten = findEmscripten();
    const env = createEmscriptenEnvironment(emscripten);
    const tool = (name) => join(emscripten.sdk, 'emscripten', IS_WINDOWS ? `${name}.bat` : name);

    const objects = join(HERE, 'native', 'obj');
    mkdirSync(objects, { recursive: true });

    const sources = [
        ...listFiles(join(binding, 'lib', 'yoga', 'yoga')).filter((x) => extname(x) === '.cpp'),
        join(binding, 'src', 'bindings.cpp'),
        join(HERE, 'native', 'bridge.cpp'),
    ];

    const built = sources.map((source) => {
        const object = join(objects, `${basename(source, '.cpp')}.o`);
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

function generateYogaNative(reactive) {
    const file = join(reactive, 'src', 'Reactive', 'Layout', 'Flex', 'Yoga', 'YogaNative.cs');
    let source = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');

    for (const name of ['YGConfigSetLogger', 'YGNodeSetMeasureFunc']) {
        const pattern = new RegExp(`\\[DllImport[^\\]]*\\]\\s*public static extern \\S+ ${name}\\([^)]*\\);`, 'gi');
        if (!source.match(pattern)) {
            throw new Error(`YogaNative.cs no longer imports ${name}, native/YogaNative.Bridge.cs needs another look`);
        }
        source = source.replace(pattern, '');
    }

    const delegate = /extern[^;]*\w(Delegate|Func)\??\s+\w+\s*[,)]/.exec(source);
    if (delegate) throw new Error(`New delegate import, browser .NET can't marshal it: ${delegate[0]}`);

    source = source.replace(/static class YogaNative/gi, 'static partial class YogaNative');
    writeFileSync(join(HERE, 'Reactive', 'YogaNative.g.cs'), source);
}

function publishApp(app) {
    remove(join(HERE, app, 'bin', 'Release', 'net10.0', 'publish'));
    run('dotnet', [
        'publish', join(HERE, app, `${app}.csproj`),
        '-c', 'Release',
        '-nologo',
        '-v:q',
        '-clp:NoSummary;ErrorsOnly',
    ]);
}

function copyApp(app) {
    const target = join(OUTPUT, app.toLowerCase());
    remove(target);
    cpSync(join(HERE, app, 'bin', 'Release', 'net10.0', 'publish', 'wwwroot'), target, { recursive: true });

    // The compressed framework is all the site serves, so keep only .wasm.gz
    for (const file of listFiles(target)) {
        const isGzip = extname(file) === '.gz';
        if (extname(file) === '.wasm' || (isGzip && !file.endsWith('.wasm.gz'))) rmSync(file);
    }
}

function buildQuest(bundle) {
    const questArguments = [join(HERE, 'Quest', 'build.mjs'), '--bundle', bundle];
    if (args['quest-repo']) questArguments.push('--quest', resolve(args['quest-repo']));
    run(process.execPath, questArguments);
}

function main() {
    warnAboutSdk();
    mkdirSync(DEPS, { recursive: true });

    const reactive = snapshotReactive();
    const bundle = cloneBundle();
    buildYoga();
    generateYogaNative(reactive);

    // Published first and replaced one by one, so a failed step leaves the previous output working
    APPS.forEach(publishApp);
    APPS.forEach(copyApp);
    if (!args['skip-quest']) buildQuest(bundle);

    const size = listFiles(OUTPUT).reduce((total, file) => total + statSync(file).size, 0);
    console.log(`Built ${OUTPUT} (${(size / 1048576).toFixed(1)} MB)`);
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
