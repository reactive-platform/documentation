import {visit} from "unist-util-visit";

export function remarkMermaid() {
    return (tree: any) => {
        visit(tree, 'code', (node) => {
            if (node.lang === 'mermaid') {
                node.type = 'mdxJsxFlowElement';
                node.name = 'Mermaid';
                node.attributes = [
                    {
                        type: 'mdxJsxAttribute',
                        name: 'chart',
                        value: node.value,
                    },
                ];

                // Clear original code block data to avoid conflicts
                delete node.value;
                delete node.lang;
                delete node.meta;
            }
        });
    };
}
