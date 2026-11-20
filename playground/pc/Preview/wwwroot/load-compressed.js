export function loadCompressed(type, name, defaultUri) {
    if (!defaultUri.endsWith('.wasm')) return defaultUri;

    return fetch(`${defaultUri}.gz`).then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${name}: ${response.status}`);
        const body = response.body.pipeThrough(new DecompressionStream('gzip'));
        return new Response(body, { headers: { 'Content-Type': 'application/wasm' } });
    });
}
