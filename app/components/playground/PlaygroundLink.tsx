import Link from 'next/link';

/** Leaves the docs for the playground page, so it's a card with an arrow rather than something like a sidebar topic. */
export function PlaygroundLink() {
    return (
        <Link
            href="/playground"
            className="group mt-2 flex items-center gap-2.5 rounded-lg border border-fd-border bg-fd-card p-2 text-fd-card-foreground transition-colors hover:border-fd-primary/40 hover:bg-fd-accent"
        >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-fd-primary text-fd-primary-foreground">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-3.5">
                    <path d="M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z" />
                </svg>
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm leading-tight font-medium">Playground</span>
                <span className="block truncate text-xs text-fd-muted-foreground">Write and run code here</span>
            </span>
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="size-4 shrink-0 text-fd-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            >
                <path d="M7 17 17 7" />
                <path d="M8 7h9v9" />
            </svg>
        </Link>
    );
}
