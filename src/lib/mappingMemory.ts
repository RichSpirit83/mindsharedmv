// Persists user-confirmed CSV header → canonical field mappings in localStorage
// so future imports auto-fill known headers without manual re-mapping.

const MEMORY_VERSION_KEY = "mapping_memory_version";
const CURRENT_VERSION = 2;

/**
 * Aggressive header normalizer: NFKD-normalize, strip diacritics, lowercase,
 * and drop ALL non-alphanumeric characters. This collapses straight + curly
 * quotes, every dash variant, brackets, colons, NBSP, em-spaces, etc., to
 * the same key — so headers that look identical to a human always match.
 */
function normalizeHeader(header: string): string {
  return header
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
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
 * One-time migration: re-key every stored entry through the new (broader)
 * normalizer. Old keys saved under the narrow normalizer would otherwise
 * silently miss matches. Runs at most once per browser.
 */
function migrateIfNeeded(storageKey: string): void {
  try {
    const versionRaw = localStorage.getItem(MEMORY_VERSION_KEY);
    const version = versionRaw ? parseInt(versionRaw, 10) : 0;
    if (version >= CURRENT_VERSION) return;

    const memory = read(storageKey);
    if (Object.keys(memory).length === 0) {
      // Still bump version so we don't keep checking
      localStorage.setItem(MEMORY_VERSION_KEY, String(CURRENT_VERSION));
      return;
    }
    const migrated: Record<string, string> = {};
    for (const [oldKey, field] of Object.entries(memory)) {
      // The old key was already a normalized string — re-normalize it under
      // the new rules. For values that were already alphanumeric this is a
      // no-op; for keys still containing curly quotes / dashes / etc. it
      // collapses them to the new canonical form.
      const newKey = normalizeHeader(oldKey);
      if (!newKey) continue;
      // First write wins — fine, since collisions mean truly equivalent headers
      if (!migrated[newKey]) migrated[newKey] = field;
    }
    write(storageKey, migrated);
    localStorage.setItem(MEMORY_VERSION_KEY, String(CURRENT_VERSION));
  } catch {
    // ignore
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
  migrateIfNeeded(storageKey);
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
 *
 * Pruning rules:
 *  - Headers present in this CSV but explicitly UNMAPPED (value="") are
 *    removed from memory, so we don't keep auto-mapping them back.
 *  - Stale entries pointing at a canonical field that the user has now
 *    re-assigned to a different header (within this CSV's headers) are
 *    removed, so old associations don't hijack future imports.
 */
export function rememberMapping(
  storageKey: string,
  mapping: Record<string, string>,
  csvHeaders: string[]
): void {
  migrateIfNeeded(storageKey);
  const memory = read(storageKey);
  const headerSet = new Set(csvHeaders);
  const normalizedHeaderSet = new Set(csvHeaders.map(normalizeHeader));

  // Fields that the user actively assigned to a header in THIS CSV
  const activeFields = new Set<string>();
  const activeHeaderKeys = new Set<string>();
  for (const [field, header] of Object.entries(mapping)) {
    if (header && headerSet.has(header)) {
      activeFields.add(field);
      activeHeaderKeys.add(normalizeHeader(header));
    }
  }

  // Prune stale entries
  for (const [key, field] of Object.entries(memory)) {
    // 1. If this CSV contains a header equivalent to `key` but the user
    //    explicitly unmapped it (no entry in activeHeaderKeys), forget it.
    if (normalizedHeaderSet.has(key) && !activeHeaderKeys.has(key)) {
      delete memory[key];
      continue;
    }
    // 2. If the user has reassigned this canonical field to a DIFFERENT
    //    header in the current CSV, drop the stale association.
    if (activeFields.has(field) && !activeHeaderKeys.has(key)) {
      delete memory[key];
    }
  }

  // Write the new pairs
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
  migrateIfNeeded(storageKey);
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
