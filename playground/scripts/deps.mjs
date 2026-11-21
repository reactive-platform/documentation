import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { IS_WINDOWS, LOCK, PATHS, read, remove, run } from './common.mjs';

function isAtCommit(dir, commit) {
    try {
        return read('git', ['-C', dir, 'rev-parse', 'HEAD']) === commit;
    } catch {
        return false;
    }
}

function fetchRepository(dir, { repository, commit }, { submodules = false } = {}) {
    if (isAtCommit(dir, commit)) {
        return;
    }

    remove(dir);
    mkdirSync(dir, { recursive: true });

    run('git', ['-C', dir, 'init', '-q']);
    run('git', ['-C', dir, 'remote', 'add', 'origin', repository]);
    run('git', ['-C', dir, 'fetch', '-q', '--depth', '1', 'origin', commit]);
    run('git', ['-C', dir, 'checkout', '-q', 'FETCH_HEAD']);

    if (submodules) {
        run('git', ['-C', dir, 'submodule', 'update', '-q', '--init', '--recursive', '--depth', '1']);
    }
}

// Takes the working tree as it is, uncommitted changes included
function copyCheckout(dir, checkout) {
    remove(dir);
    cpSync(resolve(checkout), dir, {
        recursive: true,
        filter: (source) => !['.git', 'bin', 'obj'].includes(basename(source)),
    });
}

function fetchPackage(dir, { package: name, version }) {
    const target = join(dir, version);
    if (existsSync(target)) {
        return;
    }

    remove(dir);
    mkdirSync(target, { recursive: true });

    run('npm', ['pack', `${name}@${version}`, '--silent', '--pack-destination', target], {
        shell: IS_WINDOWS,
        stdio: 'ignore',
    });

    const archive = readdirSync(target).find((x) => x.endsWith('.tgz'));
    run('tar', ['-xzf', archive], { cwd: target });
    remove(join(target, archive));
}

export function fetchDeps({ reactiveRepo, questRepo, skipQuest = false } = {}) {
    fetchRepository(PATHS.bundle, LOCK['beat-saber-sdk-bundle']);

    if (reactiveRepo) {
        copyCheckout(PATHS.reactiveMono, reactiveRepo);
    } else {
        fetchRepository(PATHS.reactiveMono, LOCK['reactive-mono']);
    }

    fetchRepository(PATHS.yogaBinding, LOCK['yoga-binding'], { submodules: true });

    if (skipQuest) {
        return;
    }

    if (questRepo) {
        copyCheckout(PATHS.reactiveQuest, questRepo);
    } else {
        fetchRepository(PATHS.reactiveQuest, LOCK['reactive-quest'], { submodules: true });
    }

    fetchPackage(PATHS.clang, LOCK.clang);
}
