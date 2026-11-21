import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// The small picture link previews show for pages without their own, the logo on the backdrop of opengraph-image.tsx

export const dynamic = 'force-static';

export async function GET() {
  const logo = await readFile(join(process.cwd(), 'public', 'logo', 'reactive-logo-white-512.png'), 'base64');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'radial-gradient(ellipse 70% 70% at 50% 0%, rgba(89, 191, 255, 0.22), transparent)',
        }}
      >
        <img src={`data:image/png;base64,${logo}`} width={232} height={232} alt="" />
      </div>
    ),
    { width: 400, height: 400 },
  );
}
