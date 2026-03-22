export const CANONICAL_FIELDS = [
  "company_name", "first_name", "last_name", "email",
  "company_description", "company_address", "city", "state_province",
  "zip_postal_code", "country",
  "dmv_area",
  "sector", "primary_market", "business_type", "customer_type", "icp",
  "employee_count", "revenue", "capital_raised", "last_round",
  "has_pmf", "sales_stage", "sales_leadership_area",
  "need_networking", "need_trends", "need_partners", "need_opportunities", "need_mentorship",
  "topics_of_interest", "critical_challenges", "additional_info",
];

export const FIELD_ALIASES: Record<string, string[]> = {
  company_name: ["company name", "companyname", "company"],
  first_name: ["first name", "firstname", "first"],
  last_name: ["last name", "lastname", "last"],
  email: ["email", "e-mail", "emailaddress"],
  company_description: ["company description", "description", "companydescription"],
  company_address: ["company address", "companyaddress", "address"],
  city: ["city"],
  state_province: ["state/province", "stateprovince", "state", "province"],
  zip_postal_code: ["zip/postal code", "zippostalcode", "zip", "postalcode", "zipcode"],
  country: ["country (company address)", "country", "countrycompanyaddress"],
  dmv_area: ["where are you based in the dmv area", "dmv area", "dmvarea", "dmv"],
  sector: ["sector", "industry"],
  primary_market: ["primary market served", "primarymarketserved", "primarymarket", "primary market"],
  business_type: ["business type", "businesstype"],
  customer_type: ["customer type", "customertype"],
  icp: ["icp"],
  employee_count: ["# employees", "employees", "employeecount", "employee count", "numemployees"],
  revenue: ["revenue", "revenueband", "revenue band"],
  capital_raised: ["capital raised", "capitalraised"],
  last_round: ["last round raised", "lastroundraised", "lastround", "last round"],
  has_pmf: ["product / market fit?", "productmarketfit", "has pmf", "product market fit", "pmf"],
  sales_stage: ["sales stage", "salesstage"],
  sales_leadership_area: ["which area of sales leadership do you want to improve the most", "salesleadershiparea", "sales leadership"],
  need_networking: ["networking (what are your main professional objectives", "networking", "neednetworking"],
  need_trends: ["discovering industry trends", "needtrends", "industry trends"],
  need_partners: ["finding business partners", "needpartners", "business partners"],
  need_opportunities: ["finding business opportunities", "needopportunities", "business opportunities"],
  need_mentorship: ["mentorship (what are your main professional objectives", "mentorship", "needmentorship"],
  topics_of_interest: ["what topics are you most interested in learning about", "topicsofinterest", "topics of interest", "topics"],
  critical_challenges: ["what are your most critical challenges", "criticalchallenges", "critical challenges", "challenges"],
  additional_info: ["is there any thing additional you would like to add", "additionalinfo", "additional info", "additional"],
};

export function fuzzyMatchHeader(header: string, canonicalFields: string[]): string | null {
  const normalized = header.toLowerCase().replace(/[\s_\-\/\?\(\)#,.'"]+/g, " ").trim();
  const collapsed = normalized.replace(/\s+/g, "");
  for (const field of canonicalFields) {
    const aliases = FIELD_ALIASES[field] || [field.replace(/_/g, " ")];
    for (const alias of aliases) {
      const aliasCollapsed = alias.replace(/[\s_\-\/\?\(\)#,.'"]+/g, "");
      if (collapsed === aliasCollapsed) return field;
      if (collapsed.startsWith(aliasCollapsed) && aliasCollapsed.length >= 6) return field;
      if (aliasCollapsed.startsWith(collapsed) && collapsed.length >= 6) return field;
    }
  }
  return null;
}

export function autoMapHeaders(headers: string[]): Record<string, string> {
  const autoMap: Record<string, string> = {};
  CANONICAL_FIELDS.forEach((field) => {
    for (const h of headers) {
      const match = fuzzyMatchHeader(h, [field]);
      if (match) {
        autoMap[field] = h;
        break;
      }
    }
  });
  return autoMap;
}
