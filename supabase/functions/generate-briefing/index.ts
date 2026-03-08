import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { table, companies, lead, prompts, sessionName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const companyDetails = (companies || []).map((c: any, i: number) => {
      const parts = [`${i + 1}. ${c.company_name || "Unknown"}`];
      if (c.first_name) parts.push(`Contact: ${c.first_name} ${c.last_name || ""}`);
      if (c.sector) parts.push(`Sector: ${c.sector}`);
      if (c.sales_stage || c.stage) parts.push(`Stage: ${c.sales_stage || c.stage}`);
      if (c.revenue) parts.push(`Revenue: ${c.revenue}`);
      if (c.critical_challenges) parts.push(`Key Challenge: ${c.critical_challenges.slice(0, 200)}`);
      if (c.company_description) parts.push(`About: ${c.company_description.slice(0, 150)}`);
      return parts.join(" | ");
    }).join("\n");

    const promptsList = (prompts || []).map((p: string, i: number) => `${i + 1}. ${p}`).join("\n");

    const leadInfo = lead ? `Table Lead: ${lead.name}\nExpertise: ${(lead.expertise_tags || []).join(", ")}\nStrengths: ${lead.network_strengths || ""}` : "No assigned lead";

    const userPrompt = `Generate a comprehensive one-page briefing for the following breakout table:

SESSION: ${sessionName || "Breakout Session"}
TABLE: ${table.table_name} (Table ${table.table_number})
THEME: ${table.theme}
RATIONALE: ${table.rationale}
STAGE MIX: ${table.stage_mix}

${leadInfo}

PARTICIPANTS:
${companyDetails}

ENGAGEMENT PROMPTS (MUST BE INCLUDED VERBATIM IN OUTPUT):
${promptsList}

Create a professional briefing that includes:
1. Table Overview - theme and why this group was matched
2. Participant Snapshots - for each company: name, what they do, sector, stage, and their key challenge
3. Conversation Starters - specific to this group's shared interests
4. Engagement Prompts - include the EXACT engagement prompts listed above as a dedicated section so the lead can reference them during the session
5. Facilitation Tips - how the lead should guide the conversation
6. Key Connections - potential synergies between specific participants`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert event facilitator creating detailed table lead briefings. Write in a professional but warm tone. Use markdown formatting with headers, bullet points, and bold text for readability. Keep it concise enough to fit on one printed page. IMPORTANT: You MUST include the engagement prompts verbatim in a dedicated section of the briefing — these are the discussion questions the lead will use during the session.",
          },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const briefing = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ briefing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-briefing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
