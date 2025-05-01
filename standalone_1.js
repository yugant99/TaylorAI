// extract-pdf.js
require('dotenv').config({ path: '.env.local' }); // Load environment variables from .env.local file
const { createClient } = require('@supabase/supabase-js');
const pdfParse = require('pdf-parse');
const fs = require('fs');

// Get environment variables directly from process.env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE; // Use service role key for admin access
const USER_ID = 'c9d4300c-7e71-427b-a2f6-351f35401169';
const RESUME_PATH = 'c9d4300c-7e71-427b-a2f6-351f35401169/resume/Resume_can_final_2.pdf';
const BUCKET = 'resumes';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function extractPdfText() {
  try {
    console.log(`Downloading PDF from ${BUCKET}/${RESUME_PATH}...`);
    
    // Download the file from Supabase storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from(BUCKET)
      .download(RESUME_PATH);
    
    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      return;
    }
    
    console.log('File downloaded successfully!');
    
    // Save file locally for inspection (optional)
    fs.writeFileSync('downloaded_resume.pdf', Buffer.from(await fileData.arrayBuffer()));
    console.log('PDF saved to downloaded_resume.pdf for inspection');
    
    // Extract text from PDF
    try {
      console.log('Extracting text from PDF...');
      const pdfData = await pdfParse(Buffer.from(await fileData.arrayBuffer()));
      
      console.log('\n--- EXTRACTED TEXT PREVIEW ---');
      console.log(pdfData.text.substring(0, 500) + '...');
      console.log(`\nTotal text length: ${pdfData.text.length} characters`);
      
      // Save extracted text to a file
      fs.writeFileSync('extracted_text.txt', pdfData.text);
      console.log('Full text saved to extracted_text.txt');
      
      // Clean the text to remove problematic characters
      function cleanText(text) {
        // Replace null bytes and other problematic characters
        return text
          .replace(/\u0000/g, '') // Remove null bytes
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
          .replace(/\\u[0-9a-fA-F]{4}/g, '') // Remove Unicode escape sequences
          .trim();
      }
      
      // Update the database with extracted text (optional)
      if (pdfData.text) {
        
        console.log('Cleaning extracted text...');
        const cleanedText = cleanText(pdfData.text);
        console.log(`Text cleaned. New length: ${cleanedText.length} characters`);
        
        console.log('Updating resume_text in database...');
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ resume_text: cleanedText })
          .eq('id', USER_ID);
        
        if (updateError) {
          console.error('Error updating database:', updateError);
        } else {
          console.log('Database updated successfully!');
        }
      }
    } catch (parseError) {
      console.error('Error parsing PDF:', parseError);
      
      // Try alternative extraction if primary method fails
      console.log('Attempting alternative extraction method...');
      // Implement alternative extraction here
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the extraction
extractPdfText();
