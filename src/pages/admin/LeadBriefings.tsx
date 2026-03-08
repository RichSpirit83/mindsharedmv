import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Copy, Download, Loader2, Users, Sparkles, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface TableData {
  id: string;
  table_number: number;
  table_name: string;
  theme: string;
  stage_mix: string;
  suggested_lead: string;
  rationale: string;
  shared_challenges: string[];
  companies: Record<string, string>[];
}

export default function LeadBriefings() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableData[]>([]);
  const [session, setSession] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [briefings, setBriefings] = useState<Record<number, string>>({});
  const [generating, setGenerating] = useState<Record<number, boolean>>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data: s } = await supabase.from("breakout_sessions").select("*").eq("id", sessionId).single();
      setSession(s);

      const { data: dbLeads } = await supabase.from("breakout_leads").select("*").eq("session_id", sessionId);
      setLeads(dbLeads || []);

      const { data: dbTables } = await supabase.from("breakout_tables").select("*").eq("session_id", sessionId).order("table_number");
      if (dbTables) {
        const tableIds = dbTables.map((t) => t.id);
        const { data: assignments } = await supabase.from("breakout_table_assignments").select("*, breakout_companies(*)").in("table_id", tableIds);

        const enriched: TableData[] = dbTables.map((t) => {
          const tableAssignments = (assignments || []).filter((a) => a.table_id === t.id);
          return {
            id: t.id,
            table_number: t.table_number,
            table_name: t.table_name || "",
            theme: t.theme || "",
            stage_mix: t.stage_mix || "",
            suggested_lead: t.suggested_lead || "",
            rationale: t.rationale || "",
            shared_challenges: (t.shared_challenges as string[]) || [],
            companies: tableAssignments.map((a) => ((a as any).breakout_companies?.mapped_data || {}) as Record<string, string>),
          };
        });
        setTables(enriched);
      }
      setLoading(false);
    };
    load();
  }, [sessionId]);

  const trimCompany = (c: Record<string, string>) => ({
    company_name: c.company_name || "",
    first_name: c.first_name || "",
    last_name: c.last_name || "",
    sector: c.sector || "",
    sales_stage: c.sales_stage || c.stage || "",
    revenue: c.revenue || "",
    capital_raised: c.capital_raised || "",
    critical_challenges: (c.critical_challenges || "").slice(0, 200),
    company_description: (c.company_description || "").slice(0, 150),
  });

  const generateBriefing = async (table: TableData) => {
    setGenerating((prev) => ({ ...prev, [table.table_number]: true }));
    try {
      const lead = leads.find((l) => l.name === table.suggested_lead);
      const trimmedCompanies = table.companies.map(trimCompany);
      const { data, error } = await supabase.functions.invoke("generate-briefing", {
        body: {
          table: { table_name: table.table_name, table_number: table.table_number, theme: table.theme, rationale: table.rationale, stage_mix: table.stage_mix },
          companies: trimmedCompanies,
          lead: lead ? { name: lead.name, expertise_tags: lead.expertise_tags, network_strengths: lead.network_strengths } : null,
          prompts: (session?.prompts as string[]) || [],
          sessionName: session?.session_name,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBriefings((prev) => ({ ...prev, [table.table_number]: data.briefing }));
      toast.success(`Briefing generated for Table ${table.table_number}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate briefing");
    } finally {
      setGenerating((prev) => ({ ...prev, [table.table_number]: false }));
    }
  };

  const generateAllBriefings = async () => {
    for (const t of tables) {
      if (!briefings[t.table_number]) {
        await generateBriefing(t);
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  };

  const copyBriefing = (tableNum: number) => {
    const text = briefings[tableNum];
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Briefing copied to clipboard");
  };

  const downloadBriefing = (table: TableData) => {
    const text = briefings[table.table_number];
    if (!text) return;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Briefing - ${table.table_name}</title>
<style>
body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1a1a2e; }
h1 { font-size: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
h2 { font-size: 18px; margin-top: 24px; color: #2563eb; }
h3 { font-size: 15px; margin-top: 16px; }
ul { padding-left: 20px; }
li { margin-bottom: 4px; }
strong { color: #1a1a2e; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.badge { background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
@media print { body { margin: 20px; } }
</style>
</head><body>
<div class="header">
<div><h1>${table.table_name}</h1><p>Table ${table.table_number} • ${table.stage_mix}</p></div>
</div>
<div>${text.replace(/\n/g, '<br>')}</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `briefing-table-${table.table_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
            <CardContent><Skeleton className="h-32 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate(`/admin/matching/${sessionId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Matching
        </Button>
        <h1 className="font-heading text-2xl font-bold">Table Lead Briefings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {session?.session_name ? `${session.session_name} — ` : ""}
          Generate personalized briefing documents for each table lead.
        </p>
      </div>

      {tables.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold mb-2">No Tables Found</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Finalize your matches in the Matching Workspace before generating briefings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <Button
              onClick={() => tables.forEach((t) => { if (!briefings[t.table_number]) generateBriefing(t); })}
              disabled={Object.values(generating).some(Boolean)}
            >
              <Sparkles className="h-4 w-4 mr-1" /> Generate All Briefings
            </Button>
          </div>

          <div className="space-y-6">
            {tables.map((table) => (
              <Card key={table.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-heading text-lg flex items-center gap-2">
                        Table {table.table_number}: {table.table_name}
                        <Badge variant="outline" className="text-xs font-normal">{table.stage_mix}</Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{table.theme}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{table.companies.length} companies</span>
                      {table.suggested_lead && (
                        <Badge variant="secondary" className="text-xs">Lead: {table.suggested_lead}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!briefings[table.table_number] ? (
                    <Button
                      onClick={() => generateBriefing(table)}
                      disabled={generating[table.table_number]}
                      className="w-full"
                    >
                      {generating[table.table_number] ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating Briefing...</>
                      ) : (
                        <><FileText className="h-4 w-4 mr-2" /> Generate Briefing</>
                      )}
                    </Button>
                  ) : (
                    <>
                      <div className="prose prose-sm max-w-none p-4 bg-muted/30 rounded-lg border text-sm leading-relaxed">
                        <ReactMarkdown>{briefings[table.table_number]}</ReactMarkdown>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyBriefing(table.table_number)}>
                          <Copy className="h-4 w-4 mr-1" /> Copy
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadBriefing(table)}>
                          <Download className="h-4 w-4 mr-1" /> Download
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => generateBriefing(table)} disabled={generating[table.table_number]}>
                          {generating[table.table_number] ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                          Regenerate
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
