import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Cache-Control": "no-store",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let breakoutId = url.searchParams.get("breakoutId");
    if (!breakoutId && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      breakoutId = body?.breakoutId || null;
    }
    if (!breakoutId) {
      return new Response(JSON.stringify({ error: "breakoutId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: session, error: sErr } = await supabase
      .from("breakout_sessions")
      .select("id, session_name, session_date, breakout_start, breakout_end, prompts, status")
      .eq("id", breakoutId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!session) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tables } = await supabase
      .from("breakout_tables")
      .select("id, table_number, table_name, theme")
      .eq("session_id", breakoutId)
      .eq("is_backup", false)
      .order("table_number");

    const { data: tableLeads } = await supabase
      .from("breakout_table_leads")
      .select("table_id, lead:lead_pool(name, title, company)")
      .eq("breakout_id", breakoutId);

    const { data: rsvps } = await supabase
      .from("breakout_rsvps")
      .select("founder_id, manual_table_override, founder:founder_pool(id, company_name, first_name, last_name)")
      .eq("breakout_id", breakoutId)
      .eq("rsvpd", true);

    const { data: seating } = await supabase
      .from("breakout_seating")
      .select("founder_id, table_id")
      .eq("breakout_id", breakoutId);

    const seatByFounder = new Map<string, string>();
    for (const s of seating || []) {
      if (s.table_id) seatByFounder.set(s.founder_id, s.table_id);
    }

    const leadsByTable = new Map<string, any[]>();
    for (const tl of tableLeads || []) {
      if (!tl.table_id || !tl.lead) continue;
      if (!leadsByTable.has(tl.table_id)) leadsByTable.set(tl.table_id, []);
      leadsByTable.get(tl.table_id)!.push(tl.lead);
    }

    const foundersByTable = new Map<string, any[]>();
    for (const r of rsvps || []) {
      const tableId = r.manual_table_override || seatByFounder.get(r.founder_id);
      if (!tableId || !r.founder) continue;
      if (!foundersByTable.has(tableId)) foundersByTable.set(tableId, []);
      foundersByTable.get(tableId)!.push({
        company_name: (r.founder as any).company_name || "",
        first_name: (r.founder as any).first_name || "",
        last_name: (r.founder as any).last_name || "",
      });
    }

    const safeTables = (tables || []).map((t) => ({
      id: t.id,
      table_number: t.table_number,
      table_name: t.table_name || "",
      theme: t.theme || "",
      leads: leadsByTable.get(t.id) || [],
      founders: (foundersByTable.get(t.id) || []).sort((a, b) =>
        a.company_name.localeCompare(b.company_name),
      ),
    }));

    return new Response(
      JSON.stringify({
        session: {
          id: session.id,
          session_name: session.session_name,
          session_date: session.session_date,
          breakout_start: session.breakout_start,
          breakout_end: session.breakout_end,
          prompts: session.prompts || [],
          status: session.status,
        },
        tables: safeTables,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e: any) {
    console.error("get-public-breakout error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
