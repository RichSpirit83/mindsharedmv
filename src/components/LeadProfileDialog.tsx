import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Building2, Briefcase, Globe, Mail, Linkedin } from "lucide-react";

interface LeadProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    name: string;
    company?: string;
    title?: string;
    expertiseTags?: string[];
    background?: string;
    email?: string;
    linkedinUrl?: string;
    website?: string;
  } | null;
}

export default function LeadProfileDialog({ open, onOpenChange, lead }: LeadProfileDialogProps) {
  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {lead.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title & Company */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              {lead.title && <p className="font-medium">{lead.title}</p>}
              {lead.company && <p className="text-sm text-muted-foreground">{lead.company}</p>}
            </div>
          </div>

          {/* Contact links */}
          {(lead.email || lead.linkedinUrl || lead.website) && (
            <div className="flex flex-wrap gap-3 text-sm">
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                  <Mail className="h-3.5 w-3.5" /> {lead.email}
                </a>
              )}
              {lead.linkedinUrl && (
                <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                </a>
              )}
              {lead.website && (
                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                  <Globe className="h-3.5 w-3.5" /> Website
                </a>
              )}
            </div>
          )}

          {/* Expertise Tags */}
          {lead.expertiseTags && lead.expertiseTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lead.expertiseTags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}

          {lead.background && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Background</p>
                <p className="text-sm leading-relaxed whitespace-pre-line">{lead.background}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
