import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload, Plus, Trash2, FileSpreadsheet, Check, Linkedin, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Papa from "papaparse";
import CsvPreviewTable from "@/components/CsvPreviewTable";
import ColumnMapper from "@/components/ColumnMapper";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_PROMPTS = [
  "What is the one decision or constraint that—if resolved in 90 days—would most change your trajectory?",
  "What have you been spending time on that isn't delivering expected return, and what assumption might be wrong?",
  "If the Mindshare network could help with one thing in the next 3-6 months, what would be most valuable?",
];

type GroupingPriority = "sector" | "stage" | "need" | "hybrid";
type SessionFormat = "deep_dive" | "speed_rounds";

interface TableLead {
  id: string;
  name: string;
  expertiseTags: string[];
  networkStrengths: string;
  notes: string;
  linkedinUrl: string;
}

const CANONICAL_FIELDS = [
  "company_name", "first_name", "last_name", "email", "sector",
  "primary_market", "business_type", "employee_count", "revenue_band",
  "capital_raised", "last_round", "has_pmf", "sales_stage",
  "need_networking", "need_trends", "need_partners", "need_opportunities",
  "need_mentorship", "topics_of_interest", "critical_challenges",
  "website", "description",
];

export default function SessionConfig() {
  const [sessionName, setSessionName] = useState("");
  const [sessionDate, setSessionDate] = useState<Date>();
  const [eventStartTime, setEventStartTime] = useState("09:00");
  const [breakoutStart, setBreakoutStart] = useState("10:00");
  const [breakoutEnd, setBreakoutEnd] = useState("11:00");
  const [numTables, setNumTables] = useState(5);
  const [targetPerTable, setTargetPerTable] = useState(6);
  const [numLeads, setNumLeads] = useState(0);
  const [groupingPriority, setGroupingPriority] = useState<GroupingPriority>("sector");
  const [allowStageMixing, setAllowStageMixing] = useState(true);
  const [sessionFormat, setSessionFormat] = useState<SessionFormat>("deep_dive");
  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);
  const [leads, setLeads] = useState<TableLead[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showMapper, setShowMapper] = useState(false);
  const [tagInput, setTagInput] = useState<Record<string, string>>({});

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data as Record<string, string>[]);
        // Auto-map matching columns
        const autoMap: Record<string, string> = {};
        CANONICAL_FIELDS.forEach((field) => {
          const match = headers.find(
            (h) => h.toLowerCase().replace(/[\s_-]/g, "") === field.replace(/_/g, "")
          );
          if (match) autoMap[field] = match;
        });
        setColumnMapping(autoMap);
        const unmapped = CANONICAL_FIELDS.filter((f) => !autoMap[f]);
        if (unmapped.length > 0) setShowMapper(true);
        toast.success(`Imported ${results.data.length} companies`);
      },
      error: () => toast.error("Failed to parse CSV"),
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith(".csv")) {
      toast.error("Please drop a CSV file");
      return;
    }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data as Record<string, string>[]);
        const autoMap: Record<string, string> = {};
        CANONICAL_FIELDS.forEach((field) => {
          const match = headers.find(
            (h) => h.toLowerCase().replace(/[\s_-]/g, "") === field.replace(/_/g, "")
          );
          if (match) autoMap[field] = match;
        });
        setColumnMapping(autoMap);
        const unmapped = CANONICAL_FIELDS.filter((f) => !autoMap[f]);
        if (unmapped.length > 0) setShowMapper(true);
        toast.success(`Imported ${results.data.length} companies`);
      },
    });
  }, []);

  const updateLeadCount = (count: number) => {
    setNumLeads(count);
    const newLeads: TableLead[] = Array.from({ length: count }, (_, i) => (
      leads[i] || { id: crypto.randomUUID(), name: "", expertiseTags: [], networkStrengths: "", notes: "" }
    ));
    setLeads(newLeads);
  };

  const updateLead = (index: number, field: keyof TableLead, value: any) => {
    setLeads((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  };

  const addTag = (index: number) => {
    const tag = tagInput[index]?.trim();
    if (!tag) return;
    updateLead(index, "expertiseTags", [...leads[index].expertiseTags, tag]);
    setTagInput((prev) => ({ ...prev, [index]: "" }));
  };

  const removeTag = (leadIndex: number, tagIndex: number) => {
    updateLead(leadIndex, "expertiseTags", leads[leadIndex].expertiseTags.filter((_, i) => i !== tagIndex));
  };

  const groupingOptions: { value: GroupingPriority; label: string; desc: string }[] = [
    { value: "sector", label: "Sector / Industry", desc: "Recommended — groups by market" },
    { value: "stage", label: "Stage", desc: "Early / Growth / Scale" },
    { value: "need", label: "Primary Need", desc: "GTM / Fundraising / Ops / Product" },
    { value: "hybrid", label: "Hybrid AI-Optimized", desc: "Let AI balance all factors" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl font-bold">Session Configuration</h1>
        <p className="text-muted-foreground text-sm mt-1">Set up your breakout session parameters before uploading company data.</p>
      </div>

      {/* Session Details */}
      <Card>
        <CardHeader><CardTitle className="font-heading text-lg">Session Details</CardTitle></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Session Name</Label>
            <Input placeholder="e.g. Mindshare 2026 Session 1" value={sessionName} onChange={(e) => setSessionName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Session Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1.5", !sessionDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {sessionDate ? format(sessionDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={sessionDate} onSelect={setSessionDate} className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Event Start</Label>
              <Input type="time" value={eventStartTime} onChange={(e) => setEventStartTime(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Breakout Start</Label>
              <Input type="time" value={breakoutStart} onChange={(e) => setBreakoutStart(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Breakout End</Label>
              <Input type="time" value={breakoutEnd} onChange={(e) => setBreakoutEnd(e.target.value)} className="mt-1.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Configuration */}
      <Card>
        <CardHeader><CardTitle className="font-heading text-lg">Table Configuration</CardTitle></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div>
            <Label>Total Companies</Label>
            <Input value={csvData.length || "—"} disabled className="mt-1.5 bg-muted" />
          </div>
          <div>
            <Label># of Tables</Label>
            <Input type="number" min={1} max={20} value={numTables} onChange={(e) => setNumTables(Number(e.target.value))} className="mt-1.5" />
          </div>
          <div>
            <Label>Target Per Table</Label>
            <Input type="number" min={3} max={10} value={targetPerTable} onChange={(e) => setTargetPerTable(Number(e.target.value))} className="mt-1.5" />
          </div>
          <div>
            <Label># of Table Leads</Label>
            <Input type="number" min={0} max={20} value={numLeads} onChange={(e) => updateLeadCount(Number(e.target.value))} className="mt-1.5" />
          </div>
        </CardContent>
      </Card>

      {/* Grouping Priority */}
      <Card>
        <CardHeader><CardTitle className="font-heading text-lg">Grouping Priority</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {groupingOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGroupingPriority(opt.value)}
                className={cn(
                  "text-left p-4 rounded-lg border-2 transition-all",
                  groupingPriority === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-center gap-2">
                  {groupingPriority === opt.value && <Check className="h-4 w-4 text-primary" />}
                  <span className="font-medium">{opt.label}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Allow stage mixing within tables</Label>
              <p className="text-sm text-muted-foreground">Intentionally spreads Early/Growth for mentorship dynamics</p>
            </div>
            <Switch checked={allowStageMixing} onCheckedChange={setAllowStageMixing} />
          </div>

          <Separator />

          <div>
            <Label className="mb-3 block">Session Format</Label>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                onClick={() => setSessionFormat("deep_dive")}
                className={cn(
                  "text-left p-4 rounded-lg border-2 transition-all",
                  sessionFormat === "deep_dive" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-center gap-2">
                  {sessionFormat === "deep_dive" && <Check className="h-4 w-4 text-primary" />}
                  <span className="font-medium">Deep Dive</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Fixed tables, no rotations</p>
              </button>
              <button
                onClick={() => setSessionFormat("speed_rounds")}
                className={cn(
                  "text-left p-4 rounded-lg border-2 transition-all",
                  sessionFormat === "speed_rounds" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-center gap-2">
                  {sessionFormat === "speed_rounds" && <Check className="h-4 w-4 text-primary" />}
                  <span className="font-medium">Speed Rounds</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">3× 20-minute rotations</p>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Engagement Prompts */}
      <Card>
        <CardHeader><CardTitle className="font-heading text-lg">Engagement Prompts</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {prompts.map((prompt, i) => (
            <div key={i}>
              <Label>Prompt {i + 1}</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompts((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
                className="mt-1.5 min-h-[80px]"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CSV Upload */}
      <Card>
        <CardHeader><CardTitle className="font-heading text-lg">Company Data Upload</CardTitle></CardHeader>
        <CardContent>
          {csvData.length === 0 ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
            >
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" id="csv-upload" />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">Drop your CSV here or click to upload</p>
                <p className="text-sm text-muted-foreground mt-1">Accepts .csv files with company survey data</p>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <span className="font-medium">{csvData.length} companies imported</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setCsvData([]); setCsvHeaders([]); setColumnMapping({}); }}>
                  Replace File
                </Button>
              </div>

              {showMapper && (
                <ColumnMapper
                  csvHeaders={csvHeaders}
                  canonicalFields={CANONICAL_FIELDS}
                  mapping={columnMapping}
                  onMappingChange={(m) => setColumnMapping(m)}
                  onConfirm={() => setShowMapper(false)}
                />
              )}

              {!showMapper && <CsvPreviewTable data={csvData} mapping={columnMapping} />}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table Leads */}
      {numLeads > 0 && (
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg">Table Leads</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {leads.map((lead, i) => (
              <div key={lead.id} className="p-4 border rounded-lg space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-semibold text-sm">Lead {i + 1}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Name</Label>
                    <Input value={lead.name} onChange={(e) => updateLead(i, "name", e.target.value)} className="mt-1.5" placeholder="Full name" />
                  </div>
                  <div>
                    <Label>Network Strengths</Label>
                    <Input value={lead.networkStrengths} onChange={(e) => updateLead(i, "networkStrengths", e.target.value)} className="mt-1.5" placeholder="e.g. Strong DC gov connections" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Expertise Tags</Label>
                    <div className="flex flex-wrap gap-2 mt-1.5 mb-2">
                      {lead.expertiseTags.map((tag, ti) => (
                        <Badge key={ti} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeTag(i, ti)}>
                          {tag} ×
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={tagInput[i] || ""}
                        onChange={(e) => setTagInput((prev) => ({ ...prev, [i]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(i))}
                        placeholder="Add tag and press Enter"
                      />
                      <Button variant="outline" size="icon" onClick={() => addTag(i)}><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Notes</Label>
                    <Textarea value={lead.notes} onChange={(e) => updateLead(i, "notes", e.target.value)} className="mt-1.5" placeholder="Additional notes about this lead..." />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end pb-8">
        <Button variant="outline">Save Draft</Button>
        <Button disabled={csvData.length === 0 || !sessionName}>
          Continue to Matching →
        </Button>
      </div>
    </div>
  );
}
