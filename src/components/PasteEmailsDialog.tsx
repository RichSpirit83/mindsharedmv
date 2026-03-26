import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Search, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PoolLead {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  email: string | null;
  website: string | null;
  linkedin_url: string | null;
  expertise_tags: string[] | null;
  background: string | null;
}

interface PasteEmailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (leads: PoolLead[]) => void;
  existingEmails: string[];
}

export default function PasteEmailsDialog({ open, onOpenChange, onImport, existingEmails }: PasteEmailsDialogProps) {
  const [rawText, setRawText] = useState("");
  const [step, setStep] = useState<"paste" | "results">("paste");
  const [loading, setLoading] = useState(false);
  const [matched, setMatched] = useState<PoolLead[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [alreadyInSession, setAlreadyInSession] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reset = () => {
    setRawText("");
    setStep("paste");
    setMatched([]);
    setUnmatched([]);
    setAlreadyInSession([]);
    setSelected(new Set());
  };

  const parseEmails = (text: string): string[] => {
    return text
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes("@"));
  };

  const handleLookup = async () => {
    const emails = parseEmails(rawText);
    if (emails.length === 0) {
      toast.error("No valid email addresses found");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from("lead_pool" as any)
        .select("*")
        .in("email", emails) as any);

      if (error) throw error;

      const leads = (data || []) as PoolLead[];
      const matchedEmails = new Set(leads.map((l) => l.email?.toLowerCase()));
      const existingSet = new Set(existingEmails.map((e) => e.toLowerCase()));

      const newMatched: PoolLead[] = [];
      const alreadyIn: string[] = [];

      for (const lead of leads) {
        const email = lead.email?.toLowerCase() || "";
        if (existingSet.has(email)) {
          alreadyIn.push(email);
        } else {
          newMatched.push(lead);
        }
      }

      const unmatchedEmails = emails.filter((e) => !matchedEmails.has(e));

      setMatched(newMatched);
      setUnmatched(unmatchedEmails);
      setAlreadyInSession(alreadyIn);
      setSelected(new Set(newMatched.map((l) => l.id)));
      setStep("results");
    } catch (err: any) {
      toast.error(err.message || "Failed to look up emails");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    const toImport = matched.filter((l) => selected.has(l.id));
    if (toImport.length === 0) return;
    onImport(toImport);
    reset();
  };

  const toggleSelection = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {step === "paste" ? "Paste Email Addresses" : "Matched Leads"}
          </DialogTitle>
        </DialogHeader>

        {step === "paste" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste email addresses (one per line, comma-separated, or semicolon-separated).
              We'll match them against the Lead Pool.
            </p>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={"jane@acme.com\njohn@beta.co\nsusan@gamma.io"}
              rows={8}
              className="font-mono text-xs"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {parseEmails(rawText).length} email{parseEmails(rawText).length !== 1 ? "s" : ""} detected
              </span>
              <Button onClick={handleLookup} disabled={!rawText.trim() || loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Looking up…</>
                ) : (
                  <><Search className="h-4 w-4 mr-1" /> Look Up</>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "results" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{matched.length} matched</Badge>
              {alreadyInSession.length > 0 && (
                <Badge variant="outline">{alreadyInSession.length} already in session</Badge>
              )}
              {unmatched.length > 0 && (
                <Badge variant="destructive">{unmatched.length} not found</Badge>
              )}
            </div>

            {matched.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-auto">
                {matched.map((lead) => (
                  <label
                    key={lead.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selected.has(lead.id)}
                      onCheckedChange={() => toggleSelection(lead.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{lead.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[lead.title, lead.company].filter(Boolean).join(" · ") || lead.email}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {unmatched.length > 0 && (
              <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 space-y-1">
                <div className="flex items-center gap-1 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Not found in Lead Pool
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {unmatched.map((email) => (
                    <div key={email}>{email}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep("paste")}>Back</Button>
              <Button onClick={handleImport} disabled={selected.size === 0}>
                Add {selected.size} Lead{selected.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
