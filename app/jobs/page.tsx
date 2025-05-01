"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import JobCard, { Job } from "@/components/JobCard";
import SelectionDrawer from "@/components/SelectionDrawer";
import CoverLetterGenerator from "@/components/CoverLetterGenerator";
import { toast } from "@/components/ui/Toast";

interface Selection {
  job_id: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  // Load jobs
  useEffect(() => {
    let mounted = true;
    supabase
      .from("jobs")
      .select()
      .limit(50)
      .then(({ data, error }) => {
        if (mounted) {
          if (data) setJobs(data);
          if (error) console.error("Error loading jobs:", error.message);
          setLoading(false);
        }
      })
      
    return () => {
      mounted = false;
    };
  }, []);

  // Load previous selections
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("user_job_selections")
        .select("job_id")
        .eq("user_id", user.id)
        .then(({ data }) => {
          if (data) {
            const sel: Record<string, boolean> = {};
            data.forEach((row: Selection) => {
              sel[row.job_id] = true;
            });
            setSelected(sel);
          }
        });
    });
  }, []);

  const handleSelect = (jobId: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [jobId]: checked }));
  };

  const handleSave = async () => {
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      toast({ title: "Not signed in", description: "Please sign in first." });
      setSaving(false);
      return;
    }
    const selectedIds = Object.entries(selected)
      .filter(([_, v]) => v)
      .map(([k]) => k);
    if (selectedIds.length === 0) {
      toast({ title: "No jobs selected" });
      setSaving(false);
      return;
    }
    const upserts = selectedIds.map((job_id) => ({ job_id, user_id: user.id }));
    const { error } = await supabase.from("user_job_selections").upsert(upserts, { onConflict: "user_id,job_id" });
    setSaving(false);
    if (!error) {
      toast({ title: "Selections saved", description: `Saved ${selectedIds.length} jobs.` });
    } else {
      toast({ title: "Error", description: error.message });
    }
  };

  const handleGenerate = () => {
    const selectedIds = Object.entries(selected)
      .filter(([_, v]) => v)
      .map(([k]) => k);
      
    if (selectedIds.length === 0) {
      toast({ title: "No jobs selected", description: "Please select at least one job." });
      return;
    }
    
    // Get the selected job objects
    const selectedJobObjects = jobs.filter(job => selected[job.id]);
    
    // Show the cover letter generator
    setShowGenerator(true);
  };

  if (loading) return <div className="p-8 text-center">Loading jobs...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 pb-32">
      <h1 className="text-2xl font-bold mb-6">Jobs</h1>
      <div className="flex flex-col gap-4">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            checked={!!selected[job.id]}
            onChange={(checked) => handleSelect(job.id, checked as boolean)}
          />
        ))}
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <SelectionDrawer
          count={Object.values(selected).filter(Boolean).length}
          onGenerate={handleGenerate}
        />
        <div className="flex justify-center mt-2 mb-4">
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded shadow disabled:opacity-50"
            onClick={handleSave}
            disabled={saving || Object.values(selected).filter(Boolean).length === 0}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      
      {showGenerator && (
        <CoverLetterGenerator
          selectedJobs={jobs.filter(job => selected[job.id])}
          onClose={() => setShowGenerator(false)}
        />
      )}
    </div>
  );
}