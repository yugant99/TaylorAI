import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'

export interface Job {
  id: string
  title: string
  company: string
  location: string
  salary_min?: number
  salary_max?: number
  currency?: string
  employment_type?: string
  work_arrangement?: string
  tech_skills?: string[]
  soft_skills?: string[]
  experience_level?: string
  responsibilities?: string[]
  qualifications?: string[]
  source_url?: string
  scraped_at?: string
}

interface JobCardProps {
  job: Job
  checked: boolean
  onChange: (checked: boolean) => void
}

export default function JobCard({ job, checked, onChange }: JobCardProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

  // Format salary range if available
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

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      
      // Check if user has a resume
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ 
          title: "Not signed in", 
          description: "Please sign in first." 
        });
        router.push('/login');
        return;
      }
      
      const { data: profile } = await supabase
        .from('users')
        .select('resume_url')
        .eq('id', user.id)
        .single();
      
      if (!profile?.resume_url) {
        toast({ 
          title: "Resume required", 
          description: "Please upload your resume in your profile first." 
        });
        router.push('/profile');
        return;
      }
      
      // Call the Supabase Edge Function to generate the cover letter
      const { data, error } = await supabase.functions.invoke('generate-letter', {
        body: { jobId: job.id }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      toast({ 
        title: "Cover letter generated", 
        description: "Your cover letter is ready to view." 
      });
      
      // Navigate to the letters page
      router.push('/letters');
    } catch (error: any) {
      toast({ 
        title: "Generation failed", 
        description: error.message || "An error occurred while generating your cover letter." 
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h2 className="font-semibold text-lg">{job.title}</h2>
          <div className="text-gray-600">{job.company}</div>
          <div className="text-gray-500 text-sm">{job.location}</div>
          {formatSalary() && <div className="text-gray-700 mt-1">{formatSalary()}</div>}
        </div>
        <div>
          <input
            type="checkbox" 
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="h-5 w-5"
          />
        </div>
      </div>
      
      {/* Job details */}
      <div className="mt-2 text-sm">
        {job.employment_type && <span className="inline-block bg-gray-100 px-2 py-1 rounded text-xs mr-2 mb-2">{job.employment_type}</span>}
        {job.work_arrangement && <span className="inline-block bg-gray-100 px-2 py-1 rounded text-xs mr-2 mb-2">{job.work_arrangement}</span>}
        {job.experience_level && <span className="inline-block bg-gray-100 px-2 py-1 rounded text-xs mr-2 mb-2">{job.experience_level}</span>}
      </div>
      
      {/* Skills */}
      {job.tech_skills && job.tech_skills.length > 0 && (
        <div className="mt-2">
          <div className="text-xs font-medium text-gray-500 mb-1">Technical Skills:</div>
          <div className="flex flex-wrap">
            {job.tech_skills.slice(0, 5).map((skill, i) => (
              <span key={i} className="inline-block bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs mr-2 mb-1">{skill}</span>
            ))}
            {job.tech_skills.length > 5 && <span className="inline-block px-2 py-1 text-xs">+{job.tech_skills.length - 5} more</span>}
          </div>
        </div>
      )}
      
      <div className="mt-3 flex justify-between items-center">
        <div className="text-xs text-gray-400">
          {job.scraped_at && `Added: ${new Date(job.scraped_at).toLocaleDateString()}`}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate Cover Letter"}
        </button>
      </div>
    </div>
  )
}