"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Job } from "@/components/JobCard";
import { toast } from "@/components/ui/Toast";

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;
  
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function fetchJob() {
      if (!jobId) return;
      
      try {
        const { data, error } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", jobId)
          .single();
        
        if (error) throw error;
        if (data) setJob(data);
      } catch (error: any) {
        console.error("Error fetching job:", error.message);
        toast({ 
          title: "Error", 
          description: "Failed to load job details. Please try again." 
        });
      } finally {
        setLoading(false);
      }
    }
    
    fetchJob();
  }, [jobId]);

  const handleGenerateCoverLetter = async () => {
    try {
      setGenerating(true);
      
      // Create a CoverLetterGenerator component with just this job
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !job) {
        toast({ 
          title: "Error", 
          description: "You must be logged in and have a job selected to generate a cover letter." 
        });
        return;
      }
      
      // Get the user's profile with resume and cover letter text
      const { data: profile } = await supabase
        .from('users')
        .select('resume_text,cover_letter_text')
        .eq('id', user.id)
        .single();
      
      if (!profile?.resume_text) {
        toast({ 
          title: "Missing Resume", 
          description: "Please upload your resume in the profile section first." 
        });
        return;
      }
      
      // Call the API to generate a cover letter
      const response = await fetch('/api/generate_cover_letters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobs: [job],
          tone: 'formal',
          style: 'narrative',
          resume: profile.resume_text,
          cover_letter: profile.cover_letter_text || ''
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate cover letter');
      }
      
      const data = await response.json();
      
      if (data.letters && data.letters.length > 0) {
        // Save the generated cover letter to the database
        const { error } = await supabase
          .from('generated_letters')
          .insert({
            user_id: user.id,
            job_id: job.id,
            cover_letter_md: data.letters[0],
          });
          
        if (error) {
          console.error('Error saving cover letter:', error);
          throw new Error('Failed to save the generated cover letter');
        }
        
        // Redirect to the letters page
        toast({ 
          title: "Success!", 
          description: "Your cover letter has been generated." 
        });
        
        router.push('/letters');
      } else {
        throw new Error('No cover letter was generated');
      }
    } catch (error: any) {
      console.error('Error generating cover letter:', error);
      toast({ 
        title: "Generation Failed", 
        description: error.message || "An error occurred while generating your cover letter." 
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-32 bg-gray-200 rounded mb-6"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Job Not Found</h1>
          <p className="text-gray-600 mb-6">The job you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => router.push("/jobs")}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  // Format salary if available
  const formatSalary = () => {
    if (job.salary_min || job.salary_max) {
      const min = job.salary_min ? `${job.currency || '$'}${job.salary_min.toLocaleString()}` : '';
      const max = job.salary_max ? `${job.currency || '$'}${job.salary_max.toLocaleString()}` : '';
      
      if (min && max) {
        return `${min} - ${max}`;
      } else {
        return min || max;
      }
    }
    return null;
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button
        onClick={() => router.push("/jobs")}
        className="flex items-center text-blue-600 mb-6 hover:underline"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to Jobs
      </button>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{job.title}</h1>
          <div className="text-xl text-gray-600 mb-1">{job.company}</div>
          <div className="text-gray-500">{job.location}</div>
          {formatSalary() && (
            <div className="text-gray-700 font-medium mt-2">{formatSalary()}</div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 mb-6">
          {job.employment_type && (
            <span className="bg-gray-100 px-3 py-1 rounded-full text-sm">{job.employment_type}</span>
          )}
          {job.work_arrangement && (
            <span className="bg-gray-100 px-3 py-1 rounded-full text-sm">{job.work_arrangement}</span>
          )}
          {job.experience_level && (
            <span className="bg-gray-100 px-3 py-1 rounded-full text-sm">{job.experience_level}</span>
          )}
        </div>
        
        {/* Technical Skills */}
        {job.tech_skills && job.tech_skills.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Technical Skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.tech_skills.map((skill, index) => (
                <span key={index} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Soft Skills */}
        {job.soft_skills && job.soft_skills.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Soft Skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.soft_skills.map((skill, index) => (
                <span key={index} className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Responsibilities */}
        {job.responsibilities && job.responsibilities.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              {job.responsibilities.map((item, index) => (
                <li key={index} className="text-gray-700">{item}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Qualifications */}
        {job.qualifications && job.qualifications.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Qualifications</h2>
            <ul className="list-disc pl-5 space-y-1">
              {job.qualifications.map((item, index) => (
                <li key={index} className="text-gray-700">{item}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Source URL */}
        {job.source_url && (
          <div className="mb-8">
            <a 
              href={job.source_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center"
            >
              View Original Job Posting
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
            </a>
          </div>
        )}
        
        {/* Generate Cover Letter Button */}
        <div className="mt-8">
          <button
            onClick={handleGenerateCoverLetter}
            disabled={generating}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-md shadow-sm disabled:opacity-50 flex items-center justify-center"
          >
            {generating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              <>
                Generate Cover Letter
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
