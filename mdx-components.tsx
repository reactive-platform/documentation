import defaultMdxComponents from 'fumadocs-ui/mdx';
import {TypeTable} from 'fumadocs-ui/components/type-table';
import type {MDXComponents} from 'mdx/types';

import {Mermaid} from '@/app/components/Mermaid';
import Alert from '@/app/components/Alert';
import Compare from '@/app/components/Compare';
import CompileExample from '@/app/components/CompileExample';
import PerfChart from '@/app/components/PerfChart';
import Screenshot from '@/app/components/Screenshot';
import PlaygroundFrame from '@/app/components/playground/PlaygroundFrame';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
    return {
        ...defaultMdxComponents,
        ...components,
        Mermaid,
        Alert,
        Compare,
        CompileExample,
        PerfChart,
        Screenshot,
        Playground: PlaygroundFrame,
        TypeTable,
    };
}
