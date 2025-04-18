import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENAI_API_KEY"),
)

def clean_description(raw_text, model="deepseek/deepseek-chat-v3-0324:free"):
    prompt = f"""
You are a smart job listing parser.

From the messy text below, extract ONLY a clear and concise job description.
Remove unrelated content like navigation menus, footers, social links, blogs, team bios, or other jobs.

Return ONLY the cleaned-up job description as plain text. Do not include any extra formatting.

### RAW TEXT STARTS:
{raw_text.strip()[:6000]}
"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print("❌ Failed to clean description:", e)
        return raw_text

if __name__ == "__main__":
    INPUT = "results/extracted_jobs_full.json"
    OUTPUT = "results/extracted_jobs_cleaned.json"

    with open(INPUT, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("🧼 Cleaning extracted job descriptions...")
    for job in data.get("included", []):
        if job.get("description"):
            job["description"] = clean_description(job["description"])

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        print(f"\n💾 Cleaned descriptions saved to: {OUTPUT}")
