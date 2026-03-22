import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

// ── Hardcoded Data ──────────────────────────────────────────
const COHORT_SIZE = 45;
const SUBMISSIONS = 47;

const SALES_STAGE = [
  { label: "Founder-Led Sales", value: 21, color: "#f43f5e" },
  { label: "Refining Process", value: 12, color: "#f59e0b" },
  { label: "Building Repeatable", value: 9, color: "#14b8a6" },
  { label: "Team-Led Sales", value: 3, color: "#22c55e" },
];

const PMF = { yes: 34, no: 13 };

const PMF_BY_STAGE = [
  { stage: "Founder-Led", pmfYes: 12, pmfNo: 9 },
  { stage: "Refining", pmfYes: 9, pmfNo: 3 },
  { stage: "Building Rep.", pmfYes: 9, pmfNo: 0 },
  { stage: "Team-Led", pmfYes: 3, pmfNo: 0 },
];

const CAPITALIZATION = [
  { label: "None / Bootstrapped", value: 6, color: "#64748b" },
  { label: "Pre-Seed", value: 20, color: "#8b5cf6" },
  { label: "Seed", value: 12, color: "#6366f1" },
  { label: "Other (undisclosed)", value: 5, color: "#a855f7" },
  { label: "Series B+", value: 1, color: "#10b981" },
];

const REVENUE = [
  { label: "<$250K", value: 22 },
  { label: "$251K–500K", value: 4 },
  { label: "$501K–$1M", value: 6 },
  { label: "$2M–$5M", value: 7 },
  { label: "$6M–$10M", value: 3 },
  { label: "$11M–$20M", value: 1 },
];

const TOP_CHALLENGES = [
  { label: "GTM Strategy", value: 42, pct: 93 },
  { label: "Scaling", value: 38, pct: 84 },
  { label: "Fundraising", value: 36, pct: 80 },
];

const NETWORKING_OBJECTIVES = [
  { label: "Networking", veryImportant: 38, pct: 84 },
  { label: "Biz Opportunities", veryImportant: 30, pct: 67 },
  { label: "Mentorship", veryImportant: 24, pct: 53 },
];

// ── Component ───────────────────────────────────────────────

export default function CohortSummary() {
  const [open, setOpen] = useState(true);

  const pmfPct = Math.round((PMF.yes / COHORT_SIZE) * 100);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-[#0f172a] text-white p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">
            Mindshare 2026 · Cohort Intelligence Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {COHORT_SIZE} companies · DMV Region · March 2026 · Confidential
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
          {/* ── TOP ROW: 4 Stat Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Cohort Snapshot */}
            <DashCard label="Cohort Size">
              <p className="text-5xl font-bold text-white">{COHORT_SIZE}</p>
              <div className="flex gap-3 mt-2 text-xs text-slate-400">
                <span>{SUBMISSIONS} Submissions</span>
                <span>2 Deduped</span>
              </div>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                <Pill color="bg-amber-500/20 text-amber-300">~55% Early Stage</Pill>
                <Pill color="bg-teal-500/20 text-teal-300">~30% Growth</Pill>
                <Pill color="bg-indigo-500/20 text-indigo-300">~15% Scale</Pill>
              </div>
            </DashCard>

            {/* Card 2: PMF Self-Report */}
            <DashCard label="Claimed Product-Market Fit">
              <p className="text-5xl font-bold text-white">{pmfPct}%</p>
              <p className="text-xs text-slate-400 mt-1">{PMF.yes} of {COHORT_SIZE}</p>
              {/* PMF bar */}
              <div className="w-full h-2 rounded-full bg-slate-700 mt-3 overflow-hidden flex">
                <div className="bg-indigo-500 h-full" style={{ width: `${pmfPct}%` }} />
                <div className="bg-slate-500 h-full flex-1" />
              </div>
              <div className="mt-3 rounded-md bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-xs text-amber-200 leading-snug">
                ⚠ Tension: 12 companies claim PMF but remain in founder-led sales — the dominant bottleneck of this cohort.
              </div>
            </DashCard>

            {/* Card 3: Top Challenge */}
            <DashCard label="GTM as Critical Challenge">
              <p className="text-5xl font-bold text-white">93%</p>
              <p className="text-xs text-slate-400 mt-1">42 of 45 companies</p>
              <div className="mt-3 space-y-2">
                {TOP_CHALLENGES.map((c) => (
                  <div key={c.label} className="flex items-center gap-2 text-xs">
                    <span className="w-24 text-slate-300 truncate">{c.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${c.pct}%` }} />
                    </div>
                    <span className="text-slate-400 w-8 text-right">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </DashCard>

            {/* Card 4: Relationship Priority */}
            <DashCard label="Why They're Here">
              <div className="space-y-3 mt-1">
                {NETWORKING_OBJECTIVES.map((n) => (
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
              <p className="text-[10px] text-slate-500 italic mt-3">
                This cohort wants intros, not content. Format should reflect that.
              </p>
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
            {/* Card 5: Sales Stage */}
            <DashCard label="Sales Stage">
              <div className="space-y-2 mt-1">
                {SALES_STAGE.map((s) => {
                  const pct = Math.round((s.value / COHORT_SIZE) * 100);
                  return (
                    <div key={s.label} className="flex items-center gap-2 text-xs">
                      <span className="w-28 text-slate-300 truncate text-[11px]">{s.label}</span>
                      <div className="flex-1 h-3 rounded bg-slate-700/50 overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{ width: `${pct}%`, backgroundColor: s.color }}
                        />
                      </div>
                      <span className="text-slate-400 w-12 text-right text-[11px]">{s.value} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </DashCard>

            {/* Card 6: Revenue Distribution */}
            <DashCard label="ARR Distribution">
              <div className="h-[180px] mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={REVENUE} margin={{ top: 5, right: 5, bottom: 30, left: -10 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                      angle={-35}
                      textAnchor="end"
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12, color: "#fff" }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                45% of cohort is sub-$250K ARR. Only 3 companies exceed $5M ARR.
              </p>
            </DashCard>

            {/* Card 7: Capitalization Stage (Donut) */}
            <DashCard label="Last Round Raised">
              <div className="h-[180px] mt-1 flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={CAPITALIZATION}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {CAPITALIZATION.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12, color: "#fff" }}
                    />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      wrapperStyle={{ fontSize: 10, color: "#94a3b8", lineHeight: "18px" }}
                      formatter={(value: string) => <span className="text-slate-300">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-center text-[10px] text-slate-500 -mt-1">44% Pre-Seed</p>
            </DashCard>

            {/* Card 8: PMF Paradox (highlighted) */}
            <DashCard label="PMF Paradox" highlight>
              <p className="text-[10px] text-slate-500 mb-2">
                Companies claiming PMF but still founder-led signal the cohort's core unlock
              </p>
              <div className="h-[170px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PMF_BY_STAGE} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                    <XAxis
                      dataKey="stage"
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12, color: "#fff" }}
                    />
                    <Bar dataKey="pmfYes" name="PMF Yes" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pmfNo" name="PMF No" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 rounded bg-indigo-500/10 border border-indigo-500/30 px-2 py-1 text-[10px] text-indigo-300 text-center">
                12 PMF-yes companies stuck in Founder-Led
              </div>
            </DashCard>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function DashCard({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-indigo-500/40 bg-slate-800/80 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]"
          : "border-slate-700/50 bg-slate-800/50"
      }`}
    >
      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest mb-2">{label}</p>
      {children}
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${color}`}>
      {children}
    </span>
  );
}
