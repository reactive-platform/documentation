/**
 * The playground runtime: the compiler worker and the preview frame. Both the playground page and the
 * embedded examples use it. One worker per platform is shared by every example on a page, and a preview
 * frame is created per example when it is first compiled.
 */

export const RUNTIME_URL = '/playground';

export const PLATFORMS = {
    pc: {
        label: 'PC (C#)',
        worker: `${RUNTIME_URL}/compiler/worker.js`,
        preview: `${RUNTIME_URL}/preview/index.html`,
        compileDelay: 350,
    },
    quest: {
        label: 'Quest (C++)',
        worker: `${RUNTIME_URL}/quest/worker.js`,
        preview: `${RUNTIME_URL}/quest/index.html`,
        compileDelay: 800,
    },
} as const;

export type PlatformName = keyof typeof PLATFORMS;

/** Maps a code fence language to a platform. */
export function platformForLanguage(lang: string | undefined): PlatformName {
    const name = (lang ?? '').toLowerCase();
    return name === 'cpp' || name === 'c++' || name === 'cxx' ? 'quest' : 'pc';
}

export interface CompilerDiagnostic {
    severity: 'error' | 'warning' | 'info';
    id: string;
    message: string;
    from: number;
    to: number;
    line: number;
    column: number;
}

export interface CompileResult {
    id: number;
    diagnostics: CompilerDiagnostic[];
    assembly: ArrayBuffer | null;
    ms: number;
}

export interface CompletionOption {
    label: string;
    type?: string;
    detail?: string;
}

export interface CompletionResponse {
    from: number;
    options: CompletionOption[];
}

export interface CompilerStatus {
    kind: 'loading' | 'ready' | 'failed';
    text: string;
}

interface CompileRequest {
    id: number;
    key: object;
    code: string;
    resolve: (result: CompileResult | null) => void;
    onAnalyzed?: (diagnostics: CompilerDiagnostic[]) => void;
}

interface CompleteRequest {
    id: number;
    resolve: (result: CompletionResponse | null) => void;
}

/**
 * A compiler worker. Compiles are queued, and a queued compile from the same requester replaces the
 * earlier one, so a burst of edits costs one compilation. The compile in flight always completes.
 */
export class Compiler {
    readonly platform: PlatformName;

    private readonly worker: Worker;
    private readonly statusListeners = new Set<(status: CompilerStatus) => void>();
    private readonly queue: CompileRequest[] = [];
    private readonly analyzers = new Map<number, (diagnostics: CompilerDiagnostic[]) => void>();
    private inFlight: CompileRequest | null = null;
    private completion: CompleteRequest | null = null;
    private nextId = 1;
    private _status: CompilerStatus = { kind: 'loading', text: 'Loading the compiler...' };

    constructor(platform: PlatformName) {
        this.platform = platform;
        this.worker = new Worker(PLATFORMS[platform].worker, { type: 'module' });
        this.worker.onmessage = ({ data }) => this.onMessage(data);
        this.worker.onerror = () => {
            this.setStatus({ kind: 'failed', text: 'The playground runtime is missing, run yarn build:playground' });
        };
    }

    get status() {
        return this._status;
    }

    onStatus(listener: (status: CompilerStatus) => void) {
        this.statusListeners.add(listener);
        listener(this._status);
        return () => {
            this.statusListeners.delete(listener);
        };
    }

    /**
     * Compiles the code. Resolves with null when a newer compile from the same requester replaced this one
     * before it started. Analyzer diagnostics arrive later through `onAnalyzed`.
     */
    compile(code: string, key: object, onAnalyzed?: (diagnostics: CompilerDiagnostic[]) => void) {
        return new Promise<CompileResult | null>((resolve) => {
            const stale = this.queue.findIndex((x) => x.key === key);
            if (stale >= 0) {
                this.queue.splice(stale, 1)[0].resolve(null);
            }

            this.queue.push({ id: this.nextId++, key, code, resolve, onAnalyzed });
            this.pump();
        });
    }

    /** Asks for completions at a position. A newer request cancels the pending one. */
    complete(code: string, position: number) {
        return new Promise<CompletionResponse | null>((resolve) => {
            this.completion?.resolve(null);
            const id = this.nextId++;
            this.completion = { id, resolve };
            this.worker.postMessage({ type: 'complete', id, code, position });
        });
    }

    private pump() {
        if (this.inFlight || this._status.kind !== 'ready') return;
        const request = this.queue.shift();
        if (!request) return;

        this.inFlight = request;
        if (request.onAnalyzed) {
            this.analyzers.set(request.id, request.onAnalyzed);
        }
        this.worker.postMessage({ type: 'compile', id: request.id, code: request.code });
    }

