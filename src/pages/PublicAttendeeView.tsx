import { useState } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Share2, Clock, Users, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TABLE_COLORS = [
  "border-l-table-blue", "border-l-table-teal", "border-l-table-green", "border-l-table-yellow",
  "border-l-table-orange", "border-l-table-red", "border-l-table-pink", "border-l-table-purple",
];

export default function PublicAttendeeView() {
  const { sessionSlug } = useParams();
  const [searchQuery, setSearchQuery] = useState("");

  // Placeholder data - will come from DB
  const sessionName = "Mindshare 2026 Session 1";
  const sessionDate = "March 15, 2026";
  const breakoutTime = "10:00 AM – 11:00 AM";
  const tables: any[] = [];

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="h-7 w-7 text-primary" />
              <div>
                <h1 className="font-heading text-xl font-bold">{sessionName}</h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span>{sessionDate}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {breakoutTime}</span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Share2 className="h-4 w-4 mr-1" /> Share
            </Button>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Find your table — enter your name or company"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 text-base rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        {tables.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="font-heading text-lg font-semibold mb-2">Tables Not Published Yet</h2>
            <p className="text-muted-foreground text-sm">
              Check back soon — the organizer hasn't published table assignments for this session yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tables.map((table: any, i: number) => (
              <Card key={table.id} className={cn("border-l-4", TABLE_COLORS[i % TABLE_COLORS.length])}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Table {table.table_number}</Badge>
                  </div>
                  <CardTitle className="font-heading text-base">{table.table_name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{table.theme}</p>
                </CardHeader>
                <CardContent>
                  {table.lead_name && (
                    <p className="text-sm font-medium mb-2">Lead: {table.lead_name}</p>
                  )}
                  <div className="space-y-1">
                    {table.companies?.map((c: any, ci: number) => (
                      <p key={ci} className="text-sm text-muted-foreground">
                        {c.company_name} — {c.first_name}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Engagement Prompts */}
        <div className="mt-12 max-w-2xl mx-auto">
          <h2 className="font-heading text-lg font-semibold mb-4 text-center">Come Prepared</h2>
          <div className="space-y-4">
            {[
              "What is the one decision or constraint that—if resolved in 90 days—would most change your trajectory?",
              "What have you been spending time on that isn't delivering expected return, and what assumption might be wrong?",
              "If the Mindshare network could help with one thing in the next 3-6 months, what would be most valuable?",
            ].map((prompt, i) => (
              <div key={i} className="p-4 rounded-lg bg-card border">
                <span className="text-xs font-medium text-primary">Prompt {i + 1}</span>
                <p className="text-sm mt-1">{prompt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
