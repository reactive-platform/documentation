# Reactive docs

Documentation site for Reactive, a C# UI library for Beat Saber mods. Built with Fumadocs on Next.js, and it hosts an
in-browser Playground. The docs cover Reactive 2.0.0.

## Commands

- Use yarn: `yarn install`, `yarn dev`, `yarn build`.
- After changing a remark plugin, `touch source.config.ts` so the content is regenerated.

## Git

- Commit only when asked. Never push or force-push unless asked.
- Commit messages are `topic(area): message`, where the area is optional, for example `feat(playground): add file tabs`.
- Write the subject line only, with no description and no contributor or co-author lines.
- Never rewrite commits that are already pushed. Check the remote first, because local tracking refs can be stale.
- Order related commits as: the feature itself, then the components that use it, then the docs.

## Docs structure

- Never change page layout or structure unasked.
- When a design request is vague, make the smallest change that fits and keep the existing page flow.

## Writing

- Use plain wording, and avoid "which is why" constructions.
- Aim for sentences of about 18 words. Don't split one thought into 3-4 short ones, and don't chain several thoughts
  into one long one.
- Keep related points in one paragraph. Don't add paragraphs when rewriting a section, keep the count it already has.
- Before an example, explain what it does in a sentence or two, in its own paragraph ending with a colon. Say that an
  example follows, in wording no other example on the page shares, like "Here's an example", "Below you can see" or
  "Try this demo".
- Use inline code only when it's really needed, like for an identifier the reader would type. Describe everything else
  in words, so `Reactive.Compiler` becomes "the Reactive compiler".
- Never mark a single symbol with inline code. Write the b slider, s-property or here 0 as plain text.
- Avoid using semicolons everywhere.
- Don't add difficulty levels.
- The manifest example uses `"Reactive": "^2.0.0"`, while `Reactive.Compiler` stays at `1.0.0`.
- Compare with BSML through fundamentals such as structure, layout and state, not small tasks like showing and hiding.
- Show BSML and Reactive code with `<Compare>`: one block with a switch, not side by side.

## Code examples

These apply to every C# example in `content/docs`, new or edited.

- Use at most 3 files per example. Everything that defines the logic goes in the main file, and boilerplate goes in the other.
- Vertical overflow is fine when the code is worth it. Never split into more files just to avoid scrolling.
- Name call arguments. Put each argument on its own line when the purpose is unclear. 
- Prefer tall over wide, with lines of about 80 characters.
- Split wide object initializers, `Map` lambdas and ternaries the same way.
- Prefer showing code by default, hide it only in places with lots of code that rather let you try it out than learn.
- Show code that fails to compile in `<CompileExample status="error" output="...">`, with the real error as `output`.
  Show its fix in a separate `<CompileExample status="compiles">` block, since each block has one state. Get the error by compiling
  the exact code with `dotnet build`, not from memory. The Playground reports `RV` errors but still runs that code, so it
  can't confirm they fail.
- Explain why code fails right after its failing block, between it and the fix. Don't save the explanation for the end.
- Every code container gets the same 32px above and below: plain code blocks, `<CompileExample>`, `<Compare>` and
  `<Playground>`. Don't vary the margin by what follows a block. If a new topic looks attached to it, add a heading.

## Playground build

Run `yarn build:playground` (`playground/build.mjs`). Flags: `--reactive-repo <path>`, `--quest-repo <path>`,
`--yoga-binding <path>`, `--rebuild-yoga`, `--skip-quest`.

- Deploys don't build the Playground. The site serves the committed `public/playground`, so rebuild and commit
  it to ship a Reactive update.
- `Yoga/yoga.a` is only rebuilt when missing, so pass `--rebuild-yoga` after changing `Yoga/bridge.cpp` or the Yoga
  commit.
- Use dotnet SDK 11.
- `dotnet publish` must run outside the sandbox.
- Never pass `--skip-sign-check`.
- The Quest output doesn't use `reactive-mono`, so a library update doesn't require rebuilding it.
- When the library adds Unity API calls, `playground/UnityEngine` may need matching members.

## Logo

- Files are in `public/logo`. Use the black logo on light backgrounds and the white logo on dark backgrounds.
- The R is a real cutout, so it shows whatever is behind it.
- The cube is a true isometric cube with sharp corners, diamond faces and a solid top. It has one cutout, on the right
  face only.
- Any new variant must look right in both black and white.
- Keep a set of options in one consistent system: the same line weight, dot size and baseline.

## Working style

- Verify visible changes in the browser, and check that a test can actually fail before trusting it.
- State plainly what was and wasn't checked.
