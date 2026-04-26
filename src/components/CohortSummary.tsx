import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import CohortDrilldownModal from "./cohort/CohortDrilldownModal";
import { CAP_COLORS, STAGE_COLORS, REVENUE_ORDER, STAGE_ORDER, CAP_ORDER } from "./cohort/companyData";

// ── Types ───────────────────────────────────────────────────

interface CohortSummaryProps {
  sessionId: string;
}

type Mapped = Record<string, string>;

interface CompanyRow {
  id: string;
  mapped_data: Mapped | null;
  raw_data: Mapped | null;
}

// ── Normalization helpers (shared with computeStageScoreFromMapped conventions) ──

function normalizeStage(raw: string): string | null {
  const s = (raw || "").toLowerCase().trim();
  if (!s) return null;
  if (s.includes("team-led") || s.includes("team led")) return "Team-Led";
  if (s.includes("repeatable") || s.includes("building")) return "Building Repeatable";
  if (s.includes("refining")) return "Refining";
  if (s.includes("founder")) return "Founder-Led";
  return null;
}

function normalizePmf(raw: string): boolean | null {
  const s = (raw || "").toLowerCase().trim();
  if (!s) return null;
  if (["true", "yes", "1", "checked", "y"].includes(s)) return true;
  if (["false", "no", "0", "unchecked", "n"].includes(s)) return false;
  return null;
}

function normalizeRevenue(raw: string): string | null {
  if (!raw) return null;
  const norm = raw.replace(/\$/g, "").toLowerCase().trim();
  const map: Record<string, string> = {
    "<250k": "<$250K",
    "251k-500k": "$251K-$500K",
    "501k-1m": "$501K-$1M",
    "2m-5m": "$2M-$5M",
    "6m-10m": "$6M-$10M",
    "11m-20m": "$11M-$20M",
  };
  return map[norm] || raw;
}

function normalizeRound(raw: string): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower.includes("none") || lower.includes("bootstrap")) return "None";
  if (lower.includes("pre-seed") || lower.includes("preseed")) return "Pre-Seed";
  if (lower.includes("series b") || lower.includes("series c") || lower.includes("series d")) return "Series B";
  if (lower.includes("seed")) return "Seed";
  return "Other";
}

function splitList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;|\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// ── Aggregation ─────────────────────────────────────────────

interface Aggregated {
  cohortSize: number;
  submissions: number;
  salesStage: { label: string; value: number; color: string }[];
  pmf: { yes: number; no: number };
  pmfByStage: { stage: string; pmfYes: number; pmfNo: number }[];
  capitalization: { label: string; value: number; color: string }[];
  revenue: { label: string; value: number }[];
  topChallenges: { label: string; value: number; pct: number }[];
  networkingObjectives: { label: string; veryImportant: number; pct: number }[];
}

