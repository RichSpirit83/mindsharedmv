import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, Upload, Plus, Trash2, FileSpreadsheet, Check, Linkedin, Loader2, Sparkles, FileUp, Save, Users, ClipboardPaste } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Papa from "papaparse";
import CsvPreviewTable from "@/components/CsvPreviewTable";
import ColumnMapper from "@/components/ColumnMapper";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import PasteLeadsDialog, { type ParsedLead } from "@/components/PasteLeadsDialog";

const DEFAULT_PROMPTS = [
  "What is the one decision or constraint that—if resolved in 90 days—would most change your trajectory?",
  "What have you been spending time on that isn't delivering expected return, and what assumption might be wrong?",
  "If the Mindshare network could help with one thing in the next 3-6 months, what would be most valuable?",
];

type GroupingPriority = "sector" | "stage" | "need" | "hybrid";
type SessionFormat = "deep_dive" | "speed_rounds";
type PromptMode = "custom" | "generate";

interface TableLead {
  id: string;
  name: string;
  company: string;
  title: string;
  email: string;
  website: string;
  expertiseTags: string[];
  background: string;
  linkedinUrl: string;
}

const CANONICAL_FIELDS = [
  "company_name", "first_name", "last_name", "email",
  "company_description", "company_address", "city", "state_province",
  "zip_postal_code", "country",
  "dmv_area",
  "sector", "primary_market", "business_type", "customer_type", "icp",
  "employee_count", "revenue", "capital_raised", "last_round",
  "has_pmf", "sales_stage", "sales_leadership_area",
  "need_networking", "need_trends", "need_partners", "need_opportunities", "need_mentorship",
  "topics_of_interest", "critical_challenges", "additional_info",
];

const FIELD_ALIASES: Record<string, string[]> = {
  company_name: ["company name", "companyname", "company"],
  first_name: ["first name", "firstname", "first"],
  last_name: ["last name", "lastname", "last"],
  email: ["email", "e-mail", "emailaddress"],
  company_description: ["company description", "description", "companydescription"],
  company_address: ["company address", "companyaddress", "address"],
  city: ["city"],
  state_province: ["state/province", "stateprovince", "state", "province"],
  zip_postal_code: ["zip/postal code", "zippostalcode", "zip", "postalcode", "zipcode"],
  country: ["country (company address)", "country", "countrycompanyaddress"],
  dmv_area: ["where are you based in the dmv area", "dmv area", "dmvarea", "dmv"],
  sector: ["sector", "industry"],
  primary_market: ["primary market served", "primarymarketserved", "primarymarket", "primary market"],
  business_type: ["business type", "businesstype"],
  customer_type: ["customer type", "customertype"],
  icp: ["icp"],
  employee_count: ["# employees", "employees", "employeecount", "employee count", "numemployees"],
  revenue: ["revenue", "revenueband", "revenue band"],
  capital_raised: ["capital raised", "capitalraised"],
  last_round: ["last round raised", "lastroundraised", "lastround", "last round"],
  has_pmf: ["product / market fit?", "productmarketfit", "has pmf", "product market fit", "pmf"],
  sales_stage: ["sales stage", "salesstage"],
  sales_leadership_area: ["which area of sales leadership do you want to improve the most", "salesleadershiparea", "sales leadership"],
  need_networking: ["networking (what are your main professional objectives", "networking", "neednetworking"],
  need_trends: ["discovering industry trends", "needtrends", "industry trends"],
  need_partners: ["finding business partners", "needpartners", "business partners"],
  need_opportunities: ["finding business opportunities", "needopportunities", "business opportunities"],
  need_mentorship: ["mentorship (what are your main professional objectives", "mentorship", "needmentorship"],
  topics_of_interest: ["what topics are you most interested in learning about", "topicsofinterest", "topics of interest", "topics"],
  critical_challenges: ["what are your most critical challenges", "criticalchallenges", "critical challenges", "challenges"],
  additional_info: ["is there any thing additional you would like to add", "additionalinfo", "additional info", "additional"],
};

