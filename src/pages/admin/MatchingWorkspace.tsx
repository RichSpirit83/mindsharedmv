import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Shuffle, Lock, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const location = useLocation();
  const sessionState = location.state as {
    sessionConfig?: any;
    csvData?: Record<string, string>[];
    columnMapping?: Record<string, string>;
    leads?: any[];
  } | null;

  const csvData = sessionState?.csvData || [];
  const columnMapping = sessionState?.columnMapping || {};
  const sessionConfig = sessionState?.sessionConfig;

  const [searchQuery, setSearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [tables, setTables] = useState<TableGroup[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Map CSV rows to company chips using column mapping
  const companies: CompanyChip[] = csvData.map((row) => ({
    company_name: row[columnMapping["company_name"] || ""] || "",
    first_name: row[columnMapping["first_name"] || ""] || "",
    last_name: row[columnMapping["last_name"] || ""] || "",
    sector: row[columnMapping["sector"] || ""] || "",
    stage: row[columnMapping["sales_stage"] || ""] || "",
    revenue: row[columnMapping["revenue"] || ""] || "",
  }));

  const filteredCompanies = companies.filter(
    (c) =>
      c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.first_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-fade-in">
      {/* Left Panel: Company List */}
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
              <div key={i} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm">
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

      {/* Right Panel: Table Cards */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-card">
          <div>
            <h2 className="font-heading font-semibold">Matching Workspace</h2>
            {sessionConfig?.sessionName && (
              <p className="text-xs text-muted-foreground">{sessionConfig.sessionName}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              <Lock className="h-4 w-4 mr-1" /> Lock All
            </Button>
            <Button size="sm" disabled={isGenerating || companies.length === 0}>
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
                    : "Configure your session and upload company data, then click \"Generate Matches\" to create optimized table groupings powered by AI."}
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

function TableCard({ table, colorClass }: { table: TableGroup; colorClass: string }) {
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
              <div key={i} className="text-xs flex items-center justify-between p-1.5 rounded bg-muted/50">
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
