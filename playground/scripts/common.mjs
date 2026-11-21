import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const IS_WINDOWS = process.platform === 'win32';

export const PLAYGROUND = dirname(dirname(fileURLToPath(import.meta.url)));
export const ROOT = dirname(PLAYGROUND);
export const LOCK = JSON.parse(readFileSync(join(PLAYGROUND, 'lock.json'), 'utf8'));

const ARTIFACTS = join(PLAYGROUND, 'artifacts');
const DOWNLOADS = join(ARTIFACTS, 'downloads');

export const PATHS = {
    pc: join(PLAYGROUND, 'pc'),
    quest: join(PLAYGROUND, 'quest'),

    bundle: join(DOWNLOADS, 'beat-saber-sdk-bundle'),
    reactiveMono: join(DOWNLOADS, 'reactive-mono'),
    reactiveQuest: join(DOWNLOADS, 'reactive-quest'),
    yogaBinding: join(DOWNLOADS, 'yoga-binding'),
    clang: join(DOWNLOADS, 'clang'),

    pcBuild: join(ARTIFACTS, 'build', 'pc'),
    questBuild: join(ARTIFACTS, 'build', 'quest'),
    web: join(ARTIFACTS, 'web'),
};

export function run(file, args, options = {}) {
    // Node only starts .bat and .cmd files through a shell, which needs the quoting done by hand
    const isBatch = IS_WINDOWS && /\.(bat|cmd)$/i.test(file);

    const result = spawnSync(
        isBatch ? `"${file}"` : file,
        isBatch ? args.map((x) => `"${x}"`) : args,
        { stdio: 'inherit', shell: isBatch, ...options },
    );

    if (result.error) {
        throw new Error(`Couldn't run ${file}: ${result.error.message}`);
    }
    if (result.status !== 0) {
        throw new Error(`${file} ${args.join(' ')} failed with ${result.status}`);
    }
}

export function read(file, args) {
    const result = spawnSync(file, args, { encoding: 'utf8' });

    if (result.error || result.status !== 0) {
        throw new Error(`Couldn't run ${file}, is it installed?`);
    }
    return result.stdout.trim();
}

export function remove(path) {
    rmSync(path, { recursive: true, force: true, maxRetries: 3 });
}

export function listFiles(dir, extension = '') {
    return readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .map((x) => join(dir, x))
        .filter((x) => x.endsWith(extension) && statSync(x).isFile());
}
