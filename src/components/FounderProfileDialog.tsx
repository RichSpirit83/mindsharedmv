import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, User, MapPin, DollarSign, Users, Target, TrendingUp, Briefcase } from "lucide-react";

interface FounderProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Record<string, string> | null;
}

export default function FounderProfileDialog({ open, onOpenChange, data }: FounderProfileDialogProps) {
  if (!data) return null;

  const gridItems = [
    { label: "Revenue", value: data.revenue, icon: DollarSign },
    { label: "Capital Raised", value: data.capital_raised, icon: TrendingUp },
    { label: "Sales Stage", value: data.sales_stage, icon: Target },
    { label: "Employees", value: data.employee_count, icon: Users },
    { label: "Last Round", value: data.last_round, icon: Briefcase },
    { label: "PMF", value: data.has_pmf, icon: Target },
  ].filter((item) => item.value);

  const badges = [
    data.sector,
    data.primary_market,
    data.business_type,
    data.customer_type,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {data.company_name || "Company"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Founder info */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{data.first_name} {data.last_name}</p>
              {data.email && <p className="text-sm text-muted-foreground">{data.email}</p>}
            </div>
          </div>

          {/* Location */}
          {(data.city || data.state_province || data.country) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {[data.city, data.state_province, data.country].filter(Boolean).join(", ")}
            </div>
          )}

          {/* Description */}
          {data.company_description && (
            <p className="text-sm leading-relaxed">{data.company_description}</p>
          )}

          {/* Tags */}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {badges.map((b, i) => (
                <Badge key={i} variant="secondary">{b}</Badge>
              ))}
            </div>
          )}

          <Separator />

          {/* Key metrics grid */}
          {gridItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {gridItems.map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <item.icon className="h-3 w-3" />
                    {item.label}
                  </div>
                  <p className="text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* ICP */}
          {data.icp && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">ICP</p>
              <p className="text-sm">{data.icp}</p>
            </div>
          )}

          {/* Critical Challenges */}
          {data.critical_challenges && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Critical Challenges</p>
              <p className="text-sm leading-relaxed">{data.critical_challenges}</p>
            </div>
          )}

          {/* Topics of Interest */}
          {data.topics_of_interest && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Topics of Interest</p>
              <p className="text-sm leading-relaxed">{data.topics_of_interest}</p>
            </div>
          )}

          {/* Networking objectives */}
          {(data.need_networking || data.need_trends || data.need_partners || data.need_opportunities || data.need_mentorship) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Professional Objectives</p>
              <div className="flex flex-wrap gap-1.5">
                {data.need_networking && <Badge variant="outline" className="text-xs">Networking</Badge>}
                {data.need_trends && <Badge variant="outline" className="text-xs">Industry Trends</Badge>}
                {data.need_partners && <Badge variant="outline" className="text-xs">Partners</Badge>}
                {data.need_opportunities && <Badge variant="outline" className="text-xs">Opportunities</Badge>}
                {data.need_mentorship && <Badge variant="outline" className="text-xs">Mentorship</Badge>}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
