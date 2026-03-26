import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Building2, User, MapPin, DollarSign, Users, Target, TrendingUp, Briefcase, Pencil, Save, X } from "lucide-react";
import { computeStageScoreFromMapped } from "@/components/cohort/companyData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface FounderProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Record<string, string> | null;
  ids?: string[];
  sessionNames?: string[];
  onSaved?: () => void;
}

export default function FounderProfileDialog({ open, onOpenChange, data, ids = [], sessionNames = [], onSaved }: FounderProfileDialogProps) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setEditData({ ...data });
    setEditing(false);
  }, [data]);

  if (!data) return null;

  const display = editing ? editData : data;

  const updateField = (key: string, value: string) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (ids.length === 0) return;
    setSaving(true);
    try {
      for (const id of ids) {
        const { error } = await supabase
          .from("breakout_companies")
          .update({ mapped_data: editData as any })
          .eq("id", id);
        if (error) throw error;
      }
      toast({ title: "Founder updated" });
      setEditing(false);
      onSaved?.();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const gridItems = [
    { label: "Revenue", key: "revenue", icon: DollarSign },
    { label: "Capital Raised", key: "capital_raised", icon: TrendingUp },
    { label: "Sales Stage", key: "sales_stage", icon: Target },
    { label: "Employees", key: "employee_count", icon: Users },
    { label: "Last Round", key: "last_round", icon: Briefcase },
    { label: "PMF", key: "has_pmf", icon: Target },
  ].filter((item) => editing || display[item.key]);

  const badges = [
    display.sector,
    display.primary_market,
    display.business_type,
    display.customer_type,
  ].filter(Boolean);

  const Field = ({ value, fieldKey, multiline }: { value: string; fieldKey: string; multiline?: boolean }) => {
    if (!editing) return <span>{value}</span>;
    if (multiline) {
      return (
        <Textarea
          value={editData[fieldKey] || ""}
          onChange={(e) => updateField(fieldKey, e.target.value)}
          className="text-sm"
          rows={3}
        />
      );
    }
    return (
      <Input
        value={editData[fieldKey] || ""}
        onChange={(e) => updateField(fieldKey, e.target.value)}
        className="h-8 text-sm"
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-heading text-xl flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {editing ? (
                <Input
                  value={editData.company_name || ""}
                  onChange={(e) => updateField("company_name", e.target.value)}
                  className="h-8 text-lg font-bold"
                />
              ) : (
                display.company_name || "Company"
              )}
            </DialogTitle>
            {ids.length > 0 && (
              <div className="flex gap-1">
                {editing ? (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => { setEditData({ ...data }); setEditing(false); }}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleSave} disabled={saving}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Session tags */}
        {sessionNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {sessionNames.map((s, i) => (
              <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
            ))}
          </div>
        )}

        {/* Stage Score */}
        {(() => {
          const score = computeStageScoreFromMapped(display);
          const pct = Math.round((score.score / 3) * 100);
          return (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground mb-1">Stage Score</p>
                <div className="h-1.5 rounded-full bg-background overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: score.color }} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: score.color }}>{score.score.toFixed(2)}</p>
                <Badge className="text-[10px] px-2 py-0" style={{ backgroundColor: `${score.color}22`, color: score.color, border: 'none' }}>
                  {score.label}
                </Badge>
              </div>
            </div>
          );
        })()}

        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              {editing ? (
                <div className="flex gap-2">
                  <Input value={editData.first_name || ""} onChange={(e) => updateField("first_name", e.target.value)} placeholder="First name" className="h-8 text-sm" />
                  <Input value={editData.last_name || ""} onChange={(e) => updateField("last_name", e.target.value)} placeholder="Last name" className="h-8 text-sm" />
                </div>
              ) : (
                <p className="font-medium">{display.first_name} {display.last_name}</p>
              )}
              {editing ? (
                <Input value={editData.email || ""} onChange={(e) => updateField("email", e.target.value)} placeholder="Email" className="h-8 text-sm mt-1" />
              ) : (
                display.email && <p className="text-sm text-muted-foreground">{display.email}</p>
              )}
            </div>
          </div>

          {/* Location */}
          {(editing || display.city || display.state_province || display.country) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              {editing ? (
                <div className="flex gap-2 flex-1">
                  <Input value={editData.city || ""} onChange={(e) => updateField("city", e.target.value)} placeholder="City" className="h-7 text-xs" />
                  <Input value={editData.state_province || ""} onChange={(e) => updateField("state_province", e.target.value)} placeholder="State" className="h-7 text-xs" />
                  <Input value={editData.country || ""} onChange={(e) => updateField("country", e.target.value)} placeholder="Country" className="h-7 text-xs" />
                </div>
              ) : (
                [display.city, display.state_province, display.country].filter(Boolean).join(", ")
              )}
            </div>
          )}

          {/* Description */}
          {(editing || display.company_description) && (
            editing ? (
              <Textarea value={editData.company_description || ""} onChange={(e) => updateField("company_description", e.target.value)} placeholder="Company description" className="text-sm" rows={3} />
            ) : (
              <p className="text-sm leading-relaxed">{display.company_description}</p>
            )
          )}

          {/* Tags */}
          {badges.length > 0 && !editing && (
            <div className="flex flex-wrap gap-2">
              {badges.map((b, i) => (
                <Badge key={i} variant="secondary">{b}</Badge>
              ))}
            </div>
          )}
          {editing && (
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-xs text-muted-foreground mb-1">Sector</p><Input value={editData.sector || ""} onChange={(e) => updateField("sector", e.target.value)} className="h-8 text-sm" /></div>
              <div><p className="text-xs text-muted-foreground mb-1">Primary Market</p><Input value={editData.primary_market || ""} onChange={(e) => updateField("primary_market", e.target.value)} className="h-8 text-sm" /></div>
              <div><p className="text-xs text-muted-foreground mb-1">Business Type</p><Input value={editData.business_type || ""} onChange={(e) => updateField("business_type", e.target.value)} className="h-8 text-sm" /></div>
              <div><p className="text-xs text-muted-foreground mb-1">Customer Type</p><Input value={editData.customer_type || ""} onChange={(e) => updateField("customer_type", e.target.value)} className="h-8 text-sm" /></div>
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
                  {editing ? (
                    <Input value={editData[item.key] || ""} onChange={(e) => updateField(item.key, e.target.value)} className="h-7 text-sm" />
                  ) : (
                    <p className="text-sm font-medium">{display[item.key]}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ICP */}
          {(editing || display.icp) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">ICP</p>
              <Field value={display.icp} fieldKey="icp" multiline />
            </div>
          )}

          {/* Critical Challenges */}
          {(editing || display.critical_challenges) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Critical Challenges</p>
              <Field value={display.critical_challenges} fieldKey="critical_challenges" multiline />
            </div>
          )}

          {/* Topics of Interest */}
          {(editing || display.topics_of_interest) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Topics of Interest</p>
              <Field value={display.topics_of_interest} fieldKey="topics_of_interest" multiline />
            </div>
          )}

          {/* Networking objectives */}
          {(display.need_networking || display.need_trends || display.need_partners || display.need_opportunities || display.need_mentorship) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Professional Objectives</p>
              <div className="flex flex-wrap gap-1.5">
                {display.need_networking && <Badge variant="outline" className="text-xs">Networking</Badge>}
                {display.need_trends && <Badge variant="outline" className="text-xs">Industry Trends</Badge>}
                {display.need_partners && <Badge variant="outline" className="text-xs">Partners</Badge>}
                {display.need_opportunities && <Badge variant="outline" className="text-xs">Opportunities</Badge>}
                {display.need_mentorship && <Badge variant="outline" className="text-xs">Mentorship</Badge>}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
