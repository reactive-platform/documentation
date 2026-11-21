import type { Metadata } from 'next';
import { Playground } from '@/app/components/playground/Playground';
import { smallPreview } from '@/lib/site';

export const metadata: Metadata = {
    title: 'Playground',
    description: 'Write Reactive components in your browser and see them run.',
    ...smallPreview('/assets/playground/pc-layout.png'),
};

export default function PlaygroundPage() {
    return <Playground />;
}
