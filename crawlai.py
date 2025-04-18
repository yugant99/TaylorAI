import time
import json
import datetime
from firecrawl import FirecrawlApp

# Initialize the Firecrawl app with your API key
app = FirecrawlApp(api_key="fc-9de23a8c60b14fd5874ece1c1028d909")

# Job search URLs to crawl
urls = [
    "https://www.glassdoor.ca/Job/toronto-data-scientist-jobs-SRCH_IL.0,7_IC2281069_KO8,22.htm",
    "https://wellfound.com/location/toronto",
    "https://www.linkedin.com/jobs/data-scientist-jobs-toronto-on/?originalSubdomain=ca",
    "https://ca.indeed.com/q-data-scientist-l-toronto,-on-jobs.html"
]

def crawl_job_site(url):
    print(f"\n\nStarting crawl for: {url}")
    
    try:
        # Start the crawl with parameters based on the documentation
        crawl_response = app.crawl_url(
            url,
            params={
                'limit': 3,  # Maximum number of pages to crawl
                'maxDepth': 2,  # Crawl up to 2 levels deep
                'scrapeOptions': {
                    'formats': ['markdown', 'links'],  # Get content as markdown and extract links
                    'onlyMainContent': False,  # Get the full page content
                    'waitFor': 5000  # Wait 5 seconds for dynamic content to load
                }
            },
            poll_interval=30  # Check status every 30 seconds
        )
        
        print(f"Crawl response: {json.dumps(crawl_response, indent=2)[:500]}...")
        
        # Check if the crawl was successful
        if crawl_response.get('status') == 'completed':
            print("Crawl completed successfully")
            
            # The data should be directly in the response
            # Return the entire response for saving
            return crawl_response
        else:
            print(f"Crawl failed or is still in progress. Status: {crawl_response.get('status')}")
            return None
            
    except Exception as e:
        print(f"Error crawling {url}: {e}")
        return None

def main():
    results = {}
    
    for i, url in enumerate(urls):
        try:
            if i > 0:
                # Wait 70 seconds between crawls to respect rate limits
                print(f"Waiting 70 seconds before starting the next crawl...")
                time.sleep(70)
            
            print(f"Starting crawl for {url}")
            data = crawl_job_site(url)
            
            if data:
                # Extract just the relevant parts to save space
                results[url] = {
                    'status': data.get('status'),
                    'data': data.get('data', [])
                }
                
                # Print some basic info about what we found
                page_count = len(data.get('data', []))
                print(f"Retrieved {page_count} pages for {url}")
            
        except Exception as e:
            print(f"Error in main loop for {url}: {e}")
    
    # Print summary of results
    print("\n\n===== SUMMARY =====")
    for url, data in results.items():
        page_count = len(data.get('data', []))
        print(f"{url}: {page_count} pages crawled")
    
    # Save results to JSON file
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"job_listings_{timestamp}.json"
    
    # Only save if we have results
    if results and any(len(data.get('data', [])) > 0 for data in results.values()):
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\nResults saved to {filename}")
    else:
        print("\nNo data to save in the results.")
        
        # Save the raw results for debugging
        debug_filename = f"debug_raw_results_{timestamp}.json"
        with open(debug_filename, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"Empty or minimal results saved to {debug_filename} for debugging")

if __name__ == "__main__":
    main()