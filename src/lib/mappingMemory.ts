// Persists user-confirmed CSV header → canonical field mappings in localStorage
// so future imports auto-fill known headers without manual re-mapping.

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_\-\/\?\(\)#,.'"]+/g, "").trim();
}

function read(storageKey: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(storageKey: string, data: Record<string, string>): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // ignore quota / unavailable storage
  }
}

/**
 * Returns a mapping of `{ canonicalField: csvHeader }` built from remembered
 * header→field associations, restricted to headers present in this CSV.
 */
export function getRememberedMapping(
  storageKey: string,
  csvHeaders: string[]
): Record<string, string> {
  const memory = read(storageKey);
  const result: Record<string, string> = {};
  for (const header of csvHeaders) {
    const field = memory[normalizeHeader(header)];
    if (field && !result[field]) {
      result[field] = header;
    }
  }
  return result;
}

/**
 * Persists each confirmed `{ canonicalField: csvHeader }` pair as
 * `{ normalizedHeader: canonicalField }` so future imports recognize it.
 * Only saves entries where the csvHeader is actually present in csvHeaders.
 */
export function rememberMapping(
  storageKey: string,
  mapping: Record<string, string>,
  csvHeaders: string[]
): void {
  const memory = read(storageKey);
  const headerSet = new Set(csvHeaders);
  for (const [field, header] of Object.entries(mapping)) {
    if (!header || !headerSet.has(header)) continue;
    memory[normalizeHeader(header)] = field;
  }
  write(storageKey, memory);
}

export function clearMappingMemory(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

/**
 * Returns the set of canonical fields whose current mapping value matches
 * what's in remembered memory — useful for showing a "Remembered" badge.
 */
export function getRememberedFields(
  storageKey: string,
  mapping: Record<string, string>
): Set<string> {
  const memory = read(storageKey);
  const remembered = new Set<string>();
  for (const [field, header] of Object.entries(mapping)) {
    if (!header) continue;
    if (memory[normalizeHeader(header)] === field) {
      remembered.add(field);
    }
  }
  return remembered;
}

export const FOUNDER_MAPPING_MEMORY_KEY = "founder_mapping_memory_v1";
export const LEAD_MAPPING_MEMORY_KEY = "lead_mapping_memory_v1";
