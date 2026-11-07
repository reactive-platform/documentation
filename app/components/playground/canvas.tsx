'use client';

import { type ReactNode, useEffect, useState } from 'react';
import type { Preview } from './runtime';

export interface CanvasState {
    zoom: number;
    hand: boolean;
}

/**
 * Whether the pointer is over something in the UI that takes pointer input, like a button, a list or a modal's
 * blocker. The renderer marks those nodes, so a wheel there is left to the UI rather than to the page.
 */
function overUi(target: EventTarget | null) {
    // The frame's elements come from another realm, so they are not `instanceof` this window's Element
    const element = target as (Element & { closest?: Element['closest'] }) | null;
    const node = typeof element?.closest === 'function' ? element.closest('[data-id]') : null;
    return !!node && (node as unknown as { __node?: { r?: boolean } }).__node?.r === true;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 3, 4];

/**
 * Makes a preview frame behave like a design canvas: an artboard the size of the host, scaled and moved as a
 * whole. The library's view only changes when the host is resized, so zooming out shrinks the bounds and the
 * content together. Dragging pans when the hand tool is on, space is held or the
 * middle button is used, so ordinary clicks and drags still reach the UI. Zooming is through the corner buttons
 * only; the wheel is left to the UI. The artboard keeps a faint outline outside its bounds.
 */
export class PreviewCanvas {
    zoom = 1;
    hand = false;

    private tx = 0;
    private ty = 0;
    private width = 0;
    private height = 0;
    private space = false;
    private panning: { pointerId: number } | null = null;
    private readonly host: HTMLElement;
    private readonly preview: Preview;
    private readonly frame: HTMLIFrameElement;
    /** The artboard's bounds, drawn over the frame in screen pixels so the line stays the same at any zoom. */
    private readonly bounds: HTMLDivElement;
    private readonly listeners = new Set<(state: CanvasState) => void>();
    private readonly cleanups: (() => void)[] = [];

    /** How much bigger than the library's native 5 px per point the artboard is drawn at 100%. */
    private readonly baseScale: number;

    constructor(preview: Preview, host: HTMLElement, options: { scale?: number } = {}) {
        this.baseScale = options.scale ?? 1;
        this.host = host;
        this.preview = preview;
        this.frame = preview.frame;
        this.host.style.background = '#0f0f13';
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        this.bounds = document.createElement('div');
        // Drawn outside the artboard, so at the reset view it lies beyond the pane's edge and is clipped away
        Object.assign(this.bounds.style, {
            position: 'absolute',
            pointerEvents: 'none',
            outline: '2px solid rgba(255, 255, 255, 0.12)',
            outlineOffset: '0px',
        });
        host.append(this.bounds);
        this.cleanups.push(() => this.bounds.remove());
        // The artboard follows the host's size, so a resized pane resizes the view. The view's zoom and pan are
        // kept, except at the reset view, which keeps filling the pane. A collapsed pane is ignored until it opens.
        const size = () => {
            const rect = host.getBoundingClientRect();
            if (rect.width < 10 || rect.height < 10) return;
            const atReset = this.zoom === 1 && this.tx === 0 && this.ty === 0;
            this.width = Math.round(rect.width / this.baseScale);
            this.height = Math.round(rect.height / this.baseScale);
            if (atReset) {
                this.tx = 0;
                this.ty = 0;
            }
            this.apply();
        };
        size();
        const observer = new ResizeObserver(size);
        observer.observe(host);
        this.cleanups.push(() => observer.disconnect());

        this.attach(this.host, window);
        const onLoad = () => {
            const win = this.frame.contentWindow;
            if (win) this.attach(win.document, win);
            this.setCursor(this.hand ? 'grab' : '');
        };
        this.frame.addEventListener('load', onLoad);
        this.cleanups.push(() => this.frame.removeEventListener('load', onLoad));
        if (this.frame.contentDocument?.readyState === 'complete' && this.frame.contentWindow?.document.getElementById('root')) {
            onLoad();
        }
    }

