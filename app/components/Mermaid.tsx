'use client';

import {CSSProperties, useEffect, useRef, useState} from 'react';
import {PanZoom} from 'react-easy-panzoom';
import mermaid from 'mermaid';

interface MermaidProps {
    chart: string;
}

export function Mermaid({chart}: MermaidProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [dimmerActive, setDimmerActive] = useState(false);
    const [style, setStyle] = useState<CSSProperties>({});

    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: true,
            theme: 'dark',
            securityLevel: 'loose',
        });
        mermaid.contentLoaded();
    }, [chart]);

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

            setTimeout(() => !isFullscreen && setDimmerActive(false), 300);
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

    return (
        <>
            {/* Dim background */}
            <div className={`
                 fixed inset-0 z-[999] bg-black transition-opacity opacity-0 duration-300 
                 ${isFullscreen && 'opacity-50'} ${!dimmerActive && 'display: none'}`}
            />

            <div
                ref={wrapperRef}
                className="z-1000 relative rounded-xl box-border border overflow-hidden border-gray-700 bg-neutral-900 p-4 justify-center"
                style={style}
            >
                <button
                    className="absolute top-2 right-2 z-50 rounded bg-neutral-700 p-1 shadow-black hover:bg-neutral-800 cursor-pointer transition"
                    onClick={() => setIsFullscreen(prev => !prev)}
                    aria-label="Toggle fullscreen"
                >
                    ⛶
                </button>

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
                    <div className="mermaid *:w-full">
                        {chart}
                    </div>
                </PanZoom>
            </div>
        </>
    );
}
