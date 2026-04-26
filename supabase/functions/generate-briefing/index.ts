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

function classifyStage(f: any): "Growth" | "Early" {
  const GROWTH_REVENUE = new Set(["2M-5M", "6M-10M", "11M-20M"]);
  const GROWTH_CAPITAL = new Set(["6M-10M", "11M-20M", "21M-50M", "51M+"]);
  const r = (f.revenue || f.mapped_data?.revenue || "").trim();
  const c = (f.capital_raised || f.mapped_data?.capital_raised || "").trim();
  return GROWTH_REVENUE.has(r) || GROWTH_CAPITAL.has(c) ? "Growth" : "Early";
}

function topChallenge(f: any): string | null {
  const raw = f.raw_data || {};
  const mapped = f.mapped_data || {};
  // Try mapped first
  if (mapped.critical_challenges) return String(mapped.critical_challenges).slice(0, 280);
  // Then scan raw_data keys
  const keys = Object.keys(raw);
  const matchKey = keys.find((k) => /critical.*challenge|biggest.*challenge|key.*challenge/i.test(k));
  if (matchKey && raw[matchKey]) return String(raw[matchKey]).slice(0, 280);
  return null;
}

function buildMarkdown(args: {
  lead: any;
  table: any;
  founders: any[];
  notMatchedWith: string[];
}): string {
  const { lead, table, founders, notMatchedWith } = args;
  const sectorStrengths = toArr(lead.sector_strengths);
  const expertise = toArr(lead.expertise_tags);

  const lines: string[] = [];
  lines.push(`# Briefing: ${lead.name || "Lead"}`);
  if (lead.title || lead.company) {
    lines.push(`**${[lead.title, lead.company].filter(Boolean).join(" · ")}**`);
  }
  if (sectorStrengths.length) lines.push(`**Sector strengths:** ${sectorStrengths.join(", ")}`);
  if (expertise.length) lines.push(`**Expertise:** ${expertise.join(", ")}`);
  lines.push("");
  lines.push(`## Table ${table?.table_number ?? ""}${table?.table_name ? ` — ${table.table_name}` : ""}`);
  lines.push("");
  lines.push(`## Founders at your table (${founders.length})`);
  lines.push("");

  // Aggregate sectors & challenges for prompt generation
  const sectorCounts = new Map<string, number>();
  const challengeBlobs: string[] = [];

  for (const f of founders) {
    const sectors = toArr(f.sector);
    sectors.forEach((s) => sectorCounts.set(s, (sectorCounts.get(s) || 0) + 1));
    const stage = classifyStage(f);
    const challenge = topChallenge(f);
    if (challenge) challengeBlobs.push(challenge);
    const founderName = [f.first_name, f.last_name].filter(Boolean).join(" ") || "—";
    const revenue = f.revenue || f.mapped_data?.revenue || "—";
    const capital = f.capital_raised || f.mapped_data?.capital_raised || "—";
    const icp = f.icp || f.mapped_data?.icp || "";
    lines.push(`### ${f.company_name || "Unknown company"}`);
    lines.push(`- **Founder:** ${founderName}`);
    lines.push(`- **Sector:** ${sectors.join(", ") || "—"}`);
    lines.push(`- **Stage:** ${stage}`);
    if (icp) lines.push(`- **ICP:** ${String(icp).slice(0, 200)}`);
    lines.push(`- **Revenue / Capital raised:** ${revenue} / ${capital}`);
    if (challenge) lines.push(`- **Top challenge:** ${challenge}`);
    lines.push("");
  }

  // 3 prompts derived from common challenges + sector overlap
  const sortedSectors = Array.from(sectorCounts.entries()).sort((a, b) => b[1] - a[1]);
  const dominantSector = sortedSectors[0]?.[0];
  const sharedSectorCount = sortedSectors[0]?.[1] || 0;

  const prompts: string[] = [];
  if (sharedSectorCount >= 2 && dominantSector) {
    prompts.push(`What playbooks have worked (or failed) inside ${dominantSector} for each of your stages, and where do they break down?`);
  } else {
    prompts.push("What is the single biggest constraint each of you is facing in the next 90 days, and what would unblock it?");
  }
  if (challengeBlobs.length >= 2) {
    prompts.push("Looking at the challenges around the table, where do you see the strongest pattern, and who in this group is closest to having solved it?");
  } else {
    prompts.push("If you had to hand off one decision to this table for an outside perspective, what would it be?");
  }
  if (sectorStrengths.length) {
    prompts.push(`Where could ${lead.name?.split(" ")[0] || "the lead"}'s experience in ${sectorStrengths.slice(0, 2).join(" / ")} most usefully be pressure-tested by this group?`);
  } else {
    prompts.push("What's one assumption each founder is making that would be most costly if wrong?");
  }

  lines.push(`## Suggested discussion prompts`);
  prompts.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  lines.push("");

  lines.push(`## Has not previously matched with`);
  if (notMatchedWith.length === 0) {
    lines.push("_All founders at this table are first-time matches with you._");
  } else {
    notMatchedWith.forEach((n) => lines.push(`- ${n}`));
  }
  lines.push("");

  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const breakoutId: string | undefined = body?.breakoutId;
    const leadIdFilter: string | undefined = body?.leadId;
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

    // Lead/table pairs at this breakout
    let tlQuery = supabase
      .from("breakout_table_leads")
      .select("id, table_id, lead_id, lead:lead_pool(*), table:breakout_tables(*)")
      .eq("breakout_id", breakoutId);
    if (leadIdFilter) tlQuery = tlQuery.eq("lead_id", leadIdFilter);
    const { data: tableLeads, error: tlErr } = await tlQuery;
    if (tlErr) throw tlErr;

    // Latest match_history for this breakout
    const { data: history, error: histErr } = await supabase
      .from("match_history")
      .select("founder_id, lead_id, table_id")
      .eq("breakout_id", breakoutId);
    if (histErr) throw histErr;

    // RSVPs (for manual_table_override)
    const { data: rsvps, error: rsvpErr } = await supabase
      .from("breakout_rsvps")
      .select("founder_id, manual_table_override, founder:founder_pool(*)")
      .eq("breakout_id", breakoutId);
    if (rsvpErr) throw rsvpErr;

    const founderById = new Map<string, any>();
    for (const r of rsvps || []) {
      if (r.founder) founderById.set((r.founder as any).id, r.founder);
    }
    const overrideByFounder = new Map<string, string>();
    for (const r of rsvps || []) {
      if (r.manual_table_override) overrideByFounder.set(r.founder_id, r.manual_table_override);
    }

    // founders per table_id: prefer override, else match_history table_id
    const foundersByTable = new Map<string, Set<string>>();
    for (const [fid, tid] of overrideByFounder) {
      if (!foundersByTable.has(tid)) foundersByTable.set(tid, new Set());
      foundersByTable.get(tid)!.add(fid);
    }
    for (const h of history || []) {
      if (!h.table_id) continue;
      if (overrideByFounder.has(h.founder_id)) continue; // override wins
      if (!foundersByTable.has(h.table_id)) foundersByTable.set(h.table_id, new Set());
      foundersByTable.get(h.table_id)!.add(h.founder_id);
    }

    // Prior pairings (across all breakouts) per (lead_id) → founder_ids
    const { data: allHistory, error: ahErr } = await supabase
      .from("match_history")
      .select("founder_id, lead_id, breakout_id");
    if (ahErr) throw ahErr;
    const priorByLead = new Map<string, Set<string>>();
    for (const h of allHistory || []) {
      if (h.breakout_id === breakoutId) continue; // exclude current breakout
      if (!priorByLead.has(h.lead_id)) priorByLead.set(h.lead_id, new Set());
      priorByLead.get(h.lead_id)!.add(h.founder_id);
    }

    const briefings: { leadId: string; leadName: string; markdown: string; generatedAt: string }[] = [];
    const upsertRows: any[] = [];

    for (const tl of tableLeads || []) {
      const lead = tl.lead as any;
      const table = tl.table as any;
      if (!lead || !table) continue;

      const founderIds = Array.from(foundersByTable.get(table.id) || []);
      const founders = founderIds.map((id) => founderById.get(id)).filter(Boolean);

      const prior = priorByLead.get(lead.id) || new Set<string>();
      const notMatchedWith = founders
        .filter((f: any) => !prior.has(f.id))
        .map((f: any) => f.company_name || [f.first_name, f.last_name].filter(Boolean).join(" "))
        .filter(Boolean);

      const markdown = buildMarkdown({ lead, table, founders, notMatchedWith });
      const generatedAt = new Date().toISOString();

      briefings.push({
        leadId: lead.id,
        leadName: lead.name || "",
        markdown,
        generatedAt,
      });
      upsertRows.push({
        breakout_id: breakoutId,
        lead_id: lead.id,
        markdown,
        generated_at: generatedAt,
      });
    }

    if (upsertRows.length > 0) {
      const { error: upErr } = await supabase
        .from("breakout_briefings")
        .upsert(upsertRows, { onConflict: "breakout_id,lead_id" });
      if (upErr) throw upErr;
    }

    return new Response(JSON.stringify({ briefings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("generate-briefing error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
