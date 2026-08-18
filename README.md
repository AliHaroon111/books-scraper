# Books Scraper

FlyRank Internship · Backend Track · W5 · A9 — The polite scraper.

A small, polite scraping pipeline that downloads the first three catalogue pages of
[Books to Scrape](https://books.toscrape.com), visits all 60 book pages, and turns the HTML
into clean, schema-validated JSON.

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