import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import FounderProfileDialog from "@/components/FounderProfileDialog";

type FounderRow = {
  id: string;
  session_id: string;
  session_name: string;
  mapped_data: Record<string, string>;
  name: string;
  company: string;
  sector: string;
  stage: string;
  revenue: string;
  location: string;
};

function extractFounder(company: any, sessionName: string): FounderRow {
  const md = (company.mapped_data || {}) as Record<string, string>;
  const firstName = md.first_name || "";
  const lastName = md.last_name || "";
  return {
    id: company.id,
    session_id: company.session_id,
    session_name: sessionName,
    mapped_data: md,
    name: [firstName, lastName].filter(Boolean).join(" ") || md.company_name || "Unknown",
    company: md.company_name || "",
    sector: md.sector || "",
    stage: md.sales_stage || "",
    revenue: md.revenue || "",
    location: [md.city, md.state_province, md.country].filter(Boolean).join(", "),
  };
}

export default function FounderPool() {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedFounder, setSelectedFounder] = useState<Record<string, string> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: founders = [], isLoading } = useQuery({
    queryKey: ["founder_pool"],
    queryFn: async () => {
      const { data: sessions } = await supabase.from("breakout_sessions").select("id, session_name");
      const sessionMap: Record<string, string> = {};
      (sessions || []).forEach((s) => { sessionMap[s.id] = s.session_name; });

      const { data: companies, error } = await supabase.from("breakout_companies").select("*");
      if (error) throw error;
      return (companies || []).map((c) => extractFounder(c, sessionMap[c.session_id] || "Unknown Session"));
    },
  });

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = founders.filter((f) =>
      f.name.toLowerCase().includes(q) ||
      f.company.toLowerCase().includes(q) ||
      f.sector.toLowerCase().includes(q) ||
      f.session_name.toLowerCase().includes(q)
    );
    if (sortField) {
      result = [...result].sort((a, b) => {
        const aVal = (a as any)[sortField] || "";
        const bVal = (b as any)[sortField] || "";
        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [founders, search, sortField, sortDir]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Founder Participants</h1>
          <Badge variant="secondary">{founders.length} founders</Badge>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, sector, session…"
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search ? "No founders match your search." : "No founder data yet. Upload company data in a session."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    <span className="inline-flex items-center">Name <SortIcon field="name" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("company")}>
                    <span className="inline-flex items-center">Company <SortIcon field="company" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("sector")}>
                    <span className="inline-flex items-center">Sector <SortIcon field="sector" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("stage")}>
                    <span className="inline-flex items-center">Stage <SortIcon field="stage" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("revenue")}>
                    <span className="inline-flex items-center">Revenue <SortIcon field="revenue" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("location")}>
                    <span className="inline-flex items-center">Location <SortIcon field="location" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("session_name")}>
                    <span className="inline-flex items-center">Session <SortIcon field="session_name" /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow
                    key={f.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { setSelectedFounder(f.mapped_data); setDialogOpen(true); }}
                  >
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>{f.company}</TableCell>
                    <TableCell>
                      {f.sector && <Badge variant="secondary" className="text-xs">{f.sector}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{f.stage}</TableCell>
                    <TableCell className="text-sm">{f.revenue}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.location}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{f.session_name}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
