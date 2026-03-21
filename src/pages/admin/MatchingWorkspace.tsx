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
  Download,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import FounderProfileDialog from "@/components/FounderProfileDialog";
import LeadProfileDialog from "@/components/LeadProfileDialog";
import LeadSelectionDialog from "@/components/LeadSelectionDialog";
import jsPDF from "jspdf";

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
  background?: string;
  email?: string;
  linkedinUrl?: string;
  website?: string;
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
  round_number: number;
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
  const [selectedLead, setSelectedLead] = useState<LeadChip | null>(null);
  const [leadProfileOpen, setLeadProfileOpen] = useState(false);
  const [activeRound, setActiveRound] = useState(1);
  const [leadPoolData, setLeadPoolData] = useState<any[]>([]);
  const [leadSelectionOpen, setLeadSelectionOpen] = useState(false);
  const [pendingTableLeads, setPendingTableLeads] = useState<any[]>([]);

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

      // Load lead pool to check for "Table Lead" tags
      const { data: poolData } = await supabase.from("lead_pool").select("*") as any;
      if (poolData) setLeadPoolData(poolData);
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
            round_number: (t as any).round_number ?? 1,
            assigned_leads: (t.suggested_lead || "").split(",").map((n: string) => n.trim()).filter(Boolean).map((name: string) => {
              const lead = (dbLeads || []).find((l: any) => l.name === name);
              return lead
                ? { name: lead.name, company: lead.company || "", title: lead.title || "", expertiseTags: (lead.expertise_tags as string[]) || [], background: lead.background || "", email: lead.email || "", linkedinUrl: lead.linkedin_url || "", website: lead.website || "" }
                : { name, company: "", title: "", expertiseTags: [] };
            }),
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

  // Get per-round settings, falling back to session-level defaults
  const getRoundSettings = (round: number) => {
    const rs = (sessionConfig?.round_settings as Record<string, any>) || {};
    const roundKey = String(round);
    return {
      grouping_priority: rs[roundKey]?.grouping_priority ?? sessionConfig?.grouping_priority ?? "hybrid",
      allow_stage_mixing: rs[roundKey]?.allow_stage_mixing ?? sessionConfig?.allow_stage_mixing ?? true,
      num_tables: rs[roundKey]?.num_tables ?? sessionConfig?.num_tables ?? 5,
      target_per_table: rs[roundKey]?.target_per_table ?? sessionConfig?.target_per_table ?? 6,
      avoid_competitors: rs[roundKey]?.avoid_competitors ?? sessionConfig?.avoid_competitors ?? true,
      lead_matching_mode: rs[roundKey]?.lead_matching_mode ?? sessionConfig?.lead_matching_mode ?? "flexible",
      shuffle_mode: rs[roundKey]?.shuffle_mode ?? "both",
    };
  };

  const activeRoundSettings = getRoundSettings(activeRound);

  const updateMatchingSettings = async (
    patch: Partial<{
      grouping_priority: string;
      allow_stage_mixing: boolean;
      num_tables: number;
      target_per_table: number;
      avoid_competitors: boolean;
      lead_matching_mode: string;
      shuffle_mode: string;
    }>
  ) => {
    if (!sessionId) return;
    const currentRoundSettings = (sessionConfig?.round_settings as Record<string, any>) || {};
    const roundKey = String(activeRound);
    const updatedRoundSettings = {
      ...currentRoundSettings,
      [roundKey]: {
        ...(currentRoundSettings[roundKey] || {}),
        ...patch,
      },
    };

    const { data, error } = await supabase
      .from("breakout_sessions")
      .update({ round_settings: updatedRoundSettings } as any)
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
      const rs = getRoundSettings(activeRound);
      const sessionConfigForAi = {
        numTables: rs.num_tables,
        targetPerTable: rs.target_per_table,
        groupingPriority: rs.grouping_priority,
        allowStageMixing: rs.allow_stage_mixing,
        avoidCompetitors: rs.avoid_competitors,
        leadMatchingMode: rs.lead_matching_mode,
        shuffleMode: rs.shuffle_mode,
      };

      const leadsForAi = (leads || []).map((l: any) => ({
        name: l.name ?? "",
        company: l.company ?? "",
        title: l.title ?? "",
        expertiseTags: toStringArray(l.expertise_tags),
        background: l.background ?? "",
      }));

      // For shuffle modes, pass previous round's tables as context
      let previousRoundTables: TableGroup[] | undefined;
      if (activeRound > 1 && rs.shuffle_mode !== "both") {
        previousRoundTables = tables.filter((t) => t.round_number === activeRound - 1);
      }

      const { data, error } = await supabase.functions.invoke("generate-matches", {
        body: { companies: fullCompanyData, sessionConfig: sessionConfigForAi, leads: leadsForAi, previousRoundTables },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const normalizeCompany = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      const fullByName = new Map(
        (fullCompanyData || []).map((fd: any) => [normalizeCompany(fd?.company_name || ""), fd])
      );

      // Add mapped_data and round_number to company chips
      const enrichedTables: TableGroup[] = (data.tables || []).map((t: any) => ({
        ...t,
        round_number: activeRound,
        companies: (t.companies || []).map((c: any) => ({
          ...c,
          mapped_data: fullByName.get(normalizeCompany(c.company_name || "")) || c,
        })),
        assigned_leads: (t.assigned_leads || []).map((al: any) => {
          const dbLead = leads.find((l: any) => l.name === al.name);
          return dbLead
            ? { ...al, company: dbLead.company || al.company || "", background: dbLead.background || "", email: dbLead.email || "", linkedinUrl: dbLead.linkedin_url || "", website: dbLead.website || "", expertiseTags: (dbLead.expertise_tags as string[]) || al.expertiseTags || [] }
            : al;
        }),
      }));

      // Merge with tables from other rounds
      setTables((prev) => {
        const otherRounds = prev.filter((t) => t.round_number !== activeRound);
        return [...otherRounds, ...enrichedTables].sort((a, b) => a.round_number - b.round_number || a.table_number - b.table_number);
      });
      setHasGenerated(true);
      toast.success(`Generated ${enrichedTables.length} table groupings for Round ${activeRound}`);

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
          suggested_lead: (table.assigned_leads || []).map((l: any) => l.name).join(", ") || table.suggested_lead,
          rationale: table.rationale,
          shared_challenges: table.shared_challenges as any,
          round_number: table.round_number ?? 1,
        } as any)
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

  const handleDownloadPdf = () => {
    if (tables.length === 0) { toast.error("No tables to export"); return; }
    toast.info("Generating PDF...");
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;

      // Group tables by round
      const rounds = Array.from(new Set(tables.map((t) => t.round_number))).sort((a, b) => a - b);

      rounds.forEach((round, roundIdx) => {
        if (roundIdx > 0) pdf.addPage();
        const roundTables = tables.filter((t) => t.round_number === round);

        // Title
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 30, 30);
        const title = sessionConfig?.session_name || "Matching Workspace";
        const dateStr = sessionConfig?.session_date ? ` — ${sessionConfig.session_date}` : "";
        const roundLabel = rounds.length > 1 ? ` — Round ${round}` : "";
        pdf.text(`${title}${dateStr}${roundLabel}`, margin, margin + 4);

        const topOffset = margin + 8;
        const availW = pageW - margin * 2;
        const availH = pageH - topOffset - margin;

        const count = roundTables.length;
        const cols = count <= 2 ? count : count <= 4 ? 2 : count <= 6 ? 3 : count <= 9 ? 3 : 4;
        const rows = Math.ceil(count / cols);
        const cellW = availW / cols;
        const cellH = availH / rows;
        const pad = 2;

        roundTables.forEach((table, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = margin + col * cellW + pad;
          const y = topOffset + row * cellH + pad;
          const innerW = cellW - pad * 2;
          let cy = y;

          pdf.setFontSize(8);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(20, 20, 20);
          pdf.text(`Table ${table.table_number}${table.table_name ? ` — ${table.table_name}` : ""}`, x, cy + 3);
          cy += 4;

          if (table.theme) {
            pdf.setFontSize(6);
            pdf.setFont("helvetica", "italic");
            pdf.setTextColor(100, 100, 100);
            const themeLines = pdf.splitTextToSize(table.theme, innerW);
            pdf.text(themeLines.slice(0, 2), x, cy + 2.5);
            cy += themeLines.slice(0, 2).length * 2.5;
          }
          cy += 1;

          if (table.assigned_leads && table.assigned_leads.length > 0) {
            pdf.setFontSize(6);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(0, 90, 160);
            pdf.text("TABLE HEAD", x, cy + 2.5);
            cy += 3;
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(40, 40, 40);
            table.assigned_leads.forEach((lead) => {
              if (cy + 2.5 > y + cellH - pad) return;
              const txt = `${lead.name}${lead.company ? ` (${lead.company})` : ""}`;
              pdf.text(pdf.splitTextToSize(txt, innerW)[0] || txt, x, cy + 2.5);
              cy += 2.8;
            });
          }
          cy += 1.5;

          pdf.setFontSize(6);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0, 120, 60);
          pdf.text("COMPANIES", x, cy + 2.5);
          cy += 3;

          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(40, 40, 40);
          pdf.setFontSize(5.5);
          table.companies.forEach((c) => {
            if (cy + 2.5 > y + cellH - pad) return;
            const name = c.company_name || "Unknown";
            const founder = [c.first_name, c.last_name].filter(Boolean).join(" ");
            const txt = founder ? `${name} — ${founder}` : name;
            pdf.text(pdf.splitTextToSize(txt, innerW)[0] || txt, x, cy + 2.2);
            cy += 2.5;
          });

          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.2);
          pdf.rect(margin + col * cellW, topOffset + row * cellH, cellW, cellH);
        });
      });

      pdf.save(`${sessionConfig?.session_name || "matching"}-workspace.pdf`);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF");
    }
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
      <LeadProfileDialog open={leadProfileOpen} onOpenChange={setLeadProfileOpen} lead={selectedLead} />

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
                   <span className="font-heading font-semibold text-sm">Round {activeRound} Settings</span>
                 </span>
                 <Badge variant="secondary" className="text-xs font-mono capitalize">
                   {activeRoundSettings.grouping_priority}
                 </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" align="end" className="w-80 p-0">
               <div className="px-4 py-3 border-b">
                 <h3 className="font-heading font-semibold text-sm">Round {activeRound} Settings</h3>
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
                       value={activeRoundSettings.num_tables}
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
                       value={activeRoundSettings.target_per_table}
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
                     value={activeRoundSettings.grouping_priority}
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
                     checked={activeRoundSettings.allow_stage_mixing}
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
                     checked={activeRoundSettings.avoid_competitors}
                     onCheckedChange={(checked) => updateMatchingSettings({ avoid_competitors: checked })}
                   />
                 </div>
                 <div className="space-y-1.5">
                   <Label className="text-xs">Lead Matching</Label>
                   <Select
                     value={activeRoundSettings.lead_matching_mode}
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
                     {activeRoundSettings.lead_matching_mode === "strict"
                       ? "Lead expertise must directly match the table theme."
                       : "AI prefers matching lead expertise to theme but can override."}
                   </p>
                 </div>
               </div>

               <Separator />

               {/* MULTI-ROUND SHUFFLE */}
               <div className="px-4 py-3 space-y-3">
                 <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Multi-Round Shuffle</p>
                 <div className="space-y-1.5">
                   <Label className="text-xs">Shuffle Mode</Label>
                   <Select
                     value={activeRoundSettings.shuffle_mode}
                     onValueChange={(v) => updateMatchingSettings({ shuffle_mode: v })}
                   >
                     <SelectTrigger className="h-8 text-sm">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="both">Founders &amp; Leads</SelectItem>
                       <SelectItem value="founders">Founders Only</SelectItem>
                       <SelectItem value="leads">Leads Only</SelectItem>
                     </SelectContent>
                   </Select>
                   <p className="text-xs text-muted-foreground">
                     {activeRoundSettings.shuffle_mode === "founders"
                       ? "Leads stay at their tables; only founders are reshuffled."
                       : activeRoundSettings.shuffle_mode === "leads"
                       ? "Founders stay at their tables; only leads are reassigned."
                       : "Both founders and leads are fully reshuffled."}
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
              <p className="text-xs text-muted-foreground mb-1">{sessionConfig.session_name}</p>
            )}
             <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
               <span className="font-semibold">Round {activeRound}</span> — Tables grouped using a <span className="font-semibold">{activeRoundSettings.grouping_priority}</span> approach
               {activeRoundSettings.grouping_priority === "sector" && " — prioritizing sector alignment so each table shares an industry vertical"}
               {activeRoundSettings.grouping_priority === "stage" && " — prioritizing stage/revenue similarity so each table has companies at similar growth phases"}
               {activeRoundSettings.grouping_priority === "need" && " — prioritizing shared challenges and needs so conversations are most relevant"}
               {activeRoundSettings.grouping_priority === "hybrid" && " — balancing sector alignment, stage diversity, and shared challenges"}
               .{" "}
               {activeRoundSettings.allow_stage_mixing
                 ? "Early and later-stage companies may be mixed for cross-stage mentorship."
                 : "Companies are kept at similar stages within each table."}
               {" "}
               {activeRoundSettings.avoid_competitors
                 ? "Direct competitors are kept apart."
                 : "Competitors may be seated together for competitive-intelligence exchange."}
               {leads.length > 0 && (
                 <>{" "}Leads are matched <span className="font-semibold">{activeRoundSettings.lead_matching_mode === "strict" ? "strictly" : "flexibly"}</span> to tables where their expertise aligns with founders' needs ({leads.length} lead{leads.length !== 1 ? "s" : ""} across {activeRoundSettings.num_tables} tables).</>
               )}
               {activeRound > 1 && (
                 <>{" "}Shuffle: <span className="font-semibold">{activeRoundSettings.shuffle_mode === "founders" ? "founders only" : activeRoundSettings.shuffle_mode === "leads" ? "leads only" : "both"}</span>.</>
               )}
             </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/admin/session/${sessionId}`)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Session Config
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Lock className="h-4 w-4 mr-1" /> Lock All
            </Button>
            <Button size="sm" disabled={isGenerating || companies.length === 0} onClick={generateMatches}>
              <Sparkles className="h-4 w-4 mr-1" />
              {isGenerating ? "Generating..." : `Generate Round ${activeRound}`}
            </Button>
          </div>
        </div>

        {/* Round Tabs */}
        {(() => {
          const allRounds = Array.from(new Set(tables.map((t) => t.round_number))).sort((a, b) => a - b);
          const maxRound = allRounds.length > 0 ? Math.max(...allRounds) : 0;
          const displayRounds = allRounds.length > 0 ? allRounds : [1];
          return (
            <div className="px-4 pt-3 pb-1 border-b bg-card flex items-center gap-1.5">
              {displayRounds.map((round) => (
                <button
                  key={round}
                  onClick={() => setActiveRound(round)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    activeRound === round
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  Round {round}
                </button>
              ))}
              <button
                onClick={() => setActiveRound(maxRound + 1)}
                className="px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors inline-flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add Round
              </button>
            </div>
          );
        })()}

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
          ) : (() => {
            const roundTables = tables.filter((t) => t.round_number === activeRound);
            return roundTables.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <Shuffle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <h3 className="font-heading text-lg font-semibold mb-2">Round {activeRound}</h3>
                  <p className="text-muted-foreground text-sm">
                    No tables generated for this round yet. Click "Generate Round {activeRound}" to create table groupings.
                  </p>
                </div>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleLeadDragEnd}>
                <div id="matching-tables-grid" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {roundTables.map((table, i) => {
                    const globalIndex = tables.indexOf(table);
                    return (
                      <TableCard key={`${table.round_number}-${table.table_number}`} table={table} tableIndex={globalIndex} colorClass={TABLE_COLORS[i % TABLE_COLORS.length]} onCompanyClick={openProfile} onLeadClick={(lead) => { setSelectedLead(lead); setLeadProfileOpen(true); }} />
                    );
                  })}
                </div>
              </DragDropContext>
            );
          })()}
        </div>

        {hasGenerated && (
          <div className="p-4 border-t bg-card flex justify-end gap-2">
            <Button variant="outline" onClick={generateMatches} disabled={isGenerating}>
              {isGenerating ? "Regenerating..." : `Regenerate Round ${activeRound}`}
            </Button>
            <Button variant="outline" onClick={handleDownloadPdf} disabled={tables.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Download PDF
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

function TableCard({ table, tableIndex, colorClass, onCompanyClick, onLeadClick }: { table: TableGroup; tableIndex: number; colorClass: string; onCompanyClick: (data: Record<string, string>) => void; onLeadClick: (lead: LeadChip) => void }) {
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
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Table Lead{table.assigned_leads.length > 1 ? "s" : ""}</p>
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
                            "text-xs flex items-center justify-between p-1.5 rounded cursor-grab",
                            li === 0
                              ? "bg-primary/20 border border-primary/30 ring-1 ring-primary/10"
                              : "bg-primary/10 border border-primary/20",
                            snapshot.isDragging && "shadow-lg ring-2 ring-primary/40"
                          )}
                          onClick={(e) => { e.stopPropagation(); onLeadClick(lead); }}
                        >
                          <div className="flex items-center gap-1.5">
                            {li === 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary">Head</Badge>}
                            <span className="font-medium text-primary">{lead.name}</span>
                            {lead.company && <span className="text-muted-foreground">· {lead.company}</span>}
                          </div>
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
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-2">Companies</p>
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
