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

    // Extract username from LinkedIn URL
    const usernameMatch = url.match(/linkedin\.com\/in\/([^/?#]+)/);
    const username = usernameMatch?.[1]?.replace(/\/$/, '') || '';

    console.log('Looking up LinkedIn profile for:', username, 'URL:', url);

    // Run two searches in parallel — use the exact URL as search query for precision
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

    console.log('LinkedIn search results count:', (linkedinSearch.data || []).length);
    console.log('Web search results count:', (webSearch.data || []).length);

    // Aggregate all text from both searches
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

    // Use AI to extract structured profile data
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
            content: `You are extracting professional profile information from search results about a LinkedIn user. The target LinkedIn profile URL is: ${url}. Focus on results that match this specific person. Extract their real full name, professional headline/role, expertise areas, and network value.`,
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
                  headline: { type: 'string', description: 'Professional headline or current role (e.g. "CEO at Company X")' },
                  expertiseTags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Up to 10 expertise/industry tags (e.g. SaaS, FinTech, Series A, AI, Go-to-Market)',
                  },
                  networkStrengths: { type: 'string', description: 'Summary of their network value and professional strengths (1-2 sentences)' },
                  notes: { type: 'string', description: 'Key background info, achievements, and relevant context' },
                },
                required: ['name', 'headline', 'expertiseTags', 'networkStrengths', 'notes'],
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

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          name: profile.name || username.replace(/-/g, ' '),
          expertiseTags: (profile.expertiseTags || []).slice(0, 10),
          networkStrengths: profile.networkStrengths || profile.headline || '',
          notes: `LinkedIn: ${url}\n${profile.headline || ''}\n\n${profile.notes || ''}`.trim(),
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
