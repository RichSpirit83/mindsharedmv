import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Building2, Layers, TrendingUp, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

interface CohortSummaryProps {
  csvData: Record<string, string>[];
  columnMapping: Record<string, string>;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
];

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
    const stages = csvData.map((r) => getCol(r, columnMapping, "sales_stage"));
    const revenues = csvData.map((r) => getCol(r, columnMapping, "revenue"));
    const states = csvData.map((r) => getCol(r, columnMapping, "state_province"));
    const cities = csvData.map((r) => getCol(r, columnMapping, "city"));

    const sectorDist = countBy(sectors);
    const stageDist = countBy(stages);
    const revenueDist = countBy(revenues);
    const geoDist = countBy(states.length ? states : cities);

    // Needs analysis
    const needFields = ["need_networking", "need_trends", "need_partners", "need_opportunities", "need_mentorship"];
    const needLabels: Record<string, string> = {
      need_networking: "Networking",
      need_trends: "Trends",
      need_partners: "Partners",
      need_opportunities: "Opportunities",
      need_mentorship: "Mentorship",
    };
    const needsData = needFields.map((field) => {
      const vals = csvData.map((r) => getCol(r, columnMapping, field).toLowerCase());
      const yesCount = vals.filter((v) => v === "yes" || v === "true" || v === "1" || v === "y").length;
      return { name: needLabels[field] || field, value: yesCount };
    }).filter((d) => d.value > 0);

    const uniqueSectors = new Set(sectors.filter(Boolean)).size;
    const uniqueGeo = new Set([...states, ...cities].filter(Boolean)).size;
    const topStage = stageDist[0]?.name || "N/A";

    return {
      total: csvData.length,
      uniqueSectors,
      topStage,
      uniqueGeo,
      sectorDist: sectorDist.slice(0, 10),
      stageDist,
      revenueDist,
      geoDist: geoDist.slice(0, 8),
      needsData,
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
        <CardContent className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Building2} label="Companies" value={stats.total} />
            <StatCard icon={Layers} label="Sectors" value={stats.uniqueSectors} />
            <StatCard icon={TrendingUp} label="Top Stage" value={stats.topStage} />
            <StatCard icon={MapPin} label="Locations" value={stats.uniqueGeo} />
          </div>

          {/* Charts Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Sector Distribution */}
            {stats.sectorDist.length > 0 && (
              <MiniChart title="Sector Distribution">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.sectorDist} layout="vertical" margin={{ left: 80, right: 12, top: 4, bottom: 4 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={75} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </MiniChart>
            )}

            {/* Sales Stage Donut */}
            {stats.stageDist.length > 0 && (
              <MiniChart title="Sales Stage Breakdown">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={stats.stageDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9 }}>
                      {stats.stageDist.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </MiniChart>
            )}

            {/* Revenue Distribution */}
            {stats.revenueDist.length > 0 && (
              <MiniChart title="Revenue Distribution">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.revenueDist} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </MiniChart>
            )}

            {/* Needs Analysis Radar */}
            {stats.needsData.length > 0 && (
              <MiniChart title="Founder Needs Analysis">
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={stats.needsData} cx="50%" cy="50%" outerRadius={70}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis tick={{ fontSize: 9 }} />
                    <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </MiniChart>
            )}

            {/* Geography */}
            {stats.geoDist.length > 0 && (
              <MiniChart title="Geographic Spread">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.geoDist} layout="vertical" margin={{ left: 60, right: 12, top: 4, bottom: 4 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={55} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </MiniChart>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
      <div className="rounded-md bg-primary/10 p-2">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-heading font-semibold text-lg leading-tight">{String(value)}</p>
      </div>
    </div>
  );
}

function MiniChart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
      {children}
    </div>
  );
}
