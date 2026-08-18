// FlyRank Internship - Backend Track - W5 - A9 - The polite scraper
// Stage 1: fetch once, cache once.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const CACHE_DIR = 'cache';
const USER_AGENT = 'FlyRankInternshipA9/1.0 (+https://github.com/YOUR_USERNAME/books-scraper)';
const TIMEOUT_MS = 8000;

// Fetches a URL politely: honest user-agent, timeout, status check.
// Reads from cache if we already saved this page before.
async function fetchWithCache(url, cacheFileName) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, cacheFileName);

  if (existsSync(cachePath)) {
    const html = readFileSync(cachePath, 'utf-8');
    console.log(`CACHE HIT ${url} (${html.length} bytes)`);
    return html;
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
  return html;
}

async function main() {
  const catalogueUrl = 'https://books.toscrape.com/catalogue/page-1.html';
  await fetchWithCache(catalogueUrl, 'catalogue-page-1.html');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});