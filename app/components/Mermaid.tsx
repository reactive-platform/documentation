'use client';

import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidProps {
    chart: string;
}

export default function Mermaid({ chart }: MermaidProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: true,
            theme: 'dark',
            securityLevel: 'loose',
            themeVariables: {
                fontFamily: 'Inter, sans-serif',
                primaryColor: '#1f2937',
                primaryTextColor: '#f3f4f6',
                lineColor: '#9ca3af',
                edgeLabelBackground: '#111827',
            },
        });

        mermaid.contentLoaded();
    }, [chart]);

    return (
        <div className="overflow-auto rounded-xl border border-gray-700 bg-neutral-900 p-4 justify-center">
            <div className="mermaid" ref={ref}>
                {chart}
            </div>
        </div>
    );
}
