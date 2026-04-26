import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Share2, Clock, Users, LayoutDashboard, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TABLE_COLORS = [
  "border-l-table-blue", "border-l-table-teal", "border-l-table-green", "border-l-table-yellow",
  "border-l-table-orange", "border-l-table-red", "border-l-table-pink", "border-l-table-purple",
];

interface PublicTable {
  id: string;
  table_number: number;
  table_name: string;
  theme: string;
  leads: { name: string; title?: string | null; company?: string | null }[];
  founders: { company_name: string; first_name: string; last_name: string }[];
}

interface PublicSession {
  id: string;
  session_name: string;
  session_date: string | null;
  breakout_start: string | null;
  breakout_end: string | null;
  prompts: string[];
}

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export default function PublicAttendeeView() {
  const { sessionSlug } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [session, setSession] = useState<PublicSession | null>(null);
  const [tables, setTables] = useState<PublicTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionSlug) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `${FUNCTIONS_BASE}/get-public-breakout?breakoutId=${encodeURIComponent(sessionSlug)}`,
          { headers: { "Cache-Control": "no-store" } },
        );
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (cancelled) return;
        setSession(data.session);
        setTables(data.tables || []);
      } catch (e) {
        console.error("load public breakout failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [sessionSlug]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  const filteredTables = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tables;
    return tables
      .map((t) => ({
        ...t,
        founders: t.founders.filter((f) =>
          `${f.first_name} ${f.last_name} ${f.company_name}`.toLowerCase().includes(q),
        ),
      }))
      .filter((t) => t.founders.length > 0 || t.leads.some((l) => l.name.toLowerCase().includes(q)));
  }, [tables, searchQuery]);

  const sessionName = session?.session_name || "Mindshare Breakout";
  const sessionDate = session?.session_date
    ? new Date(session.session_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";
  const breakoutTime = session?.breakout_start && session?.breakout_end
    ? `${session.breakout_start} – ${session.breakout_end}`
    : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="h-7 w-7 text-primary" />
              <div>
                <h1 className="font-heading text-xl font-bold">{sessionName}</h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  {sessionDate && <span>{sessionDate}</span>}
                  {breakoutTime && (
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {breakoutTime}</span>
                  )}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Share2 className="h-4 w-4 mr-1" /> Share
            </Button>
          </div>
        </div>
      </header>

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

      <div className="max-w-5xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="font-heading text-lg font-semibold mb-2">
              {tables.length === 0 ? "Tables Not Published Yet" : "No matches"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {tables.length === 0
                ? "Check back soon — the organizer hasn't published table assignments yet."
                : "Try a different name or company."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTables.map((table, i) => (
              <Card key={table.id} className={cn("border-l-4", TABLE_COLORS[i % TABLE_COLORS.length])}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Table {table.table_number}</Badge>
                  </div>
                  <CardTitle className="font-heading text-base">{table.table_name || `Table ${table.table_number}`}</CardTitle>
                  {table.theme && <p className="text-xs text-muted-foreground">{table.theme}</p>}
                </CardHeader>
                <CardContent>
                  {table.leads.length > 0 && (
                    <div className="mb-3">
                      {table.leads.map((l, li) => (
                        <p key={li} className="text-sm font-semibold">
                          Lead: {l.name}
                          {l.title && <span className="text-muted-foreground font-normal"> — {l.title}</span>}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1">
                    {table.founders.map((f, ci) => (
                      <p key={ci} className="text-sm text-muted-foreground">
                        {f.company_name}{f.first_name ? ` — ${f.first_name} ${f.last_name}`.trimEnd() : ""}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {session?.prompts && session.prompts.length > 0 && (
          <div className="mt-12 max-w-2xl mx-auto">
            <h2 className="font-heading text-lg font-semibold mb-4 text-center">Come Prepared</h2>
            <div className="space-y-4">
              {session.prompts.map((prompt, i) => (
                <div key={i} className="p-4 rounded-lg bg-card border">
                  <span className="text-xs font-medium text-primary">Prompt {i + 1}</span>
                  <p className="text-sm mt-1">{prompt}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
