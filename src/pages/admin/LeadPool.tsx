import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit2, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type LeadPoolEntry = {
  id: string;
  name: string;
  linkedin_url: string | null;
  expertise_tags: string[];
  network_strengths: string | null;
  notes: string | null;
  created_at: string;
};

export default function LeadPool() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadPoolEntry | null>(null);
  const [form, setForm] = useState({
    name: "", linkedin_url: "", expertise_tags: "", network_strengths: "", notes: "",
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["lead_pool"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("lead_pool" as any)
        .select("*")
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data ?? []).map((l: any) => ({
        ...l,
        expertise_tags: Array.isArray(l.expertise_tags) ? l.expertise_tags : [],
      })) as LeadPoolEntry[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (lead: typeof form & { id?: string }) => {
      const tags = lead.expertise_tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload = {
        name: lead.name,
        linkedin_url: lead.linkedin_url || null,
        expertise_tags: tags,
        network_strengths: lead.network_strengths || null,
        notes: lead.notes || null,
      };

      if (lead.id) {
        const { error } = await (supabase.from("lead_pool" as any).update(payload).eq("id", lead.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("lead_pool" as any).insert(payload) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead_pool"] });
      setDialogOpen(false);
      setEditingLead(null);
      resetForm();
      toast({ title: editingLead ? "Lead updated" : "Lead added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("lead_pool" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead_pool"] });
      toast({ title: "Lead removed" });
    },
  });

  const resetForm = () => setForm({ name: "", linkedin_url: "", expertise_tags: "", network_strengths: "", notes: "" });

  const openEdit = (lead: LeadPoolEntry) => {
    setEditingLead(lead);
    setForm({
      name: lead.name,
      linkedin_url: lead.linkedin_url || "",
      expertise_tags: lead.expertise_tags.join(", "),
      network_strengths: lead.network_strengths || "",
      notes: lead.notes || "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingLead(null);
    resetForm();
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Lead Pool</h1>
          <Badge variant="secondary">{leads.length} leads</Badge>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingLead(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingLead ? "Edit Lead" : "Add Lead"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate({ ...form, id: editingLead?.id });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn URL</Label>
                <Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." />
              </div>
              <div className="space-y-2">
                <Label>Expertise Tags</Label>
                <Input value={form.expertise_tags} onChange={(e) => setForm({ ...form, expertise_tags: e.target.value })} placeholder="fintech, AI, growth (comma-separated)" />
              </div>
              <div className="space-y-2">
                <Label>Network Strengths</Label>
                <Input value={form.network_strengths} onChange={(e) => setForm({ ...form, network_strengths: e.target.value })} placeholder="Strong VC network, enterprise sales..." />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : editingLead ? "Update Lead" : "Add Lead"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No leads in the pool yet. Add leads to build your candidate roster.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Expertise</TableHead>
                  <TableHead>Network Strengths</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      <div>{lead.name}</div>
                      {lead.linkedin_url && (
                        <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          LinkedIn
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {lead.expertise_tags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.network_strengths}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(lead)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(lead.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
