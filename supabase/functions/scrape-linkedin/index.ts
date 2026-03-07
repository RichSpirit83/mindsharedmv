const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || !url.includes('linkedin.com/in/')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid LinkedIn profile URL is required (linkedin.com/in/...)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract username from LinkedIn URL
    const usernameMatch = url.match(/linkedin\.com\/in\/([^/?#]+)/);
    const username = usernameMatch?.[1] || '';
    const searchName = username.replace(/-/g, ' ');

    console.log('Searching for LinkedIn profile:', searchName);

    // Use Firecrawl search to find profile info (LinkedIn direct scrape is blocked)
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `"${searchName}" linkedin site:linkedin.com/in/${username}`,
        limit: 3,
        scrapeOptions: { formats: ['markdown'] },
      }),
    });

    const searchData = await response.json();

    if (!response.ok) {
      console.error('Firecrawl search error:', searchData);
      return new Response(
        JSON.stringify({ success: false, error: searchData.error || `Search failed: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Combine search results to extract profile info
    const results = searchData.data || searchData.results || [];
    const allText = results.map((r: any) => `${r.title || ''} ${r.description || ''} ${r.markdown || ''}`).join('\n');

    // Extract name from first result title (usually "FirstName LastName - Title | LinkedIn")
    const firstTitle = results[0]?.title || '';
    const nameMatch = firstTitle.match(/^(.*?)(?:\s*[-–|])/);
    let name = nameMatch?.[1]?.trim() || '';
    // Fallback: capitalize the username
    if (!name) {
      name = searchName.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // Extract headline from first result description
    const headline = results[0]?.description?.split('.')?.[0]?.trim() || '';

    // Extract expertise keywords
    const expertiseKeywords: string[] = [];
    const patterns = [
      /(?:SaaS|B2B|B2C|HealthTech|FinTech|EdTech|GovTech|DeepTech|AI|ML|Cybersecurity|IoT|Blockchain|PropTech|CleanTech|AgriTech|InsurTech|LegalTech|MarTech|HRTech|RegTech)/gi,
      /(?:Series [A-F]|Seed|Pre-seed|Growth|Scale)/gi,
      /(?:GTM|Go-to-Market|Fundraising|Product|Engineering|Sales|Marketing|Operations|Strategy|Consulting|Venture Capital|Private Equity|Angel|Advisor)/gi,
    ];
    for (const pattern of patterns) {
      const matches = allText.match(pattern) || [];
      expertiseKeywords.push(...matches.map((m: string) => m.trim()));
    }
    const uniqueTags = [...new Set(expertiseKeywords.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)))].slice(0, 8);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          name,
          expertiseTags: uniqueTags,
          networkStrengths: headline,
          notes: `LinkedIn: ${url}\n\n${headline}`,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to look up profile' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
