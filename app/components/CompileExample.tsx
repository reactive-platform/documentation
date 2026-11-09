import type {ReactNode} from 'react';

interface CompileExampleProps {
    /** Whether this code compiles, which the block states in its header. */
    compiles: boolean;
    /** What the compiler prints when it doesn't, shown below the code as a console. */
    output?: string;
    children: ReactNode;
}

/**
 * A code block that says whether it compiles. It shows one state, so a failing version and its fix are two blocks.
 */
export default function CompileExample({compiles, output, children}: CompileExampleProps) {
    return (
        <section className="not-prose my-8 overflow-hidden rounded-xl border border-fd-border bg-fd-card text-sm [&_figure]:my-0 [&_figure]:rounded-none [&_figure]:border-0 [&_figure]:shadow-none">
            <div
                className={`flex min-h-10.5 items-center gap-1.5 border-b border-fd-border px-4 text-xs font-medium ${
                    compiles ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                }`}
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                >
                    <circle cx="12" cy="12" r="10" />
                    {compiles ? (
                        <path d="m9 12 2 2 4-4" />
                    ) : (
                        <>
                            <path d="m15 9-6 6" />
                            <path d="m9 9 6 6" />
                        </>
                    )}
                </svg>
                {compiles ? 'Compiles' : "Doesn't compile"}
            </div>
            {children}
            {output && (
                <div className="border-t border-fd-border px-4 py-3">
                    <div className="mb-1.5 text-xs font-medium text-fd-muted-foreground">Console output</div>
                    <pre className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-red-700 dark:text-red-400">
                        {output}
                    </pre>
                </div>
            )}
        </section>
    );
}