    onChange(listener: (state: CanvasState) => void) {
        this.listeners.add(listener);
        listener(this.state);
        return () => {
            this.listeners.delete(listener);
        };
    }

    get state(): CanvasState {
        return { zoom: this.zoom, hand: this.hand };
    }

    /** The scale applied to the artboard: the zoom on top of the base scale. */
    private get scale() {
        return this.zoom * this.baseScale;
    }

    setHand(hand: boolean) {
        this.hand = hand;
        this.setCursor(hand ? 'grab' : '');
        this.notify();
    }

    /** The pointer is usually over the frame's own document, so the cursor is set there as well. */
    private setCursor(cursor: string) {
        this.host.style.cursor = cursor;
        const doc = this.frame.contentDocument;
        if (doc?.documentElement) doc.documentElement.style.cursor = cursor;
        if (doc?.body) doc.body.style.cursor = cursor;
    }

    /** Zooms around a point in host coordinates, or the artboard's center. */
    setZoom(zoom: number, about?: { x: number; y: number }) {
        const next = Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
        const point = about ?? { x: this.tx + (this.width * this.scale) / 2, y: this.ty + (this.height * this.scale) / 2 };
        const ratio = next / this.zoom;
        // The artboard's top-left corner is at the pan offset, so the point under the cursor stays put
        this.tx = point.x - (point.x - this.tx) * ratio;
        this.ty = point.y - (point.y - this.ty) * ratio;
        this.zoom = next;
        this.apply();
        this.notify();
    }

    zoomStep(direction: 1 | -1) {
        const index = ZOOM_STEPS.findIndex((x) => (direction > 0 ? x > this.zoom + 0.001 : x >= this.zoom - 0.001));
        const target = direction > 0 ? ZOOM_STEPS[index === -1 ? ZOOM_STEPS.length - 1 : index] : ZOOM_STEPS[Math.max((index === -1 ? ZOOM_STEPS.length : index) - 1, 0)];
        this.setZoom(target);
    }

    /** Fits the artboard into the host and centers it. */
    reset() {
        const { width, height } = this.host.getBoundingClientRect();
        this.zoom = Math.min(width / (this.width * this.baseScale), height / (this.height * this.baseScale), 1);
        this.tx = (width - this.width * this.scale) / 2;
        this.ty = (height - this.height * this.scale) / 2;
        this.apply();
        this.notify();
    }

    destroy() {
        for (const cleanup of this.cleanups) cleanup();
        this.cleanups.length = 0;
        this.listeners.clear();
    }

    private apply() {
        // Sprites are drawn for the scale in use, in half steps so small zoom changes don't redraw everything
        this.preview.setDensity(Math.max(1, Math.ceil(this.scale * 2) / 2));
        Object.assign(this.frame.style, {
            width: `${this.width}px`,
            height: `${this.height}px`,
            transform: `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`,
            transformOrigin: '0 0',
        });
        Object.assign(this.bounds.style, {
            left: `${this.tx}px`,
            top: `${this.ty}px`,
            width: `${this.width * this.scale}px`,
            height: `${this.height * this.scale}px`,
        });
    }

    private notify() {
        for (const listener of this.listeners) listener(this.state);
    }

