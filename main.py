import json
import os
import feedparser
import asyncio
import requests
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

# === API/RSS FEEDS ===
FEEDS = {
    "remotive": {
        "url": "https://remotive.com/remote-jobs/feed",
        "type": "rss"
    },
    "jobicy": {
        "url": "https://jobicy.com/api/v2/remote-jobs?count=50&geo=canada",
        "type": "api"
    },
    "weworkremotely": {
        "url": "https://weworkremotely.com/remote-jobs.rss",
        "type": "rss"
    }
}

# === FILTER SETTINGS ===
LOCATION_FILTER = "canada"

# === FEED PARSER ===
def parse_feed(source, feed_config):
    try:
        url = feed_config["url"]
        feed_type = feed_config["type"]
        jobs = []

        if feed_type == "api":
            # Handle API response (JSON)
            response = requests.get(url)
            data = response.json()
            
            if source == "jobicy":
                for job in data.get("jobs", []):
                    job_data = {
                        "title": job.get("jobTitle", "Unknown Title"),
                        "company": job.get("companyName", "Unknown Company"),
                        "url": job.get("url", ""),
                        "published": job.get("pubDate", ""),
                        "description": job.get("jobDescription", "") or job.get("jobExcerpt", ""),
                        "location": job.get("jobGeo", ""),
                        "source": source
                    }
                    jobs.append(job_data)
        else:
            # Handle RSS feeds
            feed = feedparser.parse(url)
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

    # 1. Pull from feeds
    for source, feed_config in FEEDS.items():
        print(f"🌐 Fetching from {source}")
        raw_jobs = parse_feed(source, feed_config)
        
        # For Jobicy API, we're already getting filtered results for Canada
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