import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface TableDisplay {
  table_number: number;
  table_name: string;
  theme: string;
  suggested_lead: string;
  companies: { company_name: string; first_name: string; last_name?: string }[];
}

const TABLE_ACCENTS = [
  "hsl(217, 91%, 60%)",  // blue
  "hsl(168, 76%, 42%)",  // teal
  "hsl(142, 71%, 45%)",  // green
  "hsl(45, 93%, 47%)",   // yellow
  "hsl(25, 95%, 53%)",   // orange
  "hsl(0, 72%, 51%)",    // red
  "hsl(330, 81%, 60%)",  // pink
  "hsl(271, 81%, 56%)",  // purple
];

export default function PresentationView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<any>(null);
  const [tables, setTables] = useState<TableDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data: s } = await supabase.from("breakout_sessions").select("*").eq("id", sessionId).single();
      setSession(s);

      const { data: dbTables } = await supabase.from("breakout_tables").select("*").eq("session_id", sessionId).order("table_number");
      if (dbTables) {
        const tableIds = dbTables.map((t) => t.id);
        const { data: assignments } = await supabase.from("breakout_table_assignments").select("*, breakout_companies(*)").in("table_id", tableIds);
        const { data: dbLeads } = await supabase.from("breakout_leads").select("*").eq("session_id", sessionId);

        const display: TableDisplay[] = dbTables.map((t) => {
          const tableAssignments = (assignments || []).filter((a) => a.table_id === t.id);
          return {
            table_number: t.table_number,
            table_name: t.table_name || "",
            theme: t.theme || "",
            suggested_lead: t.suggested_lead || "",
            companies: tableAssignments.map((a) => {
              const m = ((a as any).breakout_companies?.mapped_data || {}) as Record<string, string>;
              return { company_name: m.company_name || "", first_name: m.first_name || "", last_name: m.last_name || "" };
            }),
          };
        });
        setTables(display);
      }
      setLoading(false);
    };
    load();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(230,25%,8%)] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-white/40" />
      </div>
    );
  }

  const gridCols = tables.length <= 4 ? "grid-cols-2" : tables.length <= 6 ? "grid-cols-3" : "grid-cols-4";

  return (
    <div className="min-h-screen bg-[hsl(230,25%,8%)] text-white p-8 flex flex-col">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight">{session?.session_name || "Breakout Session"}</h1>
        {session?.session_date && (
          <p className="text-lg text-white/50 mt-2">{new Date(session.session_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        )}
        {(session?.breakout_start || session?.breakout_end) && (
          <p className="text-white/40 mt-1">{session.breakout_start} – {session.breakout_end}</p>
        )}
      </div>

      {/* Table Grid */}
      <div className={`grid ${gridCols} gap-6 flex-1`}>
        {tables.map((table, i) => {
          const accent = TABLE_ACCENTS[i % TABLE_ACCENTS.length];
          return (
            <div
              key={table.table_number}
              className="rounded-2xl bg-white/[0.06] backdrop-blur border border-white/10 p-6 flex flex-col"
              style={{ borderTopColor: accent, borderTopWidth: 3 }}
            >
              {/* Table header */}
              <div className="mb-4">
                <div className="flex items-baseline gap-3 mb-1">
                  <span
                    className="text-3xl font-black"
                    style={{ color: accent }}
                  >
                    {table.table_number}
                  </span>
                  <h2 className="text-xl font-bold leading-tight">{table.table_name}</h2>
                </div>
                <p className="text-sm text-white/40">{table.theme}</p>
              </div>

              {/* Lead */}
              {table.suggested_lead && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/30">Lead</span>
                  <span className="text-sm font-semibold" style={{ color: accent }}>{table.suggested_lead}</span>
                </div>
              )}

              {/* Participants */}
              <div className="space-y-1.5 flex-1">
                {table.companies.map((c, ci) => (
                  <div key={ci} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-white/[0.04]">
                    <span className="font-medium text-white/90">{c.first_name} {c.last_name}</span>
                    <span className="text-white/40 text-xs truncate ml-2 max-w-[45%] text-right">{c.company_name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-center text-white/20 text-xs mt-6">Find your table and take a seat • Session begins shortly</p>
    </div>
  );
}
