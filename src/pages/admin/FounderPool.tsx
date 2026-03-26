import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Search, ArrowUpDown, ArrowUp, ArrowDown, Upload, ClipboardPaste } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Papa from "papaparse";
import FounderProfileDialog from "@/components/FounderProfileDialog";
import ColumnMapper from "@/components/ColumnMapper";
import CsvPreviewTable from "@/components/CsvPreviewTable";
import { CANONICAL_FIELDS, autoMapHeaders } from "@/lib/founderFields";
import { computeStageScoreFromMapped } from "@/components/cohort/companyData";

type ImportStep = "idle" | "select-session" | "mapping" | "preview";

export default function FounderPool() {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedFounder, setSelectedFounder] = useState<{ data: Record<string, string>; ids: string[]; sessionNames: string[] } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Import state
  const [importStep, setImportStep] = useState<ImportStep>("idle");
  const [importMode, setImportMode] = useState<"csv" | "paste" | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [pasteText, setPasteText] = useState("");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: sessions = [] } = useQuery({
    queryKey: ["breakout_sessions_list"],
    queryFn: async () => {
      const { data } = await supabase.from("breakout_sessions").select("id, session_name").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["founder_pool"],
    queryFn: async () => {
      const { data: sessionsData } = await supabase.from("breakout_sessions").select("id, session_name");
      const sessionMap: Record<string, string> = {};
      (sessionsData || []).forEach((s) => { sessionMap[s.id] = s.session_name; });

      const { data: companies, error } = await supabase.from("breakout_companies").select("*");
      if (error) throw error;
      return (companies || []).map((c) => ({
        id: c.id,
        session_id: c.session_id,
        session_name: sessionMap[c.session_id] || "Unknown",
        mapped_data: (c.mapped_data || {}) as Record<string, string>,
      }));
    },
  });

  // De-duplicate founders across sessions
  const dedupedData = useMemo(() => {
    const groups = new Map<string, { data: Record<string, string>; ids: string[]; sessionNames: string[] }>();
    rawData.forEach((r) => {
      const email = (r.mapped_data.email || "").toLowerCase().trim();
      const key = email || `${(r.mapped_data.first_name || "").toLowerCase().trim()}|${(r.mapped_data.last_name || "").toLowerCase().trim()}|${(r.mapped_data.company_name || "").toLowerCase().trim()}`;
      if (!key || key === "||") {
        // Can't dedup, treat as unique
        groups.set(r.id, { data: { ...r.mapped_data }, ids: [r.id], sessionNames: [r.session_name] });
        return;
      }
      const existing = groups.get(key);
      if (existing) {
        existing.ids.push(r.id);
        if (!existing.sessionNames.includes(r.session_name)) existing.sessionNames.push(r.session_name);
        // Merge: prefer non-empty values
        Object.entries(r.mapped_data).forEach(([k, v]) => {
          if (v && !existing.data[k]) existing.data[k] = v;
        });
      } else {
        groups.set(key, { data: { ...r.mapped_data }, ids: [r.id], sessionNames: [r.session_name] });
      }
    });
    return Array.from(groups.values());
  }, [rawData]);

  const allColumns = useMemo(() => {
    const keySet = new Set<string>();
    dedupedData.forEach((r) => Object.keys(r.data).forEach((k) => keySet.add(k)));
    const priority = ["first_name", "last_name", "company_name", "email", "sector", "sales_stage", "revenue", "city", "state_province", "country"];
    const ordered: string[] = [];
    priority.forEach((p) => { if (keySet.has(p)) { ordered.push(p); keySet.delete(p); } });
    Array.from(keySet).sort().forEach((k) => ordered.push(k));
    return ordered;
  }, [dedupedData]);

  const displayColumns = ["session_name", "_stage_score", "_stage", ...allColumns];

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
    if (key === "_stage_score") return "Score";
    if (key === "_stage") return "Stage";
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = dedupedData.filter((r) => {
      const vals = Object.values(r.data).join(" ").toLowerCase();
      return vals.includes(q) || r.sessionNames.join(" ").toLowerCase().includes(q);
    });
    if (sortField) {
      result = [...result].sort((a, b) => {
        if (sortField === "_stage_score" || sortField === "_stage") {
          const aScore = computeStageScoreFromMapped(a.data).score;
          const bScore = computeStageScoreFromMapped(b.data).score;
          return sortDir === "asc" ? aScore - bScore : bScore - aScore;
        }
        const aVal = sortField === "session_name" ? a.sessionNames.join(", ") : (a.data[sortField] || "");
        const bVal = sortField === "session_name" ? b.sessionNames.join(", ") : (b.data[sortField] || "");
        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [dedupedData, search, sortField, sortDir]);

  // ---- Import logic ----

  const resetImport = () => {
    setImportStep("idle");
    setImportMode(null);
    setSelectedSessionId("");
    setPasteText("");
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
  };

  const startImport = (mode: "csv" | "paste") => {
    setImportMode(mode);
    setImportStep("select-session");
  };

  const handleSessionSelected = () => {
    if (!selectedSessionId) return;
    if (importMode === "csv") {
      fileRef.current?.click();
    } else {
      // paste mode — show paste dialog (step handled within dialog)
    }
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data as Record<string, string>[]);
        const autoMap = autoMapHeaders(headers);
        setColumnMapping(autoMap);
        setImportStep("mapping");
      },
    });
    e.target.value = "";
  }, []);

  const handleParsePaste = () => {
    if (!pasteText.trim()) return;
    const result = Papa.parse(pasteText.trim(), { header: true, skipEmptyLines: true, delimiter: "" });
    const headers = result.meta.fields || [];
    const data = result.data as Record<string, string>[];

    if (headers.length === 0 || data.length === 0) {
      const fallback = Papa.parse(pasteText.trim(), { header: false, skipEmptyLines: true, delimiter: "" });
      const rows = fallback.data as string[][];
      if (rows.length > 0) {
        const defaultHeaders = CANONICAL_FIELDS.slice(0, Math.max(...rows.map(r => r.length)));
        const asObjects = rows.map(row => {
          const obj: Record<string, string> = {};
          defaultHeaders.forEach((h, i) => { obj[h] = row[i] || ""; });
          return obj;
        });
        setCsvHeaders(defaultHeaders);
        setCsvData(asObjects);
        setColumnMapping(autoMapHeaders(defaultHeaders));
        setImportStep("mapping");
        return;
      }
      toast({ title: "Could not parse data", variant: "destructive" });
      return;
    }

    setCsvHeaders(headers);
    setCsvData(data);
    setColumnMapping(autoMapHeaders(headers));
    setImportStep("mapping");
  };

  const handleImport = async () => {
    if (!selectedSessionId || csvData.length === 0) return;
    setImporting(true);

    try {
      // Build mapped rows
      const newRows = csvData.map((row) => {
        const mapped: Record<string, string> = {};
        Object.entries(columnMapping).forEach(([canonical, csvHeader]) => {
          if (csvHeader && row[csvHeader]) mapped[canonical] = row[csvHeader];
        });
        return { raw_data: row, mapped_data: mapped };
      });

      // Dedup: check existing companies in this session
      const existingInSession = rawData.filter(r => r.session_id === selectedSessionId);
      const normalize = (s: string) => (s || "").toLowerCase().trim();
      const existingKeys = new Set(
        existingInSession.map(r =>
          `${normalize(r.mapped_data.first_name)}|${normalize(r.mapped_data.last_name)}|${normalize(r.mapped_data.company_name)}`
        )
      );

      const uniqueRows = newRows.filter(r => {
        const key = `${normalize(r.mapped_data.first_name)}|${normalize(r.mapped_data.last_name)}|${normalize(r.mapped_data.company_name)}`;
        return !existingKeys.has(key);
      });

      const skipped = newRows.length - uniqueRows.length;

      if (uniqueRows.length > 0) {
        const inserts = uniqueRows.map(r => ({
          session_id: selectedSessionId,
          raw_data: r.raw_data,
          mapped_data: r.mapped_data,
        }));

        const { error } = await supabase.from("breakout_companies").insert(inserts);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["founder_pool"] });
      toast({
        title: "Import complete",
        description: `${uniqueRows.length} companies added${skipped > 0 ? `, ${skipped} duplicates skipped` : ""}`,
      });
      resetImport();
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const importDialogOpen = importStep !== "idle";

  return (
    <div className="p-6 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Founder Participants</h1>
          <Badge variant="secondary">{dedupedData.length} founders</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => startImport("csv")}>
            <Upload className="h-4 w-4 mr-1" /> Upload CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => startImport("paste")}>
            <ClipboardPaste className="h-4 w-4 mr-1" /> Paste Data
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm mt-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search founders…"
          className="pl-9"
        />
      </div>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden mt-4">
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
                  {filtered.map((r, idx) => (
                    <TableRow
                      key={r.ids[0] || idx}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelectedFounder(r); setDialogOpen(true); }}
                    >
                      {displayColumns.map((col) => {
                        if (col === "_stage_score") {
                          const score = computeStageScoreFromMapped(r.data);
                          const pct = Math.round((score.score / 3) * 100);
                          return (
                            <TableCell key={col} className="whitespace-nowrap text-sm">
                              <div className="flex items-center gap-2 min-w-[100px]">
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${pct}%`, backgroundColor: score.color }}
                                  />
                                </div>
                                <span className="text-xs font-semibold" style={{ color: score.color }}>
                                  {score.score.toFixed(2)}
                                </span>
                              </div>
                            </TableCell>
                          );
                        }
                        if (col === "_stage") {
                          const score = computeStageScoreFromMapped(r.data);
                          return (
                            <TableCell key={col} className="whitespace-nowrap text-sm">
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium"
                                style={{
                                  backgroundColor: `${score.color}26`,
                                  color: score.color,
                                }}
                              >
                                {score.label}
                              </span>
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={col} className="whitespace-nowrap text-sm max-w-[300px] truncate">
                            {col === "session_name" ? (
                              <div className="flex flex-wrap gap-1">
                                {r.sessionNames.map((s, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                                ))}
                              </div>
                            ) : (
                              r.data[col] || ""
                            )}
                          </TableCell>
                        );
                      })}
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
        data={selectedFounder?.data || null}
        ids={selectedFounder?.ids || []}
        sessionNames={selectedFounder?.sessionNames || []}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["founder_pool"] })}
      />

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(o) => { if (!o) resetImport(); }}>
        <DialogContent className="sm:max-w-4xl bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importMode === "csv" ? <Upload className="h-5 w-5" /> : <ClipboardPaste className="h-5 w-5" />}
              {importStep === "select-session" && "Select Cohort"}
              {importStep === "mapping" && "Map Columns"}
              {importStep === "preview" && `Preview Import (${csvData.length} records)`}
            </DialogTitle>
          </DialogHeader>

          {importStep === "select-session" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose which cohort (session) this new data belongs to.
              </p>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a cohort…" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.session_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {importMode === "paste" && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Paste rows from a spreadsheet. Include a header row. Tab and comma separators are auto-detected.
                  </p>
                  <Textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={"Company Name\tFirst Name\tLast Name\tEmail\tSector\nAcme Inc\tJane\tDoe\tjane@acme.com\tTech"}
                    rows={8}
                    className="font-mono text-xs"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetImport}>Cancel</Button>
                {importMode === "csv" ? (
                  <Button disabled={!selectedSessionId} onClick={handleSessionSelected}>
                    Choose File
                  </Button>
                ) : (
                  <Button disabled={!selectedSessionId || !pasteText.trim()} onClick={handleParsePaste}>
                    Parse & Continue
                  </Button>
                )}
              </div>
            </div>
          )}

          {importStep === "mapping" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{csvData.length} rows detected</Badge>
              </div>
              <ColumnMapper
                csvHeaders={csvHeaders}
                canonicalFields={CANONICAL_FIELDS}
                mapping={columnMapping}
                onMappingChange={setColumnMapping}
                onConfirm={() => setImportStep("preview")}
              />
              <div className="flex gap-2 justify-start">
                <Button variant="outline" size="sm" onClick={() => setImportStep("select-session")}>
                  Back
                </Button>
              </div>
            </div>
          )}

          {importStep === "preview" && (
            <div className="space-y-4">
              <CsvPreviewTable
                data={csvData}
                mapping={columnMapping}
                onDeleteRow={(index) => setCsvData((prev) => prev.filter((_, i) => i !== index))}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setImportStep("mapping")}>Back to Mapping</Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? "Importing…" : `Import ${csvData.length} Records`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
