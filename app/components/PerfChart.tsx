interface PerfRow {
    label: string;
    id: string;
    values: string;
    ratio: number;
    difference: string;
}

interface PerfGroup {
    name?: string;
    rows: PerfRow[];
    notes?: string[];
}

interface PerfChartProps {
    from: string;
    to: string;
    groups: PerfGroup[];
}

const gridStyle = 'grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-x-3 @2xl:grid-cols-[minmax(0,1fr)_8rem_12rem_6rem]';
const fromColor = 'bg-[#eb6834] dark:bg-[#d95926]';
const toColor = 'bg-[#2a78d6] dark:bg-[#3987e5]';

function decades(ratios: number[]) {
    return Math.max(1, Math.ceil(Math.log10(Math.max(1, ...ratios))));
}

export default function PerfChart({from, to, groups}: PerfChartProps) {
    const ratios = groups.flatMap(group => group.rows.map(row => row.ratio));
    const left = decades(ratios.map(ratio => -ratio));
    const right = decades(ratios);
    const total = left + right;
    const center = left / total * 100;

    const ticks = Array.from({length: total + 1}, (_, index) => {
        const power = Math.abs(index - left);
        return {position: index / total * 100, label: `${10 ** power}×`, isCenter: power === 0};
    });

    const gridlines = ticks.map(tick => (
        <span
            key={tick.position}
            className={`absolute inset-y-0 w-px ${tick.isCenter ? 'bg-fd-muted-foreground/50' : 'bg-fd-border'}`}
            style={{left: `${tick.position}%`}}
        />
    ));

    return (
        <div className="not-prose @container my-6 rounded-xl border bg-fd-card p-4 text-sm">
            <div className={`${gridStyle} text-xs text-fd-muted-foreground`}>
                <span/>
                <span className="self-start text-right tabular-nums">{from} → {to}</span>
                <div>
                    <div className="flex flex-wrap justify-between gap-x-2">
                        <span><span className={`mr-1 inline-block size-2 rounded-sm ${fromColor}`}/>{from} better</span>
                        <span>{to} better<span className={`ml-1 inline-block size-2 rounded-sm ${toColor}`}/></span>
                    </div>
                    <div aria-hidden className="relative mt-1 h-4">
                        {ticks.map(tick => (
                            <span
                                key={tick.position}
                                className="absolute -translate-x-1/2 tabular-nums"
                                style={{left: `${tick.position}%`}}
                            >
                                {tick.label}
                            </span>
                        ))}
                    </div>
                </div>
                <span/>
            </div>

            {groups.map(group => (
                <div key={group.name ?? 'rows'}>
                    {group.name && <div className="mt-3 mb-1 font-medium">{group.name}</div>}

                    {group.rows.map(row => {
                        const width = `${Math.log10(Math.abs(row.ratio)) / total * 100}%`;
                        const isToBetter = row.ratio > 0;

                        return (
                            <div key={row.id} title={row.id} className={`${gridStyle} rounded hover:bg-fd-accent/50`}>
                                <span className="py-1">{row.label}</span>
                                <span className="text-right tabular-nums text-fd-muted-foreground">{row.values}</span>
                                <div aria-hidden className="relative min-h-4 self-stretch">
                                    {gridlines}
                                    {row.ratio !== 0 && (
                                        <span
                                            className={`absolute top-1/2 h-2.5 min-w-0.5 -translate-y-1/2 ${isToBetter ? `rounded-r ${toColor}` : `rounded-l ${fromColor}`}`}
                                            style={isToBetter ? {left: `${center}%`, width} : {right: `${100 - center}%`, width}}
                                        />
                                    )}
                                </div>
                                <span className={`whitespace-nowrap text-right tabular-nums ${row.ratio === 0 ? 'text-fd-muted-foreground' : 'font-medium'}`}>
                                    {row.difference}
                                </span>
                            </div>
                        );
                    })}

                    {group.notes?.map(note => (
                        <p key={note} className="mt-1 text-xs text-fd-muted-foreground">{note}</p>
                    ))}
                </div>
            ))}
        </div>
    );
}
