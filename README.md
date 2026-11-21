# Reactive docs

[![Netlify Status](https://api.netlify.com/api/v1/badges/eb29b94d-0f1b-4b2c-b406-21045b46681c/deploy-status)](https://app.netlify.com/projects/astonishing-moxie-782409/deploys)

The documentation site for [Reactive](https://github.com/reactive-platform/reactive-mono), the C# UI library for
Beat Saber mods. Built with [Fumadocs](https://fumadocs.dev) on Next.js. It also hosts the in-browser
[Playground](https://reactive-platform.github.io/playground) at `/playground`.

## Running it

```bash
yarn install
yarn dev
```

Then open http://localhost:3000. `yarn build` builds the Playground and then the site.

The Playground's runtimes aren't committed. They're built from the inputs pinned in `playground/lock.json`, which the
build downloads itself. It needs .NET SDK 10.0.400 or later with the `wasm-tools` workload (`wasm-tools-net10` on SDK
11), and `yarn check:examples` then compiles every docs example that should compile against that build:

```bash
yarn build:playground
yarn check:examples
```

CI runs both in the toolchain stage of the `Dockerfile`. Pushes to `main` and `stage` are deployed to the VPS, at
reactiveui.beatleader.com and stage.reactiveui.beatleader.com, by building its `site` stage, which runs the built
server:

```bash
docker build --target site --tag reactive-docs .
docker run --publish 3000:3000 reactive-docs
```