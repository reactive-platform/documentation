import React from 'react';

type AlertType = 'note' | 'warning' | 'tip';

interface AlertProps {
    type?: AlertType;
    children: React.ReactNode;
}

const typeStyles: Record<AlertType, { box: string; icon: string; label: string; paths: React.ReactNode }> = {
    note: {
        box: 'border-blue-500/30 bg-blue-500/5',
        icon: 'text-blue-600 dark:text-blue-400',
        label: 'Note',
        paths: (
            <>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
            </>
        ),
    },
    warning: {
        box: 'border-yellow-500/40 bg-yellow-500/5',
        icon: 'text-yellow-600 dark:text-yellow-400',
        label: 'Warning',
        paths: (
            <>
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
            </>
        ),
    },
    tip: {
        box: 'border-green-500/30 bg-green-500/5',
        icon: 'text-green-600 dark:text-green-400',
        label: 'Tip',
        paths: (
            <>
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                <path d="M9 18h6" />
                <path d="M10 22h4" />
            </>
        ),
    },
};

export default function Alert({type = 'note', children}: AlertProps) {
    const style = typeStyles[type];

    return (
        <div
            role="note"
            aria-label={style.label}
            className={`my-6 flex items-center gap-4 rounded-xl border px-5 py-4 text-fd-foreground ${style.box}`}
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`size-[1.25em] shrink-0 ${style.icon}`}
            >
                {style.paths}
            </svg>
            <div className="min-w-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0">{children}</div>
        </div>
    );
}
