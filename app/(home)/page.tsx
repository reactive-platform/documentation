import { Card, Cards } from 'fumadocs-ui/components/card';
import Image from 'next/image';
import Link from 'next/link';
import Head from 'next/head';

export default function HomePage() {
  return (
    <>
      <Head>
        <link rel="apple-touch-icon-precomposed" sizes="57x57" href="apple-touch-icon-57x57.png" />
        <link rel="apple-touch-icon-precomposed" sizes="114x114" href="apple-touch-icon-114x114.png" />
        <link rel="apple-touch-icon-precomposed" sizes="72x72" href="apple-touch-icon-72x72.png" />
        <link rel="apple-touch-icon-precomposed" sizes="144x144" href="apple-touch-icon-144x144.png" />
        <link rel="apple-touch-icon-precomposed" sizes="60x60" href="apple-touch-icon-60x60.png" />
        <link rel="apple-touch-icon-precomposed" sizes="120x120" href="apple-touch-icon-120x120.png" />
        <link rel="apple-touch-icon-precomposed" sizes="76x76" href="apple-touch-icon-76x76.png" />
        <link rel="apple-touch-icon-precomposed" sizes="152x152" href="apple-touch-icon-152x152.png" />
        <link rel="icon" type="image/png" href="favicon-196x196.png" sizes="196x196" />
        <link rel="icon" type="image/png" href="favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/png" href="favicon-32x32.png" sizes="32x32" />
        <link rel="icon" type="image/png" href="favicon-16x16.png" sizes="16x16" />
        <link rel="icon" type="image/png" href="favicon-128.png" sizes="128x128" />
        <meta name="application-name" content="ReactiveUI"/>
        <meta name="msapplication-TileColor" content="#FFFFFF" />
        <meta name="msapplication-TileImage" content="mstile-144x144.png" />
        <meta name="msapplication-square70x70logo" content="mstile-70x70.png" />
        <meta name="msapplication-square150x150logo" content="mstile-150x150.png" />
        <meta name="msapplication-wide310x150logo" content="mstile-310x150.png" />
        <meta name="msapplication-square310x310logo" content="mstile-310x310.png" />
      </Head>
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
          href="/docs"
          className="mb-16 inline-flex h-12 items-center justify-center rounded-lg bg-fd-primary px-6 text-base font-semibold text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
        >
          Get Started
        </Link>

        <div className="grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col">
            <Card
              className="flex-grow"
              title="Getting Started"
              description="Learn the fundamentals, see examples, and understand why it's a great choice over BSML."
              href="/docs"
            />
            <div className="mt-4 overflow-hidden rounded-lg">
              <Image
                src="https://placehold.co/600x400/000000/FFFFFF/png"
                alt="Placeholder"
                width={600}
                height={400}
              />
            </div>
          </div>
          <div className="flex flex-col">
            <Card
              className="flex-grow"
              title="Layout System"
              description="Build flexible and responsive layouts with the powerful, Flexbox-based Yoga engine."
              href="/docs/layout"
            />
            <div className="mt-4 overflow-hidden rounded-lg">
              <Image
                src="https://placehold.co/600x400/000000/FFFFFF/png"
                alt="Placeholder"
                width={600}
                height={400}
              />
            </div>
          </div>
          <div className="flex flex-col">
            <Card
              className="flex-grow"
              title="Core Components"
              description="Explore the essential building blocks like Labels, Buttons, Images, and more."
              href="/docs/components/label"
            />
            <div className="mt-4 overflow-hidden rounded-lg">
              <Image
                src="https://placehold.co/600x400/000000/FFFFFF/png"
                alt="Placeholder"
                width={600}
                height={400}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
