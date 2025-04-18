import json
import re
import logging
import datetime
import os
from dotenv import load_dotenv
import openai

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("indeed_parser.log"),
        logging.StreamHandler()
    ]
)

# Load API key
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY not found.")

client = openai.OpenAI(
    api_key=api_key,
    base_url="https://openrouter.ai/api/v1",
    default_headers={
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "Indeed Extractor"
    }
)

MODEL = "meta-llama/llama-4-scout:free"
INPUT_FILE = "job_listings_20250415_171223.json"
OUTPUT_FILE = "indeed_structured_jobs.json"

SYSTEM_PROMPT = """You are an expert at extracting structured information from job listings.
Always return valid JSON with this schema. Fill missing values with \"Not Available\" or null:

{
  "title": "Job title",
  "company": "Company name",
  "location": "City, Province, or Remote",
  "salary_range": { "min": number or null, "max": number or null, "currency": "USD/CAD/etc" },
  "employment_type": "Full-time/Part-time/Contract/etc",
  "work_arrangement": "Remote/Hybrid/On-site",
  "skills": {
    "technical": ["List of technical skills or Not Available"],
    "soft": ["List of soft skills or Not Available"]
  },
  "experience": {
    "years": number or null,
    "level": "Entry/Mid/Senior/etc or Not Available"
  },
  "responsibilities": ["List of responsibilities or Not Available"],
  "qualifications": {
    "required": ["List of required qualifications or Not Available"],
    "preferred": ["List of preferred qualifications or Not Available"]
  }
}
Return only valid JSON with no extra text.
"""

def call_llm(prompt):
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ]
        )
        content = response.choices[0].message.content.strip()
        if "```" in content:
            content = re.search(r'```(?:json)?(.*?)```', content, re.DOTALL)
            if content:
                content = content.group(1).strip()
        return json.loads(content)
    except Exception as e:
        logging.error(f"❌ LLM call failed: {e}")
        return None

def extract_indeed_jobs(markdown):
    logging.info("🔍 Extracting jobs from Indeed")
    job_chunks = []

    # Table row format: | ## [Job Title](url) ... |
    table_rows = re.findall(r'\|\s*##\s*\[(.*?)\](.*?)\|\s*\|', markdown, re.DOTALL)
    if table_rows:
        logging.info(f"📄 Found {len(table_rows)} table-style listings")
        for title, content in table_rows:
            job_text = f"## [{title}]{content}"
            job_chunks.append(job_text)

    logging.info(f"✅ Extracted {len(job_chunks)} Indeed job chunks")
    return job_chunks

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    extracted_jobs = []
    for website_key, website_data in raw_data.items():
        if "indeed" not in website_key.lower() or website_data.get("status") != "completed":
            continue

        for page_data in website_data.get("data", []):
            markdown = page_data.get("markdown", "")
            metadata = page_data.get("metadata", {})

            job_chunks = extract_indeed_jobs(markdown)
            for chunk in job_chunks:
                prompt = f"Extract job information from this listing:\n\n{chunk}"
                structured = call_llm(prompt)

                if structured:
                    structured["source"] = {
                        "website": website_key,
                        "original_url": metadata.get("url", ""),
                        "extraction_date": datetime.datetime.now().isoformat()
                    }
                    extracted_jobs.append(structured)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(extracted_jobs, f, indent=2)
    logging.info(f"🟢 Saved {len(extracted_jobs)} jobs to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
