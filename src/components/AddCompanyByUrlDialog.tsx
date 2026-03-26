import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddCompanyByUrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (row: Record<string, string>) => void;
}

type ScrapeResult = {
  url: string;
  companyName?: string;
  error?: string;
};

export default function AddCompanyByUrlDialog({ open, onOpenChange, onAdd }: AddCompanyByUrlDialogProps) {
  const [urls, setUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<ScrapeResult[] | null>(null);

  const reset = () => {
    setUrls("");
    setResults(null);
    setProgress(0);
    setTotal(0);
  };

  const handleSubmit = async () => {
    const urlList = urls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (urlList.length === 0) return;

    setLoading(true);
    setTotal(urlList.length);
    setProgress(0);
    setResults(null);

    const scraped: ScrapeResult[] = [];

    for (let i = 0; i < urlList.length; i++) {
      const url = urlList[i];
      try {
        const { data, error } = await supabase.functions.invoke("scrape-company-name", {
          body: { url },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Failed");

        const companyName =
          data.company_name ||
          new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", "");
        scraped.push({ url, companyName });
      } catch (err: any) {
        scraped.push({ url, error: err.message || "Failed" });
      }
      setProgress(i + 1);
    }

    setResults(scraped);
    setLoading(false);
  };

  const handleConfirm = () => {
    if (!results) return;
    const successful = results.filter((r) => r.companyName);
    successful.forEach((r) => {
      const formattedUrl = r.url.startsWith("http") ? r.url : `https://${r.url}`;
      onAdd({ company_name: r.companyName!, website: formattedUrl });
    });
    toast.success(`Added ${successful.length} compan${successful.length !== 1 ? "ies" : "y"}`);
    reset();
    onOpenChange(false);
  };

  const successCount = results?.filter((r) => r.companyName).length ?? 0;
  const failCount = results?.filter((r) => r.error).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Add Companies by Website URL
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!results ? (
            <>
              <p className="text-sm text-muted-foreground">
                Paste one or more website URLs (one per line) and we'll extract company names automatically.
              </p>
              <Textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder={"https://example.com\nhttps://another-company.com"}
                rows={5}
                disabled={loading}
              />
              {loading && total > 0 && (
                <div className="space-y-1">
                  <Progress value={(progress / total) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">
                    {progress} / {total} scraped
                  </p>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={!urls.trim() || loading}>
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Scraping…</>
                  ) : (
                    <><Globe className="h-4 w-4 mr-1" /> Scrape URLs</>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {successCount > 0 && <span className="text-green-600 font-medium">{successCount} found</span>}
                {successCount > 0 && failCount > 0 && " · "}
                {failCount > 0 && <span className="text-destructive font-medium">{failCount} failed</span>}
              </p>
              <div className="max-h-60 overflow-y-auto space-y-1 text-sm">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    {r.companyName ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <span className="font-medium truncate">{r.companyName || r.url}</span>
                    {r.error && <span className="text-xs text-destructive truncate">({r.error})</span>}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setResults(null)}>Back</Button>
                <Button onClick={handleConfirm} disabled={successCount === 0}>
                  Add {successCount} Compan{successCount !== 1 ? "ies" : "y"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
