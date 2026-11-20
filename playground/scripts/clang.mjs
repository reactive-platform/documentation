import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { LOCK, PATHS } from './common.mjs';

export const CLANG_VERSION = LOCK.clang.version;

// The files the browser loads too, so Quest snippets compile with the same clang as the build
export const CLANG_FILES = join(PATHS.clang, CLANG_VERSION, 'package', 'gen');

const BUNDLE = join(CLANG_FILES, 'bundle.js');

// Runs clang compiled to WebAssembly on worker threads, one compile per worker at a time
export function createClang() {
    const size = Math.max(2, Math.min(8, availableParallelism() - 1));
    const workers = [];
    const idle = [];
    const queue = [];
    const pending = new Map();
    let nextId = 1;

    function next() {
        while (idle.length > 0 && queue.length > 0) {
            const worker = idle.pop();
            const job = queue.shift();

            pending.set(job.id, job);
            worker.postMessage({
                id: job.id,
                args: job.args,
                files: job.files,
                output: job.output,
            });
        }
    }

    function onMessage(worker, message) {
        if (message.log) {
            process.stderr.write(message.log);
            return;
        }

        const job = pending.get(message.id);
        pending.delete(message.id);
        idle.push(worker);

        if (message.failed) {
            job.reject(new Error(`${job.label}: ${message.failed}`));
        } else {
            job.resolve(message.bytes);
        }
        next();
    }

    for (let i = 0; i < size; i++) {
        const worker = new Worker(new URL('./clang-worker.mjs', import.meta.url), {
            workerData: { bundle: BUNDLE },
        });

        worker.on('message', (message) => onMessage(worker, message));
        workers.push(worker);
        idle.push(worker);
    }

    return {
        compile(label, args, files, output) {
            return new Promise((resolve, reject) => {
                queue.push({ id: nextId++, label, args, files, output, resolve, reject });
                next();
            });
        },

        async archive(name, objects) {
            const files = Object.fromEntries(objects.map((bytes, index) => [`${index}.o`, bytes]));
            const { runLLVM } = await import(pathToFileURL(BUNDLE).href);
            const result = await runLLVM(['ar', 'rcs', name, ...Object.keys(files)], files, {
                decodeASCII: false,
            });
            return result[name];
        },

        close() {
            return Promise.all(workers.map((x) => x.terminate()));
        },
    };
}
