import { z } from 'zod';

// The shape of one finished, trustworthy record.
// Raw text fields live alongside their cleaned counterparts.
export const BookRecordSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url(),
  price_text: z.string().min(1),
  price_gbp: z.number().positive(),
  availability_text: z.string().min(1),
  rating_text: z.string().nullable(),
  description: z.string().nullable(),
  source_page: z.string().url(),
  fetched_at: z.string().datetime(),
});