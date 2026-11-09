'use client';

import {CSSProperties, useEffect, useId, useRef, useState, useSyncExternalStore} from 'react';
const easypanzoom = require('react-easy-panzoom');
const {PanZoom} = easypanzoom;

interface MermaidProps {
    chart: string;
}

// Mermaid parses these itself, so they can't be CSS variables
const THEMES = {
    dark: {
        darkMode: true,
        background: '#171717',
        primaryColor: '#262626',
        primaryBorderColor: '#525252',
        primaryTextColor: '#fafafa',
        lineColor: '#a3a3a3',
        clusterBkg: '#1f1f1f',
        clusterBorder: '#404040',
        titleColor: '#d4d4d4',
        edgeLabelBackground: '#171717',
    },
    light: {
        darkMode: false,
        background: '#fafafa',
        primaryColor: '#ffffff',
        primaryBorderColor: '#a3a3a3',
        primaryTextColor: '#171717',
        lineColor: '#737373',
        clusterBkg: '#f5f5f5',
        clusterBorder: '#d4d4d4',
        titleColor: '#404040',
        edgeLabelBackground: '#fafafa',
    },
};

function subscribeToTheme(listener: () => void) {
    const observer = new MutationObserver(listener);
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ['class']});

    return () => observer.disconnect();
}

function isDarkTheme() {
    return document.documentElement.classList.contains('dark');
}

export function Mermaid({chart}: MermaidProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [dimmerActive, setDimmerActive] = useState(false);
    const [style, setStyle] = useState<CSSProperties>({});
    const [svg, setSvg] = useState('');

    const wrapperRef = useRef<HTMLDivElement>(null);
    const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
    const dark = useSyncExternalStore(subscribeToTheme, isDarkTheme, () => true);

    useEffect(() => {
        let cancelled = false;

        // Loaded here because it's a large library that most pages don't need
        import('mermaid')
            .then(async ({default: mermaid}) => {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'base',
                    securityLevel: 'strict',
                    themeVariables: {
                        ...THEMES[dark ? 'dark' : 'light'],
                        fontFamily: 'inherit',
                    },
                });

                const result = await mermaid.render(id, chart);

                if (!cancelled) {
                    setSvg(result.svg);
                }
            })
            .catch((error) => console.error('Failed to render a Mermaid chart', error));

        return () => {
            cancelled = true;
        };
    }, [chart, dark, id]);

    useEffect(() => {
        if (!wrapperRef.current) {
            return;
        }

        const rect = wrapperRef.current.getBoundingClientRect();
        const windowWidth = window.innerWidth - 120;
        const windowHeight = window.innerHeight - 120;

        const scaleX = windowWidth / rect.width;
        const scaleY = windowHeight / rect.height;
        const scale = Math.min(scaleX, scaleY);

        const translateX = window.innerWidth / 2 - (rect.left + rect.width / 2);
        const translateY = window.innerHeight / 2 - (rect.top + rect.height / 2);

        if (isFullscreen) {
            setDimmerActive(true);

            setStyle({
                transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                transition: 'transform 300ms ease-in-out',
            });
        } else {
            setStyle({
                transform: 'translate(0, 0) scale(1)',
                transition: 'transform 300ms ease-in-out',
            });

            const timeout = setTimeout(() => setDimmerActive(false), 300);

            return () => clearTimeout(timeout);
        }
    }, [isFullscreen]);

    useEffect(() => {
        if (!isFullscreen) {
            return;
        }

        const preventDefault = (e: Event) => {
            e.preventDefault();
        };

        window.addEventListener('wheel', preventDefault, { passive: false });
        window.addEventListener('touchmove', preventDefault, { passive: false });

        return () => {
            window.removeEventListener('wheel', preventDefault);
            window.removeEventListener('touchmove', preventDefault);
        };
    }, [isFullscreen]);

    const diagram = <div className="flex justify-center [&_svg]:h-auto" dangerouslySetInnerHTML={{__html: svg}} />;

    return (
        <>
            {/* Dim background */}
            {dimmerActive && (
                <div
                    className={`fixed inset-0 z-[999] bg-black transition-opacity duration-300 ${isFullscreen ? 'opacity-50' : 'opacity-0'}`}
                    onClick={() => setIsFullscreen(false)}
                />
            )}

            <div
                ref={wrapperRef}
                className={`not-prose relative my-8 box-border overflow-hidden rounded-xl border border-fd-border bg-fd-card p-4 ${svg ? '' : 'min-h-32'} ${dimmerActive ? 'z-1000' : ''}`}
                style={style}
            >
                <button
                    className="absolute top-2 right-2 z-50 cursor-pointer rounded-md border border-fd-border bg-fd-background px-1.5 py-0.5 text-fd-muted-foreground transition hover:text-fd-foreground"
                    onClick={() => setIsFullscreen(prev => !prev)}
                    aria-label="Toggle fullscreen"
                >
                    ⛶
                </button>

                {/* Only in fullscreen, so scrolling past a diagram scrolls the page instead of zooming it */}
                {isFullscreen ? (
                    <PanZoom
                        autoCenter
                        autoCenterZoomLevel={1}
                        boundaryRatioVertical={1}
                        boundaryRatioHorizontal={1}
                        enableBoundingBox
                        minZoom={0.1}
                        maxZoom={5}
                        className="*:w-full h-full"
                    >
                        {diagram}
                    </PanZoom>
                ) : diagram}
            </div>
        </>
    );
}
