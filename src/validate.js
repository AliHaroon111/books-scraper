import { BookRecordSchema } from './schema.js';

// Validates every normalized record against the schema.
// Good records go to `valid`, keyed by their canonical product_url (deduped).
// Bad records go to `invalid`, each with the reason it failed.
export function validateRecords(records) {
  const validByUrl = new Map();
  const invalid = [];

  for (const record of records) {
    const result = BookRecordSchema.safeParse(record);

    if (result.success) {
      // product_url is the record's canonical identity - last one wins on duplicates,
      // but a duplicate is never counted twice.
      validByUrl.set(result.data.product_url, result.data);
    } else {
      invalid.push({
        record,
        reason: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }
  }

  return {
    valid: [...validByUrl.values()],
    invalid,
  };
}