import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Copy, Download, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import WorkspaceNav from "@/components/WorkspaceNav";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface BriefingRow {
  leadId: string;
  leadName: string;
  markdown: string;
  generatedAt: string;
}

export default function LeadBriefings() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<any>(null);
  const [briefings, setBriefings] = useState<Record<string, BriefingRow>>({});
  const [leads, setLeads] = useState<{ id: string; name: string; tableNumber?: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const briefingRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data: s } = await supabase
        .from("breakout_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      setSession(s);

      // Lead/table pairs at this breakout
      const { data: tableLeads } = await supabase
        .from("breakout_table_leads")
        .select("lead_id, table_id, lead:lead_pool(id,name), table:breakout_tables(table_number)")
        .eq("breakout_id", sessionId);

      const leadList = (tableLeads || [])
        .map((tl: any) => ({
          id: tl.lead?.id as string,
          name: tl.lead?.name as string,
          tableNumber: tl.table?.table_number as number | undefined,
        }))
        .filter((l) => l.id);
      setLeads(leadList);

      // Existing briefings
      const { data: existing } = await supabase
        .from("breakout_briefings")
        .select("lead_id, markdown, generated_at")
        .eq("breakout_id", sessionId);
      const map: Record<string, BriefingRow> = {};
      for (const b of existing || []) {
        const lead = leadList.find((l) => l.id === b.lead_id);
        map[b.lead_id] = {
          leadId: b.lead_id,
          leadName: lead?.name || "",
          markdown: b.markdown,
          generatedAt: b.generated_at,
        };
      }
      setBriefings(map);
      setLoading(false);
    };
    load();
  }, [sessionId]);

  const generateOne = async (leadId?: string) => {
    if (leadId) setGenerating((p) => ({ ...p, [leadId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("generate-briefing", {
        body: { breakoutId: sessionId, ...(leadId ? { leadId } : {}) },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const list = ((data as any)?.briefings || []) as BriefingRow[];
      setBriefings((prev) => {
        const next = { ...prev };
        for (const b of list) next[b.leadId] = b;
        return next;
      });
      if (list.length > 0) {
        toast.success(`Generated ${list.length} briefing${list.length === 1 ? "" : "s"}`);
      } else {
        toast.message("No briefings generated — check that leads are assigned to tables.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate briefing");
    } finally {
      if (leadId) setGenerating((p) => ({ ...p, [leadId]: false }));
    }
  };

  const generateAll = async () => {
    setGeneratingAll(true);
    try {
      await generateOne();
    } finally {
      setGeneratingAll(false);
    }
  };

  const copyBriefing = (leadId: string) => {
    const b = briefings[leadId];
    if (!b) return;
    navigator.clipboard.writeText(b.markdown);
    toast.success("Briefing copied to clipboard");
  };

  const exportAsPdf = async (leadId: string) => {
    const node = briefingRefs.current[leadId];
    const briefing = briefings[leadId];
    if (!node || !briefing) return;
    try {
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 40;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 20;
      pdf.addImage(imgData, "PNG", 20, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 40;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 20;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 20, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 40;
      }
      const safeName = (briefing.leadName || "lead").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      pdf.save(`briefing-${safeName}.pdf`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export PDF");
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
            <CardContent><Skeleton className="h-32 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <WorkspaceNav sessionId={sessionId || ""} activePage="briefings" />
      <div className="px-6 space-y-8">
        <div>
          <h1 className="font-heading text-2xl font-bold">Lead Briefings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {session?.session_name ? `${session.session_name} — ` : ""}
            One briefing per assigned lead, drawn from current matches and past pairings.
          </p>
        </div>

        {leads.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="font-heading text-lg font-semibold mb-2">No Leads Assigned</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Assign leads to tables in the Matching Workspace before generating briefings.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex justify-end">
              <Button onClick={generateAll} disabled={generatingAll}>
                {generatingAll ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Generating…</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1" /> Generate All Briefings</>
                )}
              </Button>
            </div>

            <div className="space-y-6">
              {leads.map((lead) => {
                const b = briefings[lead.id];
                return (
                  <Card key={lead.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-heading text-lg flex items-center gap-2">
                          {lead.name}
                          {lead.tableNumber != null && (
                            <Badge variant="outline" className="text-xs font-normal">
                              Table {lead.tableNumber}
                            </Badge>
                          )}
                        </CardTitle>
                        {b && (
                          <span className="text-xs text-muted-foreground">
                            Generated {new Date(b.generatedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!b ? (
                        <Button
                          onClick={() => generateOne(lead.id)}
                          disabled={!!generating[lead.id]}
                          className="w-full"
                        >
                          {generating[lead.id] ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating…</>
                          ) : (
                            <><FileText className="h-4 w-4 mr-2" /> Generate Briefing</>
                          )}
                        </Button>
                      ) : (
                        <>
                          <div
                            ref={(el) => { briefingRefs.current[lead.id] = el; }}
                            className="prose prose-sm max-w-none p-4 bg-muted/30 rounded-lg border text-sm leading-relaxed"
                          >
                            <ReactMarkdown>{b.markdown}</ReactMarkdown>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Button variant="outline" size="sm" onClick={() => copyBriefing(lead.id)}>
                              <Copy className="h-4 w-4 mr-1" /> Copy
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => exportAsPdf(lead.id)}>
                              <Download className="h-4 w-4 mr-1" /> Export as PDF
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generateOne(lead.id)}
                              disabled={!!generating[lead.id]}
                            >
                              {generating[lead.id] ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <Sparkles className="h-4 w-4 mr-1" />
                              )}
                              Regenerate
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
