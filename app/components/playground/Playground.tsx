'use client';

import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { csharp } from '@codemirror/legacy-modes/mode/clike';
import { type Diagnostic, setDiagnostics } from '@codemirror/lint';
import { Compartment, EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import { useEffect, useRef, useState } from 'react';
import './playground.css';
import { samples } from './samples';

const RUNTIME_URL = '/reactive-playground';
const COMPILE_DELAY_MS = 350;

interface CompilerDiagnostic {
    severity: 'error' | 'warning';
    id: string;
    message: string;
    from: number;
    to: number;
    line: number;
    column: number;
}

interface ConsoleLine {
    key: number;
    level: 'error' | 'warning' | 'info';
    text: string;
    position?: number;
}

interface Status {
    kind: 'busy' | 'ok' | 'error';
    text: string;
}

const TEXT_COLORS = {
    busy: 'text-fd-muted-foreground',
    ok: 'text-green-700 dark:text-green-400',
    error: 'text-red-700 dark:text-red-400',
    warning: 'text-yellow-700 dark:text-yellow-400',
    info: '',
};

const LOG_LEVELS: ConsoleLine['level'][] = ['error', 'error', 'warning', 'info', 'error'];

const editorTheme = EditorView.theme({
    '&': { height: '100%', fontSize: '13px' },
    '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, Consolas, monospace' },
});

function isDark() {
    return document.documentElement.classList.contains('dark');
}

