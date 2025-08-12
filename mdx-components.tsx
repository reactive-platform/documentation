import defaultMdxComponents from 'fumadocs-ui/mdx';
import type {MDXComponents} from 'mdx/types';

import {Mermaid} from '@/app/components/Mermaid';
import Alert from '@/app/components/Alert';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
    return {
        ...defaultMdxComponents,
        ...components,
        Mermaid,
        Alert,
    };
}
