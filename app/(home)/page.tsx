import { Card } from 'fumadocs-ui/components/card';
import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <main className="flex flex-1 flex-col items-center p-4 text-center sm:p-10">
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          ReactiveUI for Beat Saber
        </h1>
        <p className="mb-8 max-w-2xl text-lg text-fd-muted-foreground">
          A modern, C#-first UI library for creating beautiful and performant
          interfaces in Beat Saber mods. Build declarative, composable UIs right
          where your logic lives.
        </p>
        <Link
          href="/docs/reactive"
          className="mb-16 inline-flex h-12 items-center justify-center rounded-lg bg-fd-primary px-6 text-base font-semibold text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
        >
          Get Started
        </Link>

        <div className="grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col">
            <Card
              className="flex-grow"
              title="Getting Started"
              description="The references to add and a first component on screen."
              href="/docs/reactive/getting-started"
            />
          </div>
          <div className="flex flex-col">
            <Card
              className="flex-grow"
              title="Try it in the browser"
              description="The Playground runs real Reactive components with nothing to install."
              href="/playground"
            />
          </div>
          <div className="flex flex-col">
            <Card
              className="flex-grow"
              title="Beat Saber SDK"
              description="Every styled component with an example: buttons, toggles, sliders, dropdowns, modals and more."
              href="/docs/sdk"
            />
          </div>
        </div>
      </main>
    </>
  );
}
