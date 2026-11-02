import { dotnet } from './_framework/dotnet.js';
import { loadCompressed } from '../preview/load-compressed.js';

let bridge = null;
let pendingCompile = null;
let pendingComplete = null;
let pendingAnalyze = null;
let scheduled = false;

function schedule() {
    if (scheduled || !bridge || !(pendingCompile || pendingComplete || pendingAnalyze)) return;
    scheduled = true;
    setTimeout(work);
}

function work() {
    scheduled = false;
    if (pendingComplete) complete();
    else if (pendingCompile) compile();
    else analyze();
    schedule();
}

function complete() {
    const { id, code, position } = pendingComplete;
    pendingComplete = null;
    postMessage({ type: 'completed', id, ...JSON.parse(bridge.Complete(code, position)) });
}

function compile() {
    const { id, code } = pendingCompile;
    pendingCompile = null;

    const started = performance.now();
    const diagnostics = JSON.parse(bridge.Compile(code));
    const assembly = bridge.TakeAssembly()?.buffer ?? null;
    pendingAnalyze = assembly ? id : null;

    postMessage(
        { type: 'compiled', id, diagnostics, ms: performance.now() - started, assembly },
        assembly ? [assembly] : []
    );
}

async function analyze() {
    const id = pendingAnalyze;
    pendingAnalyze = null;

    try {
        postMessage({ type: 'analyzed', id, diagnostics: JSON.parse(await bridge.Analyze()) });
    } catch (error) {
        console.error(error);
    }
}

self.onmessage = (e) => {
    if (e.data?.type === 'compile') pendingCompile = e.data;
    else if (e.data?.type === 'complete') pendingComplete = e.data;
    schedule();
};

try {
    const runtime = await dotnet.withResourceLoader(loadCompressed).create();
    const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
    await runtime.runMain();
    bridge = exports.Compiler.Bridge;
    postMessage({ type: 'ready' });
    schedule();
} catch (error) {
    postMessage({ type: 'failed', message: String(error) });
}
