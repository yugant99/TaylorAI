import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENAI_API_KEY"),
)

def ask_agent(resume_text, job_text, model="deepseek-coder:3"):
    prompt = f"""
You are a career assistant AI.

Using the resume and job description below, write a short, tailored cover letter that highlights the candidate's strengths and enthusiasm.
Avoid generic fluff. Focus on how the resume aligns with the job.

Return only the cover letter as plain text. No JSON formatting.

### RESUME:
{resume_text}

### JOB DESCRIPTION:
{job_text}
"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return {"cover_letter": response.choices[0].message.content.strip()}
    except Exception as e:
        print("API Status Code:", getattr(e, 'status_code', 'N/A'))
        print("❌ Agent failed:", str(e))
        return None
