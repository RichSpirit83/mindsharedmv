import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis, CartesianGrid
} from "recharts";
import {
  COMPANIES, Company, SECTOR_COLORS, STAGE_COLORS, CAP_COLORS,
  getSectorColor, getWhyItMatters, REVENUE_ORDER, STAGE_ORDER, CAP_ORDER,
  computeStageScore
} from "./companyData";

interface Props {
  cardIndex: number;
  open: boolean;
  onClose: () => void;
}

function SectorPill({ sector }: { sector: string }) {
  const color = getSectorColor(sector);
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: `${color}26`, color }}
    >
      {sector}
    </span>
  );
}

function StagePill({ stage }: { stage: string }) {
  const color = STAGE_COLORS[stage] || "#94a3b8";
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: `${color}26`, color }}
    >
      {stage}
    </span>
  );
}

function PmfBadge({ pmf }: { pmf: boolean }) {
  return pmf ? (
    <span className="flex items-center gap-1 text-[11px]">
      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> PMF ✓
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[11px] text-slate-400">
      <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> No PMF
    </span>
  );
}

// ── Card 1: Full Cohort Roster ──
function RosterDrilldown() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [sectorFilter, setSectorFilter] = useState("All");
  const [pmfFilter, setPmfFilter] = useState("All");

  const sectors = useMemo(() => [...new Set(COMPANIES.map(c => c.sector))].sort(), []);

  const filtered = useMemo(() => {
    return COMPANIES.filter(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (stageFilter !== "All") {
        const map: Record<string, string[]> = {
          "Early": ["Founder-Led", "Refining"],
          "Growth": ["Building Repeatable"],
          "Scale": ["Team-Led"],
        };
        if (!map[stageFilter]?.includes(c.salesStage)) return false;
      }
      if (sectorFilter !== "All" && c.sector !== sectorFilter) return false;
      if (pmfFilter !== "All" && (pmfFilter === "Yes" ? !c.pmf : c.pmf)) return false;
      return true;
    });
  }, [search, stageFilter, sectorFilter, pmfFilter]);

  const selectCls = "bg-slate-800 border-slate-600 text-slate-200 text-xs rounded-lg px-3 py-1.5";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-48 bg-slate-800 border-slate-600 text-white text-xs h-8"
        />
        <select className={selectCls} value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option>All</option><option>Early</option><option>Growth</option><option>Scale</option>
        </select>
        <select className={selectCls} value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}>
          <option>All</option>{sectors.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className={selectCls} value={pmfFilter} onChange={e => setPmfFilter(e.target.value)}>
          <option>All</option><option>Yes</option><option>No</option>
        </select>
      </div>
      <p className="text-xs text-slate-400">Showing {filtered.length} of {COMPANIES.length} companies</p>
      <div className="grid grid-cols-3 gap-3">
        {filtered.map(c => (
          <div key={c.name} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3.5 hover:border-slate-500 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold text-white">{c.name}</span>
              <PmfBadge pmf={c.pmf} />
            </div>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              <SectorPill sector={c.sector} />
              <StagePill stage={c.salesStage} />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>{c.revenue}</span>
              <span>{c.cap}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card 2: PMF Deep Dive ──
function PmfDrilldown() {
  const pmfYes = COMPANIES.filter(c => c.pmf);
  const pmfNo = COMPANIES.filter(c => !c.pmf);

  const stageIdx: Record<string, number> = { "Founder-Led": 0, "Refining": 1, "Building Repeatable": 2, "Team-Led": 3 };
  const revIdx: Record<string, number> = {};
  REVENUE_ORDER.forEach((r, i) => { revIdx[r] = i; });

  const scatterData = COMPANIES.map(c => ({
    x: stageIdx[c.salesStage] ?? 0,
    y: revIdx[c.revenue] ?? 0,
    name: c.name,
    sector: c.sector,
    pmf: c.pmf,
    revenue: c.revenue,
    salesStage: c.salesStage,
  }));

  return (
    <div className="flex gap-6">
      <div className="w-[40%] space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">Claimed PMF ✓ ({pmfYes.length})</h4>
          <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-2">
            {pmfYes.map(c => (
              <div key={c.name} className="flex items-center gap-2 border-l-2 border-indigo-500 pl-2 py-1">
                <span className="text-xs text-white font-medium">{c.name}</span>
                <SectorPill sector={c.sector} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2">No PMF ✗ ({pmfNo.length})</h4>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-2">
            {pmfNo.map(c => (
              <div key={c.name} className="flex items-center gap-2 border-l-2 border-rose-500 pl-2 py-1">
                <span className="text-xs text-white font-medium">{c.name}</span>
                <SectorPill sector={c.sector} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="w-[60%]">
        <p className="text-[11px] text-slate-400 mb-2">PMF Status by Sales Stage × Revenue</p>
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              type="number" dataKey="x" domain={[-0.5, 3.5]}
              ticks={[0, 1, 2, 3]}
              tickFormatter={(v: number) => STAGE_ORDER[v] || ""}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              axisLine={{ stroke: "#334155" }}
            />
            <YAxis
              type="number" dataKey="y" domain={[-0.5, 5.5]}
              ticks={[0, 1, 2, 3, 4, 5]}
              tickFormatter={(v: number) => REVENUE_ORDER[v] || ""}
              tick={{ fill: "#94a3b8", fontSize: 9 }}
              axisLine={{ stroke: "#334155" }}
            />
            <ZAxis range={[80, 80]} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12, color: "#fff" }}
              formatter={(_: any, __: any, props: any) => []}
              labelFormatter={() => ""}
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs text-white">
                    <p className="font-bold">{d.name}</p>
                    <p className="text-slate-300">{d.sector} · {d.revenue}</p>
                    <p className="text-slate-300">{d.salesStage} · {d.pmf ? "PMF ✓" : "No PMF"}</p>
                  </div>
                );
              }}
            />
            <Scatter data={scatterData.filter(d => d.pmf)} fill="#6366f1" />
            <Scatter data={scatterData.filter(d => !d.pmf)} fill="#f43f5e" />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> PMF Yes</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> PMF No</span>
        </div>
      </div>
    </div>
  );
}

// ── Card 3: Challenge Analysis ──
function ChallengeDrilldown() {
  const challenges = [
    { label: "GTM Strategy", value: 42 },
    { label: "Scaling the Business", value: 38 },
    { label: "Fundraising", value: 36 },
    { label: "Product Development", value: 28 },
    { label: "Leadership & Mgmt", value: 26 },
    { label: "AI / Tech Trends", value: 23 },
  ];

  const coOccurrence = [
    ["", "GTM", "Scaling", "Fund.", "Product", "Lead.", "AI"],
    ["GTM", "—", "32", "30", "22", "18", "15"],
    ["Scaling", "32", "—", "27", "18", "18", "14"],
    ["Fund.", "30", "27", "—", "16", "14", "12"],
    ["Product", "22", "18", "16", "—", "12", "10"],
    ["Lead.", "18", "18", "14", "12", "—", "8"],
    ["AI", "15", "14", "12", "10", "8", "—"],
  ];

  const topicInterest = [
    { label: "GTM Activities", value: 34 },
    { label: "Scaling the Business", value: 24 },
    { label: "Fundraising", value: 21 },
    { label: "Product Development", value: 13 },
    { label: "Achieving PMF", value: 12 },
    { label: "Operational / Execution", value: 9 },
    { label: "Customer Retention", value: 8 },
  ];

  const getHeatColor = (val: number) => {
    if (val >= 30) return "bg-indigo-500/60";
    if (val >= 25) return "bg-indigo-500/40";
    if (val >= 18) return "bg-indigo-500/25";
    if (val >= 12) return "bg-indigo-500/15";
    return "bg-slate-700/30";
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Challenge Frequency</h4>
        <div className="space-y-2">
          {challenges.map(c => (
            <div key={c.label} className="flex items-center gap-3">
              <span className="w-36 text-xs text-slate-300 truncate">{c.label}</span>
              <div className="flex-1 h-5 rounded bg-slate-700/50 overflow-hidden">
                <div className="h-full rounded bg-indigo-500 flex items-center justify-end pr-2" style={{ width: `${(c.value / 45) * 100}%` }}>
                  <span className="text-[10px] text-white font-medium">{c.value}</span>
                </div>
              </div>
              <span className="text-xs text-slate-400 w-10 text-right">{Math.round((c.value / 45) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Challenge Co-occurrence</h4>
        <div className="overflow-x-auto">
          <table className="text-[10px]">
            <tbody>
              {coOccurrence.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => {
                    const isHeader = ri === 0 || ci === 0;
                    const val = parseInt(cell);
                    return (
                      <td
                        key={ci}
                        className={`px-2 py-1.5 text-center ${isHeader ? "text-slate-400 font-semibold" : `${getHeatColor(val)} text-slate-200`} ${!isHeader && "rounded"}`}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">What They Want to Learn</h4>
        <div className="space-y-2">
          {topicInterest.map(t => (
            <div key={t.label} className="flex items-center gap-3">
              <span className="w-40 text-xs text-slate-300 truncate">{t.label}</span>
              <div className="flex-1 h-4 rounded bg-slate-700/50 overflow-hidden">
                <div className="h-full rounded bg-violet-500" style={{ width: `${(t.value / 45) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-400 w-6 text-right">{t.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Card 4: Attendance Objectives ──
function ObjectivesDrilldown() {
  const objectives = [
    { label: "Networking", veryImportant: 38, somewhat: 8, not: 1, insight: "38 of 45 say Very Important. Consistent across all stages." },
    { label: "Business Opportunities", veryImportant: 30, somewhat: 14, not: 2, insight: "30 of 45 Very Important. Stronger signal in early-stage companies." },
    { label: "Mentorship", veryImportant: 24, somewhat: 21, not: 2, insight: "Nearly split between Very and Somewhat Important. Growth-stage companies rate this highest." },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {objectives.map(o => {
          const total = 45;
          const viPct = (o.veryImportant / total) * 100;
          const swPct = (o.somewhat / total) * 100;
          return (
            <div key={o.label} className="flex flex-col items-center">
              <p className="text-xs text-slate-300 font-semibold mb-2">{o.label}</p>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#334155" strokeWidth="12" />
                <circle
                  cx="60" cy="60" r="50" fill="none" stroke="#6366f1" strokeWidth="12"
                  strokeDasharray={`${viPct * 3.14} ${314 - viPct * 3.14}`}
                  strokeDashoffset="78.5"
                  strokeLinecap="round"
                />
                <circle
                  cx="60" cy="60" r="50" fill="none" stroke="#6366f180" strokeWidth="12"
                  strokeDasharray={`${swPct * 3.14} ${314 - swPct * 3.14}`}
                  strokeDashoffset={`${78.5 - viPct * 3.14}`}
                  strokeLinecap="round"
                />
                <text x="60" y="56" textAnchor="middle" className="fill-white text-lg font-bold">{Math.round(viPct)}%</text>
                <text x="60" y="72" textAnchor="middle" className="fill-slate-400 text-[10px]">Very Imp.</text>
              </svg>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {objectives.map(o => (
          <div key={o.label} className="rounded-xl border-l-2 border-indigo-500 bg-slate-800/50 border border-l-indigo-500 border-slate-700/50 p-3">
            <p className="text-xs font-semibold text-white mb-1">{o.label}</p>
            <p className="text-[11px] text-slate-300 leading-relaxed">{o.insight}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Very Important</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500/50" /> Somewhat</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600" /> Not Important</span>
      </div>
    </div>
  );
}

// ── Card 5: Sales Stage Company View ──
function SalesStageDrilldown() {
  const lanes = STAGE_ORDER.map(stage => ({
    stage,
    color: STAGE_COLORS[stage],
    companies: COMPANIES.filter(c => c.salesStage === stage),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {lanes.map(lane => (
          <div key={lane.stage} className="rounded-xl overflow-hidden" style={{ backgroundColor: `${lane.color}08` }}>
            <div className="flex items-center gap-2 p-3 border-b border-slate-700/50">
              <div className="w-full h-1 rounded-full" style={{ backgroundColor: lane.color }} />
            </div>
            <div className="p-2 space-y-0.5">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[11px] font-semibold text-slate-300">{lane.stage}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">{lane.companies.length}</span>
              </div>
              {lane.companies.map(c => (
                <div key={c.name} className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-2.5 mb-1.5">
                  <p className="text-xs font-bold text-white mb-1">{c.name}</p>
                  <SectorPill sector={c.sector} />
                  <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
                    <span>{c.revenue}</span>
                    <PmfBadge pmf={c.pmf} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-xs text-amber-200">
        47% of this cohort is still closing deals personally. The unlock: 9 companies are mid-transition.
      </div>
    </div>
  );
}

// ── Card 6: Revenue Company Breakdown ──
function RevenueDrilldown() {
  const [selectedBand, setSelectedBand] = useState<string | null>(null);

  const bandCounts = REVENUE_ORDER.map(band => ({
    label: band,
    value: COMPANIES.filter(c => c.revenue === band).length,
  }));

  const displayed = selectedBand
    ? COMPANIES.filter(c => c.revenue === selectedBand)
    : [...COMPANIES].sort((a, b) => REVENUE_ORDER.indexOf(b.revenue) - REVENUE_ORDER.indexOf(a.revenue));

  return (
    <div className="flex gap-6">
      <div className="w-[45%]">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={bandCounts} margin={{ top: 5, right: 5, bottom: 40, left: -10 }}>
            <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 9 }} angle={-35} textAnchor="end" axisLine={{ stroke: "#334155" }} tickLine={false} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12, color: "#fff" }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => setSelectedBand(d.label === selectedBand ? null : d.label)}>
              {bandCounts.map((b, i) => (
                <Cell key={i} fill={b.label === selectedBand ? "#818cf8" : "#6366f1"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="space-y-1 mt-3 text-[10px] text-slate-400">
          <p>Median ARR band: &lt;$250K</p>
          <p>Only 4 companies above $5M ARR</p>
          <p>Top earner: Axiad ($11–20M)</p>
        </div>
      </div>
      <div className="w-[55%]">
        <p className="text-xs text-slate-400 mb-2">
          {selectedBand ? `Companies in ${selectedBand}` : "All companies by revenue (click a bar to filter)"}
        </p>
        <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-2">
          {displayed.map(c => (
            <div key={c.name} className="flex items-center gap-3 rounded-lg bg-slate-800/50 border border-slate-700/40 px-3 py-2 border-l-2" style={{ borderLeftColor: "#6366f1" }}>
              <span className="text-xs font-medium text-white flex-1">{c.name}</span>
              <SectorPill sector={c.sector} />
              <StagePill stage={c.salesStage} />
              <span className="text-[10px] text-slate-400">{c.cap}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Card 7: Capitalization Full Picture ──
function CapitalizationDrilldown() {
  const capCounts = CAP_ORDER.map(cap => ({
    label: cap,
    value: COMPANIES.filter(c => c.cap === cap).length,
    color: CAP_COLORS[cap] || "#94a3b8",
  }));

  const timelineData = COMPANIES.map(c => ({
    x: CAP_ORDER.indexOf(c.cap),
    y: Math.random() * 0.8 + 0.1, // jitter for visibility
    name: c.name,
    sector: c.sector,
    revenue: c.revenue,
    cap: c.cap,
    salesStage: c.salesStage,
    size: REVENUE_ORDER.indexOf(c.revenue) * 30 + 40,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {capCounts.map(c => {
          const pct = Math.round((c.value / 45) * 100);
          return (
            <div key={c.label} className="flex items-center gap-3">
              <span className="w-32 text-xs text-slate-300 truncate">{c.label}</span>
              <div className="flex-1 h-5 rounded bg-slate-700/50 overflow-hidden">
                <div className="h-full rounded flex items-center justify-end pr-2" style={{ width: `${pct}%`, backgroundColor: c.color }}>
                  <span className="text-[10px] text-white font-medium">{c.value}</span>
                </div>
              </div>
              <span className="text-xs text-slate-400 w-10 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>

      <div>
        <p className="text-[11px] text-slate-400 mb-2">Companies by Capitalization Stage (dot size = revenue)</p>
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
            <XAxis
              type="number" dataKey="x" domain={[-0.5, 4.5]}
              ticks={[0, 1, 2, 3, 4]}
              tickFormatter={(v: number) => CAP_ORDER[v] || ""}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              axisLine={{ stroke: "#334155" }}
            />
            <YAxis hide type="number" dataKey="y" domain={[0, 1]} />
            <ZAxis type="number" dataKey="size" range={[40, 200]} />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs text-white">
                    <p className="font-bold">{d.name}</p>
                    <p className="text-slate-300">{d.sector} · {d.revenue}</p>
                    <p className="text-slate-300">{d.cap} · {d.salesStage}</p>
                  </div>
                );
              }}
            />
            <Scatter data={timelineData}>
              {timelineData.map((d, i) => (
                <Cell key={i} fill={getSectorColor(COMPANIES[i]?.sector || "")} fillOpacity={0.7} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 px-4 py-3 text-xs text-indigo-200">
        44% are Pre-Seed. Only 1 company (Glue Up) has reached Series B. 13% have taken no external capital.
      </div>
    </div>
  );
}

// ── Card 8: PMF Paradox — The 12 ──
function PmfParadoxDrilldown() {
  const the12 = COMPANIES.filter(c => c.pmf && c.salesStage === "Founder-Led");

  const revScore = (c: Company) => REVENUE_ORDER.indexOf(c.revenue);
  const capScore = (c: Company) => CAP_ORDER.indexOf(c.cap);

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-5 py-4">
        <p className="text-sm text-amber-200 font-semibold">
          12 founders have self-reported PMF but are personally closing every deal.
        </p>
        <p className="text-xs text-amber-300/70 mt-1">
          This is the cohort's defining unlock — and the most valuable conversation topic.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {the12.map(c => (
          <div key={c.name} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3.5 border-t-[3px] border-t-indigo-500">
            <p className="text-sm font-bold text-white mb-1">{c.name}</p>
            <SectorPill sector={c.sector} />
            <p className="text-[11px] text-slate-400 mt-1.5">{c.revenue}</p>
            <p className="text-[11px] text-amber-300 italic mt-2">{getWhyItMatters(c.sector)}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs text-slate-300 font-semibold mb-3">What would it take to move them?</p>
        <div className="relative rounded-xl border border-slate-700/50 bg-slate-800/30 p-6" style={{ height: 280 }}>
          {/* Axis labels */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-slate-500">Revenue →</div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-slate-500">Capital Raised →</div>
          {/* Quadrant labels */}
          <div className="absolute top-4 right-6 text-[10px] text-emerald-400 font-semibold">Ready to hire first AE</div>
          <div className="absolute top-4 left-16 text-[10px] text-amber-400 font-semibold">Needs process before people</div>
          <div className="absolute bottom-8 right-6 text-[10px] text-blue-400 font-semibold">Needs ICP refinement</div>
          <div className="absolute bottom-8 left-16 text-[10px] text-slate-400 font-semibold">Still validating</div>
          {/* Crosshair */}
          <div className="absolute top-1/2 left-16 right-6 h-px bg-slate-700 -translate-y-1/2" />
          <div className="absolute left-1/2 top-4 bottom-8 w-px bg-slate-700 -translate-x-1/2" />
          {/* Company dots */}
          {the12.map(c => {
            const xPct = 15 + (revScore(c) / 5) * 70;
            const yPct = 85 - (capScore(c) / 4) * 70;
            return (
              <div
                key={c.name}
                className="absolute group"
                style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%,-50%)" }}
              >
                <div className="w-3 h-3 rounded-full bg-indigo-500 border border-indigo-300" />
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 px-1 rounded">
                  {c.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Titles/Subtitles ──
const CARD_TITLES: Record<number, { title: string; subtitle: string }> = {
  0: { title: "Full Cohort Roster", subtitle: "Searchable, filterable directory of all 45 companies" },
  1: { title: "PMF Deep Dive", subtitle: "Product-market fit analysis across stages and revenue" },
  2: { title: "Challenge Analysis", subtitle: "Challenge frequency, co-occurrence, and learning priorities" },
  3: { title: "Attendance Objectives", subtitle: "Why founders are attending — networking, opportunities, mentorship" },
  4: { title: "Sales Stage — Company View", subtitle: "Companies organized by their current sales motion" },
  5: { title: "Revenue — Company Breakdown", subtitle: "ARR distribution with company-level detail" },
  6: { title: "Capitalization — Full Picture", subtitle: "Funding stage landscape and timeline view" },
  7: { title: "PMF Paradox — The 12 Companies", subtitle: "The cohort's defining unlock" },
};

const DRILLDOWNS = [
  RosterDrilldown,
  PmfDrilldown,
  ChallengeDrilldown,
  ObjectivesDrilldown,
  SalesStageDrilldown,
  RevenueDrilldown,
  CapitalizationDrilldown,
  PmfParadoxDrilldown,
];

export default function CohortDrilldownModal({ cardIndex, open, onClose }: Props) {
  if (!open) return null;

  const info = CARD_TITLES[cardIndex] || { title: "Detail", subtitle: "" };
  const DrilldownContent = DRILLDOWNS[cardIndex];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={onClose}
      onKeyDown={e => e.key === "Escape" && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: "rgba(8,12,20,0.97)", backdropFilter: "blur(12px)" }} />
      {/* Modal */}
      <div
        className="relative w-full max-w-[900px] max-h-[80vh] rounded-2xl overflow-hidden animate-fade-in"
        style={{
          border: "1px solid rgba(99,102,241,0.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          background: "#0f172a",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div>
            <h3 className="text-lg font-bold text-white">{info.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{info.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors hover:rotate-90 transform duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: "calc(80vh - 72px)" }}>
          {DrilldownContent && <DrilldownContent />}
        </div>
      </div>
    </div>
  );
}
