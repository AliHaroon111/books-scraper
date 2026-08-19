// FlyRank Internship - Backend Track - W5 - A9 - The polite scraper

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { normalizeRecord } from './normalize.js';
import { validateRecords } from './validate.js';

const CACHE_DIR = 'cache';
const USER_AGENT = 'FlyRankInternshipA9/1.0 (+https://github.com/AliHaroon111/books-scraper)';
const TIMEOUT_MS = 8000;
const POLITE_DELAY_MS = 500;
const MAX_PAGES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Turns a book's absolute product URL into a safe, unique cache file name.
function cacheNameForBookUrl(url) {
  const parts = url.split('/').filter(Boolean);
  const slug = parts[parts.length - 2]; // the folder name, e.g. "a-light-in-the-attic_1000"
  return `book-${slug}.html`;
}

// Fetches a URL politely: honest user-agent, timeout, status check.
// Reads from cache if we already saved this page before.
async function fetchWithCache(url, cacheFileName) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, cacheFileName);

  if (existsSync(cachePath)) {
    const html = readFileSync(cachePath, 'utf-8');
    console.log(`CACHE HIT ${url} (${html.length} bytes)`);
    return { html, fromCache: true };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status !== 200) {
    throw new Error(`Fetch failed for ${url}: status ${response.status}`);
  }

  const html = await response.text();
  writeFileSync(cachePath, html, 'utf-8');
  console.log(`FETCH ${url} (${html.length} bytes)`);
  return { html, fromCache: false };
}

// Walks the catalogue starting at page 1, following the site's own "next" link
// up to MAX_PAGES, collecting every absolute book URL along the way.
async function discoverCataloguePages() {
  const bookUrls = [];
  let pageUrl = 'https://books.toscrape.com/catalogue/page-1.html';
  let pageNumber = 1;

  while (pageUrl && pageNumber <= MAX_PAGES) {
    const cacheFileName = `catalogue-page-${pageNumber}.html`;
    const { html, fromCache } = await fetchWithCache(pageUrl, cacheFileName);

    const $ = cheerio.load(html);

    $('article.product_pod h3 a').each((_, el) => {
      const href = $(el).attr('href');
      const absoluteUrl = new URL(href, pageUrl).href;
      bookUrls.push(absoluteUrl);
    });

    const nextHref = $('li.next a').attr('href');
    const hasNext = Boolean(nextHref);
    pageUrl = hasNext && pageNumber < MAX_PAGES ? new URL(nextHref, pageUrl).href : null;

    if (!fromCache && pageUrl) {
      await sleep(POLITE_DELAY_MS);
    }

    pageNumber++;
  }

  const uniqueUrls = [...new Set(bookUrls)];

  console.log(`catalogue_pages=${MAX_PAGES}`);
  console.log(`discovered=${bookUrls.length}`);
  console.log(`unique_urls=${uniqueUrls.length}`);

  return uniqueUrls;
}

// Extracts one raw record from a single book detail page's HTML.
function extractRawRecord(html, bookUrl, sourcePage) {
  const $ = cheerio.load(html);
  const productArea = $('div.product_main');

  const title = productArea.find('h1').text().trim();
  const priceText = productArea.find('p.price_color').first().text().trim();
  const availabilityText = productArea.find('p.availability').text().trim().replace(/\s+/g, ' ');

  const ratingClasses = productArea.find('p.star-rating').attr('class') || '';
  const ratingText = ratingClasses.replace('star-rating', '').trim() || null;

  const descriptionEl = $('#product_description').next('p');
  const description = descriptionEl.length ? descriptionEl.text().trim() : null;

  return {
    title,
    product_url: bookUrl,
    price_text: priceText,
    availability_text: availabilityText,
    rating_text: ratingText,
    description,
    source_page: sourcePage,
    fetched_at: new Date().toISOString(),
  };
}

// Fetches and extracts every book on the given list of URLs.
async function extractAllBooks(bookUrls) {
  const records = [];

  for (const bookUrl of bookUrls) {
    const cacheFileName = cacheNameForBookUrl(bookUrl);
    const { html, fromCache } = await fetchWithCache(bookUrl, cacheFileName);

    const record = extractRawRecord(html, bookUrl, bookUrl);
    records.push(record);

    if (!fromCache) {
      await sleep(POLITE_DELAY_MS);
    }
  }

  console.log(`detail_pages=${records.length}`);
  return records;
}

async function main() {
  const bookUrls = await discoverCataloguePages();
  const rawRecords = await extractAllBooks(bookUrls);

  const normalizedRecords = rawRecords.map(normalizeRecord);
  const { valid, invalid } = validateRecords(normalizedRecords);

  mkdirSync('output', { recursive: true });
  writeFileSync('output/books.json', JSON.stringify(valid, null, 2), 'utf-8');
  writeFileSync('output/errors.json', JSON.stringify(invalid, null, 2), 'utf-8');

  console.log(`valid_records=${valid.length}`);
  console.log(`invalid_records=${invalid.length}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});