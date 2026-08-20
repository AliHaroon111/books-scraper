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

// Set INJECT_FAKE_URL=1 before `npm start` to add one made-up book URL on
// purpose, to prove Stage 5's failure handling. Never left on by default.
const INJECT_FAKE_URL = process.env.INJECT_FAKE_URL === '1';

// Tallies for the honest end-of-run report.
const stats = {
  startTime: new Date(),
  pagesFetched: 0,
  cacheHits: 0,
  failedPages: 0,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheNameForBookUrl(url) {
  const parts = url.split('/').filter(Boolean);
  const slug = parts[parts.length - 2];
  return `book-${slug}.html`;
}

// A fetch error that also carries the HTTP status (if any), so callers can
// decide whether it's worth retrying.
class FetchError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// One raw fetch attempt: honest user-agent, timeout, status check.
async function fetchOnce(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
  } catch (err) {
    throw new FetchError(`Network error or timeout for ${url}: ${err.message}`, null);
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status !== 200) {
    throw new FetchError(`Fetch failed for ${url}: status ${response.status}`, response.status);
  }

  return response.text();
}

// Fetches with cache, retrying once on timeout/network error or a 5xx.
// Never retries a 404 (page does not exist) or 403 (site said no).
async function fetchWithCache(url, cacheFileName) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, cacheFileName);

  if (existsSync(cachePath)) {
    const html = readFileSync(cachePath, 'utf-8');
    console.log(`CACHE HIT ${url} (${html.length} bytes)`);
    stats.cacheHits++;
    return { html, fromCache: true };
  }

  try {
    const html = await fetchOnce(url);
    writeFileSync(cachePath, html, 'utf-8');
    console.log(`FETCH ${url} (${html.length} bytes)`);
    stats.pagesFetched++;
    return { html, fromCache: false };
  } catch (err) {
    const isRetryable = err.status === undefined || err.status === null || err.status >= 500;

    if (!isRetryable) {
      throw err; // 404/403 - do not retry, this is a real answer, not a glitch.
    }

    console.log(`RETRY ${url} (${err.message})`);
    await sleep(1000);

    const html = await fetchOnce(url); // let a second failure propagate up
    writeFileSync(cachePath, html, 'utf-8');
    console.log(`FETCH ${url} (${html.length} bytes)`);
    stats.pagesFetched++;
    return { html, fromCache: false };
  }
}

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

  let uniqueUrls = [...new Set(bookUrls)];

  if (INJECT_FAKE_URL) {
    uniqueUrls = [
      ...uniqueUrls,
      'https://books.toscrape.com/catalogue/this-book-does-not-exist_9999/index.html',
    ];
    console.log('INJECT_FAKE_URL is on: added one made-up book URL for testing.');
  }

  console.log(`catalogue_pages=${MAX_PAGES}`);
  console.log(`discovered=${bookUrls.length}`);
  console.log(`unique_urls=${uniqueUrls.length}`);

  return uniqueUrls;
}

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

// Fetches and extracts every book. One broken page is logged and skipped -
// it never takes the whole run down.
async function extractAllBooks(bookUrls) {
  const records = [];
  const failures = [];

  for (const bookUrl of bookUrls) {
    const cacheFileName = cacheNameForBookUrl(bookUrl);

    try {
      const { html, fromCache } = await fetchWithCache(bookUrl, cacheFileName);
      const record = extractRawRecord(html, bookUrl, bookUrl);
      records.push(record);

      if (!fromCache) {
        await sleep(POLITE_DELAY_MS);
      }
    } catch (err) {
      console.log(`SKIP ${bookUrl} (${err.message})`);
      stats.failedPages++;
      failures.push({ url: bookUrl, reason: err.message });
    }
  }

  console.log(`detail_pages=${records.length}`);
  return { records, failures };
}

async function main() {
  const bookUrls = await discoverCataloguePages();
  const { records: rawRecords, failures } = await extractAllBooks(bookUrls);

  const normalizedRecords = rawRecords.map(normalizeRecord);
  const { valid, invalid } = validateRecords(normalizedRecords);

  mkdirSync('output', { recursive: true });
  writeFileSync('output/books.json', JSON.stringify(valid, null, 2), 'utf-8');
  writeFileSync('output/errors.json', JSON.stringify(invalid, null, 2), 'utf-8');

  console.log(`valid_records=${valid.length}`);
  console.log(`invalid_records=${invalid.length}`);

  const endTime = new Date();
  const runReport = {
    start_time: stats.startTime.toISOString(),
    end_time: endTime.toISOString(),
    duration_ms: endTime - stats.startTime,
    pages_fetched: stats.pagesFetched,
    cache_hits: stats.cacheHits,
    valid_records: valid.length,
    invalid_records: invalid.length,
    failed_pages: stats.failedPages,
    failures,
  };

  writeFileSync('output/run-report.json', JSON.stringify(runReport, null, 2), 'utf-8');
  console.log(`failed_pages=${stats.failedPages}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});