function fuzzyMatchHeader(header: string, canonicalFields: string[]): string | null {
  const normalized = header.toLowerCase().replace(/[\s_\-\/\?\(\)#,.'"]+/g, " ").trim();
  const collapsed = normalized.replace(/\s+/g, "");
  for (const field of canonicalFields) {
    const aliases = FIELD_ALIASES[field] || [field.replace(/_/g, " ")];
    for (const alias of aliases) {
      const aliasCollapsed = alias.replace(/[\s_\-\/\?\(\)#,.'"]+/g, "");
      if (collapsed === aliasCollapsed) return field;
      if (collapsed.startsWith(aliasCollapsed) && aliasCollapsed.length >= 6) return field;
      if (aliasCollapsed.startsWith(collapsed) && collapsed.length >= 6) return field;
    }
  }
  return null;
}

function computeSpeedRounds(breakoutStart: string, breakoutEnd: string) {
  const [sh, sm] = breakoutStart.split(":").map(Number);
  const [eh, em] = breakoutEnd.split(":").map(Number);
  const totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
  if (totalMinutes <= 0) return { rounds: 0, perRound: 0, totalMinutes: 0 };
  let perRound = 20;
  let rounds = Math.floor(totalMinutes / perRound);
  if (rounds < 2) { perRound = 15; rounds = Math.floor(totalMinutes / perRound); }
  return { rounds: Math.max(rounds, 1), perRound, totalMinutes };
}

function emptyLead(): TableLead {
  return { id: crypto.randomUUID(), name: "", company: "", title: "", email: "", website: "", expertiseTags: [], background: "", linkedinUrl: "" };
}

export default function SessionConfig() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [sessionName, setSessionName] = useState("");
  const [sessionDate, setSessionDate] = useState<Date>();
  const [breakoutStart, setBreakoutStart] = useState("10:00");
  const [breakoutEnd, setBreakoutEnd] = useState("11:00");
  const [numTables, setNumTables] = useState(5);
  const [targetPerTable, setTargetPerTable] = useState(6);
  const [numLeads, setNumLeads] = useState(0);
  const [groupingPriority, setGroupingPriority] = useState<GroupingPriority>("sector");
  const [allowStageMixing, setAllowStageMixing] = useState(true);
  const [sessionFormat, setSessionFormat] = useState<SessionFormat>("deep_dive");
  const [promptMode, setPromptMode] = useState<PromptMode>("custom");
  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [leads, setLeads] = useState<TableLead[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showMapper, setShowMapper] = useState(false);
  const [tagInput, setTagInput] = useState<Record<string, string>>({});
  const [linkedinLoading, setLinkedinLoading] = useState<Record<number, boolean>>({});
  const [pdfLoading, setPdfLoading] = useState<Record<number, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);
  const [leadPasteDialogOpen, setLeadPasteDialogOpen] = useState(false);
  const [leadCsvDialogOpen, setLeadCsvDialogOpen] = useState(false);
  const [leadCsvData, setLeadCsvData] = useState<Record<string, string>[]>([]);
  const [leadCsvHeaders, setLeadCsvHeaders] = useState<string[]>([]);
  const [leadCsvMapping, setLeadCsvMapping] = useState<Record<string, string>>({});
  const [leadCsvStep, setLeadCsvStep] = useState<"mapping" | "preview">("mapping");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const speedRoundInfo = useMemo(() => computeSpeedRounds(breakoutStart, breakoutEnd), [breakoutStart, breakoutEnd]);

  // Load lead pool for "Add from Pool" dialog
  const { data: leadPool = [], refetch: refetchPool } = useQuery({
    queryKey: ["lead_pool"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("lead_pool" as any).select("*").order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Load session from DB
  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data: session } = await supabase
        .from("breakout_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (!session) { toast.error("Session not found"); navigate("/admin"); return; }

      setSessionName(session.session_name || "");
      if (session.session_date) setSessionDate(new Date(session.session_date));
      setBreakoutStart(session.breakout_start || "10:00");
      setBreakoutEnd(session.breakout_end || "11:00");
      setNumTables(session.num_tables || 5);
      setTargetPerTable(session.target_per_table || 6);
      setGroupingPriority((session.grouping_priority as GroupingPriority) || "sector");
      setAllowStageMixing(session.allow_stage_mixing ?? true);
      setSessionFormat((session.session_format as SessionFormat) || "deep_dive");
      setPrompts((session.prompts as string[]) || DEFAULT_PROMPTS);
      setColumnMapping((session.column_mapping as Record<string, string>) || {});

      // Load companies
      const { data: companies } = await supabase
        .from("breakout_companies")
        .select("*")
        .eq("session_id", sessionId);
      if (companies && companies.length > 0) {
        const rows = companies.map((c) => c.raw_data as Record<string, string>);
        setCsvData(rows);
        if (rows[0]) setCsvHeaders(Object.keys(rows[0]));
      }

      // Load leads
      const { data: dbLeads } = await supabase
        .from("breakout_leads")
        .select("*")
        .eq("session_id", sessionId);
      if (dbLeads && dbLeads.length > 0) {
        const mapped = dbLeads.map((l) => ({
          id: l.id,
          name: l.name || "",
          company: l.company || "",
          title: l.title || "",
          email: l.email || "",
          website: l.website || "",
          expertiseTags: (l.expertise_tags as string[]) || [],
          background: l.background || "",
          linkedinUrl: l.linkedin_url || "",
        }));
        setLeads(mapped);
        setNumLeads(mapped.length);
      }

      setLoaded(true);
    };
    load();
  }, [sessionId]);

  // Auto-save (debounced)
  const saveToDb = useCallback(async () => {
    if (!sessionId || !loaded) return;
    setSaving(true);
    try {
      await supabase.from("breakout_sessions").update({
        session_name: sessionName,
        session_date: sessionDate ? format(sessionDate, "yyyy-MM-dd") : null,
        breakout_start: breakoutStart,
        breakout_end: breakoutEnd,
        num_tables: numTables,
        target_per_table: targetPerTable,
        grouping_priority: groupingPriority,
        allow_stage_mixing: allowStageMixing,
        session_format: sessionFormat,
        prompts: prompts as any,
        column_mapping: columnMapping as any,
      }).eq("id", sessionId);

      // Save companies
      if (csvData.length > 0) {
        await supabase.from("breakout_companies").delete().eq("session_id", sessionId);
        const companyRows = csvData.map((row) => {
          const mapped: Record<string, string> = {};
          for (const [canonical, csvCol] of Object.entries(columnMapping)) {
            if (csvCol && row[csvCol]) mapped[canonical] = row[csvCol];
          }
          return { session_id: sessionId, raw_data: row as any, mapped_data: mapped as any };
        });
        for (let i = 0; i < companyRows.length; i += 100) {
          await supabase.from("breakout_companies").insert(companyRows.slice(i, i + 100));
        }
      }

      // Save leads
      await supabase.from("breakout_leads").delete().eq("session_id", sessionId);
      if (leads.length > 0) {
        const leadRows = leads.map((l) => ({
          session_id: sessionId,
          name: l.name,
          linkedin_url: l.linkedinUrl,
          company: l.company,
          title: l.title,
          email: l.email,
          website: l.website,
          background: l.background,
          expertise_tags: l.expertiseTags as any,
        }));
        await supabase.from("breakout_leads").insert(leadRows);
      }
    } catch (err) {
      console.error("Auto-save error:", err);
    } finally {
      setSaving(false);
    }
  }, [sessionId, loaded, sessionName, sessionDate, breakoutStart, breakoutEnd, numTables, targetPerTable, groupingPriority, allowStageMixing, sessionFormat, prompts, columnMapping, csvData, leads]);

  // Debounce auto-save
  useEffect(() => {
    if (!loaded || !sessionId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveToDb, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [sessionName, sessionDate, breakoutStart, breakoutEnd, numTables, targetPerTable, groupingPriority, allowStageMixing, sessionFormat, prompts, columnMapping, csvData, leads, saveToDb]);

  // Auto-sync imported lead to lead_pool
  const syncToLeadPool = async (lead: TableLead) => {
    try {
      await (supabase.from("lead_pool" as any).insert({
        name: lead.name,
        linkedin_url: lead.linkedinUrl || null,
        company: lead.company || null,
        title: lead.title || null,
        email: lead.email || null,
        website: lead.website || null,
        expertise_tags: lead.expertiseTags as any,
        background: lead.background || null,
      }) as any);
      refetchPool();
    } catch (err) {
      console.error("Failed to sync to lead pool:", err);
    }
  };

  const importFromLinkedin = async (index: number) => {
    const url = leads[index]?.linkedinUrl?.trim();
    if (!url || !url.includes('linkedin.com')) { toast.error("Please enter a valid LinkedIn URL"); return; }
    setLinkedinLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('scrape-linkedin', { body: { url } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to scrape');
      const profile = data.data;
      const updatedLead: TableLead = {
        ...leads[index],
        name: profile.name || leads[index].name,
        company: profile.company || leads[index].company,
        title: profile.title || leads[index].title,
        email: profile.email || leads[index].email,
        website: profile.website || leads[index].website,
        expertiseTags: profile.expertiseTags?.length ? profile.expertiseTags : leads[index].expertiseTags,
        background: profile.background || leads[index].background,
      };
      setLeads((prev) => prev.map((l, i) => i === index ? updatedLead : l));
      toast.success(`Imported profile for ${profile.name || 'lead'}`);
      // Auto-sync to lead pool
      await syncToLeadPool(updatedLead);
    } catch (err: any) {
      console.error('LinkedIn import error:', err);
      toast.error(err.message || "Failed to import LinkedIn profile. Try uploading a PDF instead.");
    } finally {
      setLinkedinLoading((prev) => ({ ...prev, [index]: false }));
    }
  };

  const handlePdfUpload = async (index: number, file: File) => {
    if (!file || !file.name.endsWith('.pdf')) { toast.error("Please upload a PDF file"); return; }
    setPdfLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const pdfBase64 = btoa(binary);

      const filePath = `${sessionId}/${leads[index].id}_${file.name}`;
      await supabase.storage.from('lead-profiles').upload(filePath, file, { upsert: true });

      const { data, error } = await supabase.functions.invoke('parse-lead-pdf', { body: { pdfBase64 } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to parse PDF');

      const profile = data.data;
      const updatedLead: TableLead = {
        ...leads[index],
        name: profile.name || leads[index].name,
        company: profile.company || leads[index].company,
        title: profile.title || leads[index].title,
        email: profile.email || leads[index].email,
        website: profile.website || leads[index].website,
        expertiseTags: profile.expertiseTags?.length ? profile.expertiseTags : leads[index].expertiseTags,
        background: profile.background || leads[index].background,
      };
      setLeads((prev) => prev.map((l, i) => i === index ? updatedLead : l));
      toast.success(`Extracted profile from PDF for ${profile.name || 'lead'}`);
      // Auto-sync to lead pool
      await syncToLeadPool(updatedLead);
    } catch (err: any) {
      console.error('PDF import error:', err);
      toast.error(err.message || "Failed to parse PDF");
    } finally {
      setPdfLoading((prev) => ({ ...prev, [index]: false }));
    }
  };

  const addFromPool = (poolLead: any) => {
    const newLead: TableLead = {
      id: crypto.randomUUID(),
      name: poolLead.name || "",
      company: poolLead.company || "",
      title: poolLead.title || "",
      email: poolLead.email || "",
      website: poolLead.website || "",
      expertiseTags: Array.isArray(poolLead.expertise_tags) ? poolLead.expertise_tags : [],
      background: poolLead.background || "",
      linkedinUrl: poolLead.linkedin_url || "",
    };
    setLeads((prev) => [...prev, newLead]);
    setNumLeads((prev) => prev + 1);
    setPoolDialogOpen(false);
    toast.success(`Added ${newLead.name} from lead pool`);
  };

  const autoMapHeaders = (headers: string[]) => {
    const autoMap: Record<string, string> = {};
    CANONICAL_FIELDS.forEach((field) => {
      for (const h of headers) {
        const match = fuzzyMatchHeader(h, [field]);
        if (match) { autoMap[field] = h; break; }
      }
    });
    return autoMap;
  };

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data as Record<string, string>[]);
        const autoMap = autoMapHeaders(headers);
        setColumnMapping(autoMap);
        if (CANONICAL_FIELDS.filter((f) => !autoMap[f]).length > 0) setShowMapper(true);
        toast.success(`Imported ${results.data.length} companies`);
      },
      error: () => toast.error("Failed to parse CSV"),
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith(".csv")) { toast.error("Please drop a CSV file"); return; }
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data as Record<string, string>[]);
        const autoMap = autoMapHeaders(headers);
        setColumnMapping(autoMap);
        if (CANONICAL_FIELDS.filter((f) => !autoMap[f]).length > 0) setShowMapper(true);
        toast.success(`Imported ${results.data.length} companies`);
      },
    });
  }, []);

  const generatePrompts = async () => {
    if (csvData.length === 0) { toast.error("Upload company data first to generate prompts"); return; }
    setIsGeneratingPrompts(true);
    try {
      const challengeCol = columnMapping["critical_challenges"];
      const topicCol = columnMapping["topics_of_interest"];
      const challenges = challengeCol ? csvData.map(r => r[challengeCol]).filter(Boolean) : [];
      const topics = topicCol ? csvData.map(r => r[topicCol]).filter(Boolean) : [];
      if (challenges.length === 0 && topics.length === 0) { toast.error("No challenges or topics data found."); return; }
      const { data, error } = await supabase.functions.invoke('generate-prompts', { body: { challenges, topics } });
      if (error) throw error;
      if (data?.prompts?.length) { setPrompts(data.prompts); toast.success("Generated 3 engagement prompts"); }
      else throw new Error(data?.error || "Failed to generate prompts");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate prompts");
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  const updateLeadCount = (count: number) => {
    setNumLeads(count);
    const newLeads: TableLead[] = Array.from({ length: count }, (_, i) => (
      leads[i] || emptyLead()
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

  const handleContinue = async () => {
    await saveToDb();
    navigate(`/admin/match/${sessionId}`);
  };

  // Lead CSV import
  const LEAD_IMPORT_FIELDS = ["name", "company", "title", "email", "website", "linkedin_url", "expertise_tags", "background"];
  const LEAD_FIELD_ALIASES: Record<string, string[]> = {
    name: ["name", "full name", "fullname"],
    company: ["company", "company name", "companyname", "organization"],
    title: ["title", "job title", "jobtitle", "position", "role"],
    email: ["email", "e-mail", "emailaddress"],
    website: ["website", "url", "company website", "site"],
    linkedin_url: ["linkedin", "linkedin url", "linkedinurl", "linkedin profile"],
    expertise_tags: ["expertise", "tags", "expertise tags", "skills"],
    background: ["background", "notes", "bio", "summary"],
  };

  const autoMapLeadHeaders = (headers: string[]) => {
    const mapping: Record<string, string> = {};
    for (const field of LEAD_IMPORT_FIELDS) {
      const aliases = LEAD_FIELD_ALIASES[field] || [field];
      for (const h of headers) {
        const norm = h.toLowerCase().replace(/[\s_\-\/]+/g, "").trim();
        for (const alias of aliases) {
          if (norm === alias.replace(/[\s_\-\/]+/g, "")) { mapping[field] = h; break; }
        }
        if (mapping[field]) break;
      }
    }
    return mapping;
  };

  const handleLeadCsvFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setLeadCsvHeaders(headers);
        setLeadCsvData(results.data as Record<string, string>[]);
        setLeadCsvMapping(autoMapLeadHeaders(headers));
        setLeadCsvStep("mapping");
        setLeadCsvDialogOpen(true);
      },
      error: () => toast.error("Failed to parse CSV"),
    });
    e.target.value = "";
  }, []);

  const confirmLeadCsvMapping = () => {
    if (!leadCsvMapping.name) { toast.error("Name field is required"); return; }
    setLeadCsvStep("preview");
  };

  const executeLeadCsvImport = async () => {
    const newLeads: TableLead[] = leadCsvData.map((row) => {
      const tagsRaw = leadCsvMapping.expertise_tags ? row[leadCsvMapping.expertise_tags] : "";
      const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
      return {
        id: crypto.randomUUID(),
        name: row[leadCsvMapping.name] || "",
        company: leadCsvMapping.company ? row[leadCsvMapping.company] || "" : "",
        title: leadCsvMapping.title ? row[leadCsvMapping.title] || "" : "",
        email: leadCsvMapping.email ? row[leadCsvMapping.email] || "" : "",
        website: leadCsvMapping.website ? row[leadCsvMapping.website] || "" : "",
        linkedinUrl: leadCsvMapping.linkedin_url ? row[leadCsvMapping.linkedin_url] || "" : "",
        expertiseTags: tags,
        background: leadCsvMapping.background ? row[leadCsvMapping.background] || "" : "",
      };
    }).filter(l => l.name);

    setLeads((prev) => [...prev, ...newLeads]);
    setNumLeads((prev) => prev + newLeads.length);
    setLeadCsvDialogOpen(false);
    setLeadCsvData([]);
    toast.success(`Added ${newLeads.length} leads`);

    // Sync to lead pool
    for (const l of newLeads) { await syncToLeadPool(l); }
  };

  const handleLeadPasteImport = async (parsed: ParsedLead[]) => {
    const newLeads: TableLead[] = parsed.map((l) => ({
      id: crypto.randomUUID(),
      name: l.name,
      company: l.company || "",
      title: l.title || "",
      email: l.email || "",
      website: l.website || "",
      linkedinUrl: l.linkedin_url || "",
      expertiseTags: l.expertise_tags,
      background: l.background || "",
    }));
    setLeads((prev) => [...prev, ...newLeads]);
    setNumLeads((prev) => prev + newLeads.length);
    setLeadPasteDialogOpen(false);
    toast.success(`Added ${newLeads.length} leads`);

    // Sync to lead pool
    for (const l of newLeads) { await syncToLeadPool(l); }
  };

  const groupingOptions: { value: GroupingPriority; label: string; desc: string }[] = [
    { value: "sector", label: "Sector / Industry", desc: "Recommended — groups by market" },
    { value: "stage", label: "Stage", desc: "Early / Growth / Scale" },
    { value: "need", label: "Primary Need", desc: "GTM / Fundraising / Ops / Product" },
    { value: "hybrid", label: "Hybrid AI-Optimized", desc: "Let AI balance all factors" },
  ];

  // Annotate pool leads with "already in session" status
  const annotatedPoolLeads = leadPool.map((pl: any) => ({
    ...pl,
    alreadyInSession: leads.some((l) => l.name === pl.name && l.linkedinUrl === (pl.linkedin_url || "")),
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Session Configuration</h1>
          <p className="text-muted-foreground text-sm mt-1">Set up your breakout session parameters before uploading company data.</p>
        </div>
        {saving && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving...
          </div>
        )}
        {!saving && loaded && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Save className="h-3 w-3" /> Auto-saved
          </div>
        )}
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
          <div className="grid grid-cols-2 gap-3">
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
                  groupingPriority === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
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
                className={cn("text-left p-4 rounded-lg border-2 transition-all", sessionFormat === "deep_dive" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}
              >
                <div className="flex items-center gap-2">
                  {sessionFormat === "deep_dive" && <Check className="h-4 w-4 text-primary" />}
                  <span className="font-medium">Deep Dive</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Fixed tables, no rotations</p>
              </button>
              <button
                onClick={() => setSessionFormat("speed_rounds")}
                className={cn("text-left p-4 rounded-lg border-2 transition-all", sessionFormat === "speed_rounds" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}
              >
                <div className="flex items-center gap-2">
                  {sessionFormat === "speed_rounds" && <Check className="h-4 w-4 text-primary" />}
                  <span className="font-medium">Speed Rounds</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Multiple timed rotations</p>
              </button>
            </div>
            {sessionFormat === "speed_rounds" && (
              <div className="mt-3 p-3 rounded-lg bg-muted/50 border">
                {speedRoundInfo.totalMinutes > 0 ? (
                  <p className="text-sm font-medium">
                    {speedRoundInfo.rounds} round{speedRoundInfo.rounds !== 1 ? "s" : ""} × {speedRoundInfo.perRound} min
                    <span className="text-muted-foreground font-normal ml-2">({speedRoundInfo.totalMinutes} min total)</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Set valid breakout times to calculate rounds</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Engagement Prompts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">Engagement Prompts</CardTitle>
            <div className="flex gap-2">
              <Button variant={promptMode === "custom" ? "default" : "outline"} size="sm" onClick={() => setPromptMode("custom")}>Write Your Own</Button>
              <Button variant={promptMode === "generate" ? "default" : "outline"} size="sm" onClick={() => setPromptMode("generate")}>
                <Sparkles className="h-4 w-4 mr-1" /> Generate from Data
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {promptMode === "generate" && (
            <div className="p-4 rounded-lg border border-dashed bg-muted/30 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {csvData.length === 0 ? "Upload company data first." : `Generate prompts from ${csvData.length} companies' data.`}
              </p>
              <Button onClick={generatePrompts} disabled={csvData.length === 0 || isGeneratingPrompts}>
                {isGeneratingPrompts ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Generating…</> : <><Sparkles className="h-4 w-4 mr-1" /> Generate Prompts</>}
              </Button>
            </div>
          )}
          {prompts.map((prompt, i) => (
            <div key={i}>
              <Label>Prompt {i + 1}</Label>
              <Textarea value={prompt} onChange={(e) => setPrompts((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))} className="mt-1.5 min-h-[80px]" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CSV Upload */}
      <Card>
        <CardHeader><CardTitle className="font-heading text-lg">Company Data Upload</CardTitle></CardHeader>
        <CardContent>
          {csvData.length === 0 ? (
            <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer">
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
                  <Badge variant="secondary" className="text-xs">
                    {Object.values(columnMapping).filter(Boolean).length}/{CANONICAL_FIELDS.length} fields mapped
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowMapper(!showMapper)}>
                    {showMapper ? "Hide Mapper" : "Edit Mapping"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setCsvData([]); setCsvHeaders([]); setColumnMapping({}); }}>
                    Replace File
                  </Button>
                </div>
              </div>
              {showMapper && (
                <ColumnMapper csvHeaders={csvHeaders} canonicalFields={CANONICAL_FIELDS} mapping={columnMapping} onMappingChange={(m) => setColumnMapping(m)} onConfirm={() => setShowMapper(false)} />
              )}
              {!showMapper && <CsvPreviewTable data={csvData} mapping={columnMapping} />}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table Leads */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">Table Leads</CardTitle>
            <div className="flex gap-2 flex-wrap">
              {/* Paste Import */}
              <Button variant="outline" size="sm" onClick={() => setLeadPasteDialogOpen(true)}>
                <ClipboardPaste className="h-4 w-4 mr-1" /> Paste List
              </Button>
              {/* CSV Import for Leads */}
              <div>
                <input type="file" accept=".csv" className="hidden" id="lead-csv-import" onChange={handleLeadCsvFile} />
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor="lead-csv-import" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-1" /> Import CSV
                  </label>
                </Button>
              </div>
              <Dialog open={poolDialogOpen} onOpenChange={setPoolDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4 mr-1" /> Add from Lead Pool
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add from Lead Pool</DialogTitle>
                  </DialogHeader>
                  {leadPool.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No leads in the pool yet. Add leads from the Lead Pool page first.</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-auto">
                      {annotatedPoolLeads.map((pl: any) => (
                        <button
                          key={pl.id}
                          onClick={() => !pl.alreadyInSession && addFromPool(pl)}
                          disabled={pl.alreadyInSession}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-colors",
                            pl.alreadyInSession ? "opacity-50 cursor-not-allowed bg-muted/20" : "hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-sm">{pl.name}</div>
                            {pl.alreadyInSession && <Badge variant="secondary" className="text-xs">Already added</Badge>}
                          </div>
                          {(pl.title || pl.company) && (
                            <div className="text-xs text-muted-foreground">{[pl.title, pl.company].filter(Boolean).join(" at ")}</div>
                          )}
                          {Array.isArray(pl.expertise_tags) && pl.expertise_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {pl.expertise_tags.slice(0, 5).map((t: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                              ))}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={() => { setLeads((prev) => [...prev, emptyLead()]); setNumLeads((prev) => prev + 1); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Lead
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No table leads yet. Add leads manually or from the lead pool.</p>
          ) : leads.map((lead, i) => (
            <div key={lead.id} className="p-4 border rounded-lg space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-heading font-semibold text-sm">Lead {i + 1}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                  setLeads((prev) => prev.filter((_, idx) => idx !== i));
                  setNumLeads((prev) => prev - 1);
                }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div>
                <Label>LinkedIn Profile</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    value={lead.linkedinUrl}
                    onChange={(e) => updateLead(i, "linkedinUrl", e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={() => importFromLinkedin(i)} disabled={linkedinLoading[i] || !lead.linkedinUrl}>
                    {linkedinLoading[i] ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Linkedin className="h-4 w-4 mr-1" />}
                    {linkedinLoading[i] ? "Importing…" : "Import"}
                  </Button>
                  <div>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      id={`pdf-upload-${i}`}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfUpload(i, f); }}
                    />
                    <Button variant="outline" asChild disabled={pdfLoading[i]}>
                      <label htmlFor={`pdf-upload-${i}`} className="cursor-pointer">
                        {pdfLoading[i] ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileUp className="h-4 w-4 mr-1" />}
                        PDF
                      </label>
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Import from LinkedIn or upload a PDF profile as backup</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input value={lead.name} onChange={(e) => updateLead(i, "name", e.target.value)} className="mt-1.5" placeholder="Full name" />
                </div>
                <div>
                  <Label>Company</Label>
                  <Input value={lead.company} onChange={(e) => updateLead(i, "company", e.target.value)} className="mt-1.5" placeholder="Company name" />
                </div>
                <div>
                  <Label>Title</Label>
                  <Input value={lead.title} onChange={(e) => updateLead(i, "title", e.target.value)} className="mt-1.5" placeholder="e.g. CEO, VP Engineering" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={lead.email} onChange={(e) => updateLead(i, "email", e.target.value)} className="mt-1.5" placeholder="email@company.com" />
                </div>
                <div className="md:col-span-2">
                  <Label>Website</Label>
                  <Input value={lead.website} onChange={(e) => updateLead(i, "website", e.target.value)} className="mt-1.5" placeholder="https://company.com" />
                </div>
                <div className="md:col-span-2">
                  <Label>Expertise Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-1.5 mb-2">
                    {lead.expertiseTags.map((tag, ti) => (
                      <Badge key={ti} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeTag(i, ti)}>{tag} ×</Badge>
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
                  <Label>Background / Notes</Label>
                  <Textarea value={lead.background} onChange={(e) => updateLead(i, "background", e.target.value)} className="mt-1.5" placeholder="Professional background and relevant notes..." />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Lead CSV Import Dialog */}
      <Dialog open={leadCsvDialogOpen} onOpenChange={(open) => { setLeadCsvDialogOpen(open); if (!open) { setLeadCsvData([]); setLeadCsvHeaders([]); setLeadCsvMapping({}); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {leadCsvStep === "mapping" ? "Map CSV Columns to Lead Fields" : `Preview Import (${leadCsvData.length} leads)`}
            </DialogTitle>
          </DialogHeader>
          {leadCsvStep === "mapping" ? (
            <ColumnMapper
              csvHeaders={leadCsvHeaders}
              canonicalFields={LEAD_IMPORT_FIELDS}
              mapping={leadCsvMapping}
              onMappingChange={setLeadCsvMapping}
              onConfirm={confirmLeadCsvMapping}
            />
          ) : (
            <div className="space-y-4">
              <CsvPreviewTable data={leadCsvData} mapping={leadCsvMapping} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setLeadCsvStep("mapping")}>Back to Mapping</Button>
                <Button onClick={executeLeadCsvImport}>
                  Import {leadCsvData.length} Leads
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lead Paste Dialog */}
      <PasteLeadsDialog
        open={leadPasteDialogOpen}
        onOpenChange={setLeadPasteDialogOpen}
        onImport={handleLeadPasteImport}
      />

      {/* Actions */}
      <div className="flex gap-3 justify-end pb-8">
        <Button variant="outline" onClick={saveToDb} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving...</> : "Save Now"}
        </Button>
        <Button disabled={csvData.length === 0 || !sessionName} onClick={handleContinue}>
          Continue to Matching →
        </Button>
      </div>
    </div>
  );
}
