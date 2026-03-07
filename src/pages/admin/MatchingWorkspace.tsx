import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Shuffle, Lock, GripVertical, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const TABLE_COLORS = [
  "bg-table-blue", "bg-table-teal", "bg-table-green", "bg-table-yellow",
  "bg-table-orange", "bg-table-red", "bg-table-pink", "bg-table-purple",
];

// Demo data for the workspace layout
const DEMO_TABLES = [
  {
    table_number: 1,
    table_name: "GovTech & Defense",
    theme: "Founders building for government and defense markets",
    stage_mix: "Mixed",
    suggested_lead: "",
    rationale: "Upload company data and run matching to generate optimized table groupings.",
    shared_challenges: ["Government procurement cycles", "Security clearances"],
    companies: [],
  },
];

interface CompanyChip {
  company_name: string;
  first_name: string;
  sector?: string;
  stage?: string;
  revenue?: string;
}

export default function MatchingWorkspace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [tables, setTables] = useState(DEMO_TABLES);
  const [hasGenerated, setHasGenerated] = useState(false);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-fade-in">
      {/* Left Panel: Company List */}
      <div className="w-80 border-r bg-card flex flex-col">
        <div className="p-4 border-b space-y-3">
          <h2 className="font-heading font-semibold text-sm">Companies</h2>
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
        <div className="flex-1 overflow-auto p-4">
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No companies loaded yet.</p>
            <p className="text-xs mt-1">Upload a CSV in Session Config first.</p>
          </div>
        </div>
      </div>

      {/* Right Panel: Table Cards */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-card">
          <h2 className="font-heading font-semibold">Matching Workspace</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              <Lock className="h-4 w-4 mr-1" /> Lock All
            </Button>
            <Button size="sm" disabled={isGenerating}>
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
                  Configure your session and upload company data, then click "Generate Matches" to create
                  optimized table groupings powered by AI.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tables.map((table, i) => (
                <TableCard key={table.table_number} table={table} colorClass={TABLE_COLORS[i % TABLE_COLORS.length]} />
              ))}
            </div>
          )}
        </div>

        {hasGenerated && (
          <div className="p-4 border-t bg-card flex justify-end gap-2">
            <Button variant="outline">Regenerate All</Button>
            <Button>
              <Check className="h-4 w-4 mr-1" /> Finalize & Publish
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TableCard({ table, colorClass }: { table: typeof DEMO_TABLES[0]; colorClass: string }) {
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
        {table.companies.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No companies assigned yet</p>
        )}
      </CardContent>
    </Card>
  );
}
