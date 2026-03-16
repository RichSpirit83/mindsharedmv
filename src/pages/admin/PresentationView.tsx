import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronLeft, ChevronRight, Play, Pause, RotateCcw } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";

interface LeadDisplay {
  name: string;
  company?: string;
  title?: string;
}

interface TableDisplay {
  table_number: number;
  table_name: string;
  theme: string;
  suggested_lead: string;
  leads: LeadDisplay[];
  companies: { company_name: string; first_name: string; last_name?: string }[];
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

export default function PresentationView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<any>(null);
  const [tables, setTables] = useState<TableDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedSlide, setSelectedSlide] = useState(0);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [timerStarted, setTimerStarted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data: s } = await supabase.from("breakout_sessions").select("*").eq("id", sessionId).single();
      setSession(s);

      const { data: dbTables } = await supabase.from("breakout_tables").select("*").eq("session_id", sessionId).order("table_number");
      const { data: dbLeads } = await supabase.from("breakout_leads").select("*").eq("session_id", sessionId);
      if (dbTables) {
        const tableIds = dbTables.map((t) => t.id);
        const { data: assignments } = await supabase.from("breakout_table_assignments").select("*, breakout_companies(*)").in("table_id", tableIds);

        const display: TableDisplay[] = dbTables.map((t) => {
          const tableAssignments = (assignments || []).filter((a) => a.table_id === t.id);
          const leadNames = (t.suggested_lead || "").split(",").map((n: string) => n.trim()).filter(Boolean);
          const leads: LeadDisplay[] = leadNames.map((name: string) => {
            const lead = (dbLeads || []).find((l: any) => l.name === name);
            return lead ? { name: lead.name, company: lead.company || "", title: lead.title || "" } : { name };
          });
          return {
            table_number: t.table_number,
            table_name: t.table_name || "",
            theme: t.theme || "",
            suggested_lead: t.suggested_lead || "",
            leads,
            companies: tableAssignments.map((a) => {
              const m = ((a as any).breakout_companies?.mapped_data || {}) as Record<string, string>;
              return { company_name: m.company_name || "", first_name: m.first_name || "", last_name: m.last_name || "" };
            }),
          };
        });
        setTables(display);
      }
      setLoading(false);
    };
    load();
  }, [sessionId]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(230,25%,8%)] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-white/40" />
      </div>
    );
  }

  const prompts = (session?.prompts as string[]) || [];
  const gridCols = tables.length <= 4 ? "grid-cols-2" : tables.length <= 6 ? "grid-cols-3" : "grid-cols-4";
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-[hsl(230,25%,8%)] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="text-center py-6 px-8 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">{session?.session_name || "Breakout Session"}</h1>
        {session?.session_date && (
          <p className="text-base text-white/50 mt-1">{new Date(session.session_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        )}
      </div>

      {/* Carousel */}
      <div className="flex-1 flex flex-col min-h-0 px-8 pb-6">
        <div className="flex-1 overflow-hidden" ref={emblaRef}>
          <div className="flex h-full">
            {/* Slide 1: Table Assignments */}
            <div className="min-w-0 shrink-0 grow-0 basis-full h-full overflow-auto px-2">
              <div className={`grid ${gridCols} gap-5 auto-rows-min`}>
                {tables.map((table, i) => {
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
                          <h2 className="text-lg font-bold leading-tight">{table.table_name}</h2>
                        </div>
                        <p className="text-xs text-white/40">{table.theme}</p>
                      </div>
                      {table.leads.length > 0 ? (
                        <div className="mb-3">
                          <div className="space-y-1.5 mt-1">
                            {table.leads.map((lead, li) => (
                              <div key={li} className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                                  {li === 0 ? "Head" : "Lead"}
                                </span>
                                <span className={`text-sm font-semibold ${li === 0 ? "" : "text-white/70"}`} style={li === 0 ? { color: accent } : undefined}>
                                  {lead.name}
                                </span>
                                {lead.title && <span className="text-xs text-white/30">{lead.title}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : table.suggested_lead ? (
                        <div className="mb-3 flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Lead</span>
                          <span className="text-sm font-semibold" style={{ color: accent }}>{table.suggested_lead}</span>
                        </div>
                      ) : null}
                      <div className="mb-2 text-xs text-white/30 font-medium">{table.companies.length} participants</div>
                      <div className="space-y-1 flex-1">
                        {table.companies.map((c, ci) => (
                          <div key={ci} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-white/[0.04]">
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

            {/* Slide 2: Session Prompts */}
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
              </div>
            </div>

            {/* Slide 3: Timer */}
            <div className="min-w-0 shrink-0 grow-0 basis-full h-full flex items-center justify-center">
              <div className="text-center space-y-8">
                {session?.breakout_start && session?.breakout_end && (
                  <p className="text-white/40 text-lg">{session.breakout_start} – {session.breakout_end}</p>
                )}
                <div className="text-[12rem] font-mono font-bold leading-none tracking-tight"
                  style={{ color: remainingSeconds !== null && remainingSeconds <= 60 ? "hsl(0, 72%, 51%)" : "white" }}>
                  {remainingSeconds !== null ? formatTime(remainingSeconds) : "--:--"}
                </div>
                <div className="flex items-center justify-center gap-4">
                  {!timerStarted ? (
                    <button onClick={startTimer} className="flex items-center gap-2 px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg font-semibold transition">
                      <Play className="h-6 w-6" /> Start Timer
                    </button>
                  ) : (
                    <>
                      <button onClick={toggleTimer} className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg font-semibold transition">
                        {timerRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        {timerRunning ? "Pause" : "Resume"}
                      </button>
                      <button onClick={resetTimer} className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg font-semibold transition">
                        <RotateCcw className="h-5 w-5" /> Reset
                      </button>
                    </>
                  )}
                </div>
                {!timerStarted && session?.breakout_start && (
                  <p className="text-white/30 text-sm">Timer will auto-start at {session.breakout_start} local time</p>
                )}
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
            {["Tables", "Prompts", "Timer"].map((label, i) => (
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
    </div>
  );
}
