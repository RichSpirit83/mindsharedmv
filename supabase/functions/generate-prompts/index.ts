import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Cache-Control": "no-store",
};

function toArr(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string") return v.split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
  return [];
}

function extractChallenges(f: any): string[] {
  const out: string[] = [];
  const mapped = f.mapped_data || {};
  if (mapped.critical_challenges) out.push(String(mapped.critical_challenges));
  const raw = f.raw_data || {};
  for (const k of Object.keys(raw)) {
    if (/critical.*challenge|biggest.*challenge|key.*challenge|top.*challenge/i.test(k) && raw[k]) {
      out.push(String(raw[k]));
    }
  }
  return out.map((s) => s.slice(0, 400)).filter(Boolean);
}

async function callLovableAI(systemPrompt: string, userPrompt: string): Promise<string[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_prompts",
            description: "Return 3 to 5 discussion prompts as an array of strings.",
            parameters: {
              type: "object",
              properties: {
                prompts: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 5,
                },
              },
              required: ["prompts"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_prompts" } },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI gateway error ${response.status}: ${text.slice(0, 300)}`);
  }
  const json = await response.json();
  const call = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("AI returned no tool call");
  const parsed = JSON.parse(call.function.arguments);
  const prompts = Array.isArray(parsed?.prompts) ? parsed.prompts.map(String) : [];
  if (prompts.length < 3) throw new Error("AI returned fewer than 3 prompts");
  return prompts.slice(0, 5);
}

function buildSystemPrompt(format: string): string {
  const formatGuidance: Record<string, string> = {
    deep_dive:
      "This is a DEEP DIVE format — favor prompts that unpack one specific decision or constraint in depth.",
    peer_advice:
      "This is a PEER ADVICE format — favor prompts that invite each founder to bring a specific question to the table.",
    speed_dating:
      "This is a SPEED DATING format — favor sharp, time-boxed prompts that move quickly between founders.",
    workshop:
      "This is a WORKSHOP format — favor prompts that produce a concrete artifact or framework by the end.",
  };
  const guidance = formatGuidance[format] || "Favor prompts that drive substantive, candid peer conversation.";
  return [
    "You are an expert facilitator for CEO peer-group breakout tables.",
    "Generate 3 to 5 discussion prompts tailored to the founders at the table, the lead's strengths, and the session format.",
    guidance,
    "Each prompt must be open-ended, specific to the data provided (avoid generic prompts), and answerable in 3–5 minutes per founder.",
    "Return ONLY via the return_prompts tool.",
  ].join(" ");
}

function buildUserPrompt(args: {
  founders: any[];
  lead: any | null;
  format: string;
  tableLabel: string;
}): string {
  const { founders, lead, format, tableLabel } = args;
  const founderLines = founders.map((f, i) => {
    const sectors = toArr(f.sector).join(", ") || "—";
    const revenue = f.revenue || f.mapped_data?.revenue || "—";
    const challenges = extractChallenges(f).slice(0, 1).join(" ") || "—";
    return `${i + 1}. ${f.company_name || "Unknown"} — sector: ${sectors}; revenue: ${revenue}; top challenge: ${challenges}`;
  }).join("\n");
  const sectorStrengths = lead ? toArr(lead.sector_strengths).join(", ") : "";
  const expertise = lead ? toArr(lead.expertise_tags).join(", ") : "";
  const leadLine = lead
    ? `Lead: ${lead.name}${sectorStrengths ? ` — sector strengths: ${sectorStrengths}` : ""}${expertise ? `; expertise: ${expertise}` : ""}`
    : "Lead: (none assigned)";
  return [
    `Table: ${tableLabel}`,
    `Session format: ${format}`,
    leadLine,
    "",
    "Founders at this table:",
    founderLines || "(no founders assigned)",
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const breakoutId: string | undefined = body?.breakoutId;
    const tableIdFilter: string | undefined = body?.tableId;
    if (!breakoutId) {
      return new Response(JSON.stringify({ error: "breakoutId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Breakout
    const { data: breakout, error: breakoutErr } = await supabase
      .from("breakout_sessions")
      .select("*")
      .eq("id", breakoutId)
      .maybeSingle();
    if (breakoutErr) throw breakoutErr;
    if (!breakout) throw new Error("Breakout session not found");
    const format = breakout.session_format || "deep_dive";

    // Tables
    let tableQuery = supabase
      .from("breakout_tables")
      .select("*")
      .eq("session_id", breakoutId)
      .eq("is_backup", false)
      .order("table_number");
    if (tableIdFilter) tableQuery = tableQuery.eq("id", tableIdFilter);
    const { data: tables, error: tablesErr } = await tableQuery;
    if (tablesErr) throw tablesErr;

    // Lead per table
    const { data: tableLeads, error: tlErr } = await supabase
      .from("breakout_table_leads")
      .select("table_id, lead:lead_pool(*)")
      .eq("breakout_id", breakoutId);
    if (tlErr) throw tlErr;
    const leadByTable = new Map<string, any>();
    for (const tl of tableLeads || []) {
      if (tl.table_id && !leadByTable.has(tl.table_id)) leadByTable.set(tl.table_id, tl.lead);
    }

    // Founders per table (override → match_history)
    const { data: rsvps, error: rsvpErr } = await supabase
      .from("breakout_rsvps")
      .select("founder_id, manual_table_override, founder:founder_pool(*)")
      .eq("breakout_id", breakoutId);
    if (rsvpErr) throw rsvpErr;
    const founderById = new Map<string, any>();
    const overrideByFounder = new Map<string, string>();
    for (const r of rsvps || []) {
      if (r.founder) founderById.set((r.founder as any).id, r.founder);
      if (r.manual_table_override) overrideByFounder.set(r.founder_id, r.manual_table_override);
    }
    const { data: history, error: histErr } = await supabase
      .from("match_history")
      .select("founder_id, table_id")
      .eq("breakout_id", breakoutId);
    if (histErr) throw histErr;
    const foundersByTable = new Map<string, Set<string>>();
    for (const [fid, tid] of overrideByFounder) {
      if (!foundersByTable.has(tid)) foundersByTable.set(tid, new Set());
      foundersByTable.get(tid)!.add(fid);
    }
    for (const h of history || []) {
      if (!h.table_id || overrideByFounder.has(h.founder_id)) continue;
      if (!foundersByTable.has(h.table_id)) foundersByTable.set(h.table_id, new Set());
      foundersByTable.get(h.table_id)!.add(h.founder_id);
    }

    // Generate per table
    const result: Record<string, string[]> = {};
    for (const t of tables || []) {
      const founderIds = Array.from(foundersByTable.get(t.id) || []);
      const founders = founderIds.map((id) => founderById.get(id)).filter(Boolean);
      const lead = leadByTable.get(t.id) || null;
      const tableLabel = `Table ${t.table_number}${t.table_name ? ` — ${t.table_name}` : ""}`;
      try {
        const prompts = await callLovableAI(
          buildSystemPrompt(format),
          buildUserPrompt({ founders, lead, format, tableLabel }),
        );
        result[t.id] = prompts;
      } catch (e: any) {
        console.error(`prompt gen failed for table ${t.id}:`, e?.message || e);
      }
    }

    // Merge into breakout_sessions.table_prompts
    const existing = (breakout.table_prompts as Record<string, string[]>) || {};
    const merged = { ...existing, ...result };
    const { error: updErr } = await supabase
      .from("breakout_sessions")
      .update({ table_prompts: merged })
      .eq("id", breakoutId);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ prompts: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("generate-prompts error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
