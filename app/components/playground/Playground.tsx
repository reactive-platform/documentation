'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CanvasControls, PreviewCanvas } from './canvas';
import { CONTROL, SEGMENTS, segment } from './controls';
import { readPlaygroundUrl } from './encode';
import { Editor } from './editor';
import { assemble, defaultFileName, fileExtension, freshFileName, locate, type SourceFile } from './files';
import { questSamples } from './quest-samples';
import { type CompilerDiagnostic, getCompiler, PLATFORMS, type PlatformName, Preview } from './runtime';
import { samples } from './samples';

function FileIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
            <path d="M10 12.5 8 15l2 2.5" />
            <path d="m14 12.5 2 2.5-2 2.5" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
        </svg>
    );
}

const SAMPLES = { pc: samples, quest: questSamples };

interface ConsoleLine {
    key: number;
    level: 'error' | 'warning' | 'info';
    text: string;
    /** The file and offset a diagnostic points at, so clicking it can go there. */
    fileId?: number;
    position?: number;
}

/** A file open on the page. Each keeps its own editor, so undo and the cursor survive switching tabs. */
interface OpenFile {
    id: number;
    name: string;
    editor: Editor;
    host: HTMLDivElement;
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

/** A number kept in localStorage, read after mount so the server and first client render agree. */
function useStoredNumber(key: string, initial: number): [number, (value: number) => void] {
    const [value, setValue] = useState(initial);

    useEffect(() => {
        try {
            const stored = Number(localStorage.getItem(key));
            if (stored > 0) setValue(stored);
        } catch {
            // storage may be unavailable
        }
    }, [key]);

    const set = (next: number) => {
        setValue(next);
        try {
            localStorage.setItem(key, String(Math.round(next)));
        } catch {
            // storage may be unavailable
        }
    };
    return [value, set];
}

/** A divider that reports the pointer's position while dragged. The vertical one only shows beside the editor. */
function Handle({ axis, onDrag }: { axis: 'x' | 'y'; onDrag: (x: number, y: number) => void }) {
    const [active, setActive] = useState(false);

    function start(event: React.PointerEvent<HTMLDivElement>) {
        event.preventDefault();
        setActive(true);
        const handle = event.currentTarget;
        // The pointer is captured, so moves keep coming even over the preview frame, which would otherwise take them
        handle.setPointerCapture(event.pointerId);
        const move = (e: PointerEvent) => onDrag(e.clientX, e.clientY);
        const end = (e: PointerEvent) => {
            setActive(false);
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', end);
            handle.removeEventListener('pointercancel', end);
            if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.body.classList.remove('playground-resizing');
        };
        document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
        document.body.classList.add('playground-resizing');
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    }

    const bar = `rounded-full transition-colors group-hover:bg-fd-primary ${active ? 'bg-fd-primary' : 'bg-fd-border'}`;
    return axis === 'x' ? (
        <div className="group hidden w-2 shrink-0 cursor-col-resize items-center justify-center lg:flex" role="separator" aria-orientation="vertical" onPointerDown={start}>
            <div className={`h-8 w-0.5 ${bar}`} />
        </div>
    ) : (
        <div className="group flex h-2 shrink-0 cursor-row-resize items-center justify-center" role="separator" aria-orientation="horizontal" onPointerDown={start}>
            <div className={`h-0.5 w-8 ${bar}`} />
        </div>
    );
}

export function Playground() {
    const editorHost = useRef<HTMLDivElement>(null);
    const previewHost = useRef<HTMLDivElement>(null);
    const openFiles = useRef<OpenFile[]>([]);
    const nextFileId = useRef(1);
    const drafts = useRef<Partial<Record<PlatformName, SourceFile[]>>>({});
    // The files a link put in the URL, applied once to the platform it names
    const linked = useRef<{ platform: PlatformName; files: SourceFile[] } | null>(null);
    // What the current platform's effect offers the handlers outside it
    const session = useRef<{ open: (file: SourceFile) => OpenFile; load: (files: SourceFile[]) => void; schedule: () => void } | null>(null);
    const renameInput = useRef<HTMLInputElement>(null);
    // Enter, Escape and losing focus can all end a rename, and removing the box can blur it too. The first one wins
    const renameEnded = useRef(false);
    const [platformName, setPlatformName] = useState<PlatformName>('pc');
    const platform = PLATFORMS[platformName];
    const platformSamples = SAMPLES[platformName];

    const [sampleName, setSampleName] = useState(platformSamples[0].name);
    // The files as they were last loaded, so edits to them can be detected before they are thrown away
    const baseline = useRef('');
    const [tabs, setTabs] = useState<{ id: number; name: string }[]>([]);
    const [activeId, setActiveId] = useState(0);
    const [renaming, setRenaming] = useState<number | null>(null);
    const discardDraft = useRef(false);
    const [importOpen, setImportOpen] = useState(false);
    // True from the start of a compile until the result has run, so the previous view is covered meanwhile
    const [compiling, setCompiling] = useState(false);
    const [confirm, setConfirm] = useState<{ message: string; action: () => void; cancelLabel?: string; actionLabel?: string } | null>(null);
    const [status, setStatus] = useState<Status>({ kind: 'busy', text: 'Loading the compiler...' });
    const [lines, setLines] = useState<ConsoleLine[]>([]);
    const [canvas, setCanvas] = useState<PreviewCanvas | null>(null);
    const splitHost = useRef<HTMLDivElement>(null);
    const columnHost = useRef<HTMLDivElement>(null);
    const [split, setSplit] = useStoredNumber('playground.split', 50);
    const [consoleHeight, setConsoleHeight] = useStoredNumber('playground.console', 112);

    function currentFiles(): SourceFile[] {
        return openFiles.current.map((file) => ({ name: file.name, code: file.editor.code }));
    }

    function publishTabs() {
        setTabs(openFiles.current.map(({ id, name }) => ({ id, name })));
    }

    function activate(id: number) {
        for (const file of openFiles.current) file.host.hidden = file.id !== id;
        setActiveId(id);
        openFiles.current.find((file) => file.id === id)?.editor.view.requestMeasure();
    }

    // /playground?sample=Dialog opens that sample, and /playground?platform=quest#code=... opens code handed
    // over by an example. Read after mount, so the server-rendered page and the first client render agree.
    useEffect(() => {
        const url = readPlaygroundUrl();
        const target = url.platform && url.platform in PLATFORMS ? url.platform : 'pc';
        const files = url.files ?? (url.code ? [{ name: defaultFileName(url.code, target), code: url.code }] : null);
        if (files) {
            linked.current = { platform: target, files };
        }
        if (target !== 'pc') {
            setPlatformName(target);
        }
    }, []);

    useEffect(() => {
        setStatus({ kind: 'busy', text: 'Loading the compiler...' });
        setLines([]);

        const compiler = getCompiler(platformName);
        const preview = new Preview(previewHost.current!, platformName);
        const previewCanvas = new PreviewCanvas(preview, previewHost.current!);
        setCanvas(previewCanvas);
        const key = {};
        let nextLineKey = 1;
        let compileTimer: ReturnType<typeof setTimeout> | undefined;
        let disposed = false;

        function openFile(file: SourceFile) {
            const host = document.createElement('div');
            host.className = 'absolute inset-0';
            editorHost.current!.appendChild(host);
            const entry: OpenFile = {
                id: nextFileId.current++,
                name: file.name,
                host,
                editor: new Editor({
                    parent: host,
                    doc: file.code,
                    platform: platformName,
                    onChange: scheduleCompile,
                    complete: async (text, position) => {
                        // Completion sees all the files, with the edited file's draft in place
                        const index = openFiles.current.indexOf(entry);
                        const codes = openFiles.current.map((x) => x.editor.code);
                        codes[index] = text;
                        const assembled = assemble(codes, platformName);
                        const result = await compiler.complete(assembled.text, position + assembled.starts[index]);
                        return result && { ...result, from: result.from - assembled.starts[index] };
                    },
                }),
            };
            openFiles.current.push(entry);
            return entry;
        }

        function closeAll() {
            for (const file of openFiles.current) {
                file.editor.destroy();
                file.host.remove();
            }
            openFiles.current = [];
        }

        function load(files: SourceFile[]) {
            closeAll();
            for (const file of files) openFile(file);
            publishTabs();
            activate(openFiles.current[0].id);
            baseline.current = JSON.stringify(currentFiles());
        }

        session.current = { open: openFile, load, schedule: scheduleCompile };

        const url = readPlaygroundUrl();
        const sample = platformSamples.find((x) => x.name === url.sample);
        const draft = drafts.current[platformName];
        if (linked.current?.platform === platformName) {
            load(linked.current.files);
            linked.current = null;
            setSampleName(platformSamples[0].name);
        } else if (draft) {
            load(draft);
            setSampleName(platformSamples[0].name);
        } else {
            const initial = sample ?? platformSamples[0];
            load([{ name: defaultFileName(initial.code, platformName), code: initial.code }]);
            setSampleName(initial.name);
        }

        function scheduleCompile() {
            clearTimeout(compileTimer);
            compileTimer = setTimeout(compile, platform.compileDelay);
        }

        async function compile() {
            setStatus({ kind: 'busy', text: 'Compiling...' });
            setCompiling(true);

            // Diagnostics point into this exact text, whatever happens to the files before they arrive
            const files = openFiles.current.slice();
            const codes = files.map((file) => file.editor.code);
            const assembled = assemble(codes, platformName);
            let errors: CompilerDiagnostic[] = [];

            const locateAll = (diagnostics: CompilerDiagnostic[]) => diagnostics.map((x) => ({ diagnostic: x, ...locate(x, assembled, codes) }));

            const mark = () => {
                const located = locateAll(errors);
                files.forEach((file, index) => {
                    if (!openFiles.current.includes(file)) return;
                    file.editor.showDiagnostics(
                        located.filter((x) => x.file === index && x.from >= 0).map((x) => ({ ...x.diagnostic, from: x.from, to: x.to })),
                    );
                });
            };

            const toLines = (diagnostics: CompilerDiagnostic[]): ConsoleLine[] =>
                locateAll(diagnostics).map((x) => ({
                    key: nextLineKey++,
                    level: x.diagnostic.severity,
                    text: `${files[x.file].name}(${x.line},${x.column}) ${x.diagnostic.id}: ${x.diagnostic.message}`,
                    fileId: files[x.file].id,
                    position: x.from >= 0 ? x.from : undefined,
                }));

            const result = await compiler.compile(assembled.text, key, (analyzed) => {
                if (disposed) return;
                errors = [...errors, ...analyzed];
                mark();
                setLines((current) => [...current, ...toLines(analyzed)]);
            });
            if (disposed) return;
            if (!result) {
                // Replaced by a newer compile, which keeps the cover up
                return;
            }

            errors = result.diagnostics;
            mark();
            setLines(toLines(errors));

            if (!result.assembly) {
                const count = errors.filter((x) => x.severity === 'error').length;
                setStatus({ kind: 'error', text: `${count} ${count === 1 ? 'error' : 'errors'}` });
                setCompiling(false);
                return;
            }

            const ran = await preview.run(result.id, result.assembly);
            if (disposed) return;
            setCompiling(false);
            if (ran.error) {
                setStatus({ kind: 'error', text: 'Failed to start' });
                setLines((current) => [...current, { key: nextLineKey++, level: 'error', text: ran.error! }]);
            } else {
                setStatus({ kind: 'ok', text: `Updated in ${Math.round(result.ms + ran.ms)} ms` });
            }
        }

        const unsubscribeStatus = compiler.onStatus((s) => {
            if (s.kind === 'failed') setStatus({ kind: 'error', text: s.text });
            else if (s.kind === 'loading') setStatus({ kind: 'busy', text: s.text });
            else compile();
        });

        const unsubscribeLog = preview.onLog((level, message) => {
            setLines((current) => [...current.slice(-199), { key: nextLineKey++, level, text: message }]);
        });

        return () => {
            disposed = true;
            clearTimeout(compileTimer);
            unsubscribeStatus();
            unsubscribeLog();
            drafts.current[platformName] = discardDraft.current ? undefined : currentFiles();
            discardDraft.current = false;
            closeAll();
            session.current = null;
            previewCanvas.destroy();
            setCanvas(null);
            preview.destroy();
        };
    }, [platformName, platform, platformSamples]);

    function selectSample(name: string) {
        const { code } = platformSamples.find((x) => x.name === name)!;
        session.current?.load([{ name: defaultFileName(code, platformName), code }]);
        session.current?.schedule();
        setSampleName(name);
    }

    function isEdited() {
        return openFiles.current.length > 0 && JSON.stringify(currentFiles()) !== baseline.current;
    }

    function addFile() {
        const taken = openFiles.current.map((file) => file.name);
        const file = session.current?.open({ name: freshFileName(taken, platformName), code: '' });
        if (!file) return;
        publishTabs();
        activate(file.id);
        setRenaming(file.id);
    }

    function removeFile(id: number) {
        const file = openFiles.current.find((x) => x.id === id);
        if (!file || openFiles.current.length === 1) return;

        const remove = () => {
            const index = openFiles.current.indexOf(file);
            file.editor.destroy();
            file.host.remove();
            openFiles.current = openFiles.current.filter((x) => x !== file);
            publishTabs();
            if (activeId === id) activate(openFiles.current[Math.max(index - 1, 0)].id);
            session.current?.schedule();
        };

        setConfirm({ message: `Delete ${file.name}? This can't be undone.`, action: remove, cancelLabel: 'Cancel', actionLabel: 'Delete' });
    }

    /** Ends the rename in progress. Without a value, or with an unusable one, the file keeps its name. */
    function finishRename(id: number, value: string | null, focusEditor = false) {
        if (renameEnded.current) return;
        renameEnded.current = true;
        setRenaming(null);
        const file = openFiles.current.find((x) => x.id === id);
        if (focusEditor) file?.editor.view.focus();
        const typed = value?.trim();
        if (!file || !typed) return;
        const name = typed.includes('.') ? typed : `${typed}.${fileExtension(platformName)}`;
        // A taken name is refused by keeping the old one, since names are how the console tells files apart
        if (openFiles.current.some((x) => x !== file && x.name === name)) return;
        file.name = name;
        publishTabs();
    }

    function goToLine(line: ConsoleLine) {
        const file = openFiles.current.find((x) => x.id === line.fileId);
        if (!file || line.position === undefined) return;
        activate(file.id);
        file.editor.jumpTo(line.position);
    }

    /** Runs the action, after a confirmation when it would throw away edits. */
    function guard(action: () => void) {
        if (isEdited()) {
            setConfirm({ message: 'The code has been edited. Throw the changes away?', action });
        } else {
            action();
        }
    }

    function switchPlatform(name: PlatformName) {
        if (name === platformName) return;
        guard(() => {
            discardDraft.current = true;
            setPlatformName(name);
        });
    }

    function importSample(name: string) {
        guard(() => {
            selectSample(name);
            setImportOpen(false);
        });
    }

    // A rename starts with the name selected up to its extension, so typing replaces just that
    useEffect(() => {
        const input = renameInput.current;
        if (renaming === null || !input) return;
        renameEnded.current = false;
        input.focus();
        const dot = input.value.lastIndexOf('.');
        input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
    }, [renaming]);

    // Escape closes whatever is open
    useEffect(() => {
        if (!importOpen && !confirm) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (confirm) setConfirm(null);
            else setImportOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [importOpen, confirm]);

    return (
        <div className="playground-page flex h-[calc(100dvh-3.5rem)] flex-col gap-2 p-2" style={{ '--split': `${split}%` } as React.CSSProperties}>
            <div className="flex flex-wrap items-center gap-3 px-2 text-sm">
                <span className="text-fd-muted-foreground">Platform</span>
                <div role="tablist" aria-label="Platform" className={SEGMENTS}>
                    {(Object.keys(PLATFORMS) as PlatformName[]).map((name) => (
                        <button
                            key={name}
                            role="tab"
                            aria-selected={name === platformName}
                            className={`${segment(name === platformName)} ${name === platformName ? '' : 'text-fd-muted-foreground'}`}
                            onClick={() => switchPlatform(name)}
                        >
                            {PLATFORMS[name].label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className={CONTROL}
                    onClick={() => setImportOpen(true)}
                >
                    Import example
                </button>
                <span className={`rounded-full border border-fd-border bg-fd-muted px-2.5 py-0.5 text-xs ${TEXT_COLORS[status.kind]}`}>{status.text}</span>
            </div>
            {importOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setImportOpen(false)}>
                    <div
                        role="dialog"
                        aria-label="Examples"
                        className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-xl border border-fd-border bg-fd-card p-5 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center">
                            <h2 className="text-lg font-medium">Examples</h2>
                            <span className="ms-3 text-sm text-fd-muted-foreground">{platform.label}</span>
                            <button type="button" className="ms-auto rounded-md px-2 py-1 text-fd-muted-foreground hover:text-fd-foreground" aria-label="Close" onClick={() => setImportOpen(false)}>
                                ✕
                            </button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {platformSamples.map((sample) => (
                                <button
                                    key={sample.name}
                                    type="button"
                                    className={`overflow-hidden rounded-lg border text-left transition-colors hover:border-fd-primary ${sample.name === sampleName ? 'border-fd-primary' : 'border-fd-border'}`}
                                    onClick={() => importSample(sample.name)}
                                >
                                    <img src={sample.image} alt="" className="aspect-[363/296] w-full bg-[#1c1c21] object-cover" />
                                    <div className="p-3">
                                        <div className="font-medium">{sample.name}</div>
                                        <div className="mt-1 text-xs text-fd-muted-foreground">{sample.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {confirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirm(null)}>
                    <div role="alertdialog" className="w-full max-w-sm rounded-xl border border-fd-border bg-fd-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
                        <p className="text-sm">{confirm.message}</p>
                        <div className="mt-4 flex justify-end gap-2 text-sm">
                            <button type="button" className="rounded-md border border-fd-border px-3 py-1 hover:bg-fd-accent" onClick={() => setConfirm(null)}>
                                {confirm.cancelLabel ?? 'Keep editing'}
                            </button>
                            <button
                                type="button"
                                className="rounded-md bg-fd-primary px-3 py-1 font-medium text-fd-primary-foreground hover:opacity-90"
                                onClick={() => {
                                    const { action } = confirm;
                                    setConfirm(null);
                                    action();
                                }}
                            >
                                {confirm.actionLabel ?? 'Throw away'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div ref={splitHost} className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:gap-0">
                <div className="playground-editor-pane flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-fd-border bg-fd-card lg:flex-none">
                    <div className="flex h-9.5 shrink-0 items-center border-b border-fd-border px-2 text-sm text-fd-muted-foreground">
                        <div role="tablist" aria-label="Files" className="flex min-w-0 flex-row overflow-x-auto [scrollbar-width:none]">
                            {tabs.map((tab) => (
                                <div
                                    key={tab.id}
                                    role="tab"
                                    tabIndex={0}
                                    aria-selected={tab.id === activeId}
                                    title="Double-click to rename"
                                    className={`group relative inline-flex cursor-pointer items-center gap-2 px-2 py-1.5 font-medium text-nowrap transition-colors hover:text-fd-accent-foreground ${tab.id === activeId ? 'text-fd-primary' : ''}`}
                                    onClick={() => activate(tab.id)}
                                    onDoubleClick={() => setRenaming(tab.id)}
                                    onKeyDown={(event) => {
                                        if (renaming === tab.id) return;
                                        if (event.key === 'Enter') activate(tab.id);
                                        if (event.key === 'F2') setRenaming(tab.id);
                                    }}
                                >
                                    <div className={`absolute inset-x-2 bottom-0 h-px ${tab.id === activeId ? 'bg-fd-primary' : ''}`} />
                                    <FileIcon />
                                    {renaming === tab.id ? (
                                        <input
                                            ref={renameInput}
                                            aria-label="File name"
                                            defaultValue={tab.name}
                                            size={Math.max(tab.name.length, 8)}
                                            className="rounded-sm border border-fd-border bg-fd-background px-1 font-normal text-fd-foreground outline-none"
                                            onClick={(event) => event.stopPropagation()}
                                            onDoubleClick={(event) => event.stopPropagation()}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') finishRename(tab.id, event.currentTarget.value, true);
                                                if (event.key === 'Escape') finishRename(tab.id, null, true);
                                            }}
                                            onBlur={(event) => finishRename(tab.id, event.currentTarget.value)}
                                        />
                                    ) : (
                                        tab.name
                                    )}
                                    {tabs.length > 1 && renaming !== tab.id && (
                                        <button
                                            type="button"
                                            aria-label={`Delete ${tab.name}`}
                                            className="rounded-sm px-0.5 text-xs leading-none text-fd-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-fd-foreground"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                removeFile(tab.id);
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button type="button" aria-label="Add a file" title="Add a file" className="ms-1 shrink-0 rounded-md px-2 py-0.5 hover:bg-fd-accent hover:text-fd-accent-foreground" onClick={addFile}>
                            +
                        </button>
                    </div>
                    <div ref={editorHost} className="playground-editor relative min-h-0 flex-1" />
                </div>
                <Handle
                    axis="x"
                    onDrag={(x) => {
                        const rect = splitHost.current!.getBoundingClientRect();
                        setSplit(Math.min(Math.max(((x - rect.left) / rect.width) * 100, 20), 80));
                    }}
                />
                <div ref={columnHost} className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-fd-border bg-[#1c1c21]">
                        <div ref={previewHost} className="h-full w-full" />
                        {compiling && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1c1c21] text-sm text-white/70">
                                Compiling…
                            </div>
                        )}
                        <CanvasControls canvas={canvas} />
                    </div>
                    <Handle
                        axis="y"
                        onDrag={(_, y) => {
                            const rect = columnHost.current!.getBoundingClientRect();
                            setConsoleHeight(Math.min(Math.max(rect.bottom - y, 48), rect.height - 120));
                        }}
                    />
                    <div className="shrink-0 overflow-auto rounded-lg border border-fd-border bg-fd-card p-2 font-mono text-xs" style={{ height: consoleHeight }}>
                        {lines.length === 0 && <span className="text-fd-muted-foreground">Debug.Log output and compiler errors show up here</span>}
                        {lines.map((line) => (
                            <div
                                key={line.key}
                                className={`whitespace-pre-wrap ${TEXT_COLORS[line.level]} ${line.position !== undefined ? 'cursor-pointer hover:underline' : ''}`}
                                onClick={line.position !== undefined ? () => goToLine(line) : undefined}
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
