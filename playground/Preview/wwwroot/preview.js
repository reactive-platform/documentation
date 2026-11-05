import { dotnet } from './_framework/dotnet.js';
import { fontLoaded, log, measureText, ORIGIN, render, send, startLoop, uploadTexture } from './renderer.js';
import { loadCompressed } from './load-compressed.js';

const runtime = await dotnet.withResourceLoader(loadCompressed).create();
runtime.setModuleImports('preview.js', { render, log, measureText, uploadTexture });
const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
await runtime.runMain();
const bridge = exports.Preview.Bridge;

startLoop({ tick: bridge.Tick, setRootSize: bridge.SetRootSize, pointer: bridge.Pointer });

window.addEventListener('message', (e) => {
    if (e.origin !== ORIGIN || e.data?.type !== 'run') return;

    const started = performance.now();
    const error = bridge.Run(new Uint8Array(e.data.assembly));
    send({ type: 'ran', id: e.data.id, error, ms: performance.now() - started });
});

await fontLoaded;
send({ type: 'ready' });
