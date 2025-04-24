#!/bin/bash

# Create .env.local with Supabase environment variables
cat > .env.local << EOL
# Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=https://jgwhkcmwltcorjktwatu.supabase.co
# Replace this with your actual anon key from the Supabase dashboard
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnd2hrY213bHRjb3Jqa3R3YXR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxMDI1NzAsImV4cCI6MjA2MDY3ODU3MH0.Wd0jXKBgQXLu6O2SsQhj3ysHcwE4JzBxP8v1bKWkQF0
EOL

echo "Created .env.local with Supabase environment variables"
echo "Please check the NEXT_PUBLIC_SUPABASE_ANON_KEY value and update it if necessary"
echo "You can find your anon key in the Supabase dashboard under Project Settings > API"
