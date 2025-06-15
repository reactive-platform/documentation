import React from 'react';

type AlertType = 'note' | 'warning' | 'tip';

interface AlertProps {
    type?: AlertType;
    children: React.ReactNode;
}

const typeStyles: Record<AlertType, { bg: string; border: string; text: string, short: string }> = {
    note: {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        text: 'text-blue-800 dark:text-blue-100',
        short: '📋 Note'
    },
    warning: {
        bg: 'bg-yellow-100 dark:bg-yellow-900/20',
        border: 'border-yellow-500',
        text: 'text-yellow-800 dark:text-yellow-100',
        short: '⚠️ Warning'
    },
    tip: {
        bg: 'bg-green-100 dark:bg-green-900/20',
        border: 'border-green-500',
        text: 'text-green-800 dark:text-green-100',
        short: '✅ Tip'
    },
};

export default function Alert({type = 'note', children}: AlertProps) {
    const style = typeStyles[type];

    return (
        <div className={`flex rounded-md border-l-4 items-stretch ${style.bg} ${style.border} ${style.text}`}>
            <div className="p-4 content-center text-center">
                {style.short}:
            </div>
            {children}
        </div>
    );
}
