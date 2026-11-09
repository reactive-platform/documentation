'use client';

import { Children, Fragment, isValidElement, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import './playground.css';
import { CanvasControls, PreviewCanvas } from './canvas';
import { CONTROL, PRIMARY_CONTROL } from './controls';
import { playgroundUrl } from './encode';
import type { Editor } from './editor';
import { assemble, locate, type SourceFile, withPrelude } from './files';
import { type CompilerDiagnostic, type LogLevel, PLATFORMS, type PlatformName, type Preview, platformForLanguage } from './runtime';

interface ExampleFile extends SourceFile {
    lang: string;
}

interface PlaygroundFrameProps {
    /** The example's files, one per fence inside the element. Filled in by the remark plugin. */
    files: string;
    /** The language of the first fence, `csharp` or `cpp`. Decides the platform, so there is no switch. */
    lang?: string;
    /** A recording of the outcome, shown until the example is run. */
    preview?: string;
    alt?: string;
    /** Whether the first child is an excerpt, shown at rest instead of the files. */
    excerpt?: string;
    /** Set to switch from the excerpt to the full files when the example is run. Otherwise Run leaves the code alone. */
    expandFullCode?: string | boolean | null;
    /** Whether the code section starts open. By default it does when there is an excerpt, and not otherwise. */
    showCode?: string | boolean | null;
    /** Set to "false" for code the browser build can't run yet: only the files show, with no preview or Run. */
    runnable?: string;
    /** How much bigger than native the example is drawn. 1.5 unless the example needs the room. */
    scale?: string;
    children?: ReactNode;
}

interface ConsoleLine {
    key: number;
    level: LogLevel;
    text: string;
    file?: number;
    position?: number;
}

interface Status {
    kind: 'idle' | 'busy' | 'ok' | 'error';
    text: string;
}

const STATUS_COLORS: Record<Status['kind'], string> = {
    idle: 'text-fd-muted-foreground',
    busy: 'text-fd-muted-foreground',
    ok: 'text-green-700 dark:text-green-400',
    error: 'text-red-700 dark:text-red-400',
};



function Spinner() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.2-8.6" />
        </svg>
    );
}

export function FileIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
            <path d="M10 12.5 8 15l2 2.5" />
            <path d="m14 12.5 2 2.5-2 2.5" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
        </svg>
    );
}

function ExcerptIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
            <path d="M4 6h16" />
            <path d="M4 12h10" />
            <path d="M4 18h13" />
        </svg>
    );
}

const LINE_COLORS: Record<LogLevel, string> = {
    error: 'text-red-700 dark:text-red-400',
    warning: 'text-yellow-700 dark:text-yellow-400',
    info: 'text-fd-foreground',
};

/**
 * A docs example: its files as tabs on the left, the outcome on the right. The outcome pane is empty until the
 * reader presses Run, which turns the files into editors and runs them in a live preview that can be zoomed.
 * The frame can also hand the example over to the playground page.
 */
