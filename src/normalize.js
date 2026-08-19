// Turns "£51.77" into 51.77 - a real number a program can sort and compare.
export function parsePriceGbp(priceText) {
    const match = priceText.match(/[\d.]+/);
    if (!match) return null;
    return parseFloat(match[0]);
  }
  
  // Adds the clean price_gbp field next to the raw price_text.
  // The raw record is otherwise untouched - both values live side by side.
  export function normalizeRecord(rawRecord) {
    return {
      ...rawRecord,
      price_gbp: parsePriceGbp(rawRecord.price_text),
    };
  }