import json
import os
import feedparser
import asyncio
import requests
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

# === RSS FEEDS ===
RSS_FEEDS = {
    "remotive": "https://remotive.com/remote-jobs/feed",
    "jobicy": "https://jobicy.com/?feed=job_feed&search_region=canada",
    "weworkremotely": "https://weworkremotely.com/remote-jobs.rss"
}

# === FILTER SETTINGS ===
LOCATION_FILTER = "canada"

# === RSS PARSER ===
def parse_rss_feed(url, source):
    try:
        feed = feedparser.parse(url)
        jobs = []

        if source == "jobicy":
            # Parse raw XML to extract <job_listing:company>
            response = requests.get(url)
            soup = BeautifulSoup(response.text, "xml")
            items = soup.find_all("item")

            for i, entry in enumerate(feed.entries):
                try:
                    company_tag = next(tag for tag in items[i].find_all() if tag.name.endswith("company"))
                    company = company_tag.text.strip()
                except Exception:
                    company = "Unknown Company"

                job = {
                    "title": entry.get("title", "Unknown Title"),
                    "company": company,
                    "url": entry.get("link", ""),
                    "published": entry.get("published", ""),
                    "description": entry.get("summary", ""),
                    "location": entry.get("location", ""),
                    "source": source
                }
                jobs.append(job)

        else:
            for entry in feed.entries:
                job = {
                    "title": entry.get("title", "Unknown Title"),
                    "company": entry.get("author", "Unknown Company"),
                    "url": entry.get("link", ""),
                    "published": entry.get("published", ""),
                    "description": entry.get("summary", ""),
                    "location": entry.get("location", ""),
                    "source": source
                }
                jobs.append(job)

        return jobs

    except Exception as e:
        print(f"❌ Error parsing feed for {source}: {e}")
        return []

# === LOCATION FILTER ===
def filter_jobs(jobs, keyword="canada"):
    keyword = keyword.lower()
    kept, discarded = [], []

    for job in jobs:
        text = json.dumps(job).lower()
        if keyword in text:
            kept.append(job)
        else:
            discarded.append(job)

    return kept, discarded

# === YCOMBINATOR RAW TEXT GRABBER ===
async def grab_ycombinator_inner_text(url="https://www.ycombinator.com/jobs"):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, timeout=60000)
        await page.wait_for_timeout(3000)
        text = await page.evaluate("document.body.innerText")
        await browser.close()
    return text

# === MAIN ===
async def main():
    all_jobs = []
    report = {}

    # 1. Pull from RSS feeds
    for source, url in RSS_FEEDS.items():
        print(f"🌐 Fetching RSS: {source}")
        raw_jobs = parse_rss_feed(url, source)

        if source == "jobicy":
            kept = raw_jobs
            discarded = []
        else:
            kept, discarded = filter_jobs(raw_jobs)

        report[source] = {
            "fetched": len(raw_jobs),
            "kept": len(kept),
            "discarded": len(discarded)
        }

        all_jobs += kept

    # 2. Add raw YCombinator innerText
    print("🧠 Fetching raw innerText from YCombinator...")
    yc_text = await grab_ycombinator_inner_text()
    all_jobs.append({
        "title": "Raw YCombinator Job Dump",
        "company": "YCombinator",
        "url": "https://www.ycombinator.com/jobs",
        "description": yc_text,
        "location": "N/A",
        "source": "ycombinator_raw"
    })
    report["ycombinator"] = {"fetched": 1, "kept": 1, "discarded": 0}

    # 3. Save result
    os.makedirs("results", exist_ok=True)
    with open("results/fetched_jobs.json", "w", encoding="utf-8") as f:
        json.dump(all_jobs, f, indent=2)

    # 4. Summary
    print("\n📊 Job Source Report:")
    for source, stats in report.items():
        print(f"- {source}: {stats['fetched']} fetched → {stats['kept']} kept, {stats['discarded']} discarded")

    print(f"\n💾 Final saved jobs: {len(all_jobs)} → results/fetched_jobs.json")

if __name__ == "__main__":
    asyncio.run(main())
