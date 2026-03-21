import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Edit2, Users, Upload, ClipboardPaste, Linkedin, Tag, X, ArrowUpDown, ArrowUp, ArrowDown, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Papa from "papaparse";
import ColumnMapper from "@/components/ColumnMapper";
import CsvPreviewTable from "@/components/CsvPreviewTable";
import PasteLeadsDialog, { type ParsedLead } from "@/components/PasteLeadsDialog";
import BulkLinkedInDialog from "@/components/BulkLinkedInDialog";

const LEAD_POOL_FIELDS = [
  "name", "company", "title", "email", "website", "linkedin_url", "expertise_tags", "background",
];

const FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "fullname"],
  company: ["company", "company name", "companyname", "organization"],
  title: ["title", "job title", "jobtitle", "position", "role"],
  email: ["email", "e-mail", "emailaddress", "email address"],
  website: ["website", "url", "company website", "site"],
  linkedin_url: ["linkedin", "linkedin url", "linkedinurl", "linkedin profile"],
  expertise_tags: ["expertise", "tags", "expertise tags", "skills", "specialties"],
  background: ["background", "notes", "bio", "summary", "about", "description"],
};

function autoMapLeadHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of LEAD_POOL_FIELDS) {
    const aliases = FIELD_ALIASES[field] || [field];
    for (const h of headers) {
      const norm = h.toLowerCase().replace(/[\s_\-\/]+/g, "").trim();
      for (const alias of aliases) {
        if (norm === alias.replace(/[\s_\-\/]+/g, "")) {
          mapping[field] = h;
          break;
        }
      }
      if (mapping[field]) break;
    }
  }
  return mapping;
}

type LeadPoolEntry = {
  id: string;
  name: string;
  linkedin_url: string | null;
  expertise_tags: string[];
  tags: string[];
  background: string | null;
  company: string | null;
  title: string | null;
  email: string | null;
  website: string | null;
  created_at: string;
};

const TAG_COLORS: Record<string, string> = {
  "Table Lead": "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
  "Board Member": "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700",
  "Alumni": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  "Mentor": "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
  "Investor": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  "Speaker": "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-700",
};

function getTagColor(tag: string) {
  return TAG_COLORS[tag] || "bg-muted text-muted-foreground border-border";
}