    /** A pointer position from either document, in host coordinates. */
    private toHost(event: MouseEvent, inFrame: boolean) {
        if (inFrame) {
            return { x: this.tx + event.clientX * this.scale, y: this.ty + event.clientY * this.scale };
        }
        const rect = this.host.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    private attach(target: Document | HTMLElement, win: Window) {
        const inFrame = target !== this.host;
        const on = <K extends keyof GlobalEventHandlersEventMap>(
            source: EventTarget,
            type: K,
            handler: (event: GlobalEventHandlersEventMap[K]) => void,
            options?: AddEventListenerOptions,
        ) => {
            source.addEventListener(type, handler as EventListener, options);
            this.cleanups.push(() => source.removeEventListener(type, handler as EventListener, options));
        };

        // The wheel never zooms. Over the UI it scrolls whatever is there, and the page is kept still since the
        // renderer's own listener is passive; over empty canvas it is left to the page
        on(
            target,
            'wheel',
            (event) => {
                if (inFrame && overUi(event.target)) event.preventDefault();
            },
            { capture: true, passive: false },
        );

        on(
            target,
            'pointerdown',
            (event) => {
                const pan = event.button === 1 || this.space || (this.hand && event.button === 0);
                if (!pan) return;
                event.preventDefault();
                event.stopPropagation();
                this.panning = { pointerId: event.pointerId };
                this.setCursor('grabbing');
            },
            { capture: true },
        );

        on(
            win,
            'pointermove',
            (event) => {
                if (!this.panning || event.pointerId !== this.panning.pointerId) return;
                event.preventDefault();
                event.stopPropagation();
                // Movement is in screen pixels, so it is unaffected by the frame's transform
                this.tx += event.movementX;
                this.ty += event.movementY;
                this.apply();
            },
            { capture: true },
        );

        const endPan = (event: PointerEvent) => {
            if (!this.panning || event.pointerId !== this.panning.pointerId) return;
            event.stopPropagation();
            this.panning = null;
            this.setCursor(this.hand || this.space ? 'grab' : '');
        };
        on(win, 'pointerup', endPan, { capture: true });
        on(win, 'pointercancel', endPan, { capture: true });

        on(win, 'keydown', (event) => {
            if (event.code !== 'Space' || event.repeat || this.space) return;
            if (!inFrame && !this.host.matches(':hover')) return;
            event.preventDefault();
            this.space = true;
            this.setCursor('grab');
        });
        on(win, 'keyup', (event) => {
            if (event.code !== 'Space') return;
            this.space = false;
            if (!this.panning) this.setCursor(this.hand ? 'grab' : '');
        });
    }
}

/** The corner controls of a canvas: hand tool, zoom out, zoom level (click resets), zoom in. */
/** The same pill and round icon buttons as Fumadocs' theme switch. */
function controlButton(active: boolean) {
    return `size-6.5 p-1.5 transition-colors duration-100 hover:bg-fd-accent hover:text-fd-accent-foreground ${active ? 'bg-fd-accent text-fd-accent-foreground' : ''}`;
}

function ControlIcon({ children }: { children: ReactNode }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-full">
            {children}
        </svg>
    );
}

export function CanvasControls({ canvas }: { canvas: PreviewCanvas | null }) {
    const [state, setState] = useState<CanvasState>({ zoom: 1, hand: false });

    useEffect(() => canvas?.onChange(setState), [canvas]);

    if (!canvas) return null;

    return (
        <div className="absolute end-2 bottom-2 inline-flex items-center overflow-hidden rounded-full border border-fd-border bg-fd-card p-1 text-fd-muted-foreground *:rounded-full">
            <button
                type="button"
                className={controlButton(state.hand)}
                aria-label="Hand tool"
                aria-pressed={state.hand}
                title="Hand tool: drag to pan. Or hold space, or use the middle button"
                onClick={() => canvas.setHand(!state.hand)}
            >
                <ControlIcon>
                    <path d="M18 11V6a2 2 0 0 0-4 0v5" />
                    <path d="M14 10V4a2 2 0 0 0-4 0v2" />
                    <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                </ControlIcon>
            </button>
            <button type="button" className={controlButton(false)} aria-label="Zoom out" title="Zoom out" onClick={() => canvas.zoomStep(-1)}>
                <ControlIcon>
                    <path d="M5 12h14" />
                </ControlIcon>
            </button>
            <span className="min-w-10 text-center text-xs font-medium tabular-nums">{Math.round(state.zoom * 100)}%</span>
            <button type="button" className={controlButton(false)} aria-label="Zoom in" title="Zoom in" onClick={() => canvas.zoomStep(1)}>
                <ControlIcon>
                    <path d="M5 12h14" />
                    <path d="M12 5v14" />
                </ControlIcon>
            </button>
            <button type="button" className={controlButton(false)} aria-label="Reset the view" title="Reset the view" onClick={() => canvas.reset()}>
                <ControlIcon>
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                </ControlIcon>
            </button>
        </div>
    );
}
