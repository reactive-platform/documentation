const CLANG_URL = 'https://cdn.jsdelivr.net/npm/@yowasp/clang@22.0.0-git20542-10/gen/bundle.js';
const DIAGNOSTIC = /^(.+?):(\d+):(\d+): (fatal error|error|warning|note): (.*)$/;
const APP_ENTRY = '\nextern "C" reactive::IReactiveComponent* playground_create_app() { return new App(); }\n';
const LINK_ARGS = ['-mexec-model=reactor', '-Wl,-z,stack-size=1048576', '-Wl,--stack-first'];

const decoder = new TextDecoder();
let runClang = null;
let files = null;
let compileArgs = null;
let linkFiles = null;
let pendingCompile = null;
let pendingComplete = null;
let working = false;

async function load(name) {
    const response = await fetch(`./${name}.gz`);
    if (!response.ok) throw new Error(`Failed to load ${name}: ${response.status}`);
    const body = response.body.pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(body).arrayBuffer());
}

function toTree(headers) {
    const tree = {};
    for (const [path, text] of Object.entries(headers)) {
        const parts = path.split('/');
        let node = tree;
        for (const part of parts.slice(0, -1)) node = node[part] ??= {};
        node[parts.at(-1)] = text;
    }
    return tree;
}

function reportDownload({ totalLength, doneLength }) {
    postMessage({ type: 'progress', text: `Downloading the C++ compiler, ${Math.round((doneLength / totalLength) * 100)}%...` });
}

async function clang(args, input) {
    let output = '';
    const collect = (bytes) => {
        if (bytes) output += decoder.decode(bytes);
    };

    try {
        const result = await runClang(['clang++', ...args], input, { stdout: collect, stderr: collect, decodeASCII: false, fetchProgress: reportDownload });
        return { result, output, ok: true };
    } catch (error) {
        if (error.code === undefined) throw error;
        return { result: {}, output, ok: false };
    }
}

function offsetOf(code, line, column) {
    let position = 0;
    for (let i = 1; i < line; i++) position = code.indexOf('\n', position) + 1;
    return position + column - 1;
}

function parseDiagnostics(output, code) {
    const lineCount = code.split('\n').length;
    const diagnostics = [];

    for (const text of output.split('\n')) {
        const match = DIAGNOSTIC.exec(text);
        if (!match) continue;

        const [, file, lineText, columnText, kind, message] = match;
        const line = Number(lineText);
        const column = Number(columnText);
        const inSnippet = file === 'snippet.cpp' && line <= lineCount;
        const isEntry = file === 'snippet.cpp' && line > lineCount;

        if (isEntry && kind !== 'note') {
            diagnostics.push({ severity: 'error', id: 'error', message: 'No component to show, declare `class App : public reactive::ReactiveComponent`', from: -1, to: -1, line: 1, column: 1 });
            continue;
        }
        if (isEntry) continue;

        const severity = kind === 'note' ? 'info' : kind === 'warning' ? 'warning' : 'error';
        const marked = inSnippet && severity !== 'info';
        const from = marked ? offsetOf(code, line, column) : -1;
        const word = marked ? /^\w+/.exec(code.slice(from))?.[0].length ?? 1 : 0;

        diagnostics.push({
            severity,
            id: kind,
            message: inSnippet ? message : `${file}:${line}: ${message}`,
            from,
            to: from + word,
            line,
            column,
        });
    }

    return diagnostics;
}

async function compile({ id, code }) {
    const started = performance.now();

    const compiled = await clang(
        [...compileArgs, '-c', 'snippet.cpp', '-o', 'snippet.o'],
        { ...files, 'snippet.cpp': code + APP_ENTRY }
    );
    const diagnostics = parseDiagnostics(compiled.output, code);

    if (!compiled.ok) {
        postMessage({ type: 'compiled', id, diagnostics, ms: performance.now() - started, assembly: null });
        return;
    }

    const linked = await clang(
        ['snippet.o', 'host.o', 'quest.a', ...LINK_ARGS, '-o', 'app.wasm'],
        { ...linkFiles, 'snippet.o': compiled.result['snippet.o'] }
    );

    if (!linked.ok) {
        for (const message of linked.output.split('\n').filter(Boolean)) {
            diagnostics.push({ severity: 'error', id: 'link error', message: message.replace(/^wasm-ld: error: /, ''), from: -1, to: -1, line: 1, column: 1 });
        }
        postMessage({ type: 'compiled', id, diagnostics, ms: performance.now() - started, assembly: null });
        return;
    }

    const assembly = linked.result['app.wasm'].slice().buffer;
    postMessage({ type: 'compiled', id, diagnostics, ms: performance.now() - started, assembly }, [assembly]);
}

function cleanSignature(text) {
    return text.replace(/\[#(.*?)#\]/g, '$1 ').replace(/<#(.*?)#>/g, '$1').replace(/\{#(.*?)#\}/g, '$1');
}

async function complete({ id, code, position }) {
    const before = code.slice(0, position);
    const line = before.split('\n').length;
    const column = position - before.lastIndexOf('\n');
    const from = position - /\w*$/.exec(before)[0].length;

    const { output } = await clang(
        [...compileArgs, '-fsyntax-only', '-Xclang', `-code-completion-at=snippet.cpp:${line}:${column}`, 'snippet.cpp'],
        { ...files, 'snippet.cpp': code }
    );

    const options = [];
    for (const text of output.split('\n')) {
        const match = /^COMPLETION: (\S+)(?: \(([^)]*)\))?(?: : (.*))?$/.exec(text);
        if (!match || match[2]?.includes('Inaccessible') || /^(operator|~|_)/.test(match[1])) continue;

        const signature = cleanSignature(match[3] ?? '');
        options.push({ label: match[1], type: signature.includes('(') ? 'function' : 'variable', detail: signature });
        if (options.length === 300) break;
    }

    postMessage({ type: 'completed', id, from, options });
}

async function pump() {
    if (working || !runClang) return;
    working = true;

    try {
        while (pendingComplete || pendingCompile) {
            if (pendingComplete) {
                const request = pendingComplete;
                pendingComplete = null;
                await complete(request);
            } else {
                const request = pendingCompile;
                pendingCompile = null;
                await compile(request);
            }
        }
    } catch (error) {
        postMessage({ type: 'failed', message: String(error) });
    }

    working = false;
}

self.onmessage = (e) => {
    if (e.data?.type === 'compile') pendingCompile = e.data;
    else if (e.data?.type === 'complete') pendingComplete = e.data;
    pump();
};

try {
    const [toolchain, pch, archive, host, clangModule] = await Promise.all([
        load('toolchain.json'),
        load('prelude.pch'),
        load('quest.a'),
        load('host.o'),
        import(CLANG_URL),
    ]);

    runClang = clangModule.runClang;

    const { headers, prelude, snippetFlags } = JSON.parse(decoder.decode(toolchain));
    files = { include: toTree(headers), 'prelude.hpp': prelude, 'prelude.pch': pch };
    compileArgs = [...snippetFlags, '-include-pch', 'prelude.pch', '-ferror-limit=20', '-fno-caret-diagnostics', '-fno-color-diagnostics'];
    linkFiles = { 'quest.a': archive, 'host.o': host };

    await clang(['--version'], {});

    postMessage({ type: 'ready' });
    pump();
} catch (error) {
    postMessage({ type: 'failed', message: String(error) });
}
