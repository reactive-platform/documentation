import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

// Serves the Playground runtimes that playground/build.mjs builds
const ROOT = resolve(process.cwd(), 'playground', 'artifacts', 'web');

const TYPES: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.gz': 'application/gzip',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.tar': 'application/x-tar',
    '.txt': 'text/plain; charset=utf-8',
    '.wasm': 'application/wasm',
    '.woff2': 'font/woff2',
};

async function findFile(path: string) {
    const info = await stat(path).catch(() => null);
    if (info?.isFile()) {
        return { path, info, gzip: false };
    }

    // Large files are only stored gzipped, and the browser unpacks them through Content-Encoding
    const gzipped = await stat(`${path}.gz`).catch(() => null);
    if (gzipped?.isFile()) {
        return { path: `${path}.gz`, info: gzipped, gzip: true };
    }

    return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const path = join(ROOT, ...(await params).path);
    if (!path.startsWith(ROOT + sep)) {
        return new Response(null, { status: 404 });
    }

    const file = await findFile(path);
    if (!file) {
        return new Response(null, { status: 404 });
    }

    const etag = `"${file.info.size.toString(36)}-${file.info.mtimeMs.toString(36)}"`;
    const headers: Record<string, string> = {
        'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        ETag: etag,
    };

    if (file.gzip) {
        headers['Content-Encoding'] = 'gzip';
    }

    if (request.headers.get('if-none-match') === etag) {
        return new Response(null, { status: 304, headers });
    }

    const body = Readable.toWeb(createReadStream(file.path)) as ReadableStream;
    return new Response(body, { headers });
}