export default function PlaygroundFrame({ files: filesJson, lang, preview, alt, excerpt, scale, expandFullCode, showCode, runnable, children }: PlaygroundFrameProps) {
    const files = useMemo<ExampleFile[]>(() => JSON.parse(filesJson), [filesJson]);
    const platform: PlatformName = platformForLanguage(lang);
    const allBlocks = useMemo(() => Children.toArray(children).filter(isValidElement), [children]);
    const hasExcerpt = excerpt === 'true' && allBlocks.length > 0;
    const blocks = hasExcerpt ? allBlocks.slice(1) : allBlocks;
    // A bare attribute arrives as null, so anything but leaving it out or an explicit "false" counts
    const canRun = runnable !== 'false';
    const expandOnRun = expandFullCode !== undefined && expandFullCode !== false && expandFullCode !== 'false';

    const editorHosts = useRef<(HTMLDivElement | null)[]>([]);
    const previewHost = useRef<HTMLDivElement>(null);
    const editorsRef = useRef<Editor[]>([]);
    const previewRef = useRef<Preview | null>(null);
    const runRef = useRef<() => void>(() => {});
    const key = useRef({});

    const [active, setActive] = useState(0);
    // The code section starts open when there is an excerpt to show, closed when only the full files exist,
    // unless the frame says otherwise. A bare `showCode` attribute arrives as null and means open.
    const [codeVisible, setCodeVisible] = useState(showCode === undefined ? hasExcerpt : showCode !== false && showCode !== 'false');
    // Whether a frame with an excerpt shows a file instead. What it was before Run, to go back to it on Stop
    const [fullChosen, setFullChosen] = useState(false);
    const fullBeforeRun = useRef(false);
    const [live, setLive] = useState(false);
    const [status, setStatus] = useState<Status>({ kind: 'idle', text: '' });
    const [lines, setLines] = useState<ConsoleLine[]>([]);
    const [canvas, setCanvas] = useState<PreviewCanvas | null>(null);
    // The recording stays on top until the first run has drawn something, so nothing blinks after Run
    const [shown, setShown] = useState(false);
    const [href, setHref] = useState(() => playgroundUrl(platform, withPrelude(files, platform)));

    useEffect(() => {
        if (!live) return;

        let disposed = false;
        let nextLineKey = 1;
        let unsubscribeStatus = () => {};
        let compileTimer: ReturnType<typeof setTimeout> | undefined;

        (async () => {
            setStatus({ kind: 'busy', text: 'Loading the compiler...' });
            const [{ getCompiler, Preview }, { Editor }] = await Promise.all([import('./runtime'), import('./editor')]);
            if (disposed) return;

            const compiler = getCompiler(platform);
            const codes = () => editorsRef.current.map((editor) => editor.code);
            const onEdit = () => {
                const edited = codes().map((code, index) => ({ name: files[index].name, code }));
                setHref(playgroundUrl(platform, withPrelude(edited, platform)));
                clearTimeout(compileTimer);
                compileTimer = setTimeout(() => runRef.current(), PLATFORMS[platform].compileDelay);
            };

            editorsRef.current = files.map(
                (file, index) =>
                    new Editor({
                        parent: editorHosts.current[index]!,
                        doc: file.code,
                        platform,
                        onChange: onEdit,
                        complete: async (text, position) => {
                            // Completion sees the whole example, with the edited file's draft in place
                            const current = codes();
                            current[index] = text;
                            const assembled = assemble(current, platform);
                            const result = await compiler.complete(assembled.text, position + assembled.starts[index]);
                            return result && { ...result, from: result.from - assembled.starts[index] };
                        },
                    }),
            );

            const previewFrame = new Preview(previewHost.current!, platform);
            previewRef.current = previewFrame;
            // A docs pane is small, so an example is drawn half again as big as on the playground page by default
            const previewCanvas = new PreviewCanvas(previewFrame, previewHost.current!, { scale: Number(scale) || 1.5 });
            setCanvas(previewCanvas);
            previewFrame.onLog((level, message) => {
                setLines((current) => [...current.slice(-199), { key: nextLineKey++, level, text: message }]);
            });

            unsubscribeStatus = compiler.onStatus((s) => {
                if (s.kind === 'failed') setStatus({ kind: 'error', text: s.text });
                else if (s.kind === 'loading') setStatus({ kind: 'busy', text: s.text });
            });

            runRef.current = async () => {
                setStatus({ kind: 'busy', text: 'Compiling...' });
                const current = codes();
                const assembled = assemble(current, platform);
                let errors: CompilerDiagnostic[] = [];

                const show = () => {
                    const located = errors.map((x) => ({ diagnostic: x, ...locate(x, assembled, current) }));
                    editorsRef.current.forEach((editor, index) => {
                        editor.showDiagnostics(
                            located
                                .filter((x) => x.file === index && x.from >= 0)
                                .map((x) => ({ ...x.diagnostic, from: x.from, to: x.to })),
                        );
                    });
                    setLines(
                        located.map((x) => ({
                            key: nextLineKey++,
                            level: x.diagnostic.severity,
                            text: `${files[x.file].name}(${x.line},${x.column}) ${x.diagnostic.id}: ${x.diagnostic.message}`,
                            file: x.file,
                            position: x.from >= 0 ? x.from : undefined,
                        })),
                    );
                };

                const result = await compiler.compile(assembled.text, key.current, (analyzed) => {
                    errors = [...errors, ...analyzed];
                    show();
                });
                if (!result || disposed) return;

                errors = result.diagnostics;
                show();

                if (!result.assembly) {
                    const count = errors.filter((x) => x.severity === 'error').length;
                    setStatus({ kind: 'error', text: `${count} ${count === 1 ? 'error' : 'errors'}` });
                    setShown(true);
                    return;
                }

                const ran = await previewFrame.run(result.id, result.assembly);
                if (disposed) return;
                setShown(true);
                if (ran.error) {
                    setStatus({ kind: 'error', text: 'Failed to start' });
                    setLines((current) => [...current, { key: nextLineKey++, level: 'error', text: ran.error! }]);
                } else {
                    setStatus({ kind: 'ok', text: `Ran in ${Math.round(result.ms + ran.ms)} ms` });
                }
            };

            runRef.current();
        })();

        return () => {
            disposed = true;
            clearTimeout(compileTimer);
            unsubscribeStatus();
            setCanvas((current) => {
                current?.destroy();
                return null;
            });
            previewRef.current?.destroy();
            previewRef.current = null;
            for (const editor of editorsRef.current) editor.destroy();
            editorsRef.current = [];
        };
    }, [live, platform, files, scale]);

    function run() {
        setLive(true);
        if (expandOnRun) {
            fullBeforeRun.current = fullChosen;
            setFullChosen(true);
        }
    }

    /** Ends the example: the preview closes and the code goes back to the page's listing. */
    function stop() {
        setLive(false);
        setShown(false);
        setLines([]);
        setStatus({ kind: 'idle', text: '' });
        if (expandOnRun) setFullChosen(fullBeforeRun.current);
    }

    function jumpTo(line: ConsoleLine) {
        if (line.file === undefined || line.position === undefined) return;
        const { file, position } = line;
        // The line may be in an editor that isn't showing yet, and a hidden editor can't scroll
        setCodeVisible(true);
        setFullChosen(true);
        setActive(file);
        requestAnimationFrame(() => editorsRef.current[file]?.jumpTo(position));
    }

    // The code section holds the excerpt or a file: its live editor while running, its listing otherwise. The tabs
    // pick which, the bar's toggle only hides or shows the section, and Run touches neither unless the frame asks.
    const excerptHeld = hasExcerpt && !fullChosen;
    const excerptShown = codeVisible && excerptHeld;
    const fullShown = codeVisible && !excerptHeld;
    const codeShown = codeVisible;

    // A tab always shows what it names, whatever the section held before
    const tabs = [
        ...(hasExcerpt
            ? [
                  {
                      label: 'Preview',
                      icon: <ExcerptIcon />,
                      selected: excerptShown,
                      select: () => {
                          setFullChosen(false);
                          setCodeVisible(true);
                      },
                  },
              ]
            : []),
        ...files.map((file, index) => ({
            label: file.name,
            icon: <FileIcon />,
            selected: fullShown && index === active,
            select: () => {
                setActive(index);
                setFullChosen(true);
                setCodeVisible(true);
            },
        })),
    ];

    return (
        <div className="playground-frame not-prose my-8 overflow-clip rounded-lg border border-fd-border bg-fd-card">
            {canRun && (
            <div className={`relative h-96 overflow-hidden ${live && shown ? 'bg-[#0f0f13]' : 'bg-[#1c1c21]'}`}>
                <div ref={previewHost} className="h-full w-full" hidden={!live} />
                {(!live || !shown) && preview && (
                    <img src={preview} alt={alt ?? ''} className="absolute inset-0 z-10 m-auto max-h-full max-w-full object-contain" />
                )}
                {live && status.kind === 'busy' && !shown && (
                    <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center">
                        <span className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs text-white/90">
                            <Spinner />
                            {status.text}
                        </span>
                    </div>
                )}
                {live && status.kind === 'busy' && shown && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-[#1c1c21] text-sm text-white/70">
                        <Spinner />
                        {status.text}
                    </div>
                )}
                {!live && !preview && (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">Run the example to see it here</div>
                )}
                {live && shown && <CanvasControls canvas={canvas} />}
            </div>
            )}
            <div data-frame-bar className={`flex min-h-9.5 flex-wrap items-center gap-x-2 border-y border-fd-border px-2 py-0.5 text-sm text-fd-muted-foreground ${codeShown ? '' : 'border-b-transparent'} ${canRun ? '' : 'border-t-transparent'}`}>
                {tabs.length > 1 ? (
                    <div role="tablist" className="flex min-w-0 flex-row items-center overflow-x-auto [scrollbar-width:none]">
                        {tabs.map((tab, index) => (
                            <Fragment key={tab.label}>
                                {/* The preview isn't one of the files, so they get a group of their own after it */}
                                {hasExcerpt && index === 1 && <div aria-hidden="true" className="mx-2 h-4 w-px shrink-0 bg-fd-muted-foreground/50" />}
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={tab.selected}
                                    className={`group relative inline-flex items-center gap-2 px-2 py-1.5 font-medium text-nowrap transition-colors hover:text-fd-accent-foreground ${tab.selected ? 'text-fd-primary' : ''}`}
                                    onClick={tab.select}
                                >
                                    <div className={`absolute inset-x-2 bottom-0 h-px ${tab.selected ? 'bg-fd-primary' : ''}`} />
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            </Fragment>
                        ))}
                    </div>
                ) : (
                    <div className="flex min-w-0 items-center gap-2 px-2 py-1.5 font-medium">
                        <FileIcon />
                        <span className="truncate">{files[0].name}</span>
                    </div>
                )}
                {/* Takes only the room left over, so a status appearing never wraps the bar and moves the code */}
                {status.text && <span className={`min-w-0 flex-1 truncate text-xs ${STATUS_COLORS[status.kind]}`}>{status.text}</span>}
                {canRun && (
                <div className="ms-auto flex flex-wrap items-center justify-end gap-1.5 text-xs">
                    <button type="button" className={CONTROL} onClick={() => setCodeVisible((current) => !current)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={codeVisible ? 'rotate-180' : ''}>
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                        {codeVisible ? 'Hide code' : 'Show code'}
                    </button>
                    <a href={href} className={CONTROL}>
                        Open in playground ↗
                    </a>
                    <button
                        type="button"
                        className={`min-w-14 ${live ? CONTROL : PRIMARY_CONTROL}`}
                        onClick={live ? stop : run}
                    >
                        {live ? 'Stop' : 'Run'}
                    </button>
                </div>
                )}
            </div>
            <div className="min-w-0">
                {files.map((file, index) => (
                    <div
                        key={file.name}
                        ref={(element) => {
                            editorHosts.current[index] = element;
                        }}
                        className="playground-editor max-h-[600px] overflow-auto"
                        hidden={!live || index !== active || !fullShown}
                    />
                ))}
                {excerptShown && <div className="playground-frame-code">{allBlocks[0]}</div>}
                {!live && fullShown && <div className="playground-frame-code">{blocks[active]}</div>}
            </div>
            {live && lines.length > 0 && (
                <div className="max-h-24 overflow-auto border-t border-fd-border p-2 font-mono text-xs">
                    {lines.map((line) => (
                        <div
                            key={line.key}
                            className={`whitespace-pre-wrap ${LINE_COLORS[line.level]} ${line.position !== undefined ? 'cursor-pointer hover:underline' : ''}`}
                            onClick={line.position !== undefined ? () => jumpTo(line) : undefined}
                        >
                            {line.text}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
