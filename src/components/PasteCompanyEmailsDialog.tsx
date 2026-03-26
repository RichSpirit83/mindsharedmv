import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Search, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MatchedCompany {
  id: string;
  raw_data: Record<string, string>;
  mapped_data: Record<string, string>;
  email: string;
}

interface PasteCompanyEmailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (companies: { raw_data: Record<string, string>; mapped_data: Record<string, string> }[]) => void;
  existingEmails: string[];
}

export default function PasteCompanyEmailsDialog({
  open,
  onOpenChange,
  onImport,
  existingEmails,
}: PasteCompanyEmailsDialogProps) {
  const [rawText, setRawText] = useState("");
  const [step, setStep] = useState<"paste" | "results">("paste");
  const [loading, setLoading] = useState(false);
  const [matched, setMatched] = useState<MatchedCompany[]>([]);
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
      // Query all companies and filter by email in mapped_data
      const { data, error } = await supabase
        .from("breakout_companies")
        .select("id, raw_data, mapped_data");

      if (error) throw error;

      const existingSet = new Set(existingEmails.map((e) => e.toLowerCase()));
      const emailSet = new Set(emails);
      const foundEmails = new Set<string>();
      const newMatched: MatchedCompany[] = [];
      const alreadyIn: string[] = [];
      const seen = new Set<string>(); // dedupe by email

      for (const row of data || []) {
        const mapped = (row.mapped_data || {}) as Record<string, string>;
        const raw = (row.raw_data || {}) as Record<string, string>;
        const email = (mapped.email || raw.Email || raw.email || "").toLowerCase().trim();

        if (!email || !emailSet.has(email) || seen.has(email)) continue;
        seen.add(email);
        foundEmails.add(email);

        if (existingSet.has(email)) {
          alreadyIn.push(email);
        } else {
          newMatched.push({ id: row.id, raw_data: raw, mapped_data: mapped, email });
        }
      }

      const unmatchedEmails = emails.filter((e) => !foundEmails.has(e));

      setMatched(newMatched);
      setUnmatched(unmatchedEmails);
      setAlreadyInSession(alreadyIn);
      setSelected(new Set(newMatched.map((c) => c.id)));
      setStep("results");
    } catch (err: any) {
      toast.error(err.message || "Failed to look up emails");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    const toImport = matched.filter((c) => selected.has(c.id));
    if (toImport.length === 0) return;
    onImport(toImport.map((c) => ({ raw_data: c.raw_data, mapped_data: c.mapped_data })));
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

  const getDisplayName = (c: MatchedCompany) => {
    const m = c.mapped_data;
    const r = c.raw_data;
    const name = [m.first_name || r["First Name"], m.last_name || r["Last Name"]].filter(Boolean).join(" ");
    const company = m.company_name || r["Company Name"] || r["Company"] || "";
    return { name, company };
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {step === "paste" ? "Paste Company Emails" : "Matched Companies"}
          </DialogTitle>
        </DialogHeader>

        {step === "paste" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste email addresses of founders. We'll match them against previously uploaded company data from any session.
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
                {matched.map((company) => {
                  const { name, company: companyName } = getDisplayName(company);
                  return (
                    <label
                      key={company.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selected.has(company.id)}
                        onCheckedChange={() => toggleSelection(company.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{name || company.email}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[companyName, company.email].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {unmatched.length > 0 && (
              <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 space-y-1">
                <div className="flex items-center gap-1 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Not found in any session
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
                Add {selected.size} Compan{selected.size !== 1 ? "ies" : "y"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