export default function LeadPool() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadPoolEntry | null>(null);
  const [form, setForm] = useState({
    name: "", linkedin_url: "", expertise_tags: "", background: "", company: "", title: "", email: "", website: "", tags: "",
  });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // CSV import state
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [csvStep, setCsvStep] = useState<"mapping" | "preview">("mapping");
  const [importing, setImporting] = useState(false);
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [linkedinDialogOpen, setLinkedinDialogOpen] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["lead_pool"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("lead_pool" as any)
        .select("*")
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data ?? []).map((l: any) => ({
        ...l,
        expertise_tags: Array.isArray(l.expertise_tags) ? l.expertise_tags : [],
        tags: Array.isArray(l.tags) ? l.tags : [],
      })) as LeadPoolEntry[];
    },
  });

  // Compute all unique tags across all leads
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    leads.forEach((l) => l.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [leads]);

  // Sort state
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  // Filtered and sorted leads
  const filteredLeads = useMemo(() => {
    let result = filterTag ? leads.filter((l) => l.tags.includes(filterTag)) : [...leads];
    if (sortField) {
      result.sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        if (sortField === "name") { aVal = a.name || ""; bVal = b.name || ""; }
        else if (sortField === "company") { aVal = a.company || ""; bVal = b.company || ""; }
        else if (sortField === "tags") { aVal = a.tags.length; bVal = b.tags.length; }
        else if (sortField === "background") { aVal = a.background || ""; bVal = b.background || ""; }
        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [leads, filterTag, sortField, sortDir]);

  const saveMutation = useMutation({
    mutationFn: async (lead: typeof form & { id?: string }) => {
      const expertiseTags = lead.expertise_tags.split(",").map((t) => t.trim()).filter(Boolean);
      const tags = lead.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        name: lead.name,
        linkedin_url: lead.linkedin_url || null,
        expertise_tags: expertiseTags,
        tags,
        background: lead.background || null,
        company: lead.company || null,
        title: lead.title || null,
        email: lead.email || null,
        website: lead.website || null,
      };
      if (lead.id) {
        const { error } = await (supabase.from("lead_pool" as any).update(payload).eq("id", lead.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("lead_pool" as any).insert(payload) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead_pool"] });
      setDialogOpen(false);
      setEditingLead(null);
      resetForm();
      toast({ title: editingLead ? "Lead updated" : "Lead added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("lead_pool" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead_pool"] });
      toast({ title: "Lead removed" });
    },
  });

  // Bulk tag mutation
  const bulkTagMutation = useMutation({
    mutationFn: async ({ ids, tag, action }: { ids: string[]; tag: string; action: "add" | "remove" }) => {
      for (const id of ids) {
        const lead = leads.find((l) => l.id === id);
        if (!lead) continue;
        let newTags: string[];
        if (action === "add") {
          newTags = lead.tags.includes(tag) ? lead.tags : [...lead.tags, tag];
        } else {
          newTags = lead.tags.filter((t) => t !== tag);
        }
        const { error } = await (supabase.from("lead_pool" as any).update({ tags: newTags }).eq("id", id) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead_pool"] });
      setSelectedIds(new Set());
      setBulkTagInput("");
      toast({ title: "Tags updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => setForm({ name: "", linkedin_url: "", expertise_tags: "", background: "", company: "", title: "", email: "", website: "", tags: "" });

  const openEdit = (lead: LeadPoolEntry) => {
    setEditingLead(lead);
    setForm({
      name: lead.name,
      linkedin_url: lead.linkedin_url || "",
      expertise_tags: lead.expertise_tags.join(", "),
      background: lead.background || "",
      company: lead.company || "",
      title: lead.title || "",
      email: lead.email || "",
      website: lead.website || "",
      tags: lead.tags.join(", "),
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingLead(null);
    resetForm();
    setDialogOpen(true);
  };

  // Toggle individual tag on a single lead
  const toggleLeadTag = async (lead: LeadPoolEntry, tag: string) => {
    const newTags = lead.tags.includes(tag) ? lead.tags.filter((t) => t !== tag) : [...lead.tags, tag];
    const { error } = await (supabase.from("lead_pool" as any).update({ tags: newTags }).eq("id", lead.id) as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["lead_pool"] });
    }
  };

  // Selection helpers
  const allSelected = filteredLeads.length > 0 && filteredLeads.every((l) => selectedIds.has(l.id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkTag = (action: "add" | "remove") => {
    const tag = bulkTagInput.trim();
    if (!tag) return;
    bulkTagMutation.mutate({ ids: Array.from(selectedIds), tag, action });
  };

  // CSV import handlers
  const handleCsvFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const data = results.data as Record<string, string>[];
        setCsvHeaders(headers);
        setCsvData(data);
        setCsvMapping(autoMapLeadHeaders(headers));
        setCsvStep("mapping");
        setCsvDialogOpen(true);
      },
      error: () => toast({ title: "Failed to parse CSV", variant: "destructive" }),
    });
    e.target.value = "";
  }, []);

  const confirmCsvMapping = () => {
    if (!csvMapping.name) {
      toast({ title: "Name field is required", description: "Please map the 'name' column before continuing.", variant: "destructive" });
      return;
    }
    setCsvStep("preview");
  };

  const executeBulkImport = async () => {
    setImporting(true);
    try {
      const rows = csvData.map((row) => {
        const tagsRaw = csvMapping.expertise_tags ? row[csvMapping.expertise_tags] : "";
        const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];
        return {
          name: row[csvMapping.name] || "Unknown",
          company: csvMapping.company ? row[csvMapping.company] || null : null,
          title: csvMapping.title ? row[csvMapping.title] || null : null,
          email: csvMapping.email ? row[csvMapping.email] || null : null,
          website: csvMapping.website ? row[csvMapping.website] || null : null,
          linkedin_url: csvMapping.linkedin_url ? row[csvMapping.linkedin_url] || null : null,
          expertise_tags: tags,
          background: csvMapping.background ? row[csvMapping.background] || null : null,
        };
      }).filter((r) => r.name && r.name !== "Unknown");

      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await (supabase.from("lead_pool" as any).insert(rows.slice(i, i + 100)) as any);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["lead_pool"] });
      setCsvDialogOpen(false);
      setCsvData([]);
      setCsvHeaders([]);
      setCsvMapping({});
      toast({ title: `Imported ${rows.length} leads` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handlePasteImport = async (parsed: ParsedLead[]) => {
    if (parsed.length === 0) return;
    setImporting(true);
    try {
      const rows = parsed.map((l) => ({
        name: l.name,
        company: l.company,
        title: l.title,
        email: l.email,
        website: l.website,
        linkedin_url: l.linkedin_url,
        expertise_tags: l.expertise_tags as any,
        background: l.background,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await (supabase.from("lead_pool" as any).insert(rows.slice(i, i + 100)) as any);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["lead_pool"] });
      setPasteDialogOpen(false);
      toast({ title: `Imported ${rows.length} leads` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Lead Pool</h1>
          <Badge variant="secondary">{leads.length} leads</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLinkedinDialogOpen(true)}>
            <Linkedin className="mr-2 h-4 w-4" /> Import LinkedIn
          </Button>
          <Button variant="outline" onClick={() => setPasteDialogOpen(true)}>
            <ClipboardPaste className="mr-2 h-4 w-4" /> Paste List
          </Button>
          <div>
            <input type="file" accept=".csv" className="hidden" id="csv-lead-import" onChange={handleCsvFile} />
            <Button variant="outline" asChild>
              <label htmlFor="csv-lead-import" className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" /> Import CSV
              </label>
            </Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingLead(null); }}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingLead ? "Edit Lead" : "Add Lead"}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate({ ...form, id: editingLead?.id });
                }}
                className="space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Job title" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@company.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn URL</Label>
                  <Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://company.com" />
                </div>
                <div className="space-y-2">
                  <Label>Expertise Tags</Label>
                  <Input value={form.expertise_tags} onChange={(e) => setForm({ ...form, expertise_tags: e.target.value })} placeholder="fintech, AI, growth (comma-separated)" />
                </div>
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Board Member, Alumni (comma-separated)" />
                  {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {allTags.map((tag) => {
                        const active = form.tags.split(",").map(t => t.trim()).includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${active ? getTagColor(tag) : "bg-muted/50 text-muted-foreground border-border opacity-60 hover:opacity-100"}`}
                            onClick={() => {
                              const current = form.tags.split(",").map(t => t.trim()).filter(Boolean);
                              const next = active ? current.filter(t => t !== tag) : [...current, tag];
                              setForm({ ...form, tags: next.join(", ") });
                            }}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Background / Notes</Label>
                  <Textarea value={form.background} onChange={(e) => setForm({ ...form, background: e.target.value })} rows={3} />
                </div>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : editingLead ? "Update Lead" : "Add Lead"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
          <button
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${!filterTag ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"}`}
            onClick={() => setFilterTag(null)}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filterTag === tag ? getTagColor(tag) + " ring-2 ring-primary/30" : getTagColor(tag) + " opacity-70 hover:opacity-100"}`}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                placeholder="Enter tag name…"
                className="h-8 max-w-[200px]"
              />
              <Button size="sm" variant="outline" onClick={() => handleBulkTag("add")} disabled={!bulkTagInput.trim() || bulkTagMutation.isPending}>
                <Tag className="mr-1 h-3 w-3" /> Add Tag
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkTag("remove")} disabled={!bulkTagInput.trim() || bulkTagMutation.isPending}>
                <X className="mr-1 h-3 w-3" /> Remove Tag
              </Button>
              {allTags.length > 0 && (
                <div className="flex gap-1 ml-2">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer ${getTagColor(tag)} hover:ring-1 ring-primary/30`}
                      onClick={() => setBulkTagInput(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </CardContent>
        </Card>
      )}

      {/* CSV Import Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={(open) => { setCsvDialogOpen(open); if (!open) { setCsvData([]); setCsvHeaders([]); setCsvMapping({}); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {csvStep === "mapping" ? "Map CSV Columns" : `Preview Import (${csvData.length} leads)`}
            </DialogTitle>
          </DialogHeader>
          {csvStep === "mapping" ? (
            <ColumnMapper
              csvHeaders={csvHeaders}
              canonicalFields={LEAD_POOL_FIELDS}
              mapping={csvMapping}
              onMappingChange={setCsvMapping}
              onConfirm={confirmCsvMapping}
            />
          ) : (
            <div className="space-y-4">
              <CsvPreviewTable data={csvData} mapping={csvMapping} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setCsvStep("mapping")}>Back to Mapping</Button>
                <Button onClick={executeBulkImport} disabled={importing}>
                  {importing ? "Importing…" : `Import ${csvData.length} Leads`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {filterTag ? `No leads tagged "${filterTag}".` : "No leads in the pool yet. Add leads manually or import a CSV."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="w-[50px] text-center">
                    <Star className="h-3.5 w-3.5 mx-auto text-yellow-500" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    <span className="inline-flex items-center">Name <SortIcon field="name" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("company")}>
                    <span className="inline-flex items-center">Company / Title <SortIcon field="company" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("tags")}>
                    <span className="inline-flex items-center">Tags <SortIcon field="tags" /></span>
                  </TableHead>
                  <TableHead>Expertise</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("background")}>
                    <span className="inline-flex items-center">Background <SortIcon field="background" /></span>
                  </TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className={selectedIds.has(lead.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleOne(lead.id)} />
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => toggleLeadTag(lead, "Table Lead")}
                        className={`p-1 rounded-full transition-colors ${lead.tags.includes("Table Lead") ? "text-yellow-500" : "text-muted-foreground/30 hover:text-yellow-400"}`}
                        title={lead.tags.includes("Table Lead") ? "Remove Table Lead" : "Set as Table Lead"}
                      >
                        <Star className={`h-4 w-4 ${lead.tags.includes("Table Lead") ? "fill-yellow-500" : ""}`} />
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{lead.name}</div>
                      {lead.linkedin_url && (
                        <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          LinkedIn
                        </a>
                      )}
                      {lead.email && <div className="text-xs text-muted-foreground">{lead.email}</div>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lead.company && <div className="font-medium">{lead.company}</div>}
                      {lead.title && <div className="text-muted-foreground text-xs">{lead.title}</div>}
                      {lead.website && (
                        <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          {lead.website.replace(/^https?:\/\//, '').slice(0, 30)}
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 items-center">
                        {lead.tags.map((tag, i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${getTagColor(tag)}`}>
                            {tag}
                          </span>
                        ))}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary hover:text-primary transition-colors">
                              <Plus className="h-3 w-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="start">
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Toggle tags</p>
                              {allTags.map((tag) => (
                                <button
                                  key={tag}
                                  className={`block w-full text-left text-xs px-2 py-1 rounded transition-colors ${lead.tags.includes(tag) ? getTagColor(tag) : "hover:bg-muted"}`}
                                  onClick={() => toggleLeadTag(lead, tag)}
                                >
                                  {lead.tags.includes(tag) ? "✓ " : ""}{tag}
                                </button>
                              ))}
                              <div className="border-t pt-2">
                                <Input
                                  placeholder="New tag…"
                                  className="h-7 text-xs"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const val = (e.target as HTMLInputElement).value.trim();
                                      if (val) {
                                        toggleLeadTag(lead, val);
                                        (e.target as HTMLInputElement).value = "";
                                      }
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {lead.expertise_tags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{lead.background}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(lead)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(lead.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PasteLeadsDialog
        open={pasteDialogOpen}
        onOpenChange={setPasteDialogOpen}
        onImport={handlePasteImport}
      />

      <BulkLinkedInDialog
        open={linkedinDialogOpen}
        onOpenChange={setLinkedinDialogOpen}
        onImport={handlePasteImport}
      />
    </div>
  );
}
