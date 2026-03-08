

## Issues Found

### 1. LinkedIn Data Pull Doesn't Work
The edge function extracts the username from the URL (e.g., `adeleke` from `linkedin.com/in/adeleke/`) and runs two Firecrawl searches. The problem: the search query `"adeleke" site:linkedin.com/in/adeleke` returns *other* people named Adeleke (Fagbohun, Adesida, etc.) rather than the actual profile owner. The username alone is too ambiguous and the search doesn't target the exact profile URL.

**Fix**: Instead of searching, use **Firecrawl's scrape endpoint on the full LinkedIn URL**. Wait -- scraping LinkedIn directly returned a 403. So the alternative is to use Firecrawl's search more precisely: search for the *exact URL* as the query string, e.g. `"linkedin.com/in/adeleke"`, and also use the `scrapeOptions` parameter to get markdown content from the results. If the first result's URL matches the target profile, use that data. As a fallback, pass all collected text to the Lovable AI gateway to extract structured profile info (name, title, expertise) instead of relying on brittle regex parsing.

**Revised approach**: Use AI (Lovable gateway) to parse the search results into structured data. This will be far more accurate than regex:
- Keep the dual Firecrawl search (LinkedIn-specific + web)
- Send the aggregated text to an AI model via the Lovable gateway
- Use tool calling to get structured output: `{ name, headline, expertiseTags, networkStrengths, notes }`

### 2. Matching Engine Doesn't Work
The "Generate Matches" button in `MatchingWorkspace.tsx` has **no onClick handler** and no generation logic. It's just a disabled button with no function wired to it. The matching engine needs to be built.

**Fix**: Create a new edge function `generate-matches` that:
- Takes the company list, session config (numTables, targetPerTable, groupingPriority, leads), and column mapping
- Calls the Lovable AI gateway to produce optimized table groupings
- Returns structured `TableGroup[]` data

Wire the button in `MatchingWorkspace.tsx` to call this edge function and populate the tables state.

---

## Plan

### A. Fix LinkedIn Import (scrape-linkedin edge function)

Replace the regex-based parsing with AI-powered extraction:
1. Keep the two parallel Firecrawl searches (LinkedIn-specific + web presence)
2. Aggregate all text from results
3. Call Lovable AI gateway (`google/gemini-3-flash-preview`) with tool calling to extract: `name`, `headline`, `expertiseTags` (array), `networkStrengths`, `notes`
4. Return the AI-extracted data

### B. Build Matching Engine

**New file: `supabase/functions/generate-matches/index.ts`**
- Accepts: `{ companies, sessionConfig, leads }` 
- Sends company data + config to Lovable AI gateway
- Uses tool calling to return structured `TableGroup[]` with table assignments
- Returns the grouped tables

**Edit: `src/pages/admin/MatchingWorkspace.tsx`**
- Add `generateMatches` async function that invokes the `generate-matches` edge function
- Wire "Generate Matches" button's `onClick` to call it
- Wire "Regenerate All" button similarly
- Pass full CSV row data (not just the mapped chips) to the edge function so AI has all context for matching

