import { pathToFileURL } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';

const { runClang } = await import(pathToFileURL(workerData.bundle).href);

function print(bytes) {
    if (bytes) {
        parentPort.postMessage({ log: Buffer.from(bytes).toString() });
    }
}

parentPort.on('message', async ({ id, args, files, output }) => {
    try {
        const result = await runClang(['clang++', ...args], files, {
            stdout: print,
            stderr: print,
            decodeASCII: false,
        });
        parentPort.postMessage({ id, bytes: result[output] });
    } catch (error) {
        parentPort.postMessage({ id, failed: `exit ${error.code ?? error}` });
    }
});
