import type { SourceFile } from './files';
import type { PlatformName } from './runtime';

/** Code travels to the playground page in the URL hash as base64url of UTF-8, so it survives any router. */
export function encodeCode(code: string) {
    const bytes = new TextEncoder().encode(code);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCode(encoded: string) {
    try {
        const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    } catch {
        return null;
    }
}

/** The link that opens these files on the playground page. */
export function playgroundUrl(platform: PlatformName, files: SourceFile[]) {
    const payload = files.map(({ name, code }) => ({ name, code }));
    return `/playground?platform=${platform}#files=${encodeCode(JSON.stringify(payload))}`;
}

function decodeFiles(encoded: string | null): SourceFile[] | null {
    const text = encoded && decodeCode(encoded);
    if (!text) return null;
    try {
        const files = JSON.parse(text);
        const valid = Array.isArray(files) && files.length > 0 && files.every((x) => typeof x?.name === 'string' && typeof x?.code === 'string');
        return valid ? files : null;
    } catch {
        return null;
    }
}

/** Reads what a link put in the current URL. `code` is the single file of a link made before examples had several. */
export function readPlaygroundUrl() {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const encoded = hash.get('code');
    return {
        platform: params.get('platform') as PlatformName | null,
        sample: params.get('sample'),
        files: decodeFiles(hash.get('files')),
        code: encoded ? decodeCode(encoded) : null,
    };
}
