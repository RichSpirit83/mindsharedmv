import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Users, LayoutGrid, Trash2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface BreakoutSession {
  id: string;
  session_name: string;
  session_date: string | null;
  status: string;
  num_tables: number;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  matched: "bg-primary/10 text-primary",
  finalized: "bg-success/10 text-success",
};

export default function BreakoutsList() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<BreakoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from("breakout_sessions")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Failed to load sessions");
    } else {
      setSessions(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, []);

  const createNew = async () => {
    const { data, error } = await supabase
      .from("breakout_sessions")
      .insert({ session_name: "Untitled Breakout" })
      .select()
      .single();
    if (error) {
      toast.error("Failed to create session");
      return;
    }
    navigate(`/admin/session/${data.id}`);
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("breakout_sessions").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Session deleted");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Breakout Sessions</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and resume your breakout designs.</p>
        </div>
        <Button onClick={createNew}>
          <Plus className="h-4 w-4 mr-1" /> New Breakout
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 space-y-3">
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <LayoutGrid className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold mb-2">No Breakout Sessions Yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
              Create your first breakout session to start designing table assignments.
            </p>
            <Button onClick={createNew}>
              <Plus className="h-4 w-4 mr-1" /> Create First Breakout
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => navigate(`/admin/session/${session.id}`)}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-heading font-semibold truncate flex-1">
                    {session.session_name || "Untitled"}
                  </h3>
                  <div className="flex items-center gap-1">
                    <Badge className={STATUS_COLORS[session.status] || STATUS_COLORS.draft}>
                      {session.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => deleteSession(session.id, e)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {session.session_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(session.session_date), "MMM d, yyyy")}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {session.num_tables} tables
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Updated {format(new Date(session.updated_at), "MMM d, h:mm a")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
