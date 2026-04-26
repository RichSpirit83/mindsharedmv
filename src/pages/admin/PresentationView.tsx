import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronLeft, ChevronRight, Play, Pause, RotateCcw, ArrowLeft, Pencil, Eye, EyeOff, X, Share2, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import useEmblaCarousel from "embla-carousel-react";

interface LeadDisplay {
  name: string;
  company?: string;
  title?: string;
}

interface TableDisplay {
  id: string;
  table_number: number;
  table_name: string;
  theme: string;
  suggested_lead: string;
  leads: LeadDisplay[];
  companies: { company_name: string; first_name: string; last_name?: string; mapped_data: Record<string, string> }[];
  round_number: number;
}

const TABLE_ACCENTS = [
  "hsl(217, 91%, 60%)",
  "hsl(168, 76%, 42%)",
  "hsl(142, 71%, 45%)",
  "hsl(45, 93%, 47%)",
  "hsl(25, 95%, 53%)",
  "hsl(0, 72%, 51%)",
  "hsl(330, 81%, 60%)",
  "hsl(271, 81%, 56%)",
];

function parseTimeToToday(timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export default function PresentationView({ isPublic = false }: { isPublic?: boolean }) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [tables, setTables] = useState<TableDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [showNames, setShowNames] = useState(true);
  const [showThemes, setShowThemes] = useState(true);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingTime, setEditingTime] = useState(false);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Record<string, string> | null>(null);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [timerStarted, setTimerStarted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const loadPublic = async () => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-public-breakout?breakoutId=${encodeURIComponent(sessionId)}`,
        { headers: { "Cache-Control": "no-store" } },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (cancelled) return;
      setSession(data.session);
      const display: TableDisplay[] = (data.tables || []).map((t: any) => ({
        id: t.id,
        table_number: t.table_number,
        table_name: t.table_name || "",
        theme: t.theme || "",
        suggested_lead: (t.leads || []).map((l: any) => l.name).join(", "),
        leads: (t.leads || []).map((l: any) => ({ name: l.name, company: l.company || "", title: l.title || "" })),
        round_number: 1,
        companies: (t.founders || []).map((f: any) => ({
          company_name: f.company_name || "",
          first_name: f.first_name || "",
          last_name: f.last_name || "",
          mapped_data: { company_name: f.company_name || "", first_name: f.first_name || "", last_name: f.last_name || "" },
        })),
      }));
      setTables(display);
    };

    const loadAdmin = async () => {
      const { data: s } = await supabase.from("breakout_sessions").select("*").eq("id", sessionId).single();
      if (cancelled) return;
      setSession(s);

      const { data: dbTables } = await supabase
        .from("breakout_tables")
        .select("*")
        .eq("session_id", sessionId)
        .eq("is_backup", false)
        .order("table_number");

      const { data: tableLeads } = await supabase
        .from("breakout_table_leads")
        .select("table_id, lead:lead_pool(*)")
        .eq("breakout_id", sessionId);

      const { data: rsvps } = await supabase
        .from("breakout_rsvps")
        .select("founder_id, manual_table_override, founder:founder_pool(*)")
        .eq("breakout_id", sessionId)
        .eq("rsvpd", true);

      const { data: history } = await supabase
        .from("match_history")
        .select("founder_id, table_id, created_at")
        .eq("breakout_id", sessionId)
        .order("created_at", { ascending: false });

      const latestTableByFounder = new Map<string, string>();
      for (const h of history || []) {
        if (!latestTableByFounder.has(h.founder_id) && h.table_id) {
          latestTableByFounder.set(h.founder_id, h.table_id);
        }
      }

      const leadsByTable = new Map<string, any[]>();
      for (const tl of tableLeads || []) {
        if (!tl.table_id || !tl.lead) continue;
        if (!leadsByTable.has(tl.table_id)) leadsByTable.set(tl.table_id, []);
        leadsByTable.get(tl.table_id)!.push(tl.lead);
      }

      const foundersByTable = new Map<string, any[]>();
      for (const r of rsvps || []) {
        const tableId = r.manual_table_override || latestTableByFounder.get(r.founder_id);
        if (!tableId || !r.founder) continue;
        if (!foundersByTable.has(tableId)) foundersByTable.set(tableId, []);
        foundersByTable.get(tableId)!.push(r.founder);
      }

      const display: TableDisplay[] = (dbTables || []).map((t) => {
        const leads = (leadsByTable.get(t.id) || []).map((l: any) => ({
          name: l.name,
          company: l.company || "",
          title: l.title || "",
        }));
        const founders = (foundersByTable.get(t.id) || []).map((f: any) => {
          const mapped: Record<string, string> = {
            company_name: f.company_name || "",
            first_name: f.first_name || "",
            last_name: f.last_name || "",
            email: f.email || "",
            sector: Array.isArray(f.sector) ? f.sector.join(", ") : (f.sector || ""),
            revenue: f.revenue || "",
            capital_raised: f.capital_raised || "",
            icp: f.icp || "",
          };
          return {
            company_name: f.company_name || "",
            first_name: f.first_name || "",
            last_name: f.last_name || "",
            mapped_data: mapped,
          };
        });
        return {
          id: t.id,
          table_number: t.table_number,
          table_name: t.table_name || "",
          theme: t.theme || "",
          suggested_lead: leads.map((l) => l.name).join(", "),
          leads,
          round_number: (t as any).round_number ?? 1,
          companies: founders,
        };
      });
      setTables(display);
    };

    const run = async () => {
      try {
        if (isPublic) await loadPublic();
        else await loadAdmin();
      } catch (e) {
        console.error("PresentationView load failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();

    // Auto-refresh every 30s
    const interval = setInterval(run, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [sessionId, isPublic]);

  // Auto-start timer if current time is past breakout_start
  useEffect(() => {
    if (!session?.breakout_start || !session?.breakout_end || timerStarted) return;
    const now = new Date();
    const start = parseTimeToToday(session.breakout_start);
    const end = parseTimeToToday(session.breakout_end);
    const totalSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);

    if (now >= start && now < end) {
      const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);
      setRemainingSeconds(Math.max(0, totalSeconds - elapsed));
      setTimerRunning(true);
      setTimerStarted(true);
    } else if (now < start) {
      setRemainingSeconds(totalSeconds);
    } else {
      setRemainingSeconds(0);
    }
  }, [session, timerStarted]);

  // Timer tick
  useEffect(() => {
    if (timerRunning && remainingSeconds !== null && remainingSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev === null || prev <= 1) {
            setTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning]);

  const startTimer = () => {
    if (!session?.breakout_start || !session?.breakout_end) return;
    const start = parseTimeToToday(session.breakout_start);
    const end = parseTimeToToday(session.breakout_end);
    const totalSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    setRemainingSeconds(totalSeconds);
    setTimerRunning(true);
    setTimerStarted(true);
  };

  const toggleTimer = () => setTimerRunning((r) => !r);

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerStarted(false);
    if (session?.breakout_start && session?.breakout_end) {
      const start = parseTimeToToday(session.breakout_start);
      const end = parseTimeToToday(session.breakout_end);
      setRemainingSeconds(Math.floor((end.getTime() - start.getTime()) / 1000));
    }
  };

  const startEditingTime = () => {
    setEditStart(session?.breakout_start || "00:00");
    setEditEnd(session?.breakout_end || "00:00");
    setEditingTime(true);
  };

  const saveTime = async () => {
    if (!sessionId) return;
    const { error } = await supabase.from("breakout_sessions").update({
      breakout_start: editStart,
      breakout_end: editEnd,
    }).eq("id", sessionId);
    if (!error) {
      setSession((prev: any) => ({ ...prev, breakout_start: editStart, breakout_end: editEnd }));
      setTimerRunning(false);
      setTimerStarted(false);
      const start = parseTimeToToday(editStart);
      const end = parseTimeToToday(editEnd);
      setRemainingSeconds(Math.floor((end.getTime() - start.getTime()) / 1000));
    }
    setEditingTime(false);
  };

  // Embla callbacks
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const handleStartEditing = (table: TableDisplay) => {
    setEditingTableId(table.id);
    setEditingName(table.table_name);
  };

  const handleSaveName = async (id: string) => {
    const trimmed = editingName.trim();
    const { error } = await supabase.from("breakout_tables").update({ table_name: trimmed }).eq("id", id);
    if (!error) {
      setTables((prev) => prev.map((t) => (t.id === id ? { ...t, table_name: trimmed } : t)));
    }
    setEditingTableId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(230,25%,8%)] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-white/40" />
      </div>
    );
  }

  const prompts = (session?.prompts as string[]) || [];

  // Group tables by round
  const rounds = Array.from(new Set(tables.map((t) => t.round_number))).sort((a, b) => a - b);
  const tablesByRound = rounds.map((r) => tables.filter((t) => t.round_number === r));
  const hasMultipleRounds = rounds.length > 1;

  // Build slide labels: Round 1 Tables, Round 2 Tables, ..., Prompts & Timer
  const slideLabels = [
    ...rounds.map((r) => hasMultipleRounds ? `Round ${r}` : "Tables"),
    "Prompts & Timer",
  ];

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-[hsl(230,25%,8%)] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="text-center py-6 px-8 shrink-0 relative">
        {!isPublic && (
          <button
            onClick={() => navigate(`/admin/match/${sessionId}`)}
            className="absolute left-8 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{session?.session_name || "Breakout Session"}</h1>
        {session?.session_date && (
          <p className="text-base text-white/50 mt-1">{new Date(session.session_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        )}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex gap-2">
          {!isPublic && (
            <button
              onClick={() => {
                const url = `${window.location.origin}/present/${sessionId}`;
                navigator.clipboard.writeText(url);
                toast.success("Public link copied to clipboard");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition bg-white/10 text-white/70 hover:bg-white/20"
              title="Copy public share link"
            >
              <Share2 className="h-3 w-3" /> Share
            </button>
          )}
          <button
            onClick={() => setShowNames((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${showNames ? "bg-white/15 text-white/80" : "bg-white/5 text-white/40"}`}
            title={showNames ? "Hide table names" : "Show table names"}
          >
            {showNames ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} Names
          </button>
          <button
            onClick={() => setShowThemes((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${showThemes ? "bg-white/15 text-white/80" : "bg-white/5 text-white/40"}`}
            title={showThemes ? "Hide descriptions" : "Show descriptions"}
          >
            {showThemes ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} Themes
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div className="flex-1 flex flex-col min-h-0 px-8 pb-6">
        <div className="flex-1 overflow-hidden" ref={emblaRef}>
          <div className="flex h-full">
            {/* Table slides - one per round */}
            {tablesByRound.map((roundTables, ri) => {
              const gridCols = roundTables.length <= 4 ? "grid-cols-2" : roundTables.length <= 6 ? "grid-cols-3" : "grid-cols-4";
              return (
                <div key={`round-${rounds[ri]}`} className="min-w-0 shrink-0 grow-0 basis-full h-full overflow-auto px-2">
                  {hasMultipleRounds && (
                    <h2 className="text-xl font-bold text-white/60 uppercase tracking-wider mb-4 text-center">Round {rounds[ri]}</h2>
                  )}
                  <div className={`grid ${gridCols} gap-5 auto-rows-min`}>
                    {roundTables.map((table, i) => {
                      const accent = TABLE_ACCENTS[i % TABLE_ACCENTS.length];
                      return (
                        <div
                          key={table.table_number}
                          className="rounded-2xl bg-white/[0.06] backdrop-blur border border-white/10 p-5 flex flex-col"
                          style={{ borderTopColor: accent, borderTopWidth: 3 }}
                        >
                          <div className="mb-3">
                            <div className="flex items-baseline gap-3 mb-1">
                              <span className="text-3xl font-black" style={{ color: accent }}>{table.table_number}</span>
                              {showNames && (editingTableId === table.id && !isPublic ? (
                                <input
                                  autoFocus
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onBlur={() => handleSaveName(table.id)}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(table.id); if (e.key === "Escape") setEditingTableId(null); }}
                                  className="text-lg font-bold leading-tight bg-transparent border-b border-white/30 outline-none text-white w-full"
                                />
                              ) : (
                                <h2 className={`text-lg font-bold leading-tight ${!isPublic ? "cursor-pointer hover:text-white/70" : ""}`} onDoubleClick={() => !isPublic && handleStartEditing(table)}>{table.table_name}</h2>
                              ))}
                            </div>
                            {showThemes && <p className="text-xs text-white/40">{table.theme}</p>}
                          </div>
                          {table.leads.length > 0 ? (
                            <div className="mb-3">
                              <div className="space-y-1.5 mt-1">
                                {table.leads.map((lead, li) => (
                                  <div key={li} className="flex items-start gap-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mt-0.5">
                                      {li === 0 ? "Head" : "Lead"}
                                    </span>
                                    <div>
                                      <span className={`text-sm font-semibold ${li === 0 ? "" : "text-white/70"}`} style={li === 0 ? { color: accent } : undefined}>
                                        {lead.name}
                                      </span>
                                      {lead.title && <p className="text-xs text-white/50">{lead.title}{lead.company ? `, ${lead.company}` : ""}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : table.suggested_lead ? (
                            <div className="mb-3 flex items-center gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Lead</span>
                              <span className="text-sm font-semibold" style={{ color: accent }}>{table.suggested_lead}</span>
                            </div>
                          ) : null}
                          <div className="mb-2 text-xs text-white/30 font-medium">{table.companies.length} participants</div>
                          <div className="space-y-1 flex-1">
                            {table.companies.map((c, ci) => (
                              <div
                                key={ci}
                                className="flex items-center justify-between text-sm py-1 px-2 rounded bg-white/[0.04] cursor-pointer hover:bg-white/[0.1] transition"
                                onClick={() => setSelectedCompany(c.mapped_data)}
                              >
                                <span className="font-medium text-white/90">{c.first_name} {c.last_name}</span>
                                <span className="text-white/40 text-xs truncate ml-2 max-w-[45%] text-right">{c.company_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Prompts & Timer Slide */}
            <div className="min-w-0 shrink-0 grow-0 basis-full h-full overflow-auto px-2 flex items-center justify-center">
              <div className="max-w-4xl w-full space-y-8">
                <h2 className="text-2xl font-bold text-center text-white/80 uppercase tracking-wider mb-8">Discussion Prompts</h2>
                {prompts.length === 0 ? (
                  <p className="text-center text-white/30 text-lg">No prompts configured for this session.</p>
                ) : (
                  <div className="space-y-6">
                    {prompts.map((prompt, i) => (
                      <div key={i} className="flex gap-5 items-start">
                        <span className="text-4xl font-black text-white/15 shrink-0 w-12 text-right">{i + 1}</span>
                        <p className="text-xl leading-relaxed text-white/80 pt-1">{prompt}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Timer */}
                <div className="pt-8 border-t border-white/10 text-center space-y-4">
                  {!isPublic && editingTime ? (
                    <div className="flex items-center justify-center gap-3">
                      <input
                        type="time"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-lg font-mono outline-none focus:border-white/40"
                      />
                      <span className="text-white/50 text-lg">–</span>
                      <input
                        type="time"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-lg font-mono outline-none focus:border-white/40"
                      />
                      <button onClick={saveTime} className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-semibold transition">Save</button>
                      <button onClick={() => setEditingTime(false)} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 text-sm font-semibold transition">Cancel</button>
                    </div>
                  ) : !isPublic && session?.breakout_start && session?.breakout_end ? (
                    <button onClick={startEditingTime} className="inline-flex items-center gap-2 text-white/40 text-sm hover:text-white/60 transition">
                      {session.breakout_start} – {session.breakout_end}
                      <Pencil className="h-3 w-3" />
                    </button>
                  ) : !isPublic && !session?.breakout_start ? (
                    <button onClick={startEditingTime} className="inline-flex items-center gap-2 text-white/40 text-sm hover:text-white/60 transition">
                      Set timer
                      <Pencil className="h-3 w-3" />
                    </button>
                  ) : session?.breakout_start && session?.breakout_end ? (
                    <p className="text-white/40 text-sm">{session.breakout_start} – {session.breakout_end}</p>
                  ) : null}
                  <div className="text-[6rem] font-mono font-bold leading-none tracking-tight"
                    style={{ color: remainingSeconds !== null && remainingSeconds <= 60 ? "hsl(0, 72%, 51%)" : "white" }}>
                    {remainingSeconds !== null ? formatTime(remainingSeconds) : "--:--"}
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    {!timerStarted ? (
                      <button onClick={startTimer} className="flex items-center gap-2 px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-base font-semibold transition">
                        <Play className="h-5 w-5" /> Start Timer
                      </button>
                    ) : (
                      <>
                        <button onClick={toggleTimer} className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-base font-semibold transition">
                          {timerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          {timerRunning ? "Pause" : "Resume"}
                        </button>
                        <button onClick={resetTimer} className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-base font-semibold transition">
                          <RotateCcw className="h-4 w-4" /> Reset
                        </button>
                      </>
                    )}
                  </div>
                  {!timerStarted && session?.breakout_start && (
                    <p className="text-white/30 text-xs">Timer will auto-start at {session.breakout_start} local time</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-6 pt-4 shrink-0">
          <button onClick={scrollPrev} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex gap-2">
            {slideLabels.map((label, i) => (
              <button
                key={i}
                onClick={() => emblaApi?.scrollTo(i)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition ${selectedSlide === i ? "bg-white/20 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={scrollNext} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Company Detail Overlay */}
      {selectedCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedCompany(null)}>
          <div
            className="bg-[hsl(230,25%,12%)] border border-white/15 rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {selectedCompany.first_name} {selectedCompany.last_name}
                </h3>
                {selectedCompany.company_name && (
                  <p className="text-sm text-white/50">{selectedCompany.company_name}</p>
                )}
              </div>
              <button onClick={() => setSelectedCompany(null)} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {Object.entries(selectedCompany)
                .filter(([k, v]) => v && !["first_name", "last_name"].includes(k))
                .map(([key, value]) => (
                  <div key={key} className="flex gap-3">
                    <span className="text-xs font-medium text-white/40 uppercase tracking-wider min-w-[120px] shrink-0 pt-0.5">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm text-white/80 break-words">{value}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
