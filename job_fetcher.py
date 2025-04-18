import os
import json

def load_job_posting(path: str) -> str:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Job post file not found: {path}")
    
    if path.endswith(".txt"):
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    
    elif path.endswith(".json"):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("description", "")
    
    else:
        raise ValueError("Unsupported file type. Use .txt or .json")

# For quick test
if __name__ == "__main__":
    job_text = load_job_posting("sample_job.txt")
    print(job_text[:500])
