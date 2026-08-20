# Books Scraper

FlyRank Internship · Backend Track · W5 · A9 — The polite scraper.

A small, polite scraping pipeline that downloads the first three catalogue pages of
[Books to Scrape](https://books.toscrape.com), visits all 60 book pages, and turns the HTML
into clean, schema-validated JSON — surviving a broken page without crashing, and reporting
exactly what happened on every run.

## Target classification

- **Site:** https://books.toscrape.com
- **Why this site:** it is a public sandbox site, explicitly built and hosted by ToScrape so
  people can practice web scraping on it without touching a real business's data or servers.
- **Scope:** the first 3 catalogue pages only (60 unique books), nothing beyond that.
- **Data collected:** title, product URL, price, availability, star rating, description,
  source page, and fetch timestamp — all fields already present in the page's own HTML.
- **robots.txt result:** `https://books.toscrape.com/robots.txt` returns **404 Not Found**
  (nginx/1.21.6) — no robots file exists on this site. A missing file is not the same as
  explicit permission; it just means there are no automated crawling rules published. Given
  the site's own stated purpose as a scraping sandbox, proceeding is appropriate here, but this
  is a decision made for this specific site, not a general rule.

I will not reuse this code on another site without checking its rules and terms first.

## Stack

- Node.js (ES modules)
- Cheerio for HTML parsing
- Zod for schema validation
- Built-in `fetch` and `fs` — no other dependencies

## Setup & run

```bash
git clone <this-repo-url>
cd books-scraper
npm install
npm start
```

One command (`npm start`) runs the whole pipeline: fetch → extract → normalize → validate →
store → report. Output lands in `output/books.json`, `output/errors.json`, and
`output/run-report.json`.

## Record schema

Every record in `output/books.json` has these fields (enforced by `src/schema.js` with Zod):

| Field | Type | Notes |
|---|---|---|
| `title` | string | |
| `product_url` | string (URL) | canonical identity — deduplication key |
| `price_text` | string | raw text as scraped, e.g. `"£51.77"` |
| `price_gbp` | number | cleaned numeric price, e.g. `51.77` |
| `availability_text` | string | |
| `rating_text` | string \| null | e.g. `"Three"` |
| `description` | string \| null | `null` when the book has none — never invented |
| `source_page` | string (URL) | provenance — where this fact came from |
| `fetched_at` | string (ISO datetime) | provenance — when it was fetched |

A record that fails validation is never stored in `books.json` — it goes to
`output/errors.json` with the reason instead.

## Politeness rules

- **User-agent:** every request identifies itself as `FlyRankInternshipA9/1.0` with a link back
  to this repo.
- **Timeout:** every request gives up after 8 seconds rather than hanging forever.
- **Delay:** at least 500ms between real requests to the site. Cached pages incur no delay —
  they never leave the machine.
- **Cache:** every page fetched is saved to `cache/` (git-ignored) and reused on subsequent
  runs, so the real site is only ever hit once per page during development.
- **Retry rules:** a timeout, network error, or `5xx` is retried once. A `404` or `403` is
  never retried — the site has already given a real answer.

## Idempotency

Records are deduplicated by their canonical `product_url`. Running the scraper twice produces
the same 60 records, not 120.

## Failure handling

Each page is fetched independently; one broken page is logged and skipped without taking down
the rest of the run. Proven with a deliberately injected fake URL — see below.

## Sample run report

```json
{
  "start_time": "2026-08-20T01:22:27.828Z",
  "end_time": "2026-08-20T01:22:28.758Z",
  "duration_ms": 930,
  "pages_fetched": 0,
  "cache_hits": 63,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0,
  "failures": []
}
```
<!-- Replace the block above with your own real output/run-report.json content. -->

## No browser needed

This assignment needed no browser at all — the book data (title, price, description, etc.) is
already present directly in the HTML the server sends on first response. A browser would only
add startup cost and memory overhead to render and execute JavaScript that isn't doing anything
here; a plain HTTP request already receives the complete page.

## Ethics note

Use an official API when one exists instead of scraping. Never bypass logins, paywalls, rate
limits, or explicit blocks. Collect only the data actually needed for the task, and identify
yourself honestly with a real, reachable user-agent so a site owner can always find out who is
requesting their pages.