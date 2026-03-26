import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddCompanyByUrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (row: Record<string, string>) => void;
}

export default function AddCompanyByUrlDialog({ open, onOpenChange, onAdd }: AddCompanyByUrlDialogProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setUrl("");
  };

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-company-name", {
        body: { url: url.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to extract company name");

      const companyName = data.company_name || new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", "");
      const formattedUrl = url.startsWith("http") ? url : `https://${url}`;

      onAdd({ company_name: companyName, website: formattedUrl });
      toast.success(`Added "${companyName}"`);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Scrape error:", err);
      toast.error(err.message || "Failed to scrape company name");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Add Company by Website
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste a company website URL and we'll extract the company name automatically.
          </p>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={!url.trim() || loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Scraping…</>
              ) : (
                <><Globe className="h-4 w-4 mr-1" /> Add Company</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
