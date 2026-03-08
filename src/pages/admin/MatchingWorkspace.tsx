import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Shuffle, Lock, Sparkles, Check, Loader2, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import FounderProfileDialog from "@/components/FounderProfileDialog";

const TABLE_COLORS = [
  "bg-table-blue", "bg-table-teal", "bg-table-green", "bg-table-yellow",
  "bg-table-orange", "bg-table-red", "bg-table-pink", "bg-table-purple",
];

interface CompanyChip {
  company_name: string;
  first_name: string;
  last_name?: string;
  sector?: string;
  stage?: string;
  revenue?: string;
  mapped_data?: Record<string, string>;
}

interface TableGroup {
  table_number: number;
  table_name: string;
  theme: string;
  stage_mix: string;
  suggested_lead: string;
  rationale: string;
  shared_challenges: string[];
  companies: CompanyChip[];
}

export default function MatchingWorkspace() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [sessionConfig, setSessionConfig] = useState<any>(null);
  const [companies, setCompanies] = useState<CompanyChip[]>([]);
  const [fullCompanyData, setFullCompanyData] = useState<Record<string, string>[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [tables, setTables] = useState<TableGroup[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Record<string, string> | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // Load from DB
  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data: session } = await supabase.from("breakout_sessions").select("*").eq("id", sessionId).single();
      if (!session) { toast.error("Session not found"); navigate("/admin"); return; }
      setSessionConfig(session);

      const { data: dbCompanies } = await supabase.from("breakout_companies").select("*").eq("session_id", sessionId);
      if (dbCompanies) {
        const chips: CompanyChip[] = dbCompanies.map((c) => {
          const m = (c.mapped_data || {}) as Record<string, string>;
          return {
            company_name: m.company_name || "",
            first_name: m.first_name || "",
            last_name: m.last_name || "",
            sector: m.sector || "",
            stage: m.sales_stage || "",
            revenue: m.revenue || "",
            mapped_data: m,
          };
        });
        setCompanies(chips);
        setFullCompanyData(dbCompanies.map((c) => (c.mapped_data || {}) as Record<string, string>));
      }

      const { data: dbLeads } = await supabase.from("breakout_leads").select("*").eq("session_id", sessionId);
      if (dbLeads) setLeads(dbLeads);

      // Load existing tables
      const { data: dbTables } = await supabase.from("breakout_tables").select("*").eq("session_id", sessionId).order("table_number");
      if (dbTables && dbTables.length > 0) {
        // Load assignments
        const tableIds = dbTables.map((t) => t.id);
        const { data: assignments } = await supabase.from("breakout_table_assignments").select("*, breakout_companies(*)").in("table_id", tableIds);

        const tableGroups: TableGroup[] = dbTables.map((t) => {
          const tableAssignments = (assignments || []).filter((a) => a.table_id === t.id);
          const tableCompanies = tableAssignments.map((a) => {
            const m = ((a as any).breakout_companies?.mapped_data || {}) as Record<string, string>;
            return {
              company_name: m.company_name || "",
              first_name: m.first_name || "",
              last_name: m.last_name || "",
              sector: m.sector || "",
              stage: m.sales_stage || "",
              revenue: m.revenue || "",
              mapped_data: m,
            };
          });
          return {
            table_number: t.table_number,
            table_name: t.table_name || "",
            theme: t.theme || "",
            stage_mix: t.stage_mix || "",
            suggested_lead: t.suggested_lead || "",
            rationale: t.rationale || "",
            shared_challenges: (t.shared_challenges as string[]) || [],
            companies: tableCompanies,
          };
        });
        setTables(tableGroups);
        setHasGenerated(true);
      }

      setLoading(false);
    };
    load();
  }, [sessionId]);

  const generateMatches = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-matches", {
        body: { companies: fullCompanyData, sessionConfig, leads },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Add mapped_data to company chips
      const enrichedTables = (data.tables || []).map((t: any) => ({
        ...t,
        companies: (t.companies || []).map((c: any) => ({
          ...c,
          mapped_data: fullCompanyData.find((fd) => fd.company_name === c.company_name) || c,
        })),
      }));

      setTables(enrichedTables);
      setHasGenerated(true);
      toast.success(`Generated ${enrichedTables.length} table groupings`);

      // Save to DB
      await saveTablesToDb(enrichedTables);
    } catch (err: any) {
      console.error("Match generation failed:", err);
      toast.error(err.message || "Failed to generate matches");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveTablesToDb = async (tableGroups: TableGroup[]) => {
    if (!sessionId) return;
    // Delete old tables (cascade deletes assignments)
    await supabase.from("breakout_tables").delete().eq("session_id", sessionId);

    // Get all company records to map by company_name
    const { data: dbCompanies } = await supabase.from("breakout_companies").select("id, mapped_data").eq("session_id", sessionId);
    const companyIdMap = new Map<string, string>();
    (dbCompanies || []).forEach((c) => {
      const name = (c.mapped_data as any)?.company_name;
      if (name) companyIdMap.set(name, c.id);
    });

    for (const table of tableGroups) {
      const { data: insertedTable } = await supabase.from("breakout_tables").insert({
        session_id: sessionId,
        table_number: table.table_number,
        table_name: table.table_name,
        theme: table.theme,
        stage_mix: table.stage_mix,
        suggested_lead: table.suggested_lead,
        rationale: table.rationale,
        shared_challenges: table.shared_challenges as any,
      }).select().single();

      if (insertedTable) {
        const assignments = table.companies
          .map((c) => {
            const companyId = companyIdMap.get(c.company_name);
            return companyId ? { table_id: insertedTable.id, company_id: companyId } : null;
          })
          .filter(Boolean);
        if (assignments.length > 0) {
          await supabase.from("breakout_table_assignments").insert(assignments as any);
        }
      }
    }

    // Update session status
    await supabase.from("breakout_sessions").update({ status: "matched" }).eq("id", sessionId);
  };

  const handleFinalize = async () => {
    if (!sessionId) return;
    await supabase.from("breakout_sessions").update({ status: "finalized" }).eq("id", sessionId);
    toast.success("Session finalized!");
    navigate(`/admin/leads/${sessionId}`);
  };

  const openProfile = (data: Record<string, string>) => {
    setSelectedProfile(data);
    setProfileOpen(true);
  };

  const filteredCompanies = companies.filter(
    (c) =>
      c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.first_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-fade-in">
      <FounderProfileDialog open={profileOpen} onOpenChange={setProfileOpen} data={selectedProfile} />

      {/* Left Panel */}
      <div className="w-80 border-r bg-card flex flex-col">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-sm">Companies</h2>
            <Badge variant="secondary" className="text-xs">{companies.length}</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search companies..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-1">
          {companies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No companies loaded.</p>
              <p className="text-xs mt-1">Go back to Session Config to upload a CSV.</p>
            </div>
          ) : (
            filteredCompanies.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm cursor-pointer"
                onClick={() => c.mapped_data && openProfile(c.mapped_data)}
              >
                <div>
                  <p className="font-medium truncate">{c.company_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground">{c.first_name} {c.last_name}</p>
                </div>
                {c.sector && <Badge variant="outline" className="text-xs shrink-0 ml-2">{c.sector}</Badge>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-card">
          <div>
            <h2 className="font-heading font-semibold">Matching Workspace</h2>
            {sessionConfig?.session_name && (
              <p className="text-xs text-muted-foreground">{sessionConfig.session_name}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              <Lock className="h-4 w-4 mr-1" /> Lock All
            </Button>
            <Button size="sm" disabled={isGenerating || companies.length === 0} onClick={generateMatches}>
              <Sparkles className="h-4 w-4 mr-1" />
              {isGenerating ? "Generating..." : "Generate Matches"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {isGenerating ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-60 mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !hasGenerated ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <Shuffle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="font-heading text-lg font-semibold mb-2">Ready to Match</h3>
                <p className="text-muted-foreground text-sm">
                  {companies.length > 0
                    ? `${companies.length} companies loaded. Click "Generate Matches" to create optimized table groupings.`
                    : 'Configure your session and upload company data first.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tables.map((table, i) => (
                <TableCard key={table.table_number} table={table} colorClass={TABLE_COLORS[i % TABLE_COLORS.length]} onCompanyClick={openProfile} />
              ))}
            </div>
          )}
        </div>

        {hasGenerated && (
          <div className="p-4 border-t bg-card flex justify-end gap-2">
            <Button variant="outline" onClick={generateMatches} disabled={isGenerating}>
              {isGenerating ? "Regenerating..." : "Regenerate All"}
            </Button>
            <Button variant="outline" onClick={() => window.open(`/admin/present/${sessionId}`, '_blank')}>
              <Monitor className="h-4 w-4 mr-1" /> Present
            </Button>
            <Button onClick={handleFinalize}>
              <Check className="h-4 w-4 mr-1" /> Finalize & Continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TableCard({ table, colorClass, onCompanyClick }: { table: TableGroup; colorClass: string; onCompanyClick: (data: Record<string, string>) => void }) {
  return (
    <Card className="relative overflow-hidden">
      <div className={cn("absolute top-0 left-0 w-1 h-full", colorClass)} />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-sm">Table {table.table_number}</span>
            <Badge variant="outline" className="text-xs">{table.stage_mix}</Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Lock className="h-3 w-3" />
          </Button>
        </div>
        <CardTitle className="text-base font-heading">{table.table_name}</CardTitle>
        <p className="text-xs text-muted-foreground">{table.theme}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {table.shared_challenges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {table.shared_challenges.map((c, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
            ))}
          </div>
        )}
        {table.companies.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No companies assigned yet</p>
        ) : (
          <div className="space-y-1">
            {table.companies.map((c, i) => (
              <div
                key={i}
                className="text-xs flex items-center justify-between p-1.5 rounded bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => c.mapped_data && onCompanyClick(c.mapped_data)}
              >
                <span className="font-medium">{c.company_name}</span>
                <span className="text-muted-foreground">{c.first_name}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
