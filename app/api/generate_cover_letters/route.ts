import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { jobs, tone, style, resume, cover_letter } = body;

    // Validate required fields
    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ error: "No jobs provided" }, { status: 400 });
    }
    
    if (!tone) {
      return NextResponse.json({ error: "Tone is required" }, { status: 400 });
    }
    
    if (!style) {
      return NextResponse.json({ error: "Style is required" }, { status: 400 });
    }
    
    if (!resume || resume.trim() === '') {
      return NextResponse.json({ error: "Resume content is required" }, { status: 400 });
    }
    
    if (!cover_letter || cover_letter.trim() === '') {
      return NextResponse.json({ error: "Cover letter content is required" }, { status: 400 });
    }

    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not set in environment variables");
      return NextResponse.json({ error: "API configuration error" }, { status: 500 });
    }
    
    const apiUrl = "https://openrouter.ai/api/v1/chat/completions";
    const letters: string[] = [];

    for (const job of jobs) {
      // Proceed even if job description is missing
      // The improved agent_brain.py will handle partial job data
      
      const prompt = `
You are an expert AI assistant specialized in writing highly personalized cover letters for job applications.

INSTRUCTIONS:
- Use the user's uploaded resume and (if available) their previous cover letter as the main reference for the candidate's background.
- If job responsibilities or requirements are not provided, make reasonable assumptions about the role based on the job title and company.
- Use the following tone: ${tone}.
- Use the following style: ${style}.
- Write a concise, professional, and impactful cover letter tailored to the provided job and company.
- Directly highlight how the candidate's experience matches the job (or your assumed) requirements.
- Do not fabricate any fake skills or experiences.
- Do not add any extra text, JSON, markdown, or formatting. Return only the plain cover letter body.

Below is the information you must use:

### RESUME:
${resume}

### PREVIOUS COVER LETTER:
${cover_letter}

### JOB DESCRIPTION:
${job.description}
`;

      try {
        console.log(`Generating cover letter for job: ${job.title} at ${job.company}`);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "deepseek/deepseek-chat-v3-0324:free",
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to generate letter:", errorText);
          letters.push(`Could not generate cover letter: API error (${response.status})`);
          continue;
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          console.error("Invalid API response format:", data);
          letters.push("Could not generate cover letter: Invalid API response");
          continue;
        }
        
        const content = data.choices[0].message.content;
        letters.push(content.trim());
        console.log(`Successfully generated cover letter for job: ${job.title}`);
        
      } catch (error) {
        console.error("Error generating letter:", error);
        letters.push("Could not generate cover letter: An error occurred");
      }
    }

    return NextResponse.json({ letters });
  } catch (error) {
    console.error("Unexpected error in cover letter generation API:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
