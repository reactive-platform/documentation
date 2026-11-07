'use client';

import {Children, cloneElement, isValidElement, type MouseEvent, type ReactElement, type ReactNode, useSyncExternalStore} from 'react';
import {flushSync} from 'react-dom';
import {SEGMENTS, segment} from '@/app/components/playground/controls';

type Side = 'BSML' | 'Reactive';
type Block = ReactElement<{title?: string}>;

// One choice for the whole page, so a reader who picks a side doesn't have to pick it again in every frame
let chosen: Side = 'Reactive';
const listeners = new Set<() => void>();

function choose(side: Side) {
    chosen = side;
    listeners.forEach((listener) => listener());
}

/** Frames above the clicked one change height too, so the page is scrolled back to keep the button under the pointer. */
function chooseInPlace(side: Side, event: MouseEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    const before = button.getBoundingClientRect().top;

    flushSync(() => choose(side));

    window.scrollBy({top: button.getBoundingClientRect().top - before, behavior: 'instant'});
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * One code block with a switch between the two frameworks. A fence titled "Reactive" is that side, and the others,
 * titled "Markup" and "Code", are the BSML side. A frame with only BSML has nothing to switch, so it just says so.
 */
export default function Compare({children}: {children: ReactNode}) {
    const blocks = Children.toArray(children).filter(isValidElement) as Block[];
    const bsml = blocks.filter((block) => block.props.title !== 'Reactive');
    const reactive = blocks.find((block) => block.props.title === 'Reactive');

    const picked = useSyncExternalStore(subscribe, () => chosen, () => 'Reactive' as Side);
    const side = reactive ? picked : 'BSML';

    return (
        <div className="not-prose my-6 overflow-hidden rounded-xl border border-fd-border bg-fd-card text-sm [&_figure]:my-0 [&_figure]:rounded-none [&_figure]:border-0 [&_figure]:shadow-none">
            <div className="flex min-h-10.5 items-center border-b border-fd-border px-2 text-xs text-fd-muted-foreground">
                {reactive ? (
                    <div role="group" aria-label="Framework" className={SEGMENTS}>
                        {(['BSML', 'Reactive'] as const).map((name) => (
                            <button key={name} type="button" aria-pressed={side === name} className={segment(side === name)} onClick={(event) => chooseInPlace(name, event)}>
                                {name}
                            </button>
                        ))}
                    </div>
                ) : (
                    <span className="px-2 font-medium">BSML</span>
                )}
            </div>
            {side === 'Reactive' && reactive
                ? cloneElement(reactive, {title: undefined})
                : bsml.map((block, index) => (
                      <div key={block.props.title} className={index > 0 ? 'border-t border-fd-border' : ''}>
                          {block}
                      </div>
                  ))}
        </div>
    );
}
