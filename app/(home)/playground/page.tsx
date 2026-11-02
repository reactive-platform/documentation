import type { Metadata } from 'next';
import { Playground } from '@/app/components/playground/Playground';

export const metadata: Metadata = {
    title: 'Playground',
    description: 'Write Reactive components in your browser and see them run.',
};

export default function PlaygroundPage() {
    return <Playground />;
}