export function Playground() {
    const editorHost = useRef<HTMLDivElement>(null);
    const previewHost = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [status, setStatus] = useState<Status>({ kind: 'busy', text: 'Loading the compiler...' });
    const [lines, setLines] = useState<ConsoleLine[]>([]);

    useEffect(() => {
        const worker = new Worker(`${RUNTIME_URL}/compiler/worker.js`, { type: 'module' });
        const frame = document.createElement('iframe');
        frame.src = `${RUNTIME_URL}/preview/index.html`;
        frame.title = 'Preview';
        frame.className = 'h-full w-full border-0';
        previewHost.current!.append(frame);

        const themeCompartment = new Compartment();
        let pendingCompletion: { id: number; resolve: (result: CompletionResult | null) => void } | null = null;
        let nextId = 1;
        let latestCompile = 0;
        let nextLineKey = 1;
        let previewReady = false;
        let pendingRun: { id: number; assembly: ArrayBuffer } | null = null;
        let compileTimer: ReturnType<typeof setTimeout> | undefined;
        let compileMs = 0;
        let compileErrors: CompilerDiagnostic[] = [];

        const view = new EditorView({
            parent: editorHost.current!,
            state: EditorState.create({
                doc: samples[0].code,
                extensions: [
                    basicSetup,
                    StreamLanguage.define(csharp),
                    syntaxHighlighting(classHighlighter),
                    autocompletion({ override: [complete] }),
                    EditorView.lineWrapping,
                    editorTheme,
                    themeCompartment.of(EditorView.theme({}, { dark: isDark() })),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) scheduleCompile();
                    }),
                ],
            }),
        });
        viewRef.current = view;

        const themeObserver = new MutationObserver(() => {
            view.dispatch({ effects: themeCompartment.reconfigure(EditorView.theme({}, { dark: isDark() })) });
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        function complete(context: CompletionContext) {
            if (!context.explicit && !context.matchBefore(/[\w.]/)) return null;

            pendingCompletion?.resolve(null);
            const id = nextId++;
            worker.postMessage({ type: 'complete', id, code: context.state.doc.toString(), position: context.pos });
            return new Promise<CompletionResult | null>((resolve) => {
                pendingCompletion = { id, resolve };
            });
        }

        function scheduleCompile() {
            clearTimeout(compileTimer);
            compileTimer = setTimeout(compile, COMPILE_DELAY_MS);
        }

        function compile() {
            latestCompile = nextId++;
            setStatus({ kind: 'busy', text: 'Compiling...' });
            worker.postMessage({ type: 'compile', id: latestCompile, code: view.state.doc.toString() });
        }

        function toLine(diagnostic: CompilerDiagnostic): ConsoleLine {
            return {
                key: nextLineKey++,
                level: diagnostic.severity,
                text: `(${diagnostic.line},${diagnostic.column}) ${diagnostic.id}: ${diagnostic.message}`,
                position: diagnostic.from >= 0 ? diagnostic.from : undefined,
            };
        }

        function showDiagnostics(diagnostics: CompilerDiagnostic[]) {
            const length = view.state.doc.length;
            const marks: Diagnostic[] = diagnostics
                .filter((x) => x.from >= 0 && x.from <= length)
                .map((x) => ({
                    from: x.from,
                    to: Math.min(Math.max(x.to, x.from + 1), length),
                    severity: x.severity,
                    message: `${x.id}: ${x.message}`,
                }));
            view.dispatch(setDiagnostics(view.state, marks));
        }

        function run(id: number, assembly: ArrayBuffer) {
            if (!previewReady) {
                pendingRun = { id, assembly };
                return;
            }
            frame.contentWindow!.postMessage({ type: 'run', id, assembly }, location.origin, [assembly]);
        }

        worker.onmessage = ({ data }) => {
            switch (data.type) {
                case 'ready':
                    compile();
                    break;
                case 'failed':
                    setStatus({ kind: 'error', text: `The compiler failed to start: ${data.message}` });
                    break;
                case 'completed':
                    if (pendingCompletion?.id === data.id) {
                        pendingCompletion!.resolve({ from: data.from, options: data.options, validFor: /^\w*$/ });
                        pendingCompletion = null;
                    }
                    break;
                case 'compiled':
                    if (data.id !== latestCompile) break;
                    compileErrors = data.diagnostics;
                    compileMs = data.ms;
                    showDiagnostics(data.diagnostics);
                    setLines(data.diagnostics.map(toLine));
                    if (data.assembly) {
                        run(data.id, data.assembly);
                    } else {
                        const count = data.diagnostics.filter((x: CompilerDiagnostic) => x.severity === 'error').length;
                        setStatus({ kind: 'error', text: `${count} ${count === 1 ? 'error' : 'errors'}` });
                    }
                    break;
                case 'analyzed':
                    if (data.id !== latestCompile || data.diagnostics.length === 0) break;
                    compileErrors = [...compileErrors, ...data.diagnostics];
                    showDiagnostics(compileErrors);
                    setLines((current) => [...current, ...data.diagnostics.map(toLine)]);
                    break;
            }
        };

        worker.onerror = () => {
            setStatus({ kind: 'error', text: 'The playground runtime is missing, run playground/build.ps1' });
        };

        function onPreviewMessage(event: MessageEvent) {
            if (event.source !== frame.contentWindow) return;
            const { data } = event;

            switch (data.type) {
                case 'ready':
                    previewReady = true;
                    if (pendingRun) {
                        run(pendingRun.id, pendingRun.assembly);
                        pendingRun = null;
                    }
                    break;
                case 'log':
                    setLines((current) => [
                        ...current.slice(-199),
                        { key: nextLineKey++, level: LOG_LEVELS[data.level], text: data.message },
                    ]);
                    break;
                case 'ran':
                    if (data.id !== latestCompile) break;
                    if (data.error) {
                        setStatus({ kind: 'error', text: 'Failed to start' });
                        setLines((current) => [...current, { key: nextLineKey++, level: 'error', text: data.error }]);
                    } else {
                        setStatus({ kind: 'ok', text: `Updated in ${Math.round(compileMs + data.ms)} ms` });
                    }
                    break;
            }
        }
        window.addEventListener('message', onPreviewMessage);

        return () => {
            clearTimeout(compileTimer);
            window.removeEventListener('message', onPreviewMessage);
            themeObserver.disconnect();
            view.destroy();
            viewRef.current = null;
            frame.remove();
            worker.terminate();
        };
    }, []);

    function selectSample(name: string) {
        const view = viewRef.current!;
        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: samples.find((x) => x.name === name)!.code },
            selection: EditorSelection.single(0),
        });
    }

    function jumpTo(position: number) {
        const view = viewRef.current!;
        view.dispatch({
            selection: EditorSelection.single(position),
            effects: EditorView.scrollIntoView(position, { y: 'center' }),
        });
        view.focus();
    }

    return (
        <div className="flex h-[calc(100dvh-3.5rem)] flex-col gap-2 p-2">
            <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2 text-fd-muted-foreground">
                    Example
                    <select
                        className="rounded-md border border-fd-border bg-fd-background px-2 py-1 text-fd-foreground"
                        onChange={(e) => selectSample(e.target.value)}
                    >
                        {samples.map((x) => (
                            <option key={x.name} value={x.name}>
                                {x.name}
                            </option>
                        ))}
                    </select>
                </label>
                <span className={`rounded-full border border-fd-border bg-fd-muted px-2.5 py-0.5 text-xs ${TEXT_COLORS[status.kind]}`}>{status.text}</span>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-2">
                <div ref={editorHost} className="playground-editor min-h-0 overflow-hidden rounded-lg border border-fd-border" />
                <div className="flex min-h-0 flex-col gap-2">
                    <div ref={previewHost} className="min-h-0 flex-1 overflow-hidden rounded-lg border border-fd-border bg-[#101014]" />
                    <div className="h-28 shrink-0 overflow-auto rounded-lg border border-fd-border bg-fd-card p-2 font-mono text-xs">
                        {lines.length === 0 && <span className="text-fd-muted-foreground">Debug.Log output and compiler errors show up here</span>}
                        {lines.map((line) => (
                            <div
                                key={line.key}
                                className={`whitespace-pre-wrap ${TEXT_COLORS[line.level]} ${line.position !== undefined ? 'cursor-pointer hover:underline' : ''}`}
                                onClick={line.position !== undefined ? () => jumpTo(line.position!) : undefined}
                            >
                                {line.text}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
