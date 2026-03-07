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
    const username = usernameMatch?.[1]?.replace(/\/$/, '') || '';
    const searchName = username.replace(/-/g, ' ');

    console.log('Looking up LinkedIn profile for:', username);

    // Run two searches in parallel for richer data
    const [linkedinSearch, webSearch] = await Promise.all([
      // Search 1: Find the LinkedIn listing itself
      fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `"${searchName}" site:linkedin.com/in/${username}`,
          limit: 3,
        }),
      }).then(r => r.json()),
      // Search 2: Find broader web presence (bio, articles, company info)
      fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `"${searchName}" founder CEO advisor investor biography`,
          limit: 5,
          scrapeOptions: { formats: ['markdown'] },
        }),
      }).then(r => r.json()),
    ]);

    console.log('LinkedIn search results:', JSON.stringify(linkedinSearch).slice(0, 500));
    console.log('Web search results:', JSON.stringify(webSearch).slice(0, 500));

    // Combine all text from both searches
    const linkedinResults = linkedinSearch.data || linkedinSearch.results || [];
    const webResults = webSearch.data || webSearch.results || [];

    // Extract name from LinkedIn result title (e.g. "Adeleke Adesida - CEO at Company | LinkedIn")
    const linkedinTitle = linkedinResults[0]?.title || '';
    const linkedinDesc = linkedinResults[0]?.description || '';
    const nameMatch = linkedinTitle.match(/^(.*?)(?:\s*[-–|])/);
    let name = nameMatch?.[1]?.trim() || '';
    if (!name) {
      name = searchName.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // Extract headline/role from LinkedIn description
    // LinkedIn descriptions typically look like: "Title at Company. Location. Summary..."
    const headline = linkedinDesc.split(/\.\s/)?.[0]?.trim() || linkedinDesc.slice(0, 150).trim() || '';

    // Gather all text for keyword extraction
    const allTexts = [
      linkedinTitle, linkedinDesc,
      ...linkedinResults.map((r: any) => `${r.title || ''} ${r.description || ''}`),
      ...webResults.map((r: any) => `${r.title || ''} ${r.description || ''} ${r.markdown || ''}`),
    ].join('\n');

    // Extract expertise keywords
    const tags = new Set<string>();
    const patterns: [RegExp, (m: string) => string][] = [
      [/\b(?:SaaS|B2B|B2C|HealthTech|FinTech|EdTech|GovTech|DeepTech|PropTech|CleanTech|AgriTech|InsurTech|LegalTech|MarTech|HRTech|RegTech|BioTech|MedTech|FoodTech)\b/gi, (m) => m],
      [/\b(?:AI|ML|Machine Learning|Artificial Intelligence|Cybersecurity|IoT|Blockchain|Cloud|Data Science|Analytics)\b/gi, (m) => m],
      [/\b(?:Series [A-F]|Seed|Pre-seed|Growth Stage|Scale-up)\b/gi, (m) => m],
      [/\b(?:GTM|Go-to-Market|Fundraising|Product Management|Engineering|Sales Leadership|Marketing|Operations|Strategy|Consulting)\b/gi, (m) => m],
      [/\b(?:Venture Capital|Private Equity|Angel Investor?|Board Member|Advisor|Mentor|Founder|Co-founder|CEO|CTO|COO|CFO|CMO|CPO|VP|Director)\b/gi, (m) => m],
    ];

    for (const [pattern, transform] of patterns) {
      const matches = allTexts.match(pattern) || [];
      for (const m of matches) {
        const tag = transform(m.trim());
        // Normalize: capitalize first letter
        tags.add(tag.charAt(0).toUpperCase() + tag.slice(1));
      }
    }

    // Build network strengths from headline + any company/role info
    const roleMatch = linkedinTitle.match(/[-–|]\s*(.*?)(?:\s*[-–|]\s*LinkedIn)?$/i);
    const roleInfo = roleMatch?.[1]?.trim() || '';
    const networkStrengths = [roleInfo, headline].filter(Boolean).join(' — ').slice(0, 200) || headline;

    // Build notes with context
    const noteLines = [`LinkedIn: ${url}`];
    if (headline) noteLines.push(`\n${headline}`);
    if (roleInfo && roleInfo !== headline) noteLines.push(roleInfo);
    // Add snippets from web results
    const snippets = webResults
      .filter((r: any) => r.description)
      .map((r: any) => `• ${r.description.slice(0, 150)}`)
      .slice(0, 3);
    if (snippets.length) noteLines.push('\nWeb mentions:', ...snippets);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          name,
          expertiseTags: [...tags].slice(0, 10),
          networkStrengths: networkStrengths || headline,
          notes: noteLines.join('\n'),
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
