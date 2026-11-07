'use client';

import {useEffect, useRef, useState} from 'react';

interface ScreenshotProps {
    src: string;
    alt?: string;
    /** The capture's pixel density. Assets are captured at 10 pixels per layout point and shown at their natural size. */
    scale?: number;
}

/**
 * An in-game render of a sample on a dark backdrop, since the game's UI is white on dark. Shown at its
 * natural size, capped at the content width.
 * Renders a dashed placeholder with the path while the file is missing, so pages can be written
 * before every image is captured.
 */
export default function Screenshot({src, alt, scale = 1}: ScreenshotProps) {
    const [missing, setMissing] = useState(false);
    const [width, setWidth] = useState<number | undefined>(undefined);
    const ref = useRef<HTMLImageElement>(null);

    // The image may have loaded or failed before hydration, in which case the handlers never fire
    useEffect(() => {
        const img = ref.current;
        if (!img || !img.complete) return;
        if (img.naturalWidth === 0) {
            setMissing(true);
        } else {
            setWidth(img.naturalWidth / scale);
        }
    }, [src, scale]);

    if (missing) {
        return (
            <div className="my-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-fd-border px-4 py-10 text-center text-sm text-fd-muted-foreground">
                <span>{alt ?? 'Screenshot'}</span>
                <code className="mt-2 text-xs">{src}</code>
            </div>
        );
    }

    return (
        <img
            ref={ref}
            src={src}
            alt={alt ?? ''}
            className="my-6 rounded-lg bg-[#1c1c21] p-4"
            style={{width, maxWidth: '100%', height: 'auto', boxSizing: 'content-box'}}
            onLoad={e => setWidth(e.currentTarget.naturalWidth / scale)}
            onError={() => setMissing(true)}
        />
    );
}
