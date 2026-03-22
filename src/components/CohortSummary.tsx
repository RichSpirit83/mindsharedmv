import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Building2, DollarSign, TrendingUp, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CohortSummaryProps {
  csvData: Record<string, string>[];
  columnMapping: Record<string, string>;
}

function countBy(arr: string[]): { name: string; value: number }[] {
  const map: Record<string, number> = {};
  arr.forEach((v) => {
    const key = (v || "").trim();
    if (key) map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function getCol(row: Record<string, string>, mapping: Record<string, string>, field: string): string {
  const header = mapping[field];
  return header ? (row[header] || "").trim() : "";
}

export default function CohortSummary({ csvData, columnMapping }: CohortSummaryProps) {
  const [open, setOpen] = useState(true);

  const stats = useMemo(() => {
    if (!csvData.length) return null;

    const sectors = csvData.map((r) => getCol(r, columnMapping, "sector"));
    const revenues = csvData.map((r) => getCol(r, columnMapping, "revenue"));
    const capitalRaised = csvData.map((r) => getCol(r, columnMapping, "capital_raised"));
    const stages = csvData.map((r) => getCol(r, columnMapping, "sales_stage"));
    const states = csvData.map((r) => getCol(r, columnMapping, "state_province"));
    const cities = csvData.map((r) => getCol(r, columnMapping, "city"));

    const sectorDist = countBy(sectors);
    const revenueDist = countBy(revenues);
    const capitalDist = countBy(capitalRaised);
    const stageDist = countBy(stages);

    const uniqueSectors = new Set(sectors.filter(Boolean)).size;
    const uniqueGeo = new Set([...states, ...cities].filter(Boolean)).size;
    const topStage = stageDist[0]?.name || "N/A";
    const topSector = sectorDist[0]?.name || "N/A";
    const topSectorPct = sectorDist[0] ? Math.round((sectorDist[0].value / csvData.length) * 100) : 0;
    const topRevenue = revenueDist[0]?.name || "N/A";
    const topRevenuePct = revenueDist[0] ? Math.round((revenueDist[0].value / csvData.length) * 100) : 0;
    const topCapital = capitalDist[0]?.name || "N/A";
    const topCapitalPct = capitalDist[0] ? Math.round((capitalDist[0].value / csvData.length) * 100) : 0;

    return {
      total: csvData.length,
      uniqueSectors,
      uniqueGeo,
      topStage,
      topSector, topSectorPct, sectorDist,
      topRevenue, topRevenuePct, revenueDist,
      topCapital, topCapitalPct, capitalDist,
    };
  }, [csvData, columnMapping]);

  if (!stats) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-lg">Cohort Executive Summary</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          {/* Written Summary */}
          <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed text-foreground">
            This cohort comprises <Kpi>{stats.total} companies</Kpi> spanning <Kpi>{stats.uniqueSectors} sectors</Kpi> across <Kpi>{stats.uniqueGeo} locations</Kpi>.
            {stats.topSector !== "N/A" && <> The dominant sector is <Kpi>{stats.topSector}</Kpi>, representing <Kpi>{stats.topSectorPct}%</Kpi> of the cohort.</>}
            {stats.topStage !== "N/A" && <> Most founders are at the <Kpi>{stats.topStage}</Kpi> stage.</>}
            {stats.topRevenue !== "N/A" && <> The most common revenue band is <Kpi>{stats.topRevenue}</Kpi> (<Kpi>{stats.topRevenuePct}%</Kpi>).</>}
            {stats.topCapital !== "N/A" && <> The leading capital raised bracket is <Kpi>{stats.topCapital}</Kpi> (<Kpi>{stats.topCapitalPct}%</Kpi>).</>}
          </div>

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={Building2}
              label="Companies"
              value={stats.total}
            />
            <StatCard
              icon={DollarSign}
              label="Revenue Breakout"
              value={stats.topRevenue}
              sub={stats.revenueDist.slice(0, 3).map(d => `${d.name} (${d.value})`).join(", ")}
            />
            <StatCard
              icon={TrendingUp}
              label="Capital Raised"
              value={stats.topCapital}
              sub={stats.capitalDist.slice(0, 3).map(d => `${d.name} (${d.value})`).join(", ")}
            />
            <StatCard
              icon={Layers}
              label="Sector Breakout"
              value={stats.topSector}
              sub={stats.sectorDist.slice(0, 3).map(d => `${d.name} (${d.value})`).join(", ")}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-primary/10 p-1.5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="font-heading font-semibold text-base leading-tight">{String(value)}</p>
      {sub && <p className="text-[11px] text-muted-foreground leading-snug">{sub}</p>}
    </div>
  );
}

function Kpi({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-primary">{children}</span>;
}
