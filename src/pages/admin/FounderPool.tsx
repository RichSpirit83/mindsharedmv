import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import FounderProfileDialog from "@/components/FounderProfileDialog";

export default function FounderPool() {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedFounder, setSelectedFounder] = useState<Record<string, string> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["founder_pool"],
    queryFn: async () => {
      const { data: sessions } = await supabase.from("breakout_sessions").select("id, session_name");
      const sessionMap: Record<string, string> = {};
      (sessions || []).forEach((s) => { sessionMap[s.id] = s.session_name; });

      const { data: companies, error } = await supabase.from("breakout_companies").select("*");
      if (error) throw error;
      return (companies || []).map((c) => ({
        id: c.id,
        session_name: sessionMap[c.session_id] || "Unknown",
        mapped_data: (c.mapped_data || {}) as Record<string, string>,
      }));
    },
  });

  // Dynamically collect all unique column keys from mapped_data across all founders
  const allColumns = useMemo(() => {
    const keySet = new Set<string>();
    rawData.forEach((r) => Object.keys(r.mapped_data).forEach((k) => keySet.add(k)));
    // Put common fields first, then alphabetical rest
    const priority = ["first_name", "last_name", "company_name", "email", "sector", "sales_stage", "revenue", "city", "state_province", "country"];
    const ordered: string[] = [];
    priority.forEach((p) => { if (keySet.has(p)) { ordered.push(p); keySet.delete(p); } });
    Array.from(keySet).sort().forEach((k) => ordered.push(k));
    return ordered;
  }, [rawData]);

  const displayColumns = ["session_name", ...allColumns];

  const toggleSort = (field: string) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortField(null); setSortDir("asc"); }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const formatHeader = (key: string) => {
    if (key === "session_name") return "Session";
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = rawData.filter((r) => {
      const vals = Object.values(r.mapped_data).join(" ").toLowerCase();
      return vals.includes(q) || r.session_name.toLowerCase().includes(q);
    });
    if (sortField) {
      result = [...result].sort((a, b) => {
        const aVal = sortField === "session_name" ? a.session_name : (a.mapped_data[sortField] || "");
        const bVal = sortField === "session_name" ? b.session_name : (b.mapped_data[sortField] || "");
        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [rawData, search, sortField, sortDir]);

  return (
    <div className="p-6 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Founder Participants</h1>
          <Badge variant="secondary">{rawData.length} founders</Badge>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search founders…"
          className="pl-9"
        />
      </div>

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden mt-6">
        <CardContent className="p-0 flex-1 min-h-0 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search ? "No founders match your search." : "No founder data yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    {displayColumns.map((col) => (
                      <TableHead
                        key={col}
                        className="cursor-pointer select-none whitespace-nowrap"
                        onClick={() => toggleSort(col)}
                      >
                        <span className="inline-flex items-center">
                          {formatHeader(col)} <SortIcon field={col} />
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelectedFounder(r.mapped_data); setDialogOpen(true); }}
                    >
                      {displayColumns.map((col) => (
                        <TableCell key={col} className="whitespace-nowrap text-sm max-w-[300px] truncate">
                          {col === "session_name" ? (
                            <Badge variant="outline" className="text-xs">{r.session_name}</Badge>
                          ) : (
                            r.mapped_data[col] || ""
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FounderProfileDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        data={selectedFounder}
      />
    </div>
  );
}
