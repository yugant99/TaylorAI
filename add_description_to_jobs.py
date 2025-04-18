import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

INPUT_PATH = "results/extracted_jobs.json"
OUTPUT_PATH = "results/extracted_jobs_full.json"

async def get_description_from_url(url):
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            print(f"🌐 Fetching: {url}")
            await page.goto(url, timeout=60000)
            await page.wait_for_timeout(3000)
            text = await page.evaluate("document.body.innerText")
            await browser.close()
            return text.strip()
    except Exception as e:
        print(f"❌ Failed to fetch {url}: {e}")
        return ""

async def enrich_jobs_with_descriptions():
    if not Path(INPUT_PATH).exists():
        print(f"❌ Input file not found: {INPUT_PATH}")
        return

    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    jobs = data.get("included", [])
    for job in jobs:
        if not job.get("description") and job.get("url"):
            job["description"] = await get_description_from_url(job["url"])

    enriched = {
        "included": jobs,
        "discarded": data.get("discarded", [])
    }

    os.makedirs("results", exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(enriched, f, indent=2)
    print(f"\n💾 Saved enriched jobs to: {OUTPUT_PATH}")

if __name__ == "__main__":
    asyncio.run(enrich_jobs_with_descriptions())
