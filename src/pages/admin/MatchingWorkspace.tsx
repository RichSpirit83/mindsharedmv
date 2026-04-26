import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Save, RotateCcw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import WorkspaceNav from "@/components/WorkspaceNav";
import TableCard from "@/components/matching/TableCard";
import type { AssignmentRow, FounderRow, LeadRow, TableRow } from "@/components/matching/types";

const TABLE_COLORS = [
  "bg-table-blue text-white",
  "bg-table-teal text-white",
  "bg-table-green text-white",
  "bg-table-yellow",
  "bg-table-orange text-white",
  "bg-table-red text-white",
  "bg-table-pink text-white",
  "bg-table-purple text-white",
];

function toSectorArray(s: any): string[] {
  if (!s) return [];
  if (Array.isArray(s)) return s.map((x: any) => String(x).trim()).filter(Boolean);
  if (typeof s === "string") return s.split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
  return [];
}

export default function MatchingWorkspace() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(true);
  const [sessionName, setSessionName] = useState("");
  const [founders, setFounders] = useState<FounderRow[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [assignments, setAssignments] = useState<Map<string, AssignmentRow>>(new Map());
  const [busy, setBusy] = useState<null | "generate" | "save" | "reset">(null);

  const loadAll = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const { data: s } = await supabase
        .from("breakout_sessions")
        .select("id, session_name")
        .eq("id", sessionId)
        .single();
      setSessionName(s?.session_name || "");

      const { data: rsvps } = await supabase
        .from("breakout_rsvps")
        .select("id, founder_id, manual_table_override, founder:founder_pool(*)")
        .eq("breakout_id", sessionId)
        .eq("rsvpd", true);
      const fRows: FounderRow[] = (rsvps || [])
        .filter((r: any) => r.founder)
        .map((r: any) => ({
          id: r.founder.id,
          rsvp_id: r.id,
          company_name: r.founder.company_name || "",
          first_name: r.founder.first_name,
          last_name: r.founder.last_name,
          sector: toSectorArray(r.founder.sector),
          revenue: r.founder.revenue,
          capital_raised: r.founder.capital_raised,
          manual_table_override: r.manual_table_override,
          raw_data: r.founder.raw_data,
          mapped_data: r.founder.mapped_data,
        }));
      setFounders(fRows);

      const { data: tbls } = await supabase
        .from("breakout_tables")
        .select("id, table_number, table_name")
        .eq("session_id", sessionId)
        .eq("is_backup", false)
        .order("table_number");
      const { data: tlinks } = await supabase
        .from("breakout_table_leads")
        .select("table_id, lead:lead_pool(id,name,title,company,expertise_tags)")
        .eq("breakout_id", sessionId);
      const leadByTable = new Map<string, LeadRow>();
      for (const tl of tlinks || []) {
        if (tl.table_id && tl.lead && !leadByTable.has(tl.table_id)) {
          const l: any = tl.lead;
          leadByTable.set(tl.table_id, {
            id: l.id,
            name: l.name,
            title: l.title,
            company: l.company,
            expertise_tags: Array.isArray(l.expertise_tags) ? l.expertise_tags : [],
          });
        }
      }
      const tRows: TableRow[] = (tbls || []).map((t: any) => ({
        id: t.id,
        table_number: t.table_number,
        table_name: t.table_name,
        lead: leadByTable.get(t.id) || null,
      }));
      setTables(tRows);

      // Initial assignments derive from latest match_history for this breakout, override wins
      const { data: hist } = await supabase
        .from("match_history")
        .select("founder_id, lead_id, table_id, created_at")
        .eq("breakout_id", sessionId)
        .order("created_at", { ascending: true });
      const histByFounder = new Map<string, { tableId: string; leadId: string }>();
      for (const h of hist || []) {
        if (h.table_id) histByFounder.set(h.founder_id, { tableId: h.table_id, leadId: h.lead_id });
      }
      const map = new Map<string, AssignmentRow>();
      for (const f of fRows) {
        const tableId = f.manual_table_override || histByFounder.get(f.id)?.tableId || null;
        const leadId = tableId ? leadByTable.get(tableId)?.id || null : null;
        map.set(f.id, {
          founderId: f.id,
          tableId,
          leadId,
          warnings: [],
          locked: !!f.manual_table_override,
        });
      }
      setAssignments(map);
    } catch (e: any) {
      toast.error(e.message || "Failed to load matching data");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const generate = async (commit: boolean) => {
    setBusy(commit ? "save" : "generate");
    try {
      const { data, error } = await supabase.functions.invoke("generate-matches", {
        body: { breakoutId: sessionId, commit },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const list = ((data as any)?.assignments || []) as AssignmentRow[];
      const map = new Map<string, AssignmentRow>();
      for (const a of list) map.set(a.founderId, a);
      setAssignments(map);
      const s = (data as any).summary;
      const verb = commit ? "Saved" : "Previewed";
      toast.success(
        `${verb} ${s.total} assignments · ${s.growthCount} Growth · ${s.earlyCount} Early${
          s.rematchCount ? ` · ${s.rematchCount} re-match${s.rematchCount === 1 ? "" : "es"}` : ""
        }`,
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to generate matches");
    } finally {
      setBusy(null);
    }
  };

  const resetOverrides = async () => {
    if (!sessionId) return;
    if (!confirm("Clear all manual table overrides for this breakout?")) return;
    setBusy("reset");
    try {
      const { error } = await supabase
        .from("breakout_rsvps")
        .update({ manual_table_override: null })
        .eq("breakout_id", sessionId);
      if (error) throw error;
      toast.success("Overrides cleared");
      await loadAll();
    } catch (e: any) {
      toast.error(e.message || "Failed to reset overrides");
    } finally {
      setBusy(null);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    const founderId = draggableId;
    const newTableId = destination.droppableId;
    const founder = founders.find((f) => f.id === founderId);
    if (!founder) return;

    // Optimistic update
    setAssignments((prev) => {
      const next = new Map(prev);
      const lead = tables.find((t) => t.id === newTableId)?.lead || null;
      next.set(founderId, {
        founderId,
        tableId: newTableId,
        leadId: lead?.id || null,
        warnings: [],
        locked: true,
      });
      return next;
    });
    setFounders((prev) =>
      prev.map((f) => (f.id === founderId ? { ...f, manual_table_override: newTableId } : f)),
    );

    try {
      const { error } = await supabase
        .from("breakout_rsvps")
        .update({ manual_table_override: newTableId })
        .eq("id", founder.rsvp_id);
      if (error) throw error;
      toast.success(`Locked ${founder.company_name || "founder"} to Table ${
        tables.find((t) => t.id === newTableId)?.table_number
      }`);
    } catch (e: any) {
      toast.error(e.message || "Failed to save override");
      await loadAll();
    }
  };

  const foundersByTable = useMemo(() => {
    const map = new Map<string, FounderRow[]>();
    for (const t of tables) map.set(t.id, []);
    const unassigned: FounderRow[] = [];
    for (const f of founders) {
      const a = assignments.get(f.id);
      if (a?.tableId && map.has(a.tableId)) map.get(a.tableId)!.push(f);
      else unassigned.push(f);
    }
    return { map, unassigned };
  }, [tables, founders, assignments]);

  const summary = useMemo(() => {
    const total = founders.length;
    const assigned = Array.from(assignments.values()).filter((a) => !!a.tableId).length;
    const lockedCount = Array.from(assignments.values()).filter((a) => a.locked).length;
    const warned = Array.from(assignments.values()).filter((a) => (a.warnings || []).length > 0).length;
    return { total, assigned, lockedCount, warned };
  }, [founders, assignments]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <WorkspaceNav
        sessionId={sessionId || ""}
        activePage="matching"
        rightContent={
          <>
            <Button size="sm" onClick={() => generate(false)} disabled={!!busy}>
              {busy === "generate" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Generate Matches
            </Button>
            <Button size="sm" variant="secondary" onClick={() => generate(true)} disabled={!!busy}>
              {busy === "save" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save Assignments
            </Button>
            <Button size="sm" variant="outline" onClick={resetOverrides} disabled={!!busy}>
              {busy === "reset" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
              Reset Overrides
            </Button>
          </>
        }
      />

      <div className="px-4 pb-3 border-b mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-heading font-semibold text-sm">{sessionName || "Matching Workspace"}</h2>
          <Badge variant="secondary" className="text-xs">
            {summary.assigned} / {summary.total} founders assigned
          </Badge>
          {summary.lockedCount > 0 && (
            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/30">
              {summary.lockedCount} locked
            </Badge>
          )}
          {summary.warned > 0 && (
            <Badge variant="outline" className="text-xs bg-red-500/10 text-red-700 border-red-500/30">
              {summary.warned} re-match warning{summary.warned === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Tables grouped by stage (Growth / Early). Drag a founder to a different table to lock them there — manual overrides persist across re-generates and viewers.
        </p>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
          {tables.map((t, idx) => (
            <TableCard
              key={t.id}
              table={t}
              founders={foundersByTable.map.get(t.id) || []}
              assignments={assignments}
              colorClass={TABLE_COLORS[idx % TABLE_COLORS.length]}
            />
          ))}
        </div>

        {foundersByTable.unassigned.length > 0 && (
          <div className="px-4 pb-8">
            <h3 className="font-heading text-sm font-semibold mb-2">
              Unassigned ({foundersByTable.unassigned.length})
            </h3>
            <div className="rounded border bg-muted/30 p-2 grid grid-cols-2 md:grid-cols-3 gap-1">
              {foundersByTable.unassigned.map((f) => (
                <div key={f.id} className="text-xs p-2 bg-card rounded border">
                  <div className="font-medium truncate">{f.company_name}</div>
                  <div className="text-muted-foreground truncate">
                    {[f.first_name, f.last_name].filter(Boolean).join(" ")}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Run <strong>Generate Matches</strong> to assign these founders to tables.
            </p>
          </div>
        )}
      </DragDropContext>
    </div>
  );
}
