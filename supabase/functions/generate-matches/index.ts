import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { companies, sessionConfig, leads } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const numTables = sessionConfig?.numTables || Math.ceil(companies.length / 6);
    const targetPerTable = sessionConfig?.targetPerTable || Math.ceil(companies.length / numTables);
    const groupingPriority = sessionConfig?.groupingPriority || "hybrid";

    const priorityInstructions: Record<string, string> = {
      sector: "Group companies primarily by SECTOR similarity so each table shares an industry vertical.",
      stage: "Group companies primarily by STAGE/REVENUE similarity so each table has companies at similar growth phases.",
      need: "Group companies primarily by shared CHALLENGES and NEEDS so conversations are most relevant.",
      hybrid: "Balance sector alignment, stage diversity (mix early and later-stage for mentorship), and shared challenges. Avoid placing direct competitors at the same table.",
    };

    const leadsInfo = (leads || []).map((l: any) => `Lead: ${l.name} — expertise: ${l.expertiseTags?.join(", ")} — strengths: ${l.networkStrengths}`).join("\n");

    const companyList = companies.map((c: any, i: number) => {
      const parts = [`#${i + 1} ${c.company_name || "Unknown"}`];
      if (c.first_name) parts.push(`Contact: ${c.first_name} ${c.last_name || ""}`);
      if (c.sector) parts.push(`Sector: ${c.sector}`);
      if (c.primary_market) parts.push(`Market: ${c.primary_market}`);
      if (c.stage || c.sales_stage) parts.push(`Stage: ${c.stage || c.sales_stage}`);
      if (c.revenue) parts.push(`Revenue: ${c.revenue}`);
      if (c.icp) parts.push(`ICP: ${c.icp}`);
      if (c.critical_challenges) parts.push(`Challenges: ${c.critical_challenges}`);
      if (c.topics_of_interest) parts.push(`Topics: ${c.topics_of_interest}`);
      if (c.company_description) parts.push(`Desc: ${c.company_description.slice(0, 150)}`);
      return parts.join(" | ");
    }).join("\n");

    const systemPrompt = `You are an expert event facilitator creating optimized breakout table assignments for a CEO peer-group event. You must assign ALL ${companies.length} companies to exactly ${numTables} tables with roughly ${targetPerTable} companies each.

GROUPING PRIORITY: ${priorityInstructions[groupingPriority] || priorityInstructions.hybrid}

CRITICAL RULES:
- Every company must be assigned to exactly one table
- Direct competitors should NOT be at the same table
- Each table needs a clear thematic rationale
- Tables should foster productive peer conversation

${leadsInfo ? `TABLE LEADS (assign one per table where possible):\n${leadsInfo}` : ""}`;

    const userPrompt = `Assign these ${companies.length} companies to ${numTables} tables:\n\n${companyList}`;

    console.log(`Generating matches: ${companies.length} companies -> ${numTables} tables (${groupingPriority})`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "assign_tables",
              description: "Assign all companies to tables with rationale",
              parameters: {
                type: "object",
                properties: {
                  tables: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        table_number: { type: "number" },
                        table_name: { type: "string", description: "Short memorable name for the table theme" },
                        theme: { type: "string", description: "One-sentence theme description" },
                        stage_mix: { type: "string", description: "e.g. 'Early-stage mix' or 'Growth-stage'" },
                        suggested_lead: { type: "string", description: "Name of suggested table lead or empty" },
                        rationale: { type: "string", description: "Why these companies are grouped together" },
                        shared_challenges: {
                          type: "array",
                          items: { type: "string" },
                          description: "2-4 shared challenge tags",
                        },
                        company_indices: {
                          type: "array",
                          items: { type: "number" },
                          description: "1-based indices of companies assigned to this table",
                        },
                      },
                      required: ["table_number", "table_name", "theme", "stage_mix", "rationale", "shared_challenges", "company_indices"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tables"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "assign_tables" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const parsed = JSON.parse(toolCall.function.arguments);

    // Map company indices back to company data
    const tables = (parsed.tables || []).map((table: any) => ({
      table_number: table.table_number,
      table_name: table.table_name,
      theme: table.theme,
      stage_mix: table.stage_mix,
      suggested_lead: table.suggested_lead || "",
      rationale: table.rationale,
      shared_challenges: table.shared_challenges || [],
      companies: (table.company_indices || []).map((idx: number) => {
        const c = companies[idx - 1]; // 1-based index
        return c ? {
          company_name: c.company_name || "",
          first_name: c.first_name || "",
          last_name: c.last_name || "",
          sector: c.sector || "",
          stage: c.stage || c.sales_stage || "",
          revenue: c.revenue || "",
        } : null;
      }).filter(Boolean),
    }));

    console.log(`Generated ${tables.length} tables`);

    return new Response(JSON.stringify({ tables }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-matches error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
