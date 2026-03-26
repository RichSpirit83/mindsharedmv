import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { companies, sessionConfig, leads, previousRoundTables } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const numTables = sessionConfig?.numTables || Math.ceil(companies.length / 6);
    const targetPerTable = sessionConfig?.targetPerTable || Math.ceil(companies.length / numTables);
    const minPerTable = Math.floor(companies.length / numTables);
    const maxPerTable = minPerTable + (companies.length % numTables > 0 ? 1 : 0);
    const groupingPriority = sessionConfig?.groupingPriority || "hybrid";
    const allowStageMixing =
      typeof sessionConfig?.allowStageMixing === "boolean"
        ? sessionConfig.allowStageMixing
        : true;
    const avoidCompetitors =
      typeof sessionConfig?.avoidCompetitors === "boolean"
        ? sessionConfig.avoidCompetitors
        : true;
    const leadMatchingMode = sessionConfig?.leadMatchingMode || "flexible";
    const shuffleMode = sessionConfig?.shuffleMode || "both";
    const hybridRule = allowStageMixing
      ? "Balance sector alignment, stage diversity (mix early and later-stage for mentorship), and shared challenges."
      : "Balance sector alignment, stage alignment (keep similar growth phases; avoid mixing stages), and shared challenges.";

    const priorityInstructions: Record<string, string> = {
      sector: "Group companies primarily by SECTOR similarity so each table shares an industry vertical.",
      stage: "Group companies primarily by STAGE/REVENUE similarity so each table has companies at similar growth phases.",
      need: "Group companies primarily by shared CHALLENGES and NEEDS so conversations are most relevant.",
      hybrid: hybridRule,
    };

    const leadsInfo = (leads || [])
      .map((l: any, idx: number) => {
        const tags = (l.expertiseTags || []).join(", ");
        const strengths = l.networkStrengths ? ` — strengths: ${l.networkStrengths}` : "";
        const notes = l.notes ? ` — notes: ${l.notes}` : "";
        const bg = l.background ? ` — background: ${l.background.slice(0, 200)}` : "";
        const tableLeadFlag = l.isTableLead ? " [DESIGNATED TABLE LEAD]" : "";
        return `Lead #${idx + 1}: ${l.name}${tableLeadFlag}${tags ? ` — expertise: ${tags}` : ""}${bg}${strengths}${notes}`;
      })
      .join("\n");

    const designatedTableLeads = (leads || []).filter((l: any) => l.isTableLead);
    const hasDesignatedLeads = designatedTableLeads.length > 0;
    const designatedLeadsCanCoverAllTables = designatedTableLeads.length >= numTables;

    const numLeads = (leads || []).length;
    const minLeadsPerTable = numLeads > 0 ? Math.floor(numLeads / numTables) : 0;
    const maxLeadsPerTable = numLeads > 0 ? Math.ceil(numLeads / numTables) : 0;
    const hasLeadShortage = numLeads > 0 && numLeads < numTables;

    const leadDistributionInstruction = numLeads > 0
      ? `\nLEAD DISTRIBUTION: There are ${numLeads} leads and ${numTables} tables. Every lead MUST be assigned exactly once across all tables, and no lead index may appear in more than one table. ${hasLeadShortage ? `There are fewer leads than tables, so some tables should intentionally have no assigned leads. Do NOT duplicate leads to fill every table.` : `Aim for roughly ${minLeadsPerTable === maxLeadsPerTable ? `${minLeadsPerTable}` : `${minLeadsPerTable}-${maxLeadsPerTable}`} lead(s) per table when possible.`} Use the "assigned_lead_indices" field (1-based indices) to assign leads to tables. The FIRST lead index in each table's list will be designated as the "Table Head".${hasDesignatedLeads ? designatedLeadsCanCoverAllTables ? ` ONLY leads marked with [DESIGNATED TABLE LEAD] may be placed as Table Head (first in the list). Non-designated leads must NEVER be the first lead index for any table.` : ` Prioritize leads marked with [DESIGNATED TABLE LEAD] as Table Head where assigned. Because there are only ${designatedTableLeads.length} designated leads for ${numTables} tables, tables without a designated lead may have no lead or a non-designated lead first. Never duplicate leads.` : ` Choose the lead whose expertise is the strongest match for that table's theme.`}`
      : "";

    const leadAlignmentInstruction = numLeads > 0
      ? `\nLEAD-FOUNDER ALIGNMENT: When assigning leads to tables, carefully consider each lead's background, expertise, and skills. Match leads to tables where the founders' challenges, sectors, and needs align with the lead's expertise. The goal is to maximize the value each lead brings to their table conversation.${hasDesignatedLeads ? designatedLeadsCanCoverAllTables ? `\n\nDESIGNATED TABLE LEADS: Leads marked with [DESIGNATED TABLE LEAD] MUST be assigned as the FIRST lead (Table Head) at their respective tables. They take priority over other leads. There are ${designatedTableLeads.length} designated table leads — assign each one to the table where their expertise is most relevant. Leads NOT marked as [DESIGNATED TABLE LEAD] must be placed AFTER designated leads in each table's assigned_lead_indices array — they should NEVER appear first.` : `\n\nDESIGNATED TABLE LEADS: Prioritize leads marked with [DESIGNATED TABLE LEAD] as first lead where possible. Since designated leads are fewer than tables, leave some tables without leads or place a non-designated lead first when needed. Do not duplicate designated or non-designated leads.` : ""}`
      : "";

    const leadMatchingInstruction = leadMatchingMode === "strict"
      ? "STRICT LEAD ASSIGNMENT: Each lead MUST be assigned ONLY to the table whose theme most closely matches their expertise tags. Do not assign any lead to a table where their expertise does not align with the theme."
      : "When choosing leads for each table, prefer leads whose expertise tags and background align with the table theme and founders' shared challenges, but you may use your best judgment.";

    const competitorRule = avoidCompetitors
      ? "- Direct competitors should NOT be at the same table"
      : "- Competitors MAY be seated together (intentional competitive-intelligence setup)";

    // Build shuffle constraint from previous round
    let shuffleConstraint = "";
    if (previousRoundTables && previousRoundTables.length > 0 && shuffleMode !== "both") {
      if (shuffleMode === "founders") {
        const leadAssignments = previousRoundTables.map((t: any) =>
          `Table ${t.table_number} ("${t.table_name}"): leads = [${(t.assigned_leads || []).map((l: any) => l.name).join(", ")}]`
        ).join("\n");
        shuffleConstraint = `\nSHUFFLE CONSTRAINT (Founders Only): The following lead-to-table assignments from the previous round MUST be preserved exactly. Only reshuffle the companies across tables.\nPrevious round lead assignments:\n${leadAssignments}\n`;
      } else if (shuffleMode === "leads") {
        const companyAssignments = previousRoundTables.map((t: any) =>
          `Table ${t.table_number}: companies = [${(t.companies || []).map((c: any) => c.company_name).join(", ")}]`
        ).join("\n");
        shuffleConstraint = `\nSHUFFLE CONSTRAINT (Leads Only): The following company-to-table assignments from the previous round MUST be preserved exactly. Only reassign leads across tables.\nPrevious round company assignments:\n${companyAssignments}\n`;
      }
    }

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

    const systemPrompt = `You are an expert event facilitator creating optimized breakout table assignments for a CEO peer-group event. You must assign ALL ${companies.length} companies to exactly ${numTables} tables.

HARD SIZE CONSTRAINT: Each table MUST have between ${minPerTable} and ${maxPerTable} companies. No table may have fewer than ${minPerTable} or more than ${maxPerTable}. This is a strict requirement — do NOT create unbalanced tables.

GROUPING PRIORITY: ${priorityInstructions[groupingPriority] || priorityInstructions.hybrid}

ALLOW_STAGE_MIXING: ${allowStageMixing ? "true" : "false"}
${shuffleConstraint}
CRITICAL RULES:
- Every company must be assigned to exactly one table
- Each table must have between ${minPerTable} and ${maxPerTable} companies (HARD CONSTRAINT)
- A lead index may be assigned to at most one table (no duplicate lead assignments)
${competitorRule}
- Each table needs a clear thematic rationale
- Tables should foster productive peer conversation
${allowStageMixing ? "" : "- Keep companies at similar stages within each table (avoid stage mixing)"}

${leadsInfo ? `TABLE LEADS (assign to tables):\n${leadsInfo}\n\n${leadDistributionInstruction}\n${leadAlignmentInstruction}\n\n${leadMatchingInstruction}` : ""}`;

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
                        suggested_lead: { type: "string", description: "Name of primary suggested table lead or empty" },
                        rationale: { type: "string", description: "Why these companies are grouped together and why these leads are a good fit" },
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
                        assigned_lead_indices: {
                          type: "array",
                          items: { type: "number" },
                          description: "1-based indices of leads assigned to this table",
                        },
                      },
                      required: ["table_number", "table_name", "theme", "stage_mix", "rationale", "shared_challenges", "company_indices", "assigned_lead_indices"],
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

    // Post-processing: rebalance tables if any are too small or too large
    const rawTables = parsed.tables || [];
    const rebalancedMin = Math.floor(companies.length / numTables);
    const rebalancedMax = rebalancedMin + (companies.length % numTables > 0 ? 1 : 0);

    // Flatten all indices and rebuild if needed
    let needsRebalance = rawTables.some((t: any) =>
      (t.company_indices || []).length < rebalancedMin || (t.company_indices || []).length > rebalancedMax + 1
    );

    if (needsRebalance) {
      console.log("Rebalancing tables due to uneven distribution");
      // Sort tables by size (smallest first) and move from largest to smallest
      let sorted = [...rawTables].sort((a: any, b: any) =>
        (a.company_indices || []).length - (b.company_indices || []).length
      );
      let maxIter = 100;
      while (maxIter-- > 0) {
        const smallest = sorted[0];
        const largest = sorted[sorted.length - 1];
        if ((smallest.company_indices || []).length >= rebalancedMin) break;
        if ((largest.company_indices || []).length <= rebalancedMin) break;
        // Move last company from largest to smallest
        const moved = largest.company_indices.pop();
        smallest.company_indices.push(moved);
        sorted.sort((a: any, b: any) =>
          (a.company_indices || []).length - (b.company_indices || []).length
        );
      }
    }

    // Post-processing: ensure lead assignments are globally unique (no lead duplication across tables)
    const enforceUniqueLeadAssignments = (tablesInput: any[]) => {
      const totalLeads = (leads || []).length;
      const normalizedTables = [...tablesInput]
        .map((table: any) => ({
          ...table,
          assigned_lead_indices: Array.isArray(table.assigned_lead_indices)
            ? table.assigned_lead_indices
            : [],
        }))
        .sort((a: any, b: any) => (a.table_number || 0) - (b.table_number || 0));

      if (totalLeads === 0) {
        return normalizedTables.map((table: any) => ({ ...table, assigned_lead_indices: [] }));
      }

      const usedLeadIndices = new Set<number>();

      normalizedTables.forEach((table: any) => {
        const uniqueLeadIndices: number[] = [];
        for (const rawIndex of table.assigned_lead_indices || []) {
          const leadIndex = Number(rawIndex);
          if (!Number.isInteger(leadIndex) || leadIndex < 1 || leadIndex > totalLeads) continue;
          if (usedLeadIndices.has(leadIndex)) continue;
          if (uniqueLeadIndices.includes(leadIndex)) continue;
          uniqueLeadIndices.push(leadIndex);
          usedLeadIndices.add(leadIndex);
        }
        table.assigned_lead_indices = uniqueLeadIndices;
      });

      const unassignedLeadIndices: number[] = [];
      for (let i = 1; i <= totalLeads; i++) {
        if (!usedLeadIndices.has(i)) unassignedLeadIndices.push(i);
      }

      unassignedLeadIndices.forEach((leadIndex) => {
        normalizedTables.sort(
          (a: any, b: any) =>
            (a.assigned_lead_indices?.length || 0) - (b.assigned_lead_indices?.length || 0)
        );
        const targetTable = normalizedTables[0];
        targetTable.assigned_lead_indices = [
          ...(targetTable.assigned_lead_indices || []),
          leadIndex,
        ];
      });

      return normalizedTables.sort(
        (a: any, b: any) => (a.table_number || 0) - (b.table_number || 0)
      );
    };

    const leadSafeTables = enforceUniqueLeadAssignments(rawTables);

    // Map company indices back to company data
    const tables = leadSafeTables.map((table: any) => ({
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
      assigned_leads: (table.assigned_lead_indices || []).map((idx: number) => {
        const l = (leads || [])[idx - 1];
        return l ? { name: l.name, company: l.company, title: l.title, expertiseTags: l.expertiseTags || [] } : null;
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
