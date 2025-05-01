import React, { useState } from 'react'
import CoverLetterGenerator from './CoverLetterGenerator';
import { toast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation';

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
  const [showGenerator, setShowGenerator] = useState(false);
  const [generating, setGenerating] = useState(false);
  const router = useRouter();

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

  const handleGenerate = () => {
    setShowGenerator(true);
  };

  const navigateToJobDetail = () => {
    router.push(`/jobs/${job.id}`);
  };

  return (
    <div className="bg-white p-4 rounded shadow hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex justify-between items-start mb-3">
        <div onClick={navigateToJobDetail}>
          <h2 className="font-semibold text-lg text-blue-700 hover:underline">{job.title}</h2>
          <div className="text-gray-600">{job.company}</div>
          <div className="text-gray-500 text-sm">{job.location}</div>
          {formatSalary() && <div className="text-gray-700 mt-1">{formatSalary()}</div>}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox" 
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="h-5 w-5"
          />
        </div>
      </div>
      
      {/* Job details */}
      <div className="mt-2 text-sm" onClick={navigateToJobDetail}>
        {job.employment_type && <span className="inline-block bg-gray-100 px-2 py-1 rounded text-xs mr-2 mb-2">{job.employment_type}</span>}
        {job.work_arrangement && <span className="inline-block bg-gray-100 px-2 py-1 rounded text-xs mr-2 mb-2">{job.work_arrangement}</span>}
        {job.experience_level && <span className="inline-block bg-gray-100 px-2 py-1 rounded text-xs mr-2 mb-2">{job.experience_level}</span>}
      </div>
      
      {/* Skills */}
      {job.tech_skills && job.tech_skills.length > 0 && (
        <div className="mt-2" onClick={navigateToJobDetail}>
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
        <div className="text-xs text-gray-400" onClick={navigateToJobDetail}>
          {job.scraped_at && `Added: ${new Date(job.scraped_at).toLocaleDateString()}`}
        </div>
        <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigateToJobDetail();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded"
          >
            View Details
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleGenerate();
            }}
            className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded"
          >
            Generate Letter
          </button>
        </div>
      </div>
      {showGenerator && (
        <CoverLetterGenerator
          selectedJobs={[job]}
          onClose={() => setShowGenerator(false)}
        />
      )}
    </div>
  )
}