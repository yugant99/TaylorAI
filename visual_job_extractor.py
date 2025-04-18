import json
import os
import time
import datetime
import re
from dotenv import load_dotenv
import openai
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("job_parser.log"),
        logging.StreamHandler()
    ]
)

# Load OpenAI API key from .env
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY not found.")

client = openai.OpenAI(
    api_key=api_key,
    base_url="https://openrouter.ai/api/v1",
    default_headers={
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "Job Parser"
    }
)

MODEL = "meta-llama/llama-4-scout:free"
INPUT_FILE = "job_listings_20250415_171223.json"
OUTPUT_DIR = "processed_jobs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

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

def call_llm(prompt, max_retries=3):
    for attempt in range(max_retries):
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
            logging.warning(f"Attempt {attempt+1}/{max_retries}: Error: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
    logging.error("Failed to process job after multiple attempts")
    return None

def extract_glassdoor_jobs(markdown):
    logging.info("🔍 Extracting jobs from Glassdoor")
    job_sections = re.split(r'-\s*!\[.*?Logo\]\(.*?\)', markdown)
    job_chunks = []
    for section in job_sections:
        if len(section.strip()) < 100:
            continue
        has_job_link = re.search(r'\[.*?\]\(https://www\.glassdoor\.ca/job-listing/.*?\)', section)
        has_salary_or_skills = (
            "per hour" in section.lower() or
            "glassdoor est." in section.lower() or
            "**skills:**" in section.lower()
        )
        if has_job_link and has_salary_or_skills:
            job_chunks.append(section.strip())
    logging.info(f"✅ Extracted {len(job_chunks)} Glassdoor job chunks")
    return job_chunks

def extract_wellfound_jobs(markdown):
    logging.info("🔍 Extracting jobs from Wellfound")
    job_sections = markdown.split('[![')
    job_chunks = []

    for section in job_sections[1:]:
        job_title_matches = re.findall(r'\[(.*?)\]\(https://wellfound\.com/jobs/\d+-', section)
        if job_title_matches:
            for title in job_title_matches:
                title_pattern = re.escape(f"[{title}]")
                job_content = re.search(rf'{title_pattern}.*?(?=\[|Save|Apply|$)', section, re.DOTALL)
                if job_content:
                    job_chunks.append(f"[{title}]{job_content.group(0)}")
        else:
            if any(keyword in section for keyword in ["Remote", "salary", "Full-time"]):
                job_chunks.append(section)

    logging.info(f"✅ Extracted {len(job_chunks)} Wellfound job chunks")
    return job_chunks

def extract_indeed_jobs(markdown):
    logging.info("🔍 Extracting jobs from Indeed")
    job_chunks = []
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
    request_count = 0
    start_time = time.time()
    processed_hashes = set()

    for website_key, website_data in raw_data.items():
        if website_data.get("status") != "completed":
            logging.info(f"Skipping incomplete data for {website_key}")
            continue

        if "glassdoor" in website_key.lower():
            extractor = extract_glassdoor_jobs
        elif "wellfound" in website_key.lower():
            extractor = extract_wellfound_jobs
        elif "indeed" in website_key.lower():
            extractor = extract_indeed_jobs
        else:
            continue

        for page_index, page_data in enumerate(website_data.get("data", [])):
            markdown = page_data.get("markdown", "")
            metadata = page_data.get("metadata", {})

            if not markdown:
                logging.warning(f"No markdown in {website_key}, page {page_index+1}")
                continue

            job_chunks = extractor(markdown)

            for chunk_index, chunk in enumerate(job_chunks):
                if len(chunk) < 100:
                    continue
                chunk_hash = hash(chunk)
                if chunk_hash in processed_hashes:
                    continue
                processed_hashes.add(chunk_hash)

                current_time = time.time()
                if current_time - start_time >= 60:
                    request_count = 0
                    start_time = current_time

                if request_count >= 20:
                    sleep_time = 60 - (current_time - start_time) + 2
                    if sleep_time > 0:
                        logging.info(f"Rate limit hit. Sleeping {sleep_time:.2f}s")
                        time.sleep(sleep_time)
                        request_count = 0
                        start_time = time.time()

                prompt = f"Extract job information from this listing:\n\n{chunk}"
                structured = call_llm(prompt)
                request_count += 1

                if structured:
                    structured["source"] = {
                        "website": website_key,
                        "original_url": metadata.get("url", ""),
                        "extraction_date": datetime.datetime.now().isoformat()
                    }
                    extracted_jobs.append(structured)

                time.sleep(0.5)

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = os.path.join(OUTPUT_DIR, f"structured_jobs_{timestamp}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(extracted_jobs, f, indent=2)

    logging.info(f"🟢 Saved {len(extracted_jobs)} jobs to {out_path}")

if __name__ == "__main__":
    main()
