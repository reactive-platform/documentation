import {
    defineConfig,
    defineDocs,
    frontmatterSchema,
    metaSchema,
} from 'fumadocs-mdx/config';
import {remarkMermaid} from "@/app/plugins/remarkMermaid";
import {remarkPlayground} from "@/app/plugins/remarkPlayground";
import {z} from 'zod';

// You can customise Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.vercel.app/docs/mdx/collections#define-docs
export const docs = defineDocs({
    docs: {
        schema: frontmatterSchema.extend({
            // The small picture link previews show for the page, a path under public. Pages without one show the logo
            image: z.string().optional(),
        }),
        async: true,
    },
    meta: {
        schema: metaSchema,
    },
});

export default defineConfig({
    mdxOptions: {
        remarkPlugins: [remarkMermaid, remarkPlayground]
    },
});
