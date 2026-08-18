// FlyRank Internship - Backend Track - W5 - A9 - The polite scraper
// Stage 2: discover all three catalogue pages and every book link on them.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const CACHE_DIR = 'cache';
const USER_AGENT = 'FlyRankInternshipA9/1.0 (+https://github.com/YOUR_USERNAME/books-scraper)';
const TIMEOUT_MS = 8000;
const POLITE_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetches a URL politely: honest user-agent, timeout, status check.
// Reads from cache if we already saved this page before.
// Returns { html, fromCache } so the caller knows whether to apply the polite delay.
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

// Walks the catalogue starting at page 1, following the site's own "next" link,
// collecting every absolute book URL along the way.
async function discoverCataloguePages() {
  const bookUrls = [];
  let pageUrl = 'https://books.toscrape.com/catalogue/page-1.html';
  let pageNumber = 1;

  const MAX_PAGES = 3;

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

    // Only wait between real network requests - cached pages never left our computer.
    if (!fromCache && pageUrl) {
      await sleep(POLITE_DELAY_MS);
    }

    pageNumber++;
  }

  const uniqueUrls = [...new Set(bookUrls)];

  console.log(`catalogue_pages=${pageNumber - 1}`);
  console.log(`discovered=${bookUrls.length}`);
  console.log(`unique_urls=${uniqueUrls.length}`);

  return uniqueUrls;
}

async function main() {
  await discoverCataloguePages();
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});