function aggregate(rows: CompanyRow[]): Aggregated {
  const cohortSize = rows.length;
  const submissions = cohortSize;

  // Sales stage
  const stageCounts: Record<string, number> = {};
  STAGE_ORDER.forEach((s) => (stageCounts[s] = 0));

  // PMF
  let pmfYes = 0;
  let pmfNo = 0;

  // PMF by stage
  const pmfByStageMap: Record<string, { yes: number; no: number }> = {};
  STAGE_ORDER.forEach((s) => (pmfByStageMap[s] = { yes: 0, no: 0 }));

  // Capitalization
  const capCounts: Record<string, number> = {};
  CAP_ORDER.forEach((c) => (capCounts[c] = 0));

  // Revenue
  const revCounts: Record<string, number> = {};
  REVENUE_ORDER.forEach((r) => (revCounts[r] = 0));

  // Challenges & objectives
  const challengeCounts: Record<string, number> = {};
  const objectiveCounts: Record<string, number> = {
    Networking: 0,
    "Biz Opportunities": 0,
    Mentorship: 0,
  };

  for (const row of rows) {
    const m = (row.mapped_data || {}) as Mapped;

    const stage = normalizeStage(m.sales_stage || "");
    if (stage) stageCounts[stage] = (stageCounts[stage] || 0) + 1;

    const pmf = normalizePmf(m.has_pmf || "");
    if (pmf === true) pmfYes++;
    else if (pmf === false) pmfNo++;

    if (stage && pmf !== null) {
      if (pmf) pmfByStageMap[stage].yes++;
      else pmfByStageMap[stage].no++;
    }

    const round = normalizeRound(m.last_round || m.capital_raised || "");
    if (round) capCounts[round] = (capCounts[round] || 0) + 1;

    const rev = normalizeRevenue(m.revenue || "");
    if (rev && revCounts[rev] !== undefined) revCounts[rev]++;

    splitList(m.critical_challenges || "").forEach((c) => {
      challengeCounts[c] = (challengeCounts[c] || 0) + 1;
    });

    const isYes = (v: string) => {
      const s = (v || "").toLowerCase().trim();
      return s === "very important" || s === "yes" || s === "true" || s === "5" || s === "4";
    };
    if (isYes(m.need_networking || "")) objectiveCounts.Networking++;
    if (isYes(m.need_opportunities || "")) objectiveCounts["Biz Opportunities"]++;
    if (isYes(m.need_mentorship || "")) objectiveCounts.Mentorship++;
  }

  const salesStage = STAGE_ORDER.map((s) => ({
    label: s,
    value: stageCounts[s] || 0,
    color: STAGE_COLORS[s] || "#94a3b8",
  })).filter((s) => s.value > 0);

  const pmfByStage = STAGE_ORDER.map((s) => ({
    stage: s.replace("Building Repeatable", "Building Rep.").replace("Founder-Led", "Founder-Led"),
    pmfYes: pmfByStageMap[s].yes,
    pmfNo: pmfByStageMap[s].no,
  }));

  const capitalization = CAP_ORDER.map((c) => ({
    label: c === "None" ? "None / Bootstrapped" : c === "Other" ? "Other (undisclosed)" : c,
    value: capCounts[c] || 0,
    color: CAP_COLORS[c] || "#94a3b8",
  })).filter((c) => c.value > 0);

  const revenue = REVENUE_ORDER.map((r) => ({ label: r, value: revCounts[r] || 0 }));

  const topChallenges = Object.entries(challengeCounts)
    .map(([label, value]) => ({
      label,
      value,
      pct: cohortSize > 0 ? Math.round((value / cohortSize) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const networkingObjectives = Object.entries(objectiveCounts).map(([label, value]) => ({
    label,
    veryImportant: value,
    pct: cohortSize > 0 ? Math.round((value / cohortSize) * 100) : 0,
  }));

  return {
    cohortSize,
    submissions,
    salesStage,
    pmf: { yes: pmfYes, no: pmfNo },
    pmfByStage,
    capitalization,
    revenue,
    topChallenges,
    networkingObjectives,
  };
}

// ── Component ───────────────────────────────────────────────

export default function CohortSummary({ sessionId }: CohortSummaryProps) {
  const [open, setOpen] = useState(true);
  const [drillCard, setDrillCard] = useState<number | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["cohort-summary", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breakout_companies")
        .select("id, mapped_data, raw_data")
        .eq("session_id", sessionId);
      if (error) throw error;
      return (data || []) as CompanyRow[];
    },
    enabled: !!sessionId,
  });

  const agg = useMemo(() => aggregate(rows || []), [rows]);
  const pmfPct = agg.cohortSize > 0 ? Math.round((agg.pmf.yes / agg.cohortSize) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-[#0f172a] text-white p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">
            Cohort Intelligence Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isLoading ? "Loading…" : `${agg.cohortSize} companies · Live data`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {open && (
        <div className="space-y-5">
          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            <>
              {/* ── TOP ROW: 4 Stat Cards ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <DashCard label="Cohort Size" onClick={() => setDrillCard(0)}>
                  <p className="text-5xl font-bold text-white">{agg.cohortSize}</p>
                  <div className="flex gap-3 mt-2 text-xs text-slate-400">
                    <span>{agg.submissions} Submissions</span>
                  </div>
                </DashCard>

                <DashCard label="Claimed Product-Market Fit" onClick={() => setDrillCard(1)}>
                  <p className="text-5xl font-bold text-white">{pmfPct}%</p>
                  <p className="text-xs text-slate-400 mt-1">{agg.pmf.yes} of {agg.cohortSize}</p>
                  <div className="w-full h-2 rounded-full bg-slate-700 mt-3 overflow-hidden flex">
                    <div className="bg-indigo-500 h-full" style={{ width: `${pmfPct}%` }} />
                    <div className="bg-slate-500 h-full flex-1" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    {agg.pmf.no} reported no PMF
                  </p>
                </DashCard>

                <DashCard label="Top Critical Challenges" onClick={() => setDrillCard(2)}>
                  {agg.topChallenges.length > 0 ? (
                    <>
                      <p className="text-5xl font-bold text-white">{agg.topChallenges[0]?.pct ?? 0}%</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {agg.topChallenges[0]?.value ?? 0} of {agg.cohortSize} cite "{agg.topChallenges[0]?.label}"
                      </p>
                      <div className="mt-3 space-y-2">
                        {agg.topChallenges.map((c) => (
                          <div key={c.label} className="flex items-center gap-2 text-xs">
                            <span className="w-24 text-slate-300 truncate">{c.label}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${c.pct}%` }} />
                            </div>
                            <span className="text-slate-400 w-8 text-right">{c.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 mt-2">No challenge data</p>
                  )}
                </DashCard>

                <DashCard label="Why They're Here" onClick={() => setDrillCard(3)}>
                  <div className="space-y-3 mt-1">
                    {agg.networkingObjectives.map((n) => (
                      <div key={n.label} className="text-xs">
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>{n.label}</span>
                          <span className="text-slate-400">{n.pct}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${n.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </DashCard>
              </div>

              {/* ── Divider ── */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Cohort Analytics</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>

              {/* ── BOTTOM ROW: 4 Chart Cards ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <DashCard label="Sales Stage" onClick={() => setDrillCard(4)}>
                  <div className="space-y-2 mt-1">
                    {agg.salesStage.map((s) => {
                      const pct = agg.cohortSize > 0 ? Math.round((s.value / agg.cohortSize) * 100) : 0;
                      return (
                        <div key={s.label} className="flex items-center gap-2 text-xs">
                          <span className="w-28 text-slate-300 truncate text-[11px]">{s.label}</span>
                          <div className="flex-1 h-3 rounded bg-slate-700/50 overflow-hidden">
                            <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                          </div>
                          <span className="text-slate-400 w-12 text-right text-[11px]">{s.value} ({pct}%)</span>
                        </div>
                      );
                    })}
                    {agg.salesStage.length === 0 && <p className="text-xs text-slate-500">No data</p>}
                  </div>
                </DashCard>

                <DashCard label="ARR Distribution" onClick={() => setDrillCard(5)}>
                  <div className="h-[180px] mt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={agg.revenue} margin={{ top: 5, right: 5, bottom: 30, left: -10 }}>
                        <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 9 }} angle={-35} textAnchor="end" axisLine={{ stroke: "#334155" }} tickLine={false} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12, color: "#fff" }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#6366f1" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </DashCard>

                <DashCard label="Last Round Raised" onClick={() => setDrillCard(6)}>
                  <div className="space-y-2 mt-1">
                    {agg.capitalization.map((c) => {
                      const pct = agg.cohortSize > 0 ? Math.round((c.value / agg.cohortSize) * 100) : 0;
                      return (
                        <div key={c.label} className="flex items-center gap-2 text-xs">
                          <span className="w-28 text-slate-300 truncate text-[11px]">{c.label}</span>
                          <div className="flex-1 h-3 rounded bg-slate-700/50 overflow-hidden">
                            <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                          </div>
                          <span className="text-slate-400 w-12 text-right text-[11px]">{c.value} ({pct}%)</span>
                        </div>
                      );
                    })}
                    {agg.capitalization.length === 0 && <p className="text-xs text-slate-500">No data</p>}
                  </div>
                </DashCard>

                <DashCard label="PMF × Sales Stage" highlight onClick={() => setDrillCard(7)}>
                  <p className="text-[10px] text-slate-500 mb-2">
                    Cross-tab of claimed PMF against sales evolution stage
                  </p>
                  <div className="h-[170px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={agg.pmfByStage} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                        <XAxis dataKey="stage" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={{ stroke: "#334155" }} tickLine={false} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12, color: "#fff" }} />
                        <Bar dataKey="pmfYes" name="PMF Yes" fill="#6366f1" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="pmfNo" name="PMF No" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </DashCard>
              </div>
            </>
          )}
        </div>
      )}

      {/* Drill-down modal */}
      <CohortDrilldownModal
        cardIndex={drillCard ?? 0}
        open={drillCard !== null}
        onClose={() => setDrillCard(null)}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 bg-slate-800/60" />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-44 bg-slate-800/60" />
        ))}
      </div>
    </div>
  );
}

function DashCard({ label, children, highlight, onClick }: { label: string; children: React.ReactNode; highlight?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-4 cursor-pointer group relative transition-colors ${
        highlight
          ? "border-indigo-500/40 bg-slate-800/80 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)] hover:border-indigo-400/60"
          : "border-slate-700/50 bg-slate-800/50 hover:border-slate-500"
      }`}
    >
      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest mb-2">{label}</p>
      {children}
      <span className="absolute bottom-2.5 right-3 text-[11px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
        ↗ View Detail
      </span>
    </div>
  );
}
