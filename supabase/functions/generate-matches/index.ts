import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Cache-Control": "no-store",
};

const GROWTH_REVENUE = new Set(["2M-5M", "6M-10M", "11M-20M"]);
const GROWTH_CAPITAL = new Set(["6M-10M", "11M-20M", "21M-50M", "51M+"]);

function classifyStage(founder: any): "Growth" | "Early" {
  const revenue = (founder.revenue || founder.mapped_data?.revenue || "").trim();
  const capital = (founder.capital_raised || founder.mapped_data?.capital_raised || "").trim();
  if (GROWTH_REVENUE.has(revenue) || GROWTH_CAPITAL.has(capital)) return "Growth";
  return "Early";
}

function toSectorArray(s: any): string[] {
  if (!s) return [];
  if (Array.isArray(s)) return s.map((x) => String(x).toLowerCase().trim()).filter(Boolean);
  if (typeof s === "string") return s.split(/[,;|]/).map((x) => x.toLowerCase().trim()).filter(Boolean);
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const breakoutId: string | undefined = body?.breakoutId;
    const commit: boolean = !!body?.commit;

    if (!breakoutId || typeof breakoutId !== "string") {
      return new Response(JSON.stringify({ error: "breakoutId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1) Breakout
    const { data: breakout, error: breakoutErr } = await supabase
      .from("breakout_sessions")
      .select("*")
      .eq("id", breakoutId)
      .maybeSingle();
    if (breakoutErr) throw breakoutErr;
    if (!breakout) throw new Error("Breakout session not found");

    // 2) RSVP'd founders
    const { data: rsvps, error: rsvpsErr } = await supabase
      .from("breakout_rsvps")
      .select("id, founder_id, manual_table_override, founder:founder_pool(*)")
      .eq("breakout_id", breakoutId)
      .eq("rsvpd", true);
    if (rsvpsErr) throw rsvpsErr;
    const founders = (rsvps || [])
      .map((r: any) => ({ ...r.founder, _rsvp_id: r.id, _override: r.manual_table_override }))
      .filter((f: any) => f && f.id);

    // 3) Tables + leads
    const { data: tables, error: tablesErr } = await supabase
      .from("breakout_tables")
      .select("*")
      .eq("session_id", breakoutId)
      .eq("is_backup", false)
      .order("table_number");
    if (tablesErr) throw tablesErr;

    const { data: tableLeads, error: tlErr } = await supabase
      .from("breakout_table_leads")
      .select("id, table_id, lead_id, stage, lead:lead_pool(*)")
      .eq("breakout_id", breakoutId);
    if (tlErr) throw tlErr;

    const leadByTable = new Map<string, any>();
    for (const tl of tableLeads || []) {
      if (tl.table_id && !leadByTable.has(tl.table_id)) {
        leadByTable.set(tl.table_id, { ...tl.lead, _stage: tl.stage });
      }
    }

    // 4) Match history for these founders
    const founderIds = founders.map((f: any) => f.id);
    let history: any[] = [];
    if (founderIds.length > 0) {
      const { data: hist, error: histErr } = await supabase
        .from("match_history")
        .select("founder_id, lead_id")
        .in("founder_id", founderIds);
      if (histErr) throw histErr;
      history = hist || [];
    }
    const priorMatches = new Map<string, Set<string>>();
    for (const h of history) {
      if (!priorMatches.has(h.founder_id)) priorMatches.set(h.founder_id, new Set());
      priorMatches.get(h.founder_id)!.add(h.lead_id);
    }

    // 5) Stage classification
    const tieredFounders = founders.map((f: any) => ({ founder: f, tier: classifyStage(f) }));
    const growthCount = tieredFounders.filter((t) => t.tier === "Growth").length;
    const earlyCount = tieredFounders.filter((t) => t.tier === "Early").length;

    // Tier → eligible tables. With no per-table stage info we treat all tables as eligible to both tiers,
    // but greedy assignment runs per-tier so cohorts cluster naturally.
    const allTables = (tables || []).map((t: any) => ({
      id: t.id,
      table_number: t.table_number,
      lead: leadByTable.get(t.id) || null,
    }));

    // Sector lookup per founder
    const founderSectors = new Map<string, Set<string>>();
    for (const f of founders) {
      founderSectors.set(f.id, new Set(toSectorArray(f.sector)));
    }

    // Assignment state
    const assignmentsByTable = new Map<string, string[]>(); // table_id → [founder_id]
    for (const t of allTables) assignmentsByTable.set(t.id, []);
    const assignmentByFounder = new Map<string, { tableId: string; warnings: string[]; locked?: boolean }>();
    const targetCap = breakout.target_per_table || 6;
    const validTableIds = new Set(allTables.map((t) => t.id));

    // Lock founders with a manual_table_override first — overrides always win.
    for (const f of founders) {
      const override = (f as any)._override as string | null;
      if (override && validTableIds.has(override)) {
        assignmentsByTable.get(override)!.push(f.id);
        assignmentByFounder.set(f.id, { tableId: override, warnings: [], locked: true });
      }
    }

    function eligibleTables(founderId: string) {
      const prior = priorMatches.get(founderId) || new Set<string>();
      return allTables.filter((t) => !t.lead || !prior.has(t.lead.id));
    }

    function scoreTable(founderId: string, table: any): number {
      const fSectors = founderSectors.get(founderId) || new Set<string>();
      const assigned = assignmentsByTable.get(table.id) || [];
      const tableLoad = assigned.length;
      let sectorOverlap = 0;
      for (const otherId of assigned) {
        const oSectors = founderSectors.get(otherId) || new Set<string>();
        for (const s of fSectors) if (oSectors.has(s)) { sectorOverlap++; break; }
      }
      const homogeneity = sectorOverlap / Math.max(1, tableLoad);
      const overCap = tableLoad >= targetCap ? 1000 : 0;
      return -(1.0 * sectorOverlap + 0.5 * (targetCap - tableLoad) + 2.0 * homogeneity) + overCap;
    }

    // Run greedy per tier, skipping already-locked founders
    let rematchCount = 0;
    for (const tier of ["Growth", "Early"] as const) {
      const tierFounders = tieredFounders
        .filter((t) => t.tier === tier)
        .map((t) => t.founder)
        .filter((f: any) => !assignmentByFounder.has(f.id));

      tierFounders.sort((a: any, b: any) => eligibleTables(a.id).length - eligibleTables(b.id).length);

      for (const f of tierFounders) {
        const warnings: string[] = [];
        let candidates = eligibleTables(f.id);
        if (candidates.length === 0) {
          candidates = allTables;
          rematchCount++;
          warnings.push("Re-matched with a previous lead (no fresh tables available)");
        }
        let best = candidates[0];
        let bestScore = scoreTable(f.id, best);
        for (let i = 1; i < candidates.length; i++) {
          const s = scoreTable(f.id, candidates[i]);
          if (s < bestScore) { best = candidates[i]; bestScore = s; }
        }
        assignmentsByTable.get(best.id)!.push(f.id);
        assignmentByFounder.set(f.id, { tableId: best.id, warnings });
      }
    }

    // 6) Build response
    const assignments = founders.map((f: any) => {
      const a = assignmentByFounder.get(f.id);
      const tableId = a?.tableId || null;
      const lead = tableId ? leadByTable.get(tableId) : null;
      return {
        founderId: f.id,
        tableId,
        leadId: lead?.id || null,
        warnings: a?.warnings || [],
        locked: !!a?.locked,
      };
    });

    // 7) Commit
    if (commit) {
      // Source of truth for current seating — replaceable per (breakout, founder)
      const seatingRows = assignments
        .filter((a) => a.tableId)
        .map((a) => ({
          breakout_id: breakoutId,
          founder_id: a.founderId,
          table_id: a.tableId,
          lead_id: a.leadId || null,
        }));
      if (seatingRows.length > 0) {
        const { error: seatErr } = await supabase
          .from("breakout_seating")
          .upsert(seatingRows, { onConflict: "breakout_id,founder_id" });
        if (seatErr) throw seatErr;
      }

      // Append-only history for "avoid re-match" — only when a real lead is paired
      const historyRows = assignments
        .filter((a) => a.tableId && a.leadId)
        .map((a) => ({
          founder_id: a.founderId,
          lead_id: a.leadId,
          breakout_id: breakoutId,
          table_id: a.tableId,
        }));
      if (historyRows.length > 0) {
        const { error: insErr } = await supabase
          .from("match_history")
          .upsert(historyRows, { onConflict: "founder_id,lead_id,breakout_id", ignoreDuplicates: true });
        if (insErr) throw insErr;
      }
    }

    return new Response(
      JSON.stringify({
        assignments,
        summary: {
          total: founders.length,
          growthCount,
          earlyCount,
          rematchCount,
          tableCount: allTables.length,
          committed: commit,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e: any) {
    console.error("generate-matches error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
