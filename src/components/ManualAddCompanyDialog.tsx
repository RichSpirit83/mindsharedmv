import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface ManualAddCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (row: Record<string, string>) => void;
}

export default function ManualAddCompanyDialog({ open, onOpenChange, onAdd }: ManualAddCompanyDialogProps) {
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");

  const reset = () => {
    setCompanyName("");
    setWebsite("");
  };

  const handleSubmit = () => {
    if (!companyName.trim()) return;
    const row: Record<string, string> = { company_name: companyName.trim() };
    if (website.trim()) row.website = website.trim();
    onAdd(row);
    toast.success(`Added "${companyName.trim()}"`);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Company Manually
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name *</Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Corp"
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-website">Website (optional)</Label>
            <Input
              id="company-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={!companyName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add Company
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
