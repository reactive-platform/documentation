import Link from 'next/link';

// Each one opens the matching section of the introduction, and shows the preview recorded for it
const features = [
  {
    title: 'Reactivity',
    description: 'Bind once, and every label, meter and color follows the state.',
    href: '/docs/reactive#reactivity',
    preview: '/assets/intro/reactivity.webp',
  },
  {
    title: 'Layout',
    description: 'Flexbox from the web, and your own controllers when it isn’t enough.',
    href: '/docs/reactive#layout',
    preview: '/assets/layout/flex-wrap.webp',
  },
  {
    title: 'Animations',
    description: 'Ease values and play animations on components without writing the loop.',
    href: '/docs/reactive#animations',
    preview: '/assets/animation/showcase.webp',
  },
  {
    title: 'Performance',
    description: 'Tables reuse their cells, so even 100000 rows jump with no delay.',
    href: '/docs/reactive#performance',
    preview: '/assets/intro/performance.webp',
  },
];

// The counter from the introduction, colored by hand so the page needs no highlighter
const counter: [string, string][][] = [
  [['k', 'var '], ['', 'count = '], ['f', 'Remember'], ['', '('], ['n', '0'], ['', ');']],
  [],
  [['k', 'new '], ['t', 'Label'], ['', ' {']],
  [['', '    sText = count.'], ['f', 'Map'], ['', '(x => '], ['s', '$"{x}"'], ['', ')']],
  [['', '},']],
  [['k', 'new '], ['t', 'BsPrimaryTextButton'], ['', ' {']],
  [['', '    Text = '], ['s', '"+1"'], ['', ',']],
  [['', '    OnClick = () => count.Value++']],
  [['', '}']],
];

const tokenColor: Record<string, string> = {
  k: 'text-[#ff7b9c]',
  t: 'text-[#7dd3fc]',
  f: 'text-[#c4a7ff]',
  n: 'text-[#fbbf74]',
  s: 'text-[#9be59b]',
  '': 'text-zinc-300',
};

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-4 pb-20 sm:px-10">
      {/* A soft glow behind the hero, in the blue the examples use */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] max-w-[160vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(89,191,255,0.22),transparent)]"
      />

      <section className="relative grid w-full max-w-6xl items-center gap-12 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <img src="/logo/reactive-logo-black.svg" alt="" width={72} height={72} className="mb-6 dark:hidden" />
          <img src="/logo/reactive-logo-white.svg" alt="" width={72} height={72} className="mb-6 hidden dark:block" />

          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-fd-muted-foreground">
            UI for Beat Saber mods
          </p>
          <h1 className="mb-5 text-5xl font-bold tracking-tight sm:text-6xl">
            Reactive
          </h1>
          <p className="mb-8 max-w-xl text-lg text-fd-muted-foreground">
            Write the view in C#, next to the code that drives it. Values that change live in states, and whatever
            reads a state follows it, with no markup to parse and nothing to refresh by hand.
          </p>

          <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link
              href="/docs/reactive"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-fd-primary px-6 text-base font-semibold text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
            >
              Read the introduction
            </Link>
            <Link
              href="/playground"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-fd-border bg-fd-card px-6 text-base font-semibold transition-colors hover:bg-fd-accent"
            >
              Open the Playground
            </Link>
          </div>
        </div>

        {/* The counter's code next to the same component running */}
        <div className="overflow-hidden rounded-2xl border border-fd-border bg-[#1c1c21] shadow-2xl shadow-black/30">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            <span className="ml-2 font-mono text-xs text-zinc-400">Counter.cs</span>
          </div>
          <div className="grid sm:grid-cols-[1fr_auto]">
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-6">
              {counter.map((line, i) => (
                <div key={i}>
                  {line.length === 0
                    ? ' '
                    : line.map(([kind, text], j) => (
                        <span key={j} className={tokenColor[kind]}>
                          {text}
                        </span>
                      ))}
                </div>
              ))}
            </pre>
            <div className="flex items-center justify-center border-t border-white/10 p-5 sm:border-l sm:border-t-0">
              <img src="/assets/intro/counter.webp" alt="A label counting up as a +1 button is clicked" className="h-44 w-auto" />
            </div>
          </div>
        </div>
      </section>

      <section className="relative mt-24 w-full max-w-6xl">
        <h2 className="mb-2 text-center text-2xl font-semibold tracking-tight sm:text-3xl">A step up from BSML</h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-fd-muted-foreground">
          Everything BSML makes you wire by hand, Reactive handles for you. Each of these opens the part of the
          introduction that shows how.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          {features.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="group flex flex-col overflow-hidden rounded-2xl border border-fd-border bg-fd-card transition-all hover:-translate-y-0.5 hover:border-[#59bfff]/60 hover:shadow-lg hover:shadow-[#59bfff]/10"
            >
              <div className="flex h-56 items-center justify-center bg-[#1c1c21] p-4">
                <img src={feature.preview} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
              </div>
              <div className="p-5 text-left">
                <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold">
                  {feature.title}
                  <span className="text-fd-muted-foreground transition-transform group-hover:translate-x-1">→</span>
                </h3>
                <p className="text-sm text-fd-muted-foreground">{feature.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
