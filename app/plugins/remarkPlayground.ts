import {visit} from 'unist-util-visit';

/**
 * Lets a docs page write a `<Playground>` with plain code fences inside. Every fence is one file of the example,
 * shown as a tab. The fences stay children, so they are highlighted like any other code block, and their text is
 * also passed to the component as `files` for the compiler. A file is named by the fence's `title="..."` meta, or
 * after the first type it declares. A fence marked `excerpt` is not a file: it is the short form shown until the
 * example is run, when the full files take its place.
 */
export function remarkPlayground() {
    return (tree: any) => {
        visit(tree, 'mdxJsxFlowElement', (node: any) => {
            if (node.name !== 'Playground') return;

            const allFences = (node.children ?? []).filter((child: any) => child.type === 'code');
            const isExcerpt = (fence: any) => /\bexcerpt\b/.test(fence.meta ?? '');
            const fences = allFences.filter((fence: any) => !isExcerpt(fence));
            if (fences.length === 0) return;
            // The excerpt renders at rest in place of the files, so it goes first among the children
            const excerpts = allFences.filter(isExcerpt);
            if (excerpts.length > 0) {
                node.children = [...excerpts, ...node.children.filter((child: any) => !excerpts.includes(child))];
                for (const fence of excerpts) fence.meta = fence.meta.replace(/\bexcerpt\b/, '').trim() || undefined;
            }

            node.attributes ??= [];
            const has = (name: string) =>
                node.attributes.some((attribute: any) => attribute.type === 'mdxJsxAttribute' && attribute.name === name);

            const files = fences.map((fence: any, index: number) => ({
                name: fileName(fence, index),
                lang: fence.lang ?? 'csharp',
                code: fence.value,
            }));

            // The frame shows the names as tabs, so the fences must not also render their own title bars
            for (const fence of fences) {
                fence.meta = (fence.meta ?? '').replace(/\s*title="[^"]*"/, '').trim() || undefined;
            }

            if (!has('files')) {
                node.attributes.push({type: 'mdxJsxAttribute', name: 'files', value: JSON.stringify(files)});
            }
            if (!has('lang')) {
                node.attributes.push({type: 'mdxJsxAttribute', name: 'lang', value: files[0].lang});
            }
            if (excerpts.length > 0 && !has('excerpt')) {
                node.attributes.push({type: 'mdxJsxAttribute', name: 'excerpt', value: 'true'});
            }
        });
    };
}

function fileName(fence: any, index: number) {
    const title = /title="([^"]+)"/.exec(fence.meta ?? '');
    if (title) return title[1];

    const extension = /^(cpp|c\+\+|cxx)$/i.test(fence.lang ?? '') ? 'cpp' : 'cs';
    const type = /\b(?:class|struct|record|interface|enum)\s+([A-Za-z_]\w*)/.exec(fence.value);
    return `${type ? type[1] : index === 0 ? 'Program' : `File${index + 1}`}.${extension}`;
}
