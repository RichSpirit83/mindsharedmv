import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { AlertTriangle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssignmentRow, FounderRow, TableRow } from "./types";

interface Props {
  table: TableRow;
  founders: FounderRow[];
  assignments: Map<string, AssignmentRow>;
  colorClass: string;
}

const TIER_COLORS: Record<string, string> = {
  Growth: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  Early: "bg-amber-500/10 text-amber-700 border-amber-500/30",
};

function classifyStage(f: FounderRow): "Growth" | "Early" {
  const GROWTH_REVENUE = new Set(["2M-5M", "6M-10M", "11M-20M"]);
  const GROWTH_CAPITAL = new Set(["6M-10M", "11M-20M", "21M-50M", "51M+"]);
  if (GROWTH_REVENUE.has((f.revenue || "").trim())) return "Growth";
  if (GROWTH_CAPITAL.has((f.capital_raised || "").trim())) return "Growth";
  return "Early";
}

export default function TableCard({ table, founders, assignments, colorClass }: Props) {
  return (
    <Card className="overflow-hidden border-2">
      <div className={cn("px-4 py-2 flex items-center justify-between", colorClass)}>
        <div className="flex items-center gap-2">
          <span className="font-heading font-semibold text-sm">
            Table {table.table_number}
            {table.table_name ? ` — ${table.table_name}` : ""}
          </span>
        </div>
        <span className="text-xs opacity-80">{founders.length} founders</span>
      </div>
      <div className="px-4 py-2 border-b text-xs flex items-center gap-2">
        <span className="text-muted-foreground">Lead:</span>
        <span className="font-medium">{table.lead?.name || "—"}</span>
        {table.lead?.title && (
          <span className="text-muted-foreground truncate">· {table.lead.title}</span>
        )}
      </div>
      <Droppable droppableId={table.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "min-h-[120px] p-2 space-y-1 transition-colors",
              snapshot.isDraggingOver && "bg-muted/40",
            )}
          >
            {founders.map((f, idx) => {
              const a = assignments.get(f.id);
              const stage = classifyStage(f);
              return (
                <Draggable key={f.id} draggableId={f.id} index={idx}>
                  {(prov, snap) => (
                    <div
                      ref={prov.innerRef}
                      {...prov.draggableProps}
                      {...prov.dragHandleProps}
                      className={cn(
                        "rounded border bg-card p-2 text-sm flex items-center justify-between gap-2",
                        snap.isDragging && "shadow-lg ring-2 ring-primary",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{f.company_name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[f.first_name, f.last_name].filter(Boolean).join(" ") || "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", TIER_COLORS[stage])}>
                          {stage}
                        </Badge>
                        {a?.locked && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-700 border-purple-500/30"
                            title="Manual override — locked across re-generates"
                          >
                            <Lock className="h-2.5 w-2.5 mr-0.5" /> Locked
                          </Badge>
                        )}
                        {(a?.warnings?.length ?? 0) > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-700 border-red-500/30"
                            title={a!.warnings.join("; ")}
                          >
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Re-match
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </Card>
  );
}
