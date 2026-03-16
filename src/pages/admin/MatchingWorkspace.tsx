import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Shuffle,
  Lock,
  Sparkles,
  Check,
  Loader2,
  Monitor,
  Settings2,
} from "lucide-react";
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

interface LeadChip {
  name: string;
  company?: string;
  title?: string;
  expertiseTags?: string[];
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
  assigned_leads: LeadChip[];
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
            assigned_leads: [], // Will be populated from AI response on regeneration
          };
        });
        setTables(tableGroups);
        setHasGenerated(true);
      }

      setLoading(false);
    };
    load();
  }, [sessionId]);

  const toStringArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.filter(Boolean).map((x) => String(x));
    if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  };

  const updateMatchingSettings = async (
    patch: Partial<{
      grouping_priority: string;
      allow_stage_mixing: boolean;
      num_tables: number;
      target_per_table: number;
      avoid_competitors: boolean;
      lead_matching_mode: string;
    }>
  ) => {
    if (!sessionId) return;
    const { data, error } = await supabase
      .from("breakout_sessions")
      .update(patch as any)
      .eq("id", sessionId)
      .select("*")
      .single();

    if (error) {
      console.error("Failed to update session settings:", error);
      toast.error("Failed to update settings");
      return;
    }

    setSessionConfig(data);
  };

  const generateMatches = async () => {
    setIsGenerating(true);
    try {
      const sessionConfigForAi = {
        numTables: sessionConfig?.num_tables ?? undefined,
        targetPerTable: sessionConfig?.target_per_table ?? undefined,
        groupingPriority: sessionConfig?.grouping_priority ?? undefined,
        allowStageMixing: sessionConfig?.allow_stage_mixing ?? undefined,
        avoidCompetitors: sessionConfig?.avoid_competitors ?? true,
        leadMatchingMode: sessionConfig?.lead_matching_mode ?? "flexible",
      };

      const leadsForAi = (leads || []).map((l: any) => ({
        name: l.name ?? "",
        company: l.company ?? "",
        title: l.title ?? "",
        expertiseTags: toStringArray(l.expertise_tags),
        background: l.background ?? "",
      }));

      const { data, error } = await supabase.functions.invoke("generate-matches", {
        body: { companies: fullCompanyData, sessionConfig: sessionConfigForAi, leads: leadsForAi },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const normalizeCompany = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      const fullByName = new Map(
        (fullCompanyData || []).map((fd: any) => [normalizeCompany(fd?.company_name || ""), fd])
      );

      // Add mapped_data to company chips
      const enrichedTables: TableGroup[] = (data.tables || []).map((t: any) => ({
        ...t,
        companies: (t.companies || []).map((c: any) => ({
          ...c,
          mapped_data: fullByName.get(normalizeCompany(c.company_name || "")) || c,
        })),
        assigned_leads: t.assigned_leads || [],
      }));

      setTables(enrichedTables);
      setHasGenerated(true);
      toast.success(`Generated ${enrichedTables.length} table groupings`);

      await saveTablesToDb(enrichedTables);
    } catch (err: any) {
      console.error("Match generation failed:", err);
      toast.error(err.message || "Failed to generate matches");
    } finally {
      setIsGenerating(false);
    }
  };

  const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");

  const saveTablesToDb = async (tableGroups: TableGroup[]) => {
    if (!sessionId) return;

    // Clear previous assignments for this session's tables (assignments have no session_id)
    const { data: existingTables, error: existingTablesError } = await supabase
      .from("breakout_tables")
      .select("id")
      .eq("session_id", sessionId);
    if (existingTablesError) throw existingTablesError;

    const existingTableIds = (existingTables || []).map((t) => t.id);
    if (existingTableIds.length > 0) {
      const { error: delAssignmentsError } = await supabase
        .from("breakout_table_assignments")
        .delete()
        .in("table_id", existingTableIds);
      if (delAssignmentsError) throw delAssignmentsError;
    }

    const { error: delTablesError } = await supabase
      .from("breakout_tables")
      .delete()
      .eq("session_id", sessionId);
    if (delTablesError) throw delTablesError;

    const { data: dbCompanies, error: companiesError } = await supabase
      .from("breakout_companies")
      .select("id, mapped_data")
      .eq("session_id", sessionId);
    if (companiesError) throw companiesError;

    const companyByName = new Map<string, string>();
    const companyByPerson = new Map<string, string>();
    (dbCompanies || []).forEach((c) => {
      const m = (c.mapped_data as any) || {};
      if (m.company_name) companyByName.set(normalize(m.company_name), c.id);
      const personKey = normalize((m.first_name || "") + (m.last_name || ""));
      if (personKey) companyByPerson.set(personKey, c.id);
    });

    let totalMatched = 0;
    let totalExpected = 0;

    for (const table of tableGroups) {
      const { data: insertedTable, error: insertTableError } = await supabase
        .from("breakout_tables")
        .insert({
          session_id: sessionId,
          table_number: table.table_number,
          table_name: table.table_name,
          theme: table.theme,
          stage_mix: table.stage_mix,
          suggested_lead: table.suggested_lead,
          rationale: table.rationale,
          shared_challenges: table.shared_challenges as any,
        })
        .select()
        .single();

      if (insertTableError) throw insertTableError;
      if (!insertedTable) continue;

      const assignments = table.companies
        .map((c) => {
          totalExpected++;
          const byName = companyByName.get(normalize(c.company_name || ""));
          if (byName) return { table_id: insertedTable.id, company_id: byName };
          const byPerson = companyByPerson.get(
            normalize((c.first_name || "") + (c.last_name || ""))
          );
          if (byPerson) return { table_id: insertedTable.id, company_id: byPerson };
          console.warn(`[Match] Unmatched company: "${c.company_name}" / "${c.first_name} ${c.last_name}"`);
          return null;
        })
        .filter(Boolean);

      totalMatched += assignments.length;
      if (assignments.length > 0) {
        const { error: insertAssignmentsError } = await supabase
          .from("breakout_table_assignments")
          .insert(assignments as any);
        if (insertAssignmentsError) throw insertAssignmentsError;
      }
    }

    console.log(`[Match] Saved ${totalMatched}/${totalExpected} assignments`);
    const { error: statusError } = await supabase
      .from("breakout_sessions")
      .update({ status: "matched" })
      .eq("id", sessionId);
    if (statusError) throw statusError;
  };

  const handleFinalize = async () => {
    if (!sessionId) return;
    await supabase.from("breakout_sessions").update({ status: "finalized" }).eq("id", sessionId);
    toast.success("Session finalized!");
    navigate(`/admin/leads/${sessionId}`);
  };

  const handleLeadDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const srcTableIdx = parseInt(source.droppableId.replace("leads-", ""));
    const destTableIdx = parseInt(destination.droppableId.replace("leads-", ""));
    setTables((prev) => {
      const next = prev.map((t) => ({ ...t, assigned_leads: [...t.assigned_leads] }));
      const [movedLead] = next[srcTableIdx].assigned_leads.splice(source.index, 1);
      next[destTableIdx].assigned_leads.splice(destination.index, 0, movedLead);
      next[srcTableIdx].suggested_lead = next[srcTableIdx].assigned_leads[0]?.name || "";
      next[destTableIdx].suggested_lead = next[destTableIdx].assigned_leads[0]?.name || "";
      return next;
    });
  }, []);

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
            <Input
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
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
                {c.sector && (
                  <Badge variant="outline" className="text-xs shrink-0 ml-2">{c.sector}</Badge>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t p-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span className="inline-flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-heading font-semibold text-sm">Matching Settings</span>
                </span>
                <Badge variant="secondary" className="text-xs font-mono capitalize">
                  {sessionConfig?.grouping_priority || "hybrid"}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" align="end" className="w-80 p-0">
              <div className="px-4 py-3 border-b">
                <h3 className="font-heading font-semibold text-sm">Matching Settings</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Changes apply on next generation</p>
              </div>

              {/* TABLE STRUCTURE */}
              <div className="px-4 py-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Table Structure</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Number of Tables</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={sessionConfig?.num_tables ?? 5}
                      onChange={(e) => updateMatchingSettings({ num_tables: parseInt(e.target.value) || 5 })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Target per Table</Label>
                    <Input
                      type="number"
                      min={2}
                      max={20}
                      value={sessionConfig?.target_per_table ?? 6}
                      onChange={(e) => updateMatchingSettings({ target_per_table: parseInt(e.target.value) || 6 })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* GROUPING */}
              <div className="px-4 py-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grouping</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Priority</Label>
                  <Select
                    value={sessionConfig?.grouping_priority || "hybrid"}
                    onValueChange={(v) => updateMatchingSettings({ grouping_priority: v })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sector">Sector</SelectItem>
                      <SelectItem value="stage">Stage</SelectItem>
                      <SelectItem value="need">Need</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Allow Stage Mixing</Label>
                    <p className="text-xs text-muted-foreground">Mix early &amp; growth-stage companies</p>
                  </div>
                  <Switch
                    checked={!!sessionConfig?.allow_stage_mixing}
                    onCheckedChange={(checked) => updateMatchingSettings({ allow_stage_mixing: checked })}
                  />
                </div>
              </div>

              <Separator />

              {/* AI BEHAVIOR */}
              <div className="px-4 py-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Behavior</p>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Avoid Direct Competitors</Label>
                    <p className="text-xs text-muted-foreground">Prevent rival companies from sitting together</p>
                  </div>
                  <Switch
                    checked={sessionConfig?.avoid_competitors !== false}
                    onCheckedChange={(checked) => updateMatchingSettings({ avoid_competitors: checked })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lead Matching</Label>
                  <Select
                    value={sessionConfig?.lead_matching_mode || "flexible"}
                    onValueChange={(v) => updateMatchingSettings({ lead_matching_mode: v })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flexible">Flexible</SelectItem>
                      <SelectItem value="strict">Strict</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {sessionConfig?.lead_matching_mode === "strict"
                      ? "Lead expertise must directly match the table theme."
                      : "AI prefers matching lead expertise to theme but can override."}
                  </p>
                </div>
              </div>

              <div className="px-4 py-2.5 border-t bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  Leads loaded: <span className="text-foreground font-medium">{leads.length}</span>
                </p>
              </div>
            </PopoverContent>
          </Popover>
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
            <DragDropContext onDragEnd={handleLeadDragEnd}>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {tables.map((table, i) => (
                  <TableCard key={table.table_number} table={table} tableIndex={i} colorClass={TABLE_COLORS[i % TABLE_COLORS.length]} onCompanyClick={openProfile} />
                ))}
              </div>
            </DragDropContext>
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

function TableCard({ table, tableIndex, colorClass, onCompanyClick }: { table: TableGroup; tableIndex: number; colorClass: string; onCompanyClick: (data: Record<string, string>) => void }) {
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

        {/* Assigned Leads - Droppable */}
        {table.assigned_leads && table.assigned_leads.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Leads</p>
            <Droppable droppableId={`leads-${tableIndex}`}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "space-y-1 min-h-[32px] rounded p-1 transition-colors",
                    snapshot.isDraggingOver && "bg-primary/10 ring-1 ring-primary/30"
                  )}
                >
                  {table.assigned_leads.map((lead, li) => (
                    <Draggable key={`${tableIndex}-lead-${li}`} draggableId={`${tableIndex}-lead-${li}-${lead.name}`} index={li}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            "text-xs flex items-center justify-between p-1.5 rounded bg-primary/10 border border-primary/20 cursor-grab",
                            snapshot.isDragging && "shadow-lg ring-2 ring-primary/40"
                          )}
                        >
                          <span className="font-medium text-primary">{lead.name}</span>
                          {lead.title && <span className="text-muted-foreground truncate ml-2">{lead.title}</span>}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        )}

        {/* Empty lead drop zone when no leads assigned */}
        {(!table.assigned_leads || table.assigned_leads.length === 0) && (
          <Droppable droppableId={`leads-${tableIndex}`}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "min-h-[32px] rounded p-1 transition-colors border border-dashed border-muted-foreground/20",
                  snapshot.isDraggingOver && "bg-primary/10 ring-1 ring-primary/30"
                )}
              >
                <p className="text-xs text-muted-foreground/50 text-center py-1">Drop lead here</p>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        )}

        {/* Companies */}
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
