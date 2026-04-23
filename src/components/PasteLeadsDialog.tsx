import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClipboardPaste } from "lucide-react";
import Papa from "papaparse";
import ColumnMapper from "@/components/ColumnMapper";
import CsvPreviewTable from "@/components/CsvPreviewTable";
import {
  LEAD_MAPPING_MEMORY_KEY,
  getRememberedMapping,
  rememberMapping,
  clearMappingMemory,
  getRememberedFields,
} from "@/lib/mappingMemory";
import { toast } from "@/hooks/use-toast";

const LEAD_FIELDS = [
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

function autoMapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of LEAD_FIELDS) {
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

export interface ParsedLead {
  name: string;
  company: string | null;
  title: string | null;
  email: string | null;
  website: string | null;
  linkedin_url: string | null;
  expertise_tags: string[];
  background: string | null;
}

interface PasteLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (leads: ParsedLead[]) => void;
}

export default function PasteLeadsDialog({ open, onOpenChange, onImport }: PasteLeadsDialogProps) {
  const [rawText, setRawText] = useState("");
  const [step, setStep] = useState<"paste" | "mapping" | "preview">("paste");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const reset = () => {
    setRawText("");
    setStep("paste");
    setCsvData([]);
    setCsvHeaders([]);
    setMapping({});
  };

  const handleParse = () => {
    if (!rawText.trim()) return;
    const result = Papa.parse(rawText.trim(), {
      header: true,
      skipEmptyLines: true,
      delimiter: "", // auto-detect
    });
    const headers = result.meta.fields || [];
    const data = result.data as Record<string, string>[];

    if (headers.length === 0 || data.length === 0) {
      // Try without headers (positional: Name, Company, Title, Email, Website, LinkedIn)
      const fallback = Papa.parse(rawText.trim(), {
        header: false,
        skipEmptyLines: true,
        delimiter: "",
      });
      const rows = fallback.data as string[][];
      if (rows.length > 0) {
        const defaultHeaders = ["Name", "Company", "Title", "Email", "Website", "LinkedIn URL"];
        const maxCols = Math.max(...rows.map(r => r.length));
        const usedHeaders = defaultHeaders.slice(0, maxCols);
        const asObjects = rows.map(row => {
          const obj: Record<string, string> = {};
          usedHeaders.forEach((h, i) => { obj[h] = row[i] || ""; });
          return obj;
        });
        setCsvHeaders(usedHeaders);
        setCsvData(asObjects);
        const autoFb = autoMapHeaders(usedHeaders);
        const remFb = getRememberedMapping(LEAD_MAPPING_MEMORY_KEY, usedHeaders);
        setMapping({ ...autoFb, ...remFb });
        setStep("mapping");
        return;
      }
      return;
    }

    setCsvHeaders(headers);
    setCsvData(data);
    const auto = autoMapHeaders(headers);
    const rem = getRememberedMapping(LEAD_MAPPING_MEMORY_KEY, headers);
    setMapping({ ...auto, ...rem });
    setStep("mapping");
  };

  const confirmMapping = () => {
    if (!mapping.name) return;
    rememberMapping(LEAD_MAPPING_MEMORY_KEY, mapping, csvHeaders);
    setStep("preview");
  };

  const handleImport = () => {
    const leads: ParsedLead[] = csvData
      .map((row) => {
        const tagsRaw = mapping.expertise_tags ? row[mapping.expertise_tags] : "";
        const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
        return {
          name: row[mapping.name] || "",
          company: mapping.company ? row[mapping.company] || null : null,
          title: mapping.title ? row[mapping.title] || null : null,
          email: mapping.email ? row[mapping.email] || null : null,
          website: mapping.website ? row[mapping.website] || null : null,
          linkedin_url: mapping.linkedin_url ? row[mapping.linkedin_url] || null : null,
          expertise_tags: tags,
          background: mapping.background ? row[mapping.background] || null : null,
        };
      })
      .filter(l => l.name);

    onImport(leads);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            {step === "paste" && "Paste Lead List"}
            {step === "mapping" && "Map Columns"}
            {step === "preview" && `Preview Import (${csvData.length} leads)`}
          </DialogTitle>
        </DialogHeader>

        {step === "paste" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste rows from a spreadsheet (Excel, Google Sheets). Include a header row.
              Tab-separated and comma-separated formats are auto-detected.
            </p>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={"Name\tCompany\tTitle\tEmail\nJane Doe\tAcme Inc\tCEO\tjane@acme.com\nJohn Smith\tBeta Co\tCTO\tjohn@beta.co"}
              rows={10}
              className="font-mono text-xs"
            />
            <div className="flex justify-end">
              <Button onClick={handleParse} disabled={!rawText.trim()}>
                Parse & Continue
              </Button>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{csvData.length} rows detected</Badge>
              {!mapping.name && (
                <Badge variant="destructive">Name field required</Badge>
              )}
            </div>
            <ColumnMapper
              csvHeaders={csvHeaders}
              canonicalFields={LEAD_FIELDS}
              mapping={mapping}
              onMappingChange={setMapping}
              rememberedFields={getRememberedFields(LEAD_MAPPING_MEMORY_KEY, mapping)}
              onClearMemory={() => {
                clearMappingMemory(LEAD_MAPPING_MEMORY_KEY);
                setMapping(autoMapHeaders(csvHeaders));
                toast({ title: "Remembered mappings cleared" });
              }}
              onConfirm={confirmMapping}
            />
            <div className="flex gap-2 justify-start">
              <Button variant="outline" size="sm" onClick={() => setStep("paste")}>
                Back to Paste
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <CsvPreviewTable data={csvData} mapping={mapping} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep("mapping")}>Back to Mapping</Button>
              <Button onClick={handleImport}>
                Import {csvData.length} Leads
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
