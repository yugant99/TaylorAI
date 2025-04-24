"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/Toast";
import { User } from "@supabase/supabase-js";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");

      setUser(user);
      setUserId(user.id);

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setFullName(data.full_name || "");
        setResumeUrl(data.resume_url || null);
      }

      setLoading(false);
    }

    loadProfile();
  }, [router]);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !userId) return;

    const file = e.target.files[0];
    setSelectedFileName(file.name);
    setFileError(null);
    setUploadSuccess(false);

    const ext = file.name.split('.').pop()?.toLowerCase();
    const valid = ['pdf', 'doc', 'docx', 'txt'];
    if (!ext || !valid.includes(ext)) return setFileError("Allowed: PDF, DOC, DOCX, TXT");

    if (file.size > 5 * 1024 * 1024) return setFileError("Max file size: 5MB");

    setUploading(true);
    // Store in private bucket with user ID as folder path for organization
    const filePath = `${userId}/${file.name}`;

    try {
      // Upload file to Supabase Storage (private bucket)
      const { error: uploadError } = await supabase
        .storage.from("resumes")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Get a signed URL with limited time access (24 hours)
      // This ensures the file remains private but accessible when needed
      const { data, error: urlError } = await supabase
        .storage.from("resumes")
        .createSignedUrl(filePath, 86400); // 24 hours in seconds
      if (urlError || !data?.signedUrl) throw urlError || new Error("Failed to get URL");

      const signedUrl = data.signedUrl;

      // Store the URL in the user profile
      const { error: updateError } = await supabase
        .from("users")
        .upsert({ 
          id: userId, 
          full_name: fullName, 
          resume_url: signedUrl,
          resume_filename: file.name, // Store filename for display purposes
          resume_path: filePath // Store path for future reference
        });
      if (updateError) throw updateError;

      setResumeUrl(signedUrl);
      setUploadSuccess(true);
      toast({ title: "Resume Uploaded", description: "Successfully saved to your profile." });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message || "Unexpected error." });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!userId) return;
    setUploading(true);
    
    try {
      // If there's a selected file that hasn't been uploaded yet, upload it first
      if (selectedFileName && !resumeUrl && document.getElementById('resume-upload')) {
        const fileInput = document.getElementById('resume-upload') as HTMLInputElement;
        if (fileInput?.files && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          const filePath = `${userId}/${file.name}`;
          
          // Upload file to Supabase Storage
          const { error: uploadError } = await supabase
            .storage.from("resumes")
            .upload(filePath, file, { upsert: true });
          if (uploadError) throw uploadError;
          
          // Get signed URL
          const { data, error: urlError } = await supabase
            .storage.from("resumes")
            .createSignedUrl(filePath, 86400);
          if (urlError || !data?.signedUrl) throw urlError || new Error("Failed to get URL");
          
          // Update resumeUrl with the signed URL
          setResumeUrl(data.signedUrl);
          setUploadSuccess(true);
          
          // Update user profile with all information
          const { error: updateError } = await supabase
            .from("users")
            .upsert({ 
              id: userId, 
              full_name: fullName, 
              resume_url: data.signedUrl,
              resume_filename: file.name,
              resume_path: filePath
            });
          if (updateError) throw updateError;
          
          toast({ title: "Profile & Resume Saved", description: "Your profile and resume were saved successfully." });
        }
      } else {
        // Just update the name if no new file is selected
        const { error } = await supabase
          .from("users")
          .upsert({ id: userId, full_name: fullName, resume_url: resumeUrl });
        if (error) throw error;
        toast({ title: "Profile Saved", description: "Your profile was updated." });
      }
      
      // Redirect to jobs page after successful save
      setTimeout(() => {
        router.push("/jobs");
      }, 1000); // Short delay to show the success message
      
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const uploadedView = (
    <div className="max-w-md mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-4">
        {uploadSuccess ? "Resume Uploaded!" : "Resume Already Uploaded"}
      </h2>
      <p className="text-sm mb-4 text-gray-600">
        {uploadSuccess ? `Your file "${selectedFileName}" is uploaded.` : "You're ready to apply."}
      </p>

      <div className="bg-gray-100 p-4 rounded mb-4">
        <p className="text-sm mb-1 font-medium">Resume:</p>
        <a href={resumeUrl!} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm flex items-center">
          <span>View Resume</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
        </a>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => router.push("/jobs")}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center"
        >
          <span>Proceed to Jobs</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        
        <div className="border-t pt-3 mt-3">
          <button
            onClick={() => router.push("/jobs")}
            className="w-full py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 text-sm"
          >
            Skip to Jobs
          </button>
        </div>
      </div>
    </div>
  );

  if (resumeUrl || uploadSuccess) return uploadedView;

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded shadow mt-10">
      <h1 className="text-2xl font-bold mb-4">Complete Your Profile</h1>
      <p className="text-gray-600 mb-4">Upload your resume to get started with job applications</p>
      
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            type="text"
            className="w-full border px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Upload Resume</label>
          <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center hover:border-blue-500 transition-colors">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleResumeUpload}
              disabled={uploading}
              className="w-full"
              id="resume-upload"
            />
            {uploading && (
              <div className="flex items-center justify-center mt-2">
                <svg className="animate-spin h-5 w-5 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Uploading...</span>
              </div>
            )}
            {selectedFileName && !uploading && !fileError && (
              <div className="mt-2 text-sm text-gray-700 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {selectedFileName}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Accepted formats: PDF, DOC, DOCX, TXT (max 5MB)
            </p>
            {fileError && <p className="text-red-600 text-sm mt-1">{fileError}</p>}
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleUpdateProfile}
            disabled={uploading || !fullName.trim()}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
          >
            {uploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                Save Profile & Continue to Jobs
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </>
            )}
          </button>
        </div>
        
        <div className="border-t pt-3 mt-3">
          <p className="text-center text-xs text-gray-500 mb-2">Not ready to upload your resume yet?</p>
          <button
            onClick={() => router.push("/jobs")}
            className="w-full py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 text-sm"
          >
            Skip to Jobs
          </button>
        </div>
      </div>
    </div>
  );
}
