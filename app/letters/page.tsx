"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/Toast";

interface Letter {
  id: string;
  job_id: string;
  user_id: string;
  cover_letter_md: string;
  created_at: string;
  job?: {
    title: string;
    company: string;
  };
}

export default function LettersPage() {
  const router = useRouter();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadLetters() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.replace("/login");
        return;
      }
      
      const { data, error } = await supabase
        .from("generated_letters")
        .select(`
          *,
          job:jobs(title, company)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) {
        toast({ 
          title: "Error loading letters", 
          description: error.message 
        });
      } else {
        setLetters(data || []);
      }
      
      setLoading(false);
    }
    
    loadLetters();
  }, [router]);

  const handleSelectLetter = (letter: Letter) => {
    setSelectedLetter(letter);
    setEditedContent(letter.cover_letter_md);
  };

  const handleSaveLetter = async () => {
    if (!selectedLetter) return;
    
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from("generated_letters")
        .update({ cover_letter_md: editedContent })
        .eq("id", selectedLetter.id);
      
      if (error) throw error;
      
      // Update local state
      setLetters(letters.map(letter => 
        letter.id === selectedLetter.id 
          ? { ...letter, cover_letter_md: editedContent } 
          : letter
      ));
      
      setSelectedLetter({ ...selectedLetter, cover_letter_md: editedContent });
      
      toast({ 
        title: "Letter saved", 
        description: "Your cover letter has been updated." 
      });
    } catch (error: any) {
      toast({ 
        title: "Save failed", 
        description: error.message || "An error occurred while saving." 
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse">Loading cover letters...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Your Cover Letters</h1>
      
      {letters.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">You haven't generated any cover letters yet.</p>
          <button
            onClick={() => router.push("/jobs")}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Browse Jobs
          </button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Letter list */}
          <div className="md:w-1/3">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="font-semibold mb-3">Generated Letters</h2>
              <div className="space-y-2">
                {letters.map((letter) => (
                  <div 
                    key={letter.id}
                    className={`p-3 rounded cursor-pointer transition-colors ${
                      selectedLetter?.id === letter.id 
                        ? "bg-blue-100 border-l-4 border-blue-500" 
                        : "bg-white hover:bg-gray-100"
                    }`}
                    onClick={() => handleSelectLetter(letter)}
                  >
                    <div className="font-medium">{letter.job?.title || "Untitled Position"}</div>
                    <div className="text-sm text-gray-600">{letter.job?.company || "Unknown Company"}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(letter.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Letter editor */}
          <div className="md:w-2/3">
            {selectedLetter ? (
              <div className="bg-white border rounded-lg shadow-sm">
                <div className="border-b p-4">
                  <h2 className="font-semibold">
                    {selectedLetter.job?.title || "Untitled Position"} at {selectedLetter.job?.company || "Unknown Company"}
                  </h2>
                  <div className="text-sm text-gray-500">
                    Created on {new Date(selectedLetter.created_at).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="p-4">
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full h-64 p-3 border rounded font-mono text-sm"
                    placeholder="Cover letter content..."
                  />
                </div>
                
                <div className="border-t p-4 flex justify-between">
                  <button
                    onClick={() => setEditedContent(selectedLetter.cover_letter_md)}
                    className="px-4 py-2 text-gray-700 border rounded"
                    disabled={saving}
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleSaveLetter}
                    className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                    disabled={saving || editedContent === selectedLetter.cover_letter_md}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center bg-gray-50 rounded-lg p-8 text-gray-500">
                Select a letter to view and edit
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="mt-8 text-center">
        <button
          onClick={() => router.push("/jobs")}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded"
        >
          Back to Jobs
        </button>
      </div>
    </div>
  );
}
