import pdfplumber
import os

def load_resume_text(resume_path: str) -> str:
    if not os.path.exists(resume_path):
        raise FileNotFoundError(f"Resume file not found at: {resume_path}")
    
    text = ""
    with pdfplumber.open(resume_path) as pdf:
        for page in pdf.pages:
            text += page.extract_text() + "\n"

    # Optional cleaning
    text = text.replace('\u200b', '').strip()
    return text

# For quick test
if __name__ == "__main__":
    path = "/Users/yuganthareshsoni/Downloads/Taylorai - Agent/Resume_can_final_2.pdf"
    resume_text = load_resume_text(path)
    print(resume_text[:500])  # print first 500 chars to confirm
