import React, { useState, useEffect } from 'react';
import { Job } from './JobCard';
import { supabase } from '@/lib/supabase';

interface CoverLetter {
  jobId: string;
  jobTitle: string;
  company: string;
  content: string;
}

interface CoverLetterGeneratorProps {
  selectedJobs: Job[];
  onClose: () => void;
}

export default function CoverLetterGenerator({ selectedJobs, onClose }: CoverLetterGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLetters, setGeneratedLetters] = useState<CoverLetter[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<string>('formal');
  const [selectedStyle, setSelectedStyle] = useState<string>('narrative');
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<string>('');
  const [coverLetter, setCoverLetter] = useState<string>('');
  const [resumeLoading, setResumeLoading] = useState<boolean>(true);
  const [loadingStatus, setLoadingStatus] = useState<string>('Initializing...');
  const [extractionAttempts, setExtractionAttempts] = useState({
    resume: 0,
    coverLetter: 0
  });

  const toneOptions = [
    { value: 'casual', label: 'Casual' },
    { value: 'formal', label: 'Formal' },
    { value: 'confident', label: 'Confident' },
    { value: 'persuasive', label: 'Persuasive' }
  ];

  const styleOptions = [
    { value: 'narrative', label: 'Narrative' },
    { value: 'bullet-point', label: 'Bullet Points' },
    { value: 'hybrid', label: 'Hybrid' }
  ];

  // Helper function to clean text and remove problematic characters
  const cleanText = (text: string): string => {
    if (!text) return '';
    
    return text
      .replace(/\u0000/g, '') // Remove null bytes that PostgreSQL rejects
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\\u[0-9a-fA-F]{4}/g, '') // Remove Unicode escape sequences
      .trim();
  };

  // Extract text from PDF or other document
  const extractTextFromFile = async (bucket: string, filePath: string): Promise<string> => {
    try {
      console.log(`Extracting text from ${bucket}/${filePath}`);
      setLoadingStatus(`Extracting text from ${bucket.replace(/s$/, '')}...`);
      
      const response = await fetch('/api/extract_pdf_text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bucket, filePath }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Text extraction API error (${response.status}):`, errorText);
        throw new Error(`Failed to extract text: ${response.status}`);
      }

      const data = await response.json();
      if (!data.text) {
        console.warn('Text extraction returned empty result');
        return '';
      }
      
      // The API should already clean the text, but we'll do it again here as a safeguard
      const extractedText = data.text;
      console.log(`Successfully extracted ${extractedText.length} characters from ${bucket}/${filePath}`);
      
      // Additional cleaning step before saving to database
      const cleanedText = cleanText(extractedText);
      console.log(`Text cleaned. Original: ${extractedText.length} chars, Cleaned: ${cleanedText.length} chars`);
      
      // Save the extracted text to the database
      if (bucket === 'resumes' || bucket === 'coverletters') {
        try {
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData?.user?.id;
          
          if (userId) {
            const field = bucket === 'resumes' ? 'resume_text' : 'cover_letter_text';
            console.log(`Updating ${field} in database for user ${userId}`);
            
            // Use the cleaned text for database update
            const { error: updateError } = await supabase
              .from('users')
              .update({ [field]: cleanedText })
              .eq('id', userId);
              
            if (updateError) {
              console.error(`Failed to update ${field} in database:`, updateError);
            } else {
              console.log(`Successfully updated ${field} in database`);
            }
          }
        } catch (saveError) {
          console.error('Error saving extracted text to database:', saveError);
        }
      }
      
      return cleanedText;
    } catch (error) {
      console.error('Error in text extraction:', error);
      return '';
    }
  };

  useEffect(() => {
    let mounted = true;
    setResumeLoading(true);
    setLoadingStatus('Loading your profile...');

    (async () => {
      try {
        // Get the current user
        const { data: authData, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('❌ Error fetching user:', userError);
          setError('Failed to authenticate user. Please try logging in again.');
          setResumeLoading(false);
          return;
        }

        const user = authData?.user;
        
        if (!user) {
          console.log('No user found, please log in');
          setError('No user found. Please log in to continue.');
          setResumeLoading(false);
          return;
        }

        console.log('User found with ID:', user.id);
        setLoadingStatus('Loading documents...');
        
        // Fetch user profile including the extracted text content
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('❌ Error fetching profile:', profileError);
          setError('Failed to load your profile data. Please try again.');
          setResumeLoading(false);
          return;
        }

        if (!profile) {
          console.error('❌ No profile data found');
          setError('No profile data found. Please upload your resume and cover letter first.');
          setResumeLoading(false);
          return;
        }

        console.log('Full profile data:', profile);
        
        // Check and handle resume text
        let resumeText = profile.resume_text || '';
        if ((!resumeText || resumeText.trim() === '') && profile.resume_path) {
          setLoadingStatus('Extracting resume text...');
          console.log('Resume text not found in database, extracting from file...');
          
          setExtractionAttempts(prev => ({...prev, resume: prev.resume + 1}));
          
          if (!profile.resume_path) {
            console.error('Cannot extract resume text: No file path available');
            setError('Resume file not found. Please upload your resume again.');
          } else {
            resumeText = await extractTextFromFile('resumes', profile.resume_path);
          }
        }
        
        // Check and handle cover letter text
        let coverLetterText = profile.cover_letter_text || '';
        if ((!coverLetterText || coverLetterText.trim() === '') && profile.cover_letter_path) {
          setLoadingStatus('Extracting cover letter text...');
          console.log('Cover letter text not found in database, extracting from file...');
          
          setExtractionAttempts(prev => ({...prev, coverLetter: prev.coverLetter + 1}));
          
          if (!profile.cover_letter_path) {
            console.error('Cannot extract cover letter text: No file path available');
            setError('Cover letter file not found. Please upload your cover letter again.');
          } else {
            coverLetterText = await extractTextFromFile('coverletters', profile.cover_letter_path);
          }
        }

        if (mounted) {
          setResume(resumeText);
          setCoverLetter(coverLetterText);
          setResumeLoading(false);
          setLoadingStatus('');
          
          // Log for debugging
          console.log('Resume text loaded:', resumeText ? `${resumeText.substring(0, 100)}...` : 'None');
          console.log('Cover letter text loaded:', coverLetterText ? `${coverLetterText.substring(0, 100)}...` : 'None');
          
          // Show warning if texts are still missing
          if (!resumeText.trim()) {
            console.warn('Warning: Resume text is still empty after extraction attempt');
            setError('Could not extract text from your resume. Please try uploading it again in a different format.');
          }
          
          if (!coverLetterText.trim()) {
            console.warn('Warning: Cover letter text is still empty after extraction attempt');
            setError('Could not extract text from your cover letter. Please try uploading it again in a different format.');
          }
        }
      } catch (err) {
        console.error('❌ Unexpected error:', err);
        setError('An unexpected error occurred. Please try again.');
        setResumeLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (generatedLetters.length > 0 && !activeTab) {
      setActiveTab(generatedLetters[0].jobId);
    }
  }, [generatedLetters, activeTab]);

  const generateCoverLetters = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Double-check if we have resume and cover letter text
      if (!resume.trim()) {
        setError('Resume text is missing. Please upload your resume again.');
        setIsLoading(false);
        return;
      }

      if (!coverLetter.trim()) {
        setError('Cover letter text is missing. Please upload your cover letter again.');
        setIsLoading(false);
        return;
      }

      console.log('Generating cover letters with:');
      console.log('- Resume text length:', resume.trim().length);
      console.log('- Cover letter text length:', coverLetter.trim().length);
      console.log('- Selected jobs:', selectedJobs.length);
      console.log('- Tone:', selectedTone);
      console.log('- Style:', selectedStyle);

      setLoadingStatus('Sending request to AI model...');
      
      const response = await fetch('/api/generate_cover_letters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobs: selectedJobs,
          tone: selectedTone,
          style: selectedStyle,
          resume: resume.trim(),
          cover_letter: coverLetter.trim(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Failed to generate cover letters');
        } catch (parseError) {
          throw new Error(`Failed to generate cover letters: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('API response data:', data);

      if (!data.letters || !Array.isArray(data.letters)) {
        throw new Error('Invalid response format from API');
      }

      const newLetters: CoverLetter[] = selectedJobs.map((job, index) => ({
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        content: data.letters[index] || 'Failed to generate cover letter for this job.',
      }));

      setGeneratedLetters(newLetters);

      const initialEditedContent: Record<string, string> = {};
      selectedJobs.forEach((job, index) => {
        initialEditedContent[job.id] = data.letters[index] || '';
      });
      setEditedContent(initialEditedContent);

      if (selectedJobs.length > 0) {
        setActiveTab(selectedJobs[0].id);
      }
    } catch (err) {
      console.error('❌ Error generating cover letters:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const handleContentChange = (jobId: string, content: string) => {
    setEditedContent((prev: Record<string, string>) => ({
      ...prev,
      [jobId]: content
    }));
  };

  const downloadCoverLetter = (jobId: string) => {
    const letter = generatedLetters.find(l => l.jobId === jobId);
    if (!letter) return;

    const content = editedContent[jobId] || letter.content;
    const fileName = `Cover_Letter_${letter.company.replace(/\s+/g, '_')}_${letter.jobTitle.replace(/\s+/g, '_')}.txt`;

    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Cover Letter Generator</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {!generatedLetters.length ? (
          <div className="p-6 flex-1 overflow-auto">
            {loadingStatus && (
              <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {loadingStatus}
              </div>
            )}
            
            {/* Resume and Cover Letter Status */}
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className={`p-3 rounded border ${resume.trim() ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <h3 className="font-medium">Resume</h3>
                <p className="text-sm text-gray-600">
                  {resume.trim() 
                    ? `${resume.length} characters loaded` 
                    : extractionAttempts.resume > 0 
                      ? 'Failed to extract text. Please upload again.' 
                      : 'Loading...'}
                </p>
              </div>
              
              <div className={`p-3 rounded border ${coverLetter.trim() ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <h3 className="font-medium">Cover Letter</h3>
                <p className="text-sm text-gray-600">
                  {coverLetter.trim() 
                    ? `${coverLetter.length} characters loaded` 
                    : extractionAttempts.coverLetter > 0 
                      ? 'Failed to extract text. Please upload again.' 
                      : 'Loading...'}
                </p>
              </div>
            </div>
            
            {/* tone and style selectors */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Tone</h3>
              <div className="flex flex-wrap gap-2">
                {toneOptions.map(tone => (
                  <button key={tone.value} onClick={() => setSelectedTone(tone.value)}
                    className={`px-4 py-2 rounded-full ${selectedTone === tone.value ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                    {tone.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Style</h3>
              <div className="flex flex-wrap gap-2">
                {styleOptions.map(style => (
                  <button key={style.value} onClick={() => setSelectedStyle(style.value)}
                    className={`px-4 py-2 rounded-full ${selectedStyle === style.value ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* errors */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                {error}
              </div>
            )}

            <div className="mt-6">
              <button 
                onClick={generateCoverLetters} 
                disabled={isLoading || resumeLoading || !resume.trim() || !coverLetter.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center"
              >
                {isLoading && (
                  <svg className="animate-spin mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isLoading ? 'Generating...' : 'Generate Cover Letters'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* tabbed cover letters */}
            <div className="border-b">
              <div className="flex overflow-x-auto">
                {generatedLetters.map((letter, idx) => (
                  <button key={letter.jobId || idx} onClick={() => setActiveTab(letter.jobId)}
                    className={`px-4 py-3 whitespace-nowrap ${activeTab === letter.jobId ? 'border-b-2 border-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {letter.company} - {letter.jobTitle}
                  </button>
                ))}
              </div>
            </div>

            {/* editor */}
            <div className="p-4 flex-1 overflow-auto">
              {activeTab && (
                <textarea
                  value={editedContent[activeTab] || ''}
                  onChange={(e) => handleContentChange(activeTab, e.target.value)}
                  className="flex-1 w-full h-[calc(100vh-300px)] p-3 border rounded resize-none font-mono text-sm"
                  placeholder="Cover letter content will appear here"
                />
              )}
              <div className="mt-4 flex justify-between">
                <button 
                  onClick={() => downloadCoverLetter(activeTab!)}
                  disabled={!activeTab || !editedContent[activeTab!]}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  Download Cover Letter
                </button>
                <button
                  onClick={() => {
                    setGeneratedLetters([]);
                    setActiveTab(null);
                    setEditedContent({});
                  }}
                  className="text-gray-600 hover:text-gray-800 px-4 py-2"
                >
                  Generate New Letters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
