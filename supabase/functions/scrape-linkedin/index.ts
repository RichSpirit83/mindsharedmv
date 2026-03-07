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

    if (!url || !url.includes('linkedin.com')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid LinkedIn URL is required' }),
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

    console.log('Scraping LinkedIn profile:', url);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url.trim(),
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract profile info from markdown
    const markdown = data.data?.markdown || data.markdown || '';
    const metadata = data.data?.metadata || data.metadata || {};

    // Parse name from title or markdown
    const titleMatch = metadata.title?.match(/^(.*?)(?:\s*[-–|]|\s*\()/);
    const name = titleMatch?.[1]?.trim() || metadata.title?.split(' - ')?.[0]?.trim() || '';

    // Extract headline/title from metadata or markdown
    const headline = metadata.description?.split('.')?.[0]?.trim() || '';

    // Extract expertise keywords from the content
    const expertiseKeywords: string[] = [];
    const keywordPatterns = [
      /(?:SaaS|B2B|B2C|HealthTech|FinTech|EdTech|GovTech|DeepTech|AI|ML|Cybersecurity|IoT|Blockchain)/gi,
      /(?:Series [A-F]|Seed|Pre-seed|Growth|Scale)/gi,
      /(?:GTM|Go-to-Market|Fundraising|Product|Engineering|Sales|Marketing|Operations)/gi,
    ];
    for (const pattern of keywordPatterns) {
      const matches = markdown.match(pattern) || [];
      expertiseKeywords.push(...matches.map((m: string) => m.trim()));
    }
    const uniqueTags = [...new Set(expertiseKeywords.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)))].slice(0, 8);

    // Extract network strengths from headline + description
    const networkStrengths = headline;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          name,
          expertiseTags: uniqueTags,
          networkStrengths,
          notes: `LinkedIn: ${url}\n\n${headline}`,
          rawMarkdown: markdown.slice(0, 2000),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to scrape' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
