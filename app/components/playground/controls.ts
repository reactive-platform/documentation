/** The look of the small controls in the playground's bars, so a frame and the playground page read as one thing. */
const SHAPE = 'inline-flex h-6.5 items-center justify-center gap-1 rounded-md border px-2 font-medium text-nowrap transition-colors';

export const CONTROL = `${SHAPE} border-fd-border hover:bg-fd-accent hover:text-fd-accent-foreground`;

export const PRIMARY_CONTROL = `${SHAPE} border-transparent bg-fd-primary text-fd-primary-foreground hover:opacity-90`;

export const SEGMENTS = 'inline-flex h-6.5 items-stretch gap-0.5 rounded-md border border-fd-border p-0.5';

export function segment(selected: boolean) {
    return `flex items-center rounded px-1.5 font-medium text-nowrap transition-colors ${selected ? 'bg-fd-accent text-fd-accent-foreground' : 'hover:text-fd-foreground'}`;
}
