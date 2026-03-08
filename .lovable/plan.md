

## Plan: Fix Briefing Generation, PDF Extraction, and Add Back Navigation

### Issues Identified

**1. Briefing generation fails ("Failed to send a request")** — The network logs show the request payloads are massive (full ICP descriptions running thousands of characters per company). The requests fail with "Load failed" before the edge function even processes them. Fix: trim company data to only essential fields before sending to the edge function, and generate briefings sequentially (not all at once) to avoid rate limiting.

**2. PDF extraction fails** — `file.text()` reads a PDF as raw binary, producing garbled text. PDFs are binary files — you can't just call `.text()` on them. Fix: use the browser's FileReader to read the PDF as an ArrayBuffer, then extract text client-side using a lightweight approach (read the raw bytes for ASCII text extraction as a basic fallback), OR send the raw base64 to the edge function and use a Deno PDF library there. The simplest reliable fix: read as base64, send to the edge function, and have the AI work with whatever text is extractable.

**3. Missing back button** — Add back navigation to the LeadBriefings page header.

### Changes

**File: `src/pages/admin/LeadBriefings.tsx`**
- Add a back button (ArrowLeft icon + `useNavigate`) in the header, linking back to the matching workspace
- Trim company data before sending to edge function: only send `company_name`, `first_name`, `last_name`, `sector`, `sales_stage`, `revenue`, `capital_raised`, `critical_challenges` (first 200 chars), and `company_description` (first 150 chars)
- Change "Generate All" to generate briefings sequentially with a small delay between each, not all in parallel

**File: `src/pages/admin/SessionConfig.tsx`**
- Fix PDF upload: read file as ArrayBuffer, convert to base64, send base64 to edge function instead of garbled `.text()` output

**File: `supabase/functions/parse-lead-pdf/index.ts`**
- Accept `pdfBase64` parameter (in addition to `pdfText`)
- Decode base64, extract readable ASCII strings from the binary data (simple byte scanning for printable text runs)
- Send extracted text to AI for structured parsing

**File: `supabase/functions/generate-briefing/index.ts`**
- Add a safety trim: truncate the entire prompt to stay under token limits
- The company trimming on the client side should already fix the payload size issue

