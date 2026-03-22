export interface Company {
  name: string;
  sector: string;
  table: number;
  revenue: string;
  cap: string;
  salesStage: string;
  pmf: boolean;
  primaryMarket: string;
  employees: string;
}

export const COMPANIES: Company[] = [
  { name: "Overmatch", sector: "GovTech", table: 1, revenue: "<$250K", cap: "None", salesStage: "Founder-Led", pmf: false, primaryMarket: "Government", employees: "1-5" },
  { name: "Agentic Defense", sector: "GovTech/Cyber", table: 1, revenue: "<$250K", cap: "None", salesStage: "Founder-Led", pmf: true, primaryMarket: "Defense", employees: "1-5" },
  { name: "Transcend", sector: "GovTech", table: 1, revenue: "<$250K", cap: "Pre-Seed", salesStage: "Refining", pmf: true, primaryMarket: "Government", employees: "1-5" },
  { name: "SUSA", sector: "Cyber", table: 1, revenue: "<$250K", cap: "None", salesStage: "Founder-Led", pmf: false, primaryMarket: "Government", employees: "1-5" },
  { name: "Hilltop", sector: "GovTech", table: 1, revenue: "<$250K", cap: "Pre-Seed", salesStage: "Founder-Led", pmf: true, primaryMarket: "Telecom/Gov", employees: "1-5" },
  { name: "Axiad", sector: "Cyber", table: 2, revenue: "$11M-$20M", cap: "Other", salesStage: "Team-Led", pmf: true, primaryMarket: "Enterprise", employees: "51-100" },
  { name: "Trava Security", sector: "Cyber", table: 2, revenue: "$2M-$5M", cap: "Other", salesStage: "Team-Led", pmf: true, primaryMarket: "SMB", employees: "25-50" },
  { name: "IntelliGRC", sector: "Cyber", table: 2, revenue: "$2M-$5M", cap: "Seed", salesStage: "Building Repeatable", pmf: true, primaryMarket: "Enterprise", employees: "6-25" },
  { name: "SEVII", sector: "Cyber", table: 2, revenue: "$501K-$1M", cap: "Pre-Seed", salesStage: "Building Repeatable", pmf: true, primaryMarket: "Enterprise", employees: "25-50" },
  { name: "Brightlines", sector: "Cyber", table: 2, revenue: "$2M-$5M", cap: "Other", salesStage: "Refining", pmf: true, primaryMarket: "Enterprise", employees: "6-25" },
  { name: "DEVSEC", sector: "Cyber", table: 2, revenue: "$501K-$1M", cap: "None", salesStage: "Founder-Led", pmf: true, primaryMarket: "Enterprise", employees: "6-25" },
  { name: "Carte Medical", sector: "HealthTech", table: 3, revenue: "<$250K", cap: "None", salesStage: "Founder-Led", pmf: false, primaryMarket: "Healthcare", employees: "1-5" },
  { name: "VEA", sector: "HealthTech", table: 3, revenue: "<$250K", cap: "Pre-Seed", salesStage: "Refining", pmf: true, primaryMarket: "Veterinary", employees: "1-5" },
  { name: "Evra Health", sector: "HealthTech", table: 3, revenue: "<$250K", cap: "Pre-Seed", salesStage: "Founder-Led", pmf: true, primaryMarket: "Healthcare", employees: "1-5" },
  { name: "UCleaner", sector: "Life Sciences", table: 3, revenue: "<$250K", cap: "Pre-Seed", salesStage: "Founder-Led", pmf: false, primaryMarket: "Healthcare", employees: "1-5" },
  { name: "NextStep Robotics", sector: "HealthTech", table: 3, revenue: "<$250K", cap: "Seed", salesStage: "Refining", pmf: false, primaryMarket: "Healthcare", employees: "25-50" },
  { name: "Nasoni", sector: "HealthTech", table: 3, revenue: "$2M-$5M", cap: "Seed", salesStage: "Founder-Led", pmf: false, primaryMarket: "Healthcare", employees: "6-25" },
  { name: "Drogue", sector: "Deep Tech", table: 4, revenue: "<$250K", cap: "Pre-Seed", salesStage: "Founder-Led", pmf: false, primaryMarket: "Energy", employees: "1-5" },
  { name: "Torev Motors", sector: "Deep Tech", table: 4, revenue: "<$250K", cap: "Seed", salesStage: "Founder-Led", pmf: false, primaryMarket: "Automotive", employees: "1-5" },
  { name: "Quantum Catalyzer", sector: "Deep Tech", table: 4, revenue: "$501K-$1M", cap: "Pre-Seed", salesStage: "Founder-Led", pmf: true, primaryMarket: "Deep Tech", employees: "1-5" },
  { name: "YYZdata", sector: "Deep Tech", table: 4, revenue: "<$250K", cap: "Pre-Seed", salesStage: "Founder-Led", pmf: true, primaryMarket: "Automotive", employees: "1-5" },
  { name: "Buckstop", sector: "Deep Tech", table: 4, revenue: "<$250K", cap: "Pre-Seed", salesStage: "Founder-Led", pmf: true, primaryMarket: "Energy", employees: "1-5" },
  { name: "Floraponics", sector: "Life Sciences", table: 4, revenue: "<$250K", cap: "Pre-Seed", salesStage: "Building Repeatable", pmf: true, primaryMarket: "Agriculture", employees: "1-5" },
  { name: "Aluvi", sector: "FinTech", table: 5, revenue: "<$250K", cap: "Pre-Seed", salesStage: "Founder-Led", pmf: false, primaryMarket: "Sales Tech", employees: "1-5" },
  { name: "Chordia", sector: "FinTech", table: 5, revenue: "<$250K", cap: "Pre-Seed", salesStage: "Founder-Led", pmf: true, primaryMarket: "Finance", employees: "1-5" },
  { name: "GELDO", sector: "FinTech", table: 5, revenue: "<$250K", cap: "Seed", salesStage: "Founder-Led", pmf: true, primaryMarket: "Insurance", employees: "1-5" },
  { name: "Experio Labs", sector: "B2B SaaS", table: 5, revenue: "<$250K", cap: "Other", salesStage: "Founder-Led", pmf: false, primaryMarket: "Professional Services", employees: "1-5" },
  { name: "Fairway to Green", sector: "B2B SaaS", table: 5, revenue: "<$250K", cap: "None", salesStage: "Founder-Led", pmf: true, primaryMarket: "Sports/Media", employees: "1-5" },
  { name: "Brandi AI", sector: "MarTech", table: 6, revenue: "$501K-$1M", cap: "None", salesStage: "Refining", pmf: true, primaryMarket: "Marketing", employees: "6-25" },
  { name: "Cliquify", sector: "MarTech", table: 6, revenue: "$501K-$1M", cap: "Pre-Seed", salesStage: "Refining", pmf: true, primaryMarket: "Advertising", employees: "25-50" },
  { name: "NextMinder", sector: "MarTech", table: 6, revenue: "$251K-$500K", cap: "Pre-Seed", salesStage: "Founder-Led", pmf: true, primaryMarket: "Marketing", employees: "25-50" },
  { name: "GUDEA", sector: "MarTech", table: 6, revenue: "$2M-$5M", cap: "Seed", salesStage: "Building Repeatable", pmf: true, primaryMarket: "Advertising", employees: "6-25" },
  { name: "Yo-Do Software", sector: "Consumer Tech", table: 6, revenue: "<$250K", cap: "Seed", salesStage: "Founder-Led", pmf: true, primaryMarket: "Tourism", employees: "1-5" },
  { name: "Syntes AI", sector: "MarTech", table: 6, revenue: "$251K-$500K", cap: "None", salesStage: "Team-Led", pmf: true, primaryMarket: "Retail", employees: "6-25" },
  { name: "Shift Group", sector: "HRTech", table: 7, revenue: "$2M-$5M", cap: "Seed", salesStage: "Building Repeatable", pmf: true, primaryMarket: "HR/Staffing", employees: "25-50" },
  { name: "Crux", sector: "HRTech", table: 7, revenue: "<$250K", cap: "Pre-Seed", salesStage: "Refining", pmf: true, primaryMarket: "HR/Staffing", employees: "25-50" },
  { name: "TERN Mentoring", sector: "EdTech", table: 7, revenue: "<$250K", cap: "Pre-Seed", salesStage: "Refining", pmf: true, primaryMarket: "Education", employees: "1-5" },
  { name: "Little Arms Studios", sector: "EdTech", table: 7, revenue: "$501K-$1M", cap: "Pre-Seed", salesStage: "Building Repeatable", pmf: true, primaryMarket: "Education", employees: "25-50" },
  { name: "Glue Up", sector: "B2B SaaS", table: 7, revenue: "$6M-$10M", cap: "Series B", salesStage: "Team-Led", pmf: true, primaryMarket: "Associations", employees: "51-100" },
  { name: "Scout Space", sector: "Deep Tech", table: 8, revenue: "$2M-$5M", cap: "Seed", salesStage: "Team-Led", pmf: true, primaryMarket: "Aerospace", employees: "25-50" },
  { name: "Teleworker", sector: "B2B SaaS", table: 8, revenue: "$251K-$500K", cap: "Pre-Seed", salesStage: "Building Repeatable", pmf: true, primaryMarket: "Construction", employees: "6-25" },
  { name: "Kinnami Software", sector: "Deep Tech", table: 8, revenue: "$2M-$5M", cap: "Pre-Seed", salesStage: "Refining", pmf: false, primaryMarket: "Infrastructure", employees: "25-50" },
  { name: "Meibel", sector: "Deep Tech", table: 8, revenue: "$251K-$500K", cap: "Seed", salesStage: "Refining", pmf: false, primaryMarket: "Horizontal", employees: "25-50" },
  { name: "Revolution Cooking", sector: "Consumer Tech", table: 8, revenue: "$6M-$10M", cap: "Seed", salesStage: "Building Repeatable", pmf: true, primaryMarket: "Food/Consumer", employees: "6-25" },
  { name: "Tigeraire", sector: "Consumer Tech", table: 8, revenue: "$251K-$500K", cap: "Seed", salesStage: "Refining", pmf: true, primaryMarket: "Retail", employees: "1-5" },
];

