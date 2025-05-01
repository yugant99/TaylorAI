import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { supabase } from '@/lib/supabase';
// Import the core module without initialization
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

// Helper to create a temp file
async function createTempFile(data: ArrayBuffer, extension: string): Promise<string> {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `temp-${Date.now()}${extension}`);
  await fs.promises.writeFile(tempFilePath, Buffer.from(data));
  return tempFilePath;
}

// Helper function to clean text and remove problematic characters
function cleanText(text: string): string {
  return text
    .replace(/\u0000/g, '') // Remove null bytes that PostgreSQL rejects
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\\u[0-9a-fA-F]{4}/g, '') // Remove Unicode escape sequences
    .trim();
}

// Helper to extract text from PDF using pdf-parse library
async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    // Read the PDF file
    const dataBuffer = await fs.promises.readFile(filePath);
    
    // Parse the PDF
    const data = await pdfParse(dataBuffer);
    
    // Clean and return the text content
    const extractedText = data.text || '';
    console.log(`Raw extracted text length: ${extractedText.length} characters`);
    
    const cleanedText = cleanText(extractedText);
    console.log(`Cleaned text length: ${cleanedText.length} characters`);
    
    return cleanedText;
  } catch (error) {
    console.error('Failed to extract text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

export async function POST(req: NextRequest) {
  try {
    const { bucket, filePath } = await req.json();
    
    if (!bucket || !filePath) {
      return NextResponse.json({ error: 'Missing bucket or filePath' }, { status: 400 });
    }
    
    // Download the file from Supabase storage
    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    
    if (error || !data) {
      console.error('Error downloading file from Supabase:', error);
      return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
    }
    
    // Convert Blob to ArrayBuffer
    const arrayBuffer = await data.arrayBuffer();
    
    // Create a temporary file
    const extension = path.extname(filePath);
    const tempFilePath = await createTempFile(arrayBuffer, extension);
    
    try {
      // Extract text from the PDF
      const extractedText = await extractTextFromPDF(tempFilePath);
      
      // Return the extracted text
      return NextResponse.json({ text: extractedText });
    } finally {
      // Clean up the temporary file
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (e) {
        console.error('Failed to delete temporary file:', e);
      }
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
