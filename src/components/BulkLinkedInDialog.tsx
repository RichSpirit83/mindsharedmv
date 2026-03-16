import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Linkedin, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ParsedLead } from "@/components/PasteLeadsDialog";

interface ScrapeResult {
  url: string;
  status: "pending" | "loading" | "success" | "error";
  lead?: ParsedLead;
  error?: string;
}

interface BulkLinkedInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (leads: ParsedLead[]) => void;
}

function parseUrls(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("linkedin.com/in/"));
}

export default function BulkLinkedInDialog({ open, onOpenChange, onImport }: BulkLinkedInDialogProps) {
  const [rawText, setRawText] = useState("");
  const [step, setStep] = useState<"input" | "processing" | "preview">("input");
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const cancelRef = useRef(false);

  const reset = () => {
    setRawText("");
    setStep("input");
    setResults([]);
    cancelRef.current = false;
  };

  const startProcessing = async () => {
    const urls = parseUrls(rawText);
    if (urls.length === 0) return;

    cancelRef.current = false;
    const initial: ScrapeResult[] = urls.map((url) => ({ url, status: "pending" }));
    setResults(initial);
    setStep("processing");

    for (let i = 0; i < urls.length; i++) {
      if (cancelRef.current) break;

      setResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "loading" } : r))
      );

      try {
        const { data, error } = await supabase.functions.invoke("scrape-linkedin", {
          body: { url: urls[i] },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Scrape failed");

        const profile = data.data;
        const lead: ParsedLead = {
          name: profile.name || "",
          company: profile.company || null,
          title: profile.title || null,
          email: profile.email || null,
          website: profile.website || null,
          linkedin_url: urls[i],
          expertise_tags: profile.expertiseTags || [],
          background: profile.background || null,
        };

        setResults((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "success", lead } : r))
        );
      } catch (err: any) {
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "error", error: err.message || "Failed" } : r
          )
        );
      }

      // Small delay between requests to avoid rate limiting
      if (i < urls.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    setStep("preview");
  };

  const handleImport = () => {
    const successful = results.filter((r) => r.status === "success" && r.lead).map((r) => r.lead!);
    onImport(successful);
    reset();
  };

  const urls = parseUrls(rawText);
  const processed = results.filter((r) => r.status === "success" || r.status === "error").length;
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const progress = results.length > 0 ? (processed / results.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5" />
            {step === "input" && "Bulk LinkedIn Import"}
            {step === "processing" && `Processing ${processed} of ${results.length}...`}
            {step === "preview" && `Import Results (${successCount} ready)`}
          </DialogTitle>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste LinkedIn profile URLs, one per line. Each profile will be looked up and enriched automatically.
            </p>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={"https://linkedin.com/in/jane-doe\nhttps://linkedin.com/in/john-smith\nhttps://linkedin.com/in/alice-jones"}
              rows={8}
              className="font-mono text-xs"
            />
            <div className="flex items-center justify-between">
              <Badge variant="secondary">
                {urls.length} valid URL{urls.length !== 1 ? "s" : ""} detected
              </Badge>
              <Button onClick={startProcessing} disabled={urls.length === 0}>
                <Linkedin className="mr-2 h-4 w-4" />
                Process {urls.length} Profile{urls.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="space-y-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              Processing profile {Math.min(processed + 1, results.length)} of {results.length}...
              {errorCount > 0 && <span className="text-destructive ml-2">({errorCount} failed)</span>}
            </p>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1 px-2 rounded-md bg-muted/30">
                  {r.status === "pending" && <div className="h-4 w-4" />}
                  {r.status === "loading" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {r.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {r.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                  <span className="truncate flex-1 font-mono text-xs">{r.url}</span>
                  {r.status === "success" && r.lead && (
                    <span className="text-xs text-muted-foreground">{r.lead.name}</span>
                  )}
                  {r.status === "error" && (
                    <span className="text-xs text-destructive">{r.error}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => { cancelRef.current = true; setStep("preview"); }}>
                Stop & Review
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {successCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {successCount} successful
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> {errorCount} failed
                </Badge>
              )}
            </div>

            <div className="max-h-[350px] overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Title</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i} className={r.status === "error" ? "opacity-50" : ""}>
                      <TableCell>
                        {r.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        {r.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {r.lead?.name || <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">{r.lead?.company || "—"}</TableCell>
                      <TableCell className="text-sm">{r.lead?.title || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { reset(); }}>Cancel</Button>
              <Button onClick={handleImport} disabled={successCount === 0}>
                Import {successCount} Lead{successCount !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
