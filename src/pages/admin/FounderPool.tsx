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
import {
  FOUNDER_MAPPING_MEMORY_KEY,
  getRememberedMapping,
  rememberMapping,
  clearMappingMemory,
  getRememberedFields,
} from "@/lib/mappingMemory";
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
      const { data: sessionsData } = await supabase
        .from("breakout_sessions")
        .select("id, session_name");
      const sessionMap: Record<string, string> = {};
      (sessionsData || []).forEach((s) => { sessionMap[s.id] = s.session_name; });

      const { data: founders, error } = await (supabase as any)
        .from("founder_pool")
        .select("*");
      if (error) throw error;

      const { data: rsvps } = await (supabase as any)
        .from("breakout_rsvps")
        .select("founder_id, breakout_id");
      const rsvpsByFounder: Record<string, string[]> = {};
      (rsvps || []).forEach((r: any) => {
        (rsvpsByFounder[r.founder_id] ||= []).push(r.breakout_id);
      });

      return (founders || []).map((f: any) => {
        const breakoutIds = rsvpsByFounder[f.id] || [];
        const sessionNames = breakoutIds.map((bid) => sessionMap[bid]).filter(Boolean);
        const mapped: Record<string, string> = { ...((f.mapped_data || {}) as Record<string, string>) };
        const setIf = (k: string, v: any) => {
          if (v != null && v !== "" && !mapped[k]) mapped[k] = String(v);
        };
        setIf("company_name", f.company_name);
        setIf("first_name", f.first_name);
        setIf("last_name", f.last_name);
        setIf("email", f.email);
        setIf("revenue", f.revenue);
        setIf("capital_raised", f.capital_raised);
        setIf("last_round", f.last_round);
        setIf("icp", f.icp);
        setIf("business_type", f.business_type);
        setIf("linkedin_url", f.linkedin_url);
        if (Array.isArray(f.sector) && !mapped.sector) mapped.sector = f.sector.join(",");
        if (Array.isArray(f.customer_type) && !mapped.customer_type) mapped.customer_type = f.customer_type.join(",");
        return {
          id: f.id as string,
          mapped_data: mapped,
          session_names: sessionNames,
          breakout_count: breakoutIds.length,
        };
      });
    },
  });

  // founder_pool is already deduped server-side — adapt to legacy shape
  const dedupedData = useMemo(() => {
    return (rawData as any[]).map((r) => ({
      data: r.mapped_data,
      ids: [r.id],
      sessionNames: r.session_names,
      breakoutCount: r.breakout_count as number,
    }));
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

  const displayColumns = ["_breakouts", "session_name", "_stage_score", "_stage", ...allColumns];

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
        const remembered = getRememberedMapping(FOUNDER_MAPPING_MEMORY_KEY, headers);
        setColumnMapping({ ...autoMap, ...remembered });
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
        const autoMapFb = autoMapHeaders(defaultHeaders);
        const rememberedFb = getRememberedMapping(FOUNDER_MAPPING_MEMORY_KEY, defaultHeaders);
        setColumnMapping({ ...autoMapFb, ...rememberedFb });
        setImportStep("mapping");
        return;
      }
      toast({ title: "Could not parse data", variant: "destructive" });
      return;
    }

    setCsvHeaders(headers);
    setCsvData(data);
    const autoMap2 = autoMapHeaders(headers);
    const remembered2 = getRememberedMapping(FOUNDER_MAPPING_MEMORY_KEY, headers);
    setColumnMapping({ ...autoMap2, ...remembered2 });
    setImportStep("mapping");
  };

  const handleImport = async () => {
    if (!selectedSessionId || csvData.length === 0) return;
    setImporting(true);

    const MAX_FIELD_CHARS = 8000;
    const MAX_RAW_BYTES = 32_000;
    const BATCH_SIZE = 200;

    const truncateField = (v: any): string => {
      if (v == null) return "";
      const s = String(v);
      return s.length > MAX_FIELD_CHARS ? s.slice(0, MAX_FIELD_CHARS) + "…[truncated]" : s;
    };

    const trimRawData = (raw: Record<string, any>): Record<string, string> => {
      const out: Record<string, string> = {};
      Object.entries(raw).forEach(([k, v]) => { out[k] = truncateField(v); });
      // If still too large, drop longest fields until under limit
      let json = JSON.stringify(out);
      if (json.length <= MAX_RAW_BYTES) return out;
      const keysBySize = Object.keys(out).sort((a, b) => out[b].length - out[a].length);
      for (const k of keysBySize) {
        out[k] = out[k].slice(0, 500) + "…[truncated]";
        json = JSON.stringify(out);
        if (json.length <= MAX_RAW_BYTES) break;
      }
      return out;
    };

    try {
      // Build mapped rows
      const builtRows = csvData.map((row) => {
        const mapped: Record<string, string> = {};
        Object.entries(columnMapping).forEach(([canonical, csvHeader]) => {
          if (csvHeader && row[csvHeader]) mapped[canonical] = truncateField(row[csvHeader]);
        });
        return { raw_data: trimRawData(row), mapped_data: mapped };
      });

      // Skip empty rows (no first/last/company)
      const nonEmptyRows = builtRows.filter(r => {
        const m = r.mapped_data;
        return (m.first_name || m.last_name || m.company_name);
      });
      const emptySkipped = builtRows.length - nonEmptyRows.length;

      // Dedup: check existing companies in this session
      const existingInSession = rawData.filter(r => r.session_id === selectedSessionId);
      const normalize = (s: string) => (s || "").toLowerCase().trim();
      const existingKeys = new Set(
        existingInSession.map(r =>
          `${normalize(r.mapped_data.first_name)}|${normalize(r.mapped_data.last_name)}|${normalize(r.mapped_data.company_name)}`
        )
      );

      const uniqueRows = nonEmptyRows.filter(r => {
        const key = `${normalize(r.mapped_data.first_name)}|${normalize(r.mapped_data.last_name)}|${normalize(r.mapped_data.company_name)}`;
        return !existingKeys.has(key);
      });
      const dupSkipped = nonEmptyRows.length - uniqueRows.length;

      const inserts = uniqueRows.map(r => ({
        session_id: selectedSessionId,
        raw_data: r.raw_data,
        mapped_data: r.mapped_data,
      }));

      let inserted = 0;
      const failures: { name: string; message: string }[] = [];

      for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
        const batch = inserts.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("breakout_companies").insert(batch);
        if (!error) {
          inserted += batch.length;
          continue;
        }
        console.error("[FounderPool] batch insert failed, falling back per-row:", error);
        // Per-row fallback
        for (const row of batch) {
          const { error: rowErr } = await supabase.from("breakout_companies").insert(row);
          if (rowErr) {
            const m = row.mapped_data as Record<string, string>;
            const name = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.company_name || "(unnamed)";
            console.error("[FounderPool] row insert failed:", name, rowErr, row);
            failures.push({ name, message: rowErr.message });
          } else {
            inserted += 1;
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["founder_pool"] });

      const parts: string[] = [`Added: ${inserted}`];
      if (dupSkipped > 0) parts.push(`Skipped duplicates: ${dupSkipped}`);
      if (emptySkipped > 0) parts.push(`Empty rows skipped: ${emptySkipped}`);
      if (failures.length > 0) parts.push(`Failed: ${failures.length}`);

      const description = parts.join(" · ") + (
        failures.length > 0
          ? `\nFirst failure — "${failures[0].name}": ${failures[0].message}`
          : ""
      );

      if (inserted === 0 && failures.length > 0) {
        toast({ title: "Import failed", description, variant: "destructive" });
        // keep dialog open
      } else {
        toast({
          title: failures.length > 0 ? "Import completed with errors" : "Import complete",
          description,
          variant: failures.length > 0 ? "destructive" : "default",
        });
        resetImport();
      }
    } catch (err: any) {
      console.error("[FounderPool] import crashed:", err);
      toast({ title: "Import failed", description: err.message || "Unknown error", variant: "destructive" });
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
                rememberedFields={getRememberedFields(FOUNDER_MAPPING_MEMORY_KEY, columnMapping)}
                onClearMemory={() => {
                  clearMappingMemory(FOUNDER_MAPPING_MEMORY_KEY);
                  setColumnMapping(autoMapHeaders(csvHeaders));
                  toast({ title: "Remembered mappings cleared" });
                }}
                onConfirm={() => {
                  rememberMapping(FOUNDER_MAPPING_MEMORY_KEY, columnMapping, csvHeaders);
                  setImportStep("preview");
                }}
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
