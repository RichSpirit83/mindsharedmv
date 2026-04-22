import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, LayoutGrid, LogOut, Eye } from "lucide-react";
import { format } from "date-fns";

interface BreakoutSession {
  id: string;
  session_name: string;
  session_date: string | null;
  status: string;
  num_tables: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  matched: "bg-primary/10 text-primary",
  finalized: "bg-success/10 text-success",
};

export default function ViewerBreakouts() {
  const navigate = useNavigate();
  const { signOut, user, isAdmin } = useAuth();
  const [sessions, setSessions] = useState<BreakoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("breakout_sessions")
        .select("id, session_name, session_date, status, num_tables")
        .order("updated_at", { ascending: false });
      setSessions(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const displayName = user?.email?.endsWith("@viewer.local")
    ? user.email.replace("@viewer.local", "")
    : user?.email;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-heading font-bold">Breakout Sessions</h1>
          <Badge variant="outline" className="text-xs">View Only</Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{displayName}</span>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-1" /> Sign out
          </Button>
        </div>
      </header>

      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">No breakout sessions yet.</div>
        ) : (
          sessions.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/view/present/${s.id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="font-heading font-semibold text-lg">{s.session_name}</h2>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {s.session_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(s.session_date), "MMM d, yyyy")}
                      </span>
                    )}
                    <span>{s.num_tables} tables</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={STATUS_COLORS[s.status || "draft"] || ""}>{s.status || "draft"}</Badge>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
