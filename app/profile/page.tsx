"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Profile() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [coverLetterPath, setCoverLetterPath] = useState<string | null>(null);
  const [coverLetterUrl, setCoverLetterUrl] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState<string>(""); // Added state for resume text content
  const [coverLetterText, setCoverLetterText] = useState<string>(""); // Added state for cover letter text content
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [coverLetterSuccess, setCoverLetterSuccess] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedCoverLetterName, setSelectedCoverLetterName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractingText, setExtractingText] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  // Helper function to clean text and remove problematic characters
  const cleanText = (text: string): string => {
    if (!text) return '';
    
    return text
      .replace(/\u0000/g, '') // Remove null bytes that PostgreSQL rejects
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\\u[0-9a-fA-F]{4}/g, '') // Remove Unicode escape sequences
      .trim();
  };

  // Extract text from PDF using our API endpoint
  const extractTextFromPDF = async (bucket: string, filePath: string): Promise<string> => {
    try {
      setExtractingText(true);
      console.log(`Extracting text from ${bucket}/${filePath}`);
      
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
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Failed to extract text from PDF');
        } catch (e) {
          throw new Error(`Failed to extract text: ${response.status}`);
        }
      }

      const data = await response.json();
      const extractedText = data.text || '';
      console.log(`Successfully extracted ${extractedText.length} characters`);
      
      // Additional cleaning step as a safeguard
      const cleanedText = cleanText(extractedText);
      console.log(`Text cleaned. Original: ${extractedText.length} chars, Cleaned: ${cleanedText.length} chars`);
      
      return cleanedText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      return '';
    } finally {
      setExtractingText(false);
    }
  };

  // 🔥 refresh user profile from database with debugging
  const refreshProfile = async () => {
    if (!userId) return;
    console.log("Refreshing profile for user:", userId);

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    console.log("Profile data:", data);
    console.log("Profile error:", error);

    if (data) {
      setResumeUrl(data.resume_url || null);
      setCoverLetterPath(data.cover_letter_path || null);
      setCoverLetterUrl(data.cover_letter_url || null);
      setResumeText(data.resume_text || '');
      setCoverLetterText(data.cover_letter_text || '');
      
      if (data.resume_filename) setSelectedFileName(data.resume_filename);
      if (data.cover_letter_filename) setSelectedCoverLetterName(data.cover_letter_filename);
      
      console.log("Updated state with resume URL:", data.resume_url);
      console.log("Updated state with cover letter path:", data.cover_letter_path);
      console.log("Updated state with cover letter URL:", data.cover_letter_url);
      console.log("Updated state with resume text:", data.resume_text ? `${data.resume_text.substring(0, 100)}...` : 'None');
      console.log("Updated state with cover letter text:", data.cover_letter_text ? `${data.cover_letter_text.substring(0, 100)}...` : 'None');
      console.log("Updated state with resume filename:", data.resume_filename);
      console.log("Updated state with cover letter filename:", data.cover_letter_filename);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      console.log("Fetching initial profile data");
      
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (!user) {
        console.log("No user found, redirecting to login");
        router.push("/login");
        return;
      }
      
      console.log("User found:", user.id);
      setUserId(user.id);

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      console.log("Initial profile data:", data);
      console.log("Initial profile error:", error);

      if (data) {
        setFullName(data.full_name || "");
        setResumeUrl(data.resume_url || null);
        setCoverLetterPath(data.cover_letter_path || null);
        setCoverLetterUrl(data.cover_letter_url || null); // Added this line
        
        if (data.resume_filename) setSelectedFileName(data.resume_filename);
        if (data.cover_letter_filename) setSelectedCoverLetterName(data.cover_letter_filename);
      }
    };

    fetchProfile();
  }, []);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setError(null);
      const file = e.target.files?.[0];
      if (!file || !userId) {
        setUploading(false);
        return;
      }

      console.log("Uploading resume:", file.name);
      const filePath = `${userId}/resume/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: signedData } = await supabase.storage
        .from("resumes")
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);

      if (signedData?.signedUrl) {
        console.log("Generated signed URL for resume:", signedData.signedUrl);
        
        // Extract text from the uploaded PDF
        console.log("Extracting text from resume PDF...");
        const extractedText = await extractTextFromPDF("resumes", filePath);
        console.log(`Extracted ${extractedText.length} characters from resume`);
        
        // First check if the user exists in the database
        const { data: existingUser } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();
        
        console.log("Existing user data:", existingUser);
        
        // Try a different approach - first check if user exists, then update or insert accordingly
        const { data: existingUserCheck, error: checkError } = await supabase
          .from("users")
          .select("id")
          .eq("id", userId);
          
        console.log("Check if user exists:", existingUserCheck, checkError);
        
        let dbOperation;
        const basicUserData = {
          full_name: fullName,
          resume_filename: file.name,
          resume_path: filePath,
          resume_url: signedData.signedUrl
        };
        
        // Try to update without the resume_text field first
        if (existingUserCheck && existingUserCheck.length > 0) {
          console.log("User exists, updating basic fields first");
          dbOperation = await supabase
            .from("users")
            .update(basicUserData)
            .eq("id", userId);
        } else {
          console.log("User doesn't exist, inserting new record with basic fields");
          dbOperation = await supabase
            .from("users")
            .insert({
              id: userId,
              ...basicUserData
            });
        }
        
        console.log("Basic user data operation:", dbOperation);
        
        // Now try to update just the resume_text field separately
        console.log("Now trying to update resume_text field separately");
        try {
          const { data, error } = await supabase
            .from("users")
            .update({ resume_text: extractedText })
            .eq("id", userId);
            
          console.log("Resume text update response:", data);
          console.log("Resume text update error:", error);
          
          if (error) {
            console.error("Failed to save resume_text to database:", error);
            console.log("Continuing anyway since basic user data was saved");
          }
        } catch (updateError) {
          console.error("Exception updating resume_text:", updateError);
          console.log("Continuing anyway since basic user data was saved");
        }

        setResumeText(extractedText);
        setUploadSuccess(true);
        await refreshProfile(); // 🔥 refresh after upload
      }
    } catch (err: any) {
      console.error("Resume upload error:", err);
      setError("Resume upload failed. " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCoverLetterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setError(null);
      const file = e.target.files?.[0];
      if (!file || !userId) {
        setUploading(false);
        return;
      }

      console.log("Uploading cover letter:", file.name);
      const filePath = `${userId}/coverletter/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("coverletters")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: signedData } = await supabase.storage
        .from("coverletters")
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);

      if (signedData?.signedUrl) {
        console.log("Generated signed URL for cover letter:", signedData.signedUrl);
        
        // Extract text from the uploaded PDF
        console.log("Extracting text from cover letter PDF...");
        const extractedText = await extractTextFromPDF("coverletters", filePath);
        console.log(`Extracted ${extractedText.length} characters from cover letter`);
        
        // First check if the user exists in the database
        const { data: existingUser } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();
        
        console.log("Existing user data:", existingUser);
        
        // Try a different approach - first check if user exists, then update or insert accordingly
        const { data: existingUserCheck, error: checkError } = await supabase
          .from("users")
          .select("id")
          .eq("id", userId);
          
        console.log("Check if user exists:", existingUserCheck, checkError);
        
        let dbOperation;
        const basicUserData = {
          full_name: fullName,
          cover_letter_filename: file.name,
          cover_letter_path: filePath,
          cover_letter_url: signedData.signedUrl
        };
        
        // Try to update without the cover_letter_text field first
        if (existingUserCheck && existingUserCheck.length > 0) {
          console.log("User exists, updating basic fields first");
          dbOperation = await supabase
            .from("users")
            .update(basicUserData)
            .eq("id", userId);
        } else {
          console.log("User doesn't exist, inserting new record with basic fields");
          dbOperation = await supabase
            .from("users")
            .insert({
              id: userId,
              ...basicUserData
            });
        }
        
        console.log("Basic user data operation:", dbOperation);
        
        // Now try to update just the cover_letter_text field separately
        console.log("Now trying to update cover_letter_text field separately");
        try {
          const { data, error } = await supabase
            .from("users")
            .update({ cover_letter_text: extractedText })
            .eq("id", userId);
            
          console.log("Cover letter text update response:", data);
          console.log("Cover letter text update error:", error);
          
          if (error) {
            console.error("Failed to save cover_letter_text to database:", error);
            console.log("Continuing anyway since basic user data was saved");
          }
        } catch (updateError) {
          console.error("Exception updating cover_letter_text:", updateError);
          console.log("Continuing anyway since basic user data was saved");
        }

        setCoverLetterText(extractedText);
        setCoverLetterSuccess(true);
        await refreshProfile(); // 🔥 refresh after upload
      }
    } catch (err: any) {
      console.error("Cover letter upload error:", err);
      setError("Cover letter upload failed. " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    router.push("/jobs");
  };

  // ✅ Updated uploads completed check to use coverLetterUrl
  const uploadsCompleted = (resumeUrl || uploadSuccess) && (coverLetterUrl || coverLetterSuccess);
  console.log("Upload status check:", {
    resumeUrl,
    uploadSuccess,
    coverLetterUrl,
    coverLetterSuccess,
    uploadsCompleted
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">Complete Your Profile</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-medium">Full Name</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="block font-medium">Upload Resume</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleResumeUpload}
              disabled={uploading}
            />
            {selectedFileName && <p className="text-sm mt-1">{selectedFileName}</p>}
          </div>

          <div>
            <label className="block font-medium">Upload Cover Letter</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleCoverLetterUpload}
              disabled={uploading}
            />
            {selectedCoverLetterName && (
              <p className="text-sm mt-1">
                {selectedCoverLetterName}
                {!coverLetterUrl && " (URL not saved)"}
              </p>
            )}
          </div>

          {error && <div className="text-red-600">{error}</div>}

          <button
            type="submit"
            disabled={uploading || !fullName.trim() || !uploadsCompleted}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded disabled:opacity-50 w-full"
          >
            {uploading ? "Uploading..." : "Continue to Jobs"}
          </button>
        </form>
      </div>
    </div>
  );
}
