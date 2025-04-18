import os
import json
import requests
from pathlib import Path
from hashlib import sha256

# Your SerpAPI key (safe to keep it here for testing, but store in env for prod)
SERPAPI_KEY = "85b049f0260260a65c0f42bc22dd331bfa1664d5b33b5affabc314503f0a50fa"

# Directory for caching queries
CACHE_DIR = "cache"
os.makedirs(CACHE_DIR, exist_ok=True)

def generate_cache_key(query: str):
    return sha256(query.encode()).hexdigest()

def search_contacts(query: str):
    # Generate a cache filename from the query hash
    cache_file = Path(CACHE_DIR) / f"{generate_cache_key(query)}.json"
    
    # Return from cache if exists
    if cache_file.exists():
        print(f"✅ Loaded from cache: {cache_file.name}")
        with open(cache_file, "r") as f:
            return json.load(f)

    # SerpAPI request
    print("🔍 Fetching from SerpAPI...")
    url = "https://serpapi.com/search.json"
    params = {
        "q": query,
        "engine": "google",
        "api_key": SERPAPI_KEY,
        "num": 10,
    }
    response = requests.get(url, params=params)
    data = response.json()

    # Save to cache
    with open(cache_file, "w") as f:
        json.dump(data, f, indent=2)
    print(f"💾 Saved to cache: {cache_file.name}")
    
    return data

def extract_contacts(data):
    results = []
    for result in data.get("organic_results", [])[:5]:
        title = result.get("title")
        link = result.get("link")
        snippet = result.get("snippet", "")
        results.append({
            "name": title,
            "linkedin": link,
            "summary": snippet
        })
    return results

if __name__ == "__main__":
    query = '"CEO" "Toronto" "OpenBook"'
    raw_data = search_contacts(query)
    contacts = extract_contacts(raw_data)

    print("\n📇 Top Contacts:")
    for c in contacts:
        print(f"- {c['name']}")
        print(f"  ↳ {c['linkedin']}")
        print(f"  📝 {c['summary']}\n")