export const SECTOR_COLORS: Record<string, string> = {
  "GovTech": "#14b8a6",
  "GovTech/Cyber": "#14b8a6",
  "Cyber": "#6366f1",
  "HealthTech": "#10b981",
  "Life Sciences": "#10b981",
  "Deep Tech": "#8b5cf6",
  "MarTech": "#f59e0b",
  "FinTech": "#3b82f6",
  "HRTech": "#f43f5e",
  "EdTech": "#f43f5e",
  "Consumer Tech": "#f97316",
  "B2B SaaS": "#94a3b8",
};

export const CAP_COLORS: Record<string, string> = {
  "None": "#64748b",
  "Pre-Seed": "#8b5cf6",
  "Seed": "#6366f1",
  "Other": "#a855f7",
  "Series B": "#10b981",
};

export const STAGE_COLORS: Record<string, string> = {
  "Founder-Led": "#f43f5e",
  "Refining": "#f59e0b",
  "Building Repeatable": "#14b8a6",
  "Team-Led": "#22c55e",
};

export const REVENUE_ORDER = ["<$250K", "$251K-$500K", "$501K-$1M", "$2M-$5M", "$6M-$10M", "$11M-$20M"];
export const STAGE_ORDER = ["Founder-Led", "Refining", "Building Repeatable", "Team-Led"];
export const CAP_ORDER = ["None", "Pre-Seed", "Seed", "Other", "Series B"];

export function getSectorColor(sector: string): string {
  return SECTOR_COLORS[sector] || "#94a3b8";
}

export function getWhyItMatters(sector: string): string {
  if (sector.includes("GovTech")) return "Long gov sales cycles may mask real PMF signal";
  if (sector.includes("Cyber")) return "Enterprise deals need team selling";
  if (sector.includes("Health") || sector.includes("Life")) return "Regulatory complexity requires process, not heroics";
  if (sector.includes("FinTech") || sector.includes("SaaS")) return "Repeatable motion is the next unlock";
  return "Founder dependency is the growth ceiling";
}