    private onMessage(data: any) {
        switch (data.type) {
            case 'ready':
                this.setStatus({ kind: 'ready', text: 'Ready' });
                this.pump();
                break;
            case 'progress':
                this.setStatus({ kind: 'loading', text: data.text });
                break;
            case 'failed':
                this.setStatus({ kind: 'failed', text: `The compiler failed to start: ${data.message}` });
                for (const request of this.queue.splice(0)) request.resolve(null);
                break;
            case 'completed':
                if (this.completion && this.completion.id === data.id) {
                    this.completion.resolve({ from: data.from, options: data.options });
                    this.completion = null;
                }
                break;
            case 'compiled': {
                const request = this.inFlight;
                if (!request || request.id !== data.id) break;
                this.inFlight = null;
                if (!data.assembly) {
                    this.analyzers.delete(data.id);
                }
                request.resolve({ id: data.id, diagnostics: data.diagnostics, assembly: data.assembly ?? null, ms: data.ms });
                this.pump();
                break;
            }
            case 'analyzed': {
                const analyzer = this.analyzers.get(data.id);
                this.analyzers.delete(data.id);
                if (analyzer && data.diagnostics.length > 0) {
                    analyzer(data.diagnostics);
                }
                break;
            }
        }
    }

    private setStatus(status: CompilerStatus) {
        this._status = status;
        for (const listener of this.statusListeners) listener(status);
    }
}

const compilers: Partial<Record<PlatformName, Compiler>> = {};

/** The shared compiler for a platform, started on first use. */
export function getCompiler(platform: PlatformName) {
    return (compilers[platform] ??= new Compiler(platform));
}

export interface RunResult {
    error: string | null;
    ms: number;
}

export type LogLevel = 'error' | 'warning' | 'info';

// Unity log types: Error, Assert, Warning, Log, Exception
const LOG_LEVELS: LogLevel[] = ['error', 'error', 'warning', 'info', 'error'];

/** A preview frame that runs compiled assemblies. */
export class Preview {
    readonly frame: HTMLIFrameElement;

    private ready = false;
    private density = 1;
    private pending: { id: number; assembly: ArrayBuffer } | null = null;
    private readonly runs = new Map<number, (result: RunResult) => void>();
    private readonly logListeners = new Set<(level: LogLevel, message: string) => void>();
    private readonly onMessage = (event: MessageEvent) => {
        if (event.source !== this.frame.contentWindow) return;
        const { data } = event;

        switch (data.type) {
            case 'ready':
                this.ready = true;
                if (this.density !== 1) {
                    this.frame.contentWindow!.postMessage({ type: 'density', value: this.density }, location.origin);
                }
                if (this.pending) {
                    this.post(this.pending.id, this.pending.assembly);
                    this.pending = null;
                }
                break;
            case 'log':
                for (const listener of this.logListeners) listener(LOG_LEVELS[data.level] ?? 'info', data.message);
                break;
            case 'ran': {
                const resolve = this.runs.get(data.id);
                this.runs.delete(data.id);
                resolve?.({ error: data.error ?? null, ms: data.ms });
                break;
            }
        }
    };

    constructor(host: HTMLElement, platform: PlatformName) {
        this.frame = document.createElement('iframe');
        this.frame.src = PLATFORMS[platform].preview;
        this.frame.title = 'Preview';
        this.frame.className = 'h-full w-full border-0';
        // The frame's own colour matches its document's, so nothing flashes while the document loads
        this.frame.style.background = '#1c1c21';
        window.addEventListener('message', this.onMessage);
        host.append(this.frame);
    }

    /** Asks the renderer to draw its sprites at this density, so a scaled-up frame stays crisp. */
    setDensity(density: number) {
        if (this.density === density) return;
        this.density = density;
        if (this.ready) this.frame.contentWindow!.postMessage({ type: 'density', value: density }, location.origin);
    }

    /** Runs an assembly once the frame is ready. Only the latest run is kept while the frame loads. */
    run(id: number, assembly: ArrayBuffer) {
        return new Promise<RunResult>((resolve) => {
            this.runs.set(id, resolve);
            if (this.ready) {
                this.post(id, assembly);
            } else {
                if (this.pending) this.runs.delete(this.pending.id);
                this.pending = { id, assembly };
            }
        });
    }

    onLog(listener: (level: LogLevel, message: string) => void) {
        this.logListeners.add(listener);
        return () => {
            this.logListeners.delete(listener);
        };
    }

    destroy() {
        window.removeEventListener('message', this.onMessage);
        this.frame.remove();
        this.runs.clear();
        this.logListeners.clear();
    }

    private post(id: number, assembly: ArrayBuffer) {
        this.frame.contentWindow!.postMessage({ type: 'run', id, assembly }, location.origin, [assembly]);
    }
}
