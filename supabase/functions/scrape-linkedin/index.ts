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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const usernameMatch = url.match(/linkedin\.com\/in\/([^/?#]+)/);
    const username = usernameMatch?.[1]?.replace(/\/$/, '') || '';

    console.log('Looking up LinkedIn profile for:', username, 'URL:', url);

    const [linkedinSearch, webSearch] = await Promise.all([
      fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `"linkedin.com/in/${username}"`,
          limit: 3,
          scrapeOptions: { formats: ['markdown'] },
        }),
      }).then(r => r.json()),
      fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `"${username.replace(/-/g, ' ')}" linkedin professional`,
          limit: 5,
          scrapeOptions: { formats: ['markdown'] },
        }),
      }).then(r => r.json()),
    ]);

    const linkedinResults = linkedinSearch.data || linkedinSearch.results || [];
    const webResults = webSearch.data || webSearch.results || [];

    const allText = [
      ...linkedinResults.map((r: any) => `[LinkedIn Result] Title: ${r.title || ''}\nURL: ${r.url || ''}\nDescription: ${r.description || ''}\nContent: ${(r.markdown || '').slice(0, 2000)}`),
      ...webResults.map((r: any) => `[Web Result] Title: ${r.title || ''}\nURL: ${r.url || ''}\nDescription: ${r.description || ''}\nContent: ${(r.markdown || '').slice(0, 1500)}`),
    ].join('\n\n---\n\n');

    if (!allText.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'No search results found for this profile' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are extracting professional profile information from search results about a LinkedIn user. The target LinkedIn profile URL is: ${url}. Focus on results that match this specific person. Extract their real full name, company, title, email if available, company website, expertise areas, and a background summary.`,
          },
          {
            role: 'user',
            content: `Extract profile information from these search results:\n\n${allText.slice(0, 8000)}`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_profile',
              description: 'Extract structured LinkedIn profile data',
              parameters: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Full name of the person' },
                  company: { type: 'string', description: 'Current company name' },
                  title: { type: 'string', description: 'Current job title (e.g. "CEO", "VP of Engineering")' },
                  email: { type: 'string', description: 'Email address if found, otherwise empty string' },
                  website: { type: 'string', description: 'Company website URL if found, otherwise empty string' },
                  expertiseTags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Up to 10 expertise/industry tags (e.g. SaaS, FinTech, Series A, AI, Go-to-Market)',
                  },
                  background: { type: 'string', description: 'A 2-3 sentence summary of the person\'s professional background, achievements, and relevant context' },
                },
                required: ['name', 'company', 'title', 'email', 'website', 'expertiseTags', 'background'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_profile' } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ success: false, error: 'Rate limited, please try again shortly.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error('AI extraction failed');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call in AI response');

    const profile = JSON.parse(toolCall.function.arguments);
    console.log('AI extracted profile:', profile.name, '- Tags:', profile.expertiseTags?.length);

    // Add "AI Generated" to expertise tags
    const tags = (profile.expertiseTags || []).slice(0, 10);
    if (!tags.includes('AI Generated')) tags.push('AI Generated');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          name: profile.name || username.replace(/-/g, ' '),
          company: profile.company || '',
          title: profile.title || '',
          email: profile.email || '',
          website: profile.website || '',
          expertiseTags: tags,
          background: `LinkedIn: ${url}\n${profile.title || ''} at ${profile.company || ''}\n\n${profile.background || ''}`.trim(),
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
