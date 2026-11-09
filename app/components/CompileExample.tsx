import type {ReactNode} from 'react';

const STATUSES = {
    compiles: {label: 'Compiles', color: 'text-green-700 dark:text-green-400'},
    warning: {label: 'Compiles with a warning', color: 'text-amber-700 dark:text-amber-400'},
    error: {label: "Doesn't compile", color: 'text-red-700 dark:text-red-400'},
};

interface CompileExampleProps {
    /** How the build of this code went, which sets the header and the output's color. */
    status: keyof typeof STATUSES;
    /** What the compiler prints, shown below the code as a console. */
    output?: string;
    children: ReactNode;
}

/**
 * A code block that says whether it compiles. It shows one state, so a failing version and its fix are two blocks.
 */
export default function CompileExample({status, output, children}: CompileExampleProps) {
    const {label, color} = STATUSES[status];

    return (
        <section className="not-prose my-8 overflow-hidden rounded-xl border border-fd-border bg-fd-card text-sm [&_figure]:my-0 [&_figure]:rounded-none [&_figure]:border-0 [&_figure]:shadow-none">
            <div className={`flex min-h-10.5 items-center gap-1.5 border-b border-fd-border px-4 text-xs font-medium ${color}`}>
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
                    {status === 'warning' ? (
                        <>
                            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0" />
                            <path d="M12 9v4" />
                            <path d="M12 17h.01" />
                        </>
                    ) : (
                        <>
                            <circle cx="12" cy="12" r="10" />
                            {status === 'compiles' ? (
                                <path d="m9 12 2 2 4-4" />
                            ) : (
                                <>
                                    <path d="m15 9-6 6" />
                                    <path d="m9 9 6 6" />
                                </>
                            )}
                        </>
                    )}
                </svg>
                {label}
            </div>
            {children}
            {output && (
                <div className="border-t border-fd-border px-4 py-3">
                    <div className="mb-1.5 text-xs font-medium text-fd-muted-foreground">Console output</div>
                    <pre className={`overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap ${color}`}>
                        {output}
                    </pre>
                </div>
            )}
        </section>
    );
}
