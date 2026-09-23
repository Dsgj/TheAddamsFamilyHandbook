import { defineCollection, z } from 'astro:content';
import { handbookLoader } from '~/lib/handbook/loader';

const handbook = defineCollection({
  loader: handbookLoader(),
  schema: z.object({
    page: z.number(),
    label: z.string(),
    section: z.string(),
    sectionTitle: z.string(),
    order: z.number(),
    headings: z.array(
      z.object({
        id: z.string(),
        level: z.union([z.literal(2), z.literal(3)]),
        text: z.string(),
        page: z.number(),
      }),
    ),
    plain: z.string(),
  }),
});

export const collections = { handbook };
