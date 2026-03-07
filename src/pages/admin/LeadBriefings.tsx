import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Copy, Mail, Download } from "lucide-react";

export default function LeadBriefings() {
  // Placeholder - will be populated from session data
  const leads: any[] = [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl font-bold">Table Lead Briefings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate personalized briefing documents for each table lead after finalizing matches.
        </p>
      </div>

      {leads.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold mb-2">No Leads Assigned Yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Configure table leads in Session Config and finalize your matches in the Matching Workspace
              before generating briefings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {leads.map((lead: any) => (
            <Card key={lead.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading text-lg">{lead.name}</CardTitle>
                  <Badge variant="outline">Table {lead.tableNumber}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {lead.expertiseTags?.map((tag: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full">
                  <FileText className="h-4 w-4 mr-2" /> Generate Briefing
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Copy className="h-4 w-4 mr-1" /> Copy
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Download className="h-4 w-4 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Mail className="h-4 w-4 mr-1" /> Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
