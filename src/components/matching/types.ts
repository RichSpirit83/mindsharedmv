export interface FounderRow {
  id: string; // founder_pool.id
  rsvp_id: string; // breakout_rsvps.id
  company_name: string;
  first_name: string | null;
  last_name: string | null;
  sector: string[];
  revenue: string | null;
  capital_raised: string | null;
  manual_table_override: string | null;
  raw_data?: Record<string, any>;
  mapped_data?: Record<string, any>;
}

export interface LeadRow {
  id: string;
  name: string;
  title?: string | null;
  company?: string | null;
  expertise_tags?: string[];
}

export interface TableRow {
  id: string;
  table_number: number;
  table_name?: string | null;
  lead?: LeadRow | null;
}

export interface AssignmentRow {
  founderId: string;
  tableId: string | null;
  leadId: string | null;
  warnings: string[];
  locked?: boolean;
}
