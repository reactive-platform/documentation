import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// The preview image link embeds show for every page, laid out like the home page's hero

export const alt = 'Reactive, UI for Beat Saber mods';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const kicker = 'UI FOR BEAT SABER MODS';
const title = 'Reactive';
const tagline = 'Write the view in C#, next to the code that drives it.';

// next/og can't read the woff2 files next/font uses, so Inter comes from Google Fonts as TTF,
// cut down to the characters drawn
async function loadInter(weight: number, text: string) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&text=${encodeURIComponent(text)}`,
  ).then((response) => response.text());

  const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
  if (!url) {
    throw new Error(`Google Fonts returned no TTF for Inter ${weight}`);
  }

  return fetch(url).then((response) => response.arrayBuffer());
}

export default async function Image() {
  const [logo, medium, bold, regular] = await Promise.all([
    readFile(join(process.cwd(), 'public', 'logo', 'reactive-logo-white-512.png'), 'base64'),
    loadInter(500, kicker),
    loadInter(700, title),
    loadInter(400, tagline),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          // The glow behind the hero, in the blue the examples use
          backgroundImage: 'radial-gradient(ellipse 50% 60% at 50% 0%, rgba(89, 191, 255, 0.22), transparent)',
          color: '#fafafa',
          fontFamily: 'Inter',
        }}
      >
        <img src={`data:image/png;base64,${logo}`} width={136} height={136} alt="" />
        <div
          style={{
            marginTop: 44,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: '0.2em',
            color: '#a3a3a3',
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 120,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 34,
            fontWeight: 400,
            color: '#a3a3a3',
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Inter', data: medium, weight: 500, style: 'normal' },
        { name: 'Inter', data: bold, weight: 700, style: 'normal' },
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
      ],
    },
  );
